import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { setBusy as setSwBusy } from 'virtual:pwa-register';
import type {
  UserProfile,
  AnySessionItem,
  ConjFact,
  ConjSessionItem,
  FactKind,
  SessionItem,
  SessionResult,
  SessionQuestionLog,
  Badge,
  BoxLevel,
} from './types';
import {
  FAST_THRESHOLD_MS,
  DIVISION_FAST_THRESHOLD_MS,
  REMAINDER_FAST_THRESHOLD_MS,
} from './types';
import { composeSession } from './lib/sessionComposer';
import { composeDailySession } from './lib/dailyComposer';
import { composeConjSession, isConjAccepted, type ConjJudgement } from './lib/conjugationComposer';
import { createInitialConjFacts } from './lib/conjugationFacts';
import { seedConjFromPlacement, type ConjPlacementResult } from './lib/conjugationPlacement';
import { processAnswer } from './lib/leitner';
import {
  checkBadges,
  getCompletedTables,
  getCompletedDivisionTables,
  getCompletedRemainderTables,
  isRule11Unlocked,
  isDivisionUnlocked,
  isRemainderUnlocked,
  isConjAvailable,
  isConjVisible,
  activeLevel,
} from './lib/badges';
import {
  loadProfile,
  loadProfileById,
  saveProfile,
  addProfile,
  deleteActiveProfile,
  setActiveProfile,
  listProfiles,
  getActiveProfileId,
  createNewProfile,
  exportProfile,
  importProfile,
} from './lib/storage';
import { getFactKey } from './lib/facts';
import { getDivisionFactKey } from './lib/divisionFacts';
import { getRemainderFactKey } from './lib/remainderFacts';
import { seedFromPlacement } from './lib/placement';
import type { PlacementResult } from './lib/placement';
import { todayISO } from './lib/utils';
import { applyStreakUpdate } from './lib/streak';
import { isStandalone, clearInstallSkipped } from './lib/install';
import { preflightMicPermission } from './lib/micPreflight';
import { syncLastSession } from './lib/push';
import { listWatched } from './lib/watchStore';
import type { WatchPairing } from './lib/watch';
import { isVoiceMode } from './hooks/useInputMode';
import { useLang } from './i18n/lang';
import { useAppStrings } from './i18n/app';
// Eager : parcours principal (onboarding + boucle quotidienne). Ces
// écrans sont hit par tout utilisateur, souvent plusieurs fois par jour
// (Session/Recap surtout) — pas de gain à les lazy-loader, et ça
// garderait les tests synchrones du parcours utilisateur.
//
// Note : pas d'écran "landing" dans App. La landing est servie en HTML
// statique directement écrit dans index.html (#static-landing) ; ses
// boutons sont wired par l'inline script à la fin de body. Quand App
// monte, on est déjà passé la landing (skip flag, profil, ou standalone).
import WelcomeScreen from './screens/WelcomeScreen';
import ProfileSelectScreen from './screens/ProfileSelectScreen';
import RulesIntroScreen from './screens/RulesIntroScreen';
import HomeScreen from './screens/HomeScreen';
import SessionScreen from './screens/SessionScreen';
import RecapScreen from './screens/RecapScreen';
// ProgressScreen est eager : c'est l'image mystère, la récompense tapée à la
// fin de CHAQUE séance (depuis le Recap), donc de facto dans la boucle
// quotidienne. La garder lazy faisait dépendre cette récompense d'un fetch de
// chunk au moment le plus fragile (fin de séance, enfant souvent sur un WiFi
// faible) → "Failed to fetch dynamically imported module" → écran de crash.
// En eager elle est dans le graphe initial, chargée au démarrage avec le shell.
import ProgressScreen from './screens/ProgressScreen';
// Lazy : écrans secondaires (consultation, parent, infos) — ouverts
// occasionnellement, leur coût parse/CPU au cold launch est gaspillé
// pour la majorité des sessions. Précachés par le SW → cache hit
// instantané quand l'utilisateur clique.
// ConjPlacementScreen est lazy : c'est un écran ONE-SHOT (le tout premier
// contact avec la matière conjugaison), hors boucle quotidienne, et fr-only —
// exactement le profil des écrans secondaires. Il tire tout le clavier de
// lettres et l'inventaire des sondes, qu'un utilisateur anglophone ne verra
// jamais.
const ConjPlacementScreen = lazy(() => import('./screens/ConjPlacementScreen'));
const BadgesScreen     = lazy(() => import('./screens/BadgesScreen'));
const RulesScreen      = lazy(() => import('./screens/RulesScreen'));
const ParentDashboard  = lazy(() => import('./screens/ParentDashboard'));
const PrivacyScreen    = lazy(() => import('./screens/PrivacyScreen'));
const ChangelogScreen  = lazy(() => import('./screens/ChangelogScreen'));

type Screen =
  | 'welcome'
  | 'profiles'
  | 'rulesIntro'
  | 'home'
  | 'conjPlacement'
  | 'session'
  | 'recap'
  | 'progress'
  | 'badges'
  | 'rules'
  | 'parent'
  | 'privacy'
  | 'changelog';

// Écran d'arrivée d'un profil donné (post-sélection ou post-import).
function profileHome(profile: UserProfile): Screen {
  return profile.hasSeenRulesIntro ? 'home' : 'rulesIntro';
}

function initialScreen(profile: UserProfile | null, profileCount: number): Screen {
  // Dès 2 profils sur l'appareil, le boot passe par « Qui joue ? » : on ne
  // devine jamais quel enfant tient la tablette. Mono-profil : parcours
  // inchangé, zéro friction ajoutée.
  if (profileCount > 1) return 'profiles';
  if (!profile) {
    // Aucun profil local mais au moins un enfant suivi à distance : l'appareil
    // est celui d'un parent (il a peut-être découvert Tablito en scannant le QR
    // de son enfant). Lui proposer l'onboarding enfant — prénom, test de
    // placement — serait un contresens : on ouvre son espace parent.
    return listWatched().length > 0 ? 'parent' : 'welcome';
  }
  return profileHome(profile);
}

// Écrans sans état mémoire précieux : un reload SW ou un retour forcé au
// choix du joueur n'y fait rien perdre. Partout ailleurs (séance, récap,
// navigation parent…), interrompre casserait le travail en cours.
function isDisposableScreen(screen: Screen): boolean {
  return screen === 'home' || screen === 'welcome' || screen === 'profiles';
}

// Retour au premier plan après une longue absence : sur une tablette
// familiale, l'enfant qui reprend l'app n'est souvent pas celui qui l'a
// laissée — et la PWA reste en mémoire des heures, donc le « Qui joue ? » du
// boot ne couvre pas ce cas. Au-delà de ce délai passé en arrière-plan, on
// repropose le choix du joueur. Sous le seuil (notification, aller-retour
// rapide), on ne touche à rien.
const RESHOW_PICKER_AFTER_HIDDEN_MS = 15 * 60 * 1000;

interface AppProps {
  // Issue d'un #transfer= présent au boot : 'imported' confirme que la
  // progression est bien arrivée (sans ça, l'utilisateur qui atterrit sur
  // l'accueil doute que le scan ait marché), 'error' signale l'échec (code
  // expiré, déjà consommé, hors-ligne…). Annoncé une fois, quel que soit
  // l'écran d'arrivée.
  transferResult?: 'imported' | 'error' | null;
  // Issu d'un #watch= présent au boot : le parent vient de scanner le QR de
  // l'appareil de son enfant. Déjà déchiffré par main.tsx, transmis tel quel à
  // l'espace parent pour un affichage immédiat.
  watchPairing?: WatchPairing | 'error' | null;
  // Vrai si le boot venait d'un clic sur la notification de recap hebdomadaire
  // (fragment RECAP_HASH, consommé par main.tsx comme les autres fragments).
  recapRequested?: boolean;
}

export default function App({
  transferResult = null,
  watchPairing = null,
  recapRequested = false,
}: AppProps) {
  const appStrings = useAppStrings();
  const [transferNotice, setTransferNotice] = useState(transferResult);
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile());
  // Un #watch= au boot signifie que le parent vient de scanner le QR de son
  // enfant : quoi qu'il y ait par ailleurs sur l'appareil, ce qu'il veut voir
  // est l'espace parent (même en cas d'échec — il peut y réessayer l'appairage).
  const [screen, setScreen] = useState<Screen>(() =>
    // Un #watch= au boot signifie un appairage ; #recap vient du clic sur la
    // notification hebdomadaire. Dans les deux cas c'est l'espace parent qu'on
    // veut, pas l'accueil de l'enfant.
    watchPairing || recapRequested ? 'parent' : initialScreen(profile, listProfiles().length),
  );
  // Pilote l'affichage du bouton « changer de joueur » sur Home et le retour
  // du Welcome « ajout d'un enfant ». Lu à chaque render : l'index est
  // minuscule et ne change que via des flows qui re-rendent déjà App.
  const profileCount = listProfiles().length;
  // Liste unifiée de la séance en cours : 100% multiplication avant déblocage,
  // mixte (division + entretien des tables) après (specs §11.6), ou 100%
  // conjugaison — une séance ne mélange jamais deux MATIÈRES (spec Verbito §7.2).
  const [sessionItems, setSessionItems] = useState<AnySessionItem[]>([]);
  // Quelle « saveur » de récap afficher (multiplication, division, division
  // avec reste, conjugaison) — pilote le nom affiché, le jalon surveillé et
  // l'image cible.
  const [recapMode, setRecapMode] = useState<FactKind>('mult');
  // Onglet ouvert à l'arrivée sur l'écran progression (« Mes images ») : sur
  // l'image du niveau de la séance quand on y va depuis le récap.
  const [progressView, setProgressView] = useState<FactKind>('mult');
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [newBadges, setNewBadges] = useState<Badge[]>([]);
  const [newlyCompletedTables, setNewlyCompletedTables] = useState<number[]>([]);
  // Vrai sur le récap de la séance où le 8e badge de table tombe : c'est le
  // moment du déblocage du niveau 2 (division), célébré une seule fois.
  const [divisionJustUnlocked, setDivisionJustUnlocked] = useState(false);
  // Idem pour le niveau 3 : 8e badge « Divisions par N » (specs §12.3).
  const [remainderJustUnlocked, setRemainderJustUnlocked] = useState(false);
  const [freezeJustUsed, setFreezeJustUsed] = useState(false);
  const [freezeJustEarned, setFreezeJustEarned] = useState(false);
  // Tracked in state so a date rollover (app left open past minuit) re-déclenche
  // les memos qui dépendent du jour courant (ex: disponibilité de la séance).
  const [today, setToday] = useState<string>(() => todayISO());

  // Track session stats for badge checking
  const sessionConsecutiveCorrect = useRef(0);
  const sessionMaxConsecutiveCorrect = useRef(0);
  const sessionQuestionLogs = useRef<SessionQuestionLog[]>([]);
  // A fact counts as "promoted" only if its final box ends strictly above the
  // one it started the session in (spec §3.5). This is what actually drives a
  // visible change on the mystery image (§5.1).
  const sessionInitialBoxes = useRef(new Map<string, BoxLevel>());
  const sessionPromoted = useRef(new Set<string>());

  // Snapshot of tables already mastered before the session starts
  const tablesCompletedBeforeSession = useRef<Set<number>>(new Set());
  const divisionTablesCompletedBeforeSession = useRef<Set<number>>(new Set());
  const remainderTablesCompletedBeforeSession = useRef<Set<number>>(new Set());

  // Skip the initial save-to-localStorage on mount
  const isInitialLoad = useRef(true);

  // Save profile to localStorage whenever it changes (skip initial load)
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    if (profile) {
      saveProfile(profile);
    }
  }, [profile]);

  // Si on tourne en standalone (PWA installée), le flag "skip" du navigateur
  // n'a plus d'utilité. On nettoie pour qu'un éventuel retour navigateur
  // (uninstall) reparte sur la landing.
  useEffect(() => {
    if (isStandalone()) clearInstallSkipped();
  }, []);

  // /mystery/* est exclu du précache SW (cf. scripts/build.mjs : install
  // lourd). On warm-cache les 5 niveaux dès qu'on connaît le thème, sinon
  // une carte qui passe en boîte 5 hors-ligne déclenche son 1er fetch et
  // affiche un blanc. Différé après idle + SW ready, sans quoi les fetches
  // partent avant l'activation du SW et n'atterrissent que dans le HTTP
  // cache — perdues à la prochaine cold launch hors-ligne.
  const theme = profile?.mysteryTheme;
  useEffect(() => {
    if (!theme) return;
    const base = import.meta.env.BASE_URL;
    const warmup = () => {
      navigator.serviceWorker?.ready.finally(() => {
        for (let level = 1; level <= 5; level++) {
          fetch(`${base}mystery/${theme}/level-${level}.png`).catch(() => {});
        }
      });
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warmup, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warmup, 1500);
    return () => window.clearTimeout(id);
  }, [theme]);

  // Reset le scroll à chaque changement d'écran. useLayoutEffect (synchrone,
  // pré-paint) plutôt que useEffect : avec useEffect, l'utilisateur voit
  // brièvement le nouvel écran avec l'ancien scroll, et si la nouvelle page
  // est plus courte que la précédente le navigateur clampe et on atterrit
  // tout en bas.
  //
  // On reset body ET documentElement : avec `html, body { height: 100% }` et
  // body en `overflow: auto`, c'est body qui scroll (pas window), donc
  // window.scrollTo n'a aucun effet — vérifié au Playwright. On garde aussi
  // documentElement par sécurité au cas où le contexte change.
  useLayoutEffect(() => {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, [screen]);

  // Signale au pwa-register si on est dans un écran "safe" pour appliquer
  // une mise à jour SW (= reload) — cf. isDisposableScreen. `welcome` est
  // inclus car une install neuve (sans profil) y reste bloquée — sans ça, ces
  // utilisateurs ne recevraient JAMAIS de mise à jour (ex. l'écran d'import
  // lui-même).
  const safeForReload = isDisposableScreen(screen);
  useEffect(() => {
    setSwBusy(!safeForReload);
  }, [safeForReload]);

  // Rafraîchir `today` quand l'app revient au premier plan : sans ça, un user
  // qui laisse l'app ouverte la nuit voit toujours "c'est fait pour aujourd'hui"
  // le lendemain car le memo ne se recalcule pas.
  useEffect(() => {
    const refresh = () => setToday((prev) => {
      const next = todayISO();
      return next === prev ? prev : next;
    });
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  // Repropose « Qui joue ? » au retour au premier plan après une longue
  // absence (cf. RESHOW_PICKER_AFTER_HIDDEN_MS), s'il y a plusieurs profils.
  // Uniquement depuis un écran sans état précieux (même notion que le reload
  // SW) : on n'interrompt jamais une séance, un récap ou une navigation
  // parent. Un ajout d'enfant laissé en plan > 15 min, lui, est périmé —
  // retour au choix du joueur, comme le ferait une mise à jour SW.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      const longAbsence =
        hiddenAt > 0 && Date.now() - hiddenAt >= RESHOW_PICKER_AFTER_HIDDEN_MS;
      hiddenAt = 0;
      if (!longAbsence || listProfiles().length < 2) return;
      setScreen((prev) => (isDisposableScreen(prev) ? 'profiles' : prev));
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Welcome: create new profile with optional placement test results.
  // addProfile persiste tout de suite sous un NOUVEL id (qui devient actif) :
  // sans ça, l'effet de sauvegarde écraserait le profil de l'enfant précédent
  // quand on ajoute un deuxième enfant.
  const handleWelcomeComplete = useCallback((name: string, placementResults: PlacementResult[]) => {
    const newProfile = createNewProfile(name);
    seedFromPlacement(newProfile.facts, placementResults, todayISO());
    addProfile(newProfile);
    setProfile(newProfile);
    setScreen('rulesIntro');
  }, []);

  // Sélection d'un joueur depuis l'écran « Qui joue ? ».
  const handleSelectProfile = useCallback((id: string) => {
    const selected = loadProfileById(id);
    if (!selected) return;
    setActiveProfile(id);
    setProfile(selected);
    setScreen(profileHome(selected));
  }, []);

  // « Ajouter un enfant » (depuis « Qui joue ? » ou l'espace parent) : on
  // rejoue l'onboarding Welcome complet, prénom + test de placement.
  const handleAddProfile = useCallback(() => setScreen('welcome'), []);

  // Annulation de l'ajout d'un enfant : même décision qu'au boot — choix du
  // joueur s'il y a plusieurs profils, sinon l'accueil de l'enfant actif.
  const handleWelcomeCancel = useCallback(() => {
    setScreen(initialScreen(profile, listProfiles().length));
  }, [profile]);

  const handleRulesIntroComplete = useCallback(() => {
    setProfile((prev) => (prev ? { ...prev, hasSeenRulesIntro: true } : prev));
    setScreen('home');
  }, []);

  // Règle bonus ×11 : on calcule l'état "débloqué" depuis le profil, et la
  // pastille "Nouveau" s'éteint dès la première visite de l'écran Règles
  // après le déblocage.
  const rule11Unlocked = useMemo(
    () => (profile ? isRule11Unlocked(profile) : false),
    [profile],
  );
  const hasNewRule = !!profile && rule11Unlocked && !profile.hasSeenRule11;

  const handleShowRules = useCallback(() => {
    setProfile((prev) => {
      if (!prev) return prev;
      if (!isRule11Unlocked(prev) || prev.hasSeenRule11) return prev;
      return { ...prev, hasSeenRule11: true };
    });
    setScreen('rules');
  }, []);

  // Séance du jour, un seul bouton (specs §11). Avant déblocage de la division :
  // 100% multiplication (parcours v1). Après : séance mixte composée par
  // composeDailySession — division + entretien des tables réellement dues
  // (§11.6), un seul écran de séance pour les deux.
  const divisionUnlocked = useMemo(
    () => (profile ? isDivisionUnlocked(profile) : false),
    [profile],
  );
  const remainderUnlocked = useMemo(
    () => (profile ? isRemainderUnlocked(profile) : false),
    [profile],
  );
  // Niveau de la séance du jour — composeDailySession branche lui-même sur le
  // niveau actif, on n'a besoin du mode que pour le récap et l'image cible.
  const sessionMode: 'mult' | 'div' | 'rem' = profile ? activeLevel(profile) : 'mult';
  // « Fait aujourd'hui » se compte PAR MATIÈRE : faire ses maths ne ferme pas
  // la conjugaison du jour, et réciproquement (spec Verbito §7.2). C'est
  // `lastSessionDate` — inchangé, toutes matières confondues — qui reste
  // l'ancre de la flamme de série, partagée.
  const sessionDone = !!profile && profile.lastMathSessionDate === today;
  const pendingItems = useMemo<SessionItem[]>(() => {
    if (!profile || sessionDone) return [];
    if (divisionUnlocked) return composeDailySession(profile, today);
    return composeSession(profile, today).map((q): SessionItem => ({ kind: 'mult', ...q }));
  }, [profile, sessionDone, divisionUnlocked, today]);
  const hasSessionAvailable = pendingItems.length > 0;

  // === Matière conjugaison (spec Verbito) ===
  // Disponibilité = langue d'interface française, point. Elle ne se débloque
  // pas par la progression : c'est une matière, pas un niveau.
  const { lang } = useLang();
  const conjAvailable = isConjAvailable(lang);
  const conjSessionDone = !!profile && profile.lastConjSessionDate === today;
  // Tant que le test de placement n'a pas été passé, la « séance du jour » de
  // la matière EST ce test (il enchaîne ensuite sur la première séance, §6.1).
  const conjNeedsPlacement = !!profile && conjAvailable && profile.hasDoneConjPlacement !== true;
  // Dépendances restreintes à ce que la composition LIT (cf. `ConjProfile`) :
  // sur `profile` entier, chaque réponse d'une séance de maths recomposait la
  // séance de conjugaison du jour.
  const conjFacts = profile?.conjFacts;
  const badges = profile?.badges;
  const conjPendingItems = useMemo<ConjSessionItem[]>(() => {
    if (!conjFacts || !badges || !conjAvailable || conjSessionDone || conjNeedsPlacement) return [];
    return composeConjSession({ conjFacts, badges }, today).map(
      (q): ConjSessionItem => ({ kind: 'conj', ...q }),
    );
  }, [conjFacts, badges, conjAvailable, conjSessionDone, conjNeedsPlacement, today]);
  const hasConjSessionAvailable =
    conjAvailable && !conjSessionDone && (conjNeedsPlacement || conjPendingItems.length > 0);
  // Matière ouverte au moins une fois : c'est ce qui allume ses onglets
  // transverses (images, badges, espace parent) et éteint la pastille de
  // découverte — révélation différée, pas de modale (§6.2).
  const conjVisible = !!profile && isConjVisible(profile, lang);

  // Remet à zéro les compteurs de séance.
  const resetSessionTracking = useCallback(() => {
    sessionConsecutiveCorrect.current = 0;
    sessionMaxConsecutiveCorrect.current = 0;
    sessionQuestionLogs.current = [];
    sessionInitialBoxes.current = new Map();
    sessionPromoted.current = new Set();
  }, []);

  // Démarre la séance du jour (multiplication ou mixte selon le déblocage).
  const handleStart = useCallback(async () => {
    if (!profile || pendingItems.length === 0) return;

    // En mode vocal, on attend la réponse au prompt micro avant d'entrer en
    // séance — sinon la première question (et son timer) démarrerait pendant
    // que l'utilisateur décide.
    if (isVoiceMode()) {
      await preflightMicPermission();
    }

    resetSessionTracking();
    // Snapshot des tables maîtrisées (célébration de complétion) — ×, ÷, reste.
    tablesCompletedBeforeSession.current = getCompletedTables(profile.facts);
    divisionTablesCompletedBeforeSession.current = getCompletedDivisionTables(
      profile.divisionFacts ?? [],
    );
    remainderTablesCompletedBeforeSession.current = getCompletedRemainderTables(
      profile.remainderFacts ?? [],
    );
    setSessionItems(pendingItems);
    setScreen('session');
  }, [profile, pendingItems, resetSessionTracking]);

  /**
   * Séance de conjugaison du jour. Premier appui de la vie du profil : on part
   * sur le test de placement (spec §6.1), qui enchaîne lui-même sur la première
   * séance. Dans tous les cas, l'appui marque la matière comme ouverte — c'est
   * ce qui éteint la pastille de découverte et fait apparaître ses onglets
   * (badges, images, espace parent).
   */
  const handleStartConj = useCallback(async () => {
    if (!profile || !conjAvailable) return;
    // Ensemencement des 63 faits À LA PREMIÈRE ENTRÉE, pas à la création du
    // profil : `conjFacts` absent veut dire « matière jamais commencée », et
    // les porter dans chaque profil coûtait ~6 Ko sérialisés à chaque réponse
    // de maths (cf. lib/storage).
    setProfile((prev) => {
      if (!prev) return prev;
      const seed = prev.conjFacts ? null : createInitialConjFacts();
      if (!seed && prev.hasSeenConjIntro) return prev;
      return { ...prev, hasSeenConjIntro: true, ...(seed ? { conjFacts: seed } : {}) };
    });
    if (conjNeedsPlacement) {
      // Le placement se fait au clavier, quel que soit le réglage de saisie : ses
      // sondes sont le premier contact avec la matière, ce n'est pas le moment de
      // faire dépendre la réassurance d'une reconnaissance vocale (§15.7).
      setScreen('conjPlacement');
      return;
    }
    if (conjPendingItems.length === 0) return;
    // Mode vocal épelé : on attend la réponse au prompt micro avant d'entrer en
    // séance, sinon la première question (et son chrono de rappel) démarrerait
    // pendant que l'utilisateur décide. Même geste que la séance de maths.
    if (isVoiceMode()) {
      await preflightMicPermission();
    }
    resetSessionTracking();
    setSessionItems(conjPendingItems);
    setScreen('session');
  }, [profile, conjAvailable, conjNeedsPlacement, conjPendingItems, resetSessionTracking]);

  /**
   * Fin du test de placement de la conjugaison. Le profil mis à jour est
   * calculé ICI plutôt que dans un updater `setProfile` : la première séance se
   * compose dans la foulée et doit voir les boîtes déjà ensemencées (même
   * geste qu'`handleWelcomeComplete` côté maths).
   */
  const handleConjPlacementComplete = useCallback(
    async (results: ConjPlacementResult[]) => {
      if (!profile) return;
      const now = todayISO();
      // Le placement est la porte d'entrée de la matière : c'est ici que les
      // 63 faits existent pour la première fois si `handleStartConj` ne les a
      // pas déjà ensemencés.
      const conjFacts = (profile.conjFacts ?? createInitialConjFacts()).map((f) => ({ ...f }));
      seedConjFromPlacement(conjFacts, results, now);
      const updated: UserProfile = {
        ...profile,
        conjFacts,
        hasDoneConjPlacement: true,
        hasSeenConjIntro: true,
      };
      setProfile(updated);

      const items = composeConjSession(updated, now).map(
        (q): ConjSessionItem => ({ kind: 'conj', ...q }),
      );
      if (items.length === 0) {
        setScreen('home');
        return;
      }
      // Le placement enchaîne DIRECTEMENT sur la première séance : en mode
      // vocal, la permission micro se demande donc ici aussi, sinon la première
      // question démarre pendant que l'utilisateur répond au prompt natif.
      if (isVoiceMode()) {
        await preflightMicPermission();
      }
      resetSessionTracking();
      setSessionItems(items);
      setScreen('session');
    },
    [profile, resetSessionTracking],
  );

  // Met à jour le suivi « fait promu » (boîte finale > boîte initiale dans la
  // séance), qui pilote le « ton image a changé » du récap (§3.5). Idempotent —
  // sûr sous la double-invocation strict-mode du reducer setProfile.
  const trackPromotion = useCallback(
    (key: string, currentBox: BoxLevel, newBox: BoxLevel) => {
      if (!sessionInitialBoxes.current.has(key)) {
        sessionInitialBoxes.current.set(key, currentBox);
      }
      const initialBox = sessionInitialBoxes.current.get(key)!;
      if (newBox > initialBox) {
        sessionPromoted.current.add(key);
      } else {
        sessionPromoted.current.delete(key);
      }
    },
    [],
  );

  // Réponse individuelle — un seul handler pour les deux types de question
  // (multiplication / division). Préambule commun (log + série de bonnes
  // réponses) ; la mise à jour Leitner branche sur le type (facts vs
  // divisionFacts) via le discriminant `kind`. Updater fonctionnel pour ne pas
  // lire un fait périmé lors des retries.
  const handleSessionItemAnswer = useCallback(
    (
      item: SessionItem,
      correct: boolean,
      timeMs: number,
      answered: number | null,
      inputMode: 'keypad' | 'voice',
      answeredRemainder?: number | null,
    ) => {
      const fastMs = (
        item.kind === 'rem'
          ? REMAINDER_FAST_THRESHOLD_MS
          : item.kind === 'div'
            ? DIVISION_FAST_THRESHOLD_MS
            : FAST_THRESHOLD_MS
      )[inputMode];

      sessionQuestionLogs.current.push({
        kind: item.kind,
        a: item.kind === 'mult' ? item.fact.a : item.fact.divisor,
        b: item.kind === 'mult' ? item.fact.b : item.fact.quotient,
        correct,
        responseTimeMs: timeMs,
        answeredWith: answered,
        ...(item.kind === 'rem' ? { remainder: item.remainder, answeredRemainder } : {}),
        isBonusReview: item.isBonusReview,
        inputMode,
        fast: correct && timeMs < fastMs,
      });

      if (correct) {
        sessionConsecutiveCorrect.current++;
        sessionMaxConsecutiveCorrect.current = Math.max(
          sessionMaxConsecutiveCorrect.current,
          sessionConsecutiveCorrect.current,
        );
      } else {
        sessionConsecutiveCorrect.current = 0;
      }

      // Révision bonus : feedback et stats seulement, pas de changement Leitner.
      if (item.isBonusReview) return;

      const today = todayISO();

      setProfile((prev) => {
        if (!prev) return prev;

        if (item.kind === 'rem') {
          if (!prev.remainderFacts) return prev;
          const { divisor, quotient } = item.fact;
          const current =
            prev.remainderFacts.find((f) => f.divisor === divisor && f.quotient === quotient) ??
            item.fact;
          const updated = processAnswer(current, correct, timeMs, today, inputMode, fastMs);
          if (updated.history.length > 0) {
            updated.history[updated.history.length - 1].answeredWith = answered;
          }
          if (!updated.introduced) updated.introduced = true;
          trackPromotion(getRemainderFactKey(divisor, quotient), current.box, updated.box);
          return {
            ...prev,
            remainderFacts: prev.remainderFacts.map((f) =>
              f.divisor === divisor && f.quotient === quotient ? updated : f,
            ),
          };
        }

        if (item.kind === 'div') {
          if (!prev.divisionFacts) return prev;
          const { dividend, divisor } = item.fact;
          const current =
            prev.divisionFacts.find((f) => f.dividend === dividend && f.divisor === divisor) ??
            item.fact;
          const updated = processAnswer(current, correct, timeMs, today, inputMode, fastMs);
          if (updated.history.length > 0) {
            updated.history[updated.history.length - 1].answeredWith = answered;
          }
          // Pas d'`introducedAt` côté division : pas de fenêtre 48h ici (§11.6),
          // l'anti-interférence passe par `questionConflict` (même dividende).
          if (!updated.introduced) updated.introduced = true;
          trackPromotion(getDivisionFactKey(dividend, divisor), current.box, updated.box);
          return {
            ...prev,
            divisionFacts: prev.divisionFacts.map((f) =>
              f.dividend === dividend && f.divisor === divisor ? updated : f,
            ),
          };
        }

        const { a, b } = item.fact;
        const current = prev.facts.find((f) => f.a === a && f.b === b) ?? item.fact;
        const updated = processAnswer(current, correct, timeMs, today, inputMode, fastMs);
        if (updated.history.length > 0) {
          updated.history[updated.history.length - 1].answeredWith = answered;
        }
        if (!updated.introduced) {
          updated.introduced = true;
          updated.introducedAt = today; // date d'intro réelle (cf. §1.2)
        }
        trackPromotion(getFactKey(a, b), current.box, updated.box);
        return {
          ...prev,
          facts: prev.facts.map((f) => (f.a === a && f.b === b ? updated : f)),
        };
      });
    },
    [trackPromotion],
  );

  /**
   * Réponse à une question de conjugaison (spec Verbito §4.5, §5.3). Canal
   * séparé d'`handleSessionItemAnswer` : la réponse est une chaîne, le verdict
   * n'est pas booléen, et surtout le fait à faire redescendre n'est PAS
   * toujours celui qui a été posé — « seron » pour « serons », c'est la
   * terminaison -ons qui a lâché, pas le radical ser-.
   */
  const handleConjAnswer = useCallback(
    (
      item: ConjSessionItem,
      judgement: ConjJudgement,
      fast: boolean,
      timeMs: number,
      inputMode: 'keypad' | 'voice',
    ) => {
      const accepted = isConjAccepted(judgement.verdict);

      sessionQuestionLogs.current.push({
        kind: 'conj',
        // Pas d'`a`/`b` : c'est `factKey` qui identifie le fait.
        factKey: item.fact.key,
        correct: accepted,
        responseTimeMs: timeMs,
        answeredWith: null,
        isBonusReview: item.isBonusReview,
        // Clavier, ou mode vocal épelé (§15.10) : c'est l'écran de séance qui
        // sait lequel a servi.
        inputMode,
        fast,
      });

      if (accepted) {
        sessionConsecutiveCorrect.current++;
        sessionMaxConsecutiveCorrect.current = Math.max(
          sessionMaxConsecutiveCorrect.current,
          sessionConsecutiveCorrect.current,
        );
      } else {
        sessionConsecutiveCorrect.current = 0;
      }

      const today = todayISO();
      const posedKey = item.fact.key;
      // Le fait vient d'être PRÉSENTÉ : son compteur avance, révision bonus
      // comprise. C'est lui qui fait tourner les phrases porteuses (§10) — un
      // fait servi en bonus tous les jours resterait sinon sur la même phrase.
      const bumpSeen = (fact: ConjFact): ConjFact =>
        fact.key === posedKey
          ? { ...fact, seen: (fact.seen ?? fact.history.length) + 1 }
          : fact;

      // Révision bonus : feedback et stats seulement, pas de Leitner (comme en
      // maths).
      if (item.isBonusReview) {
        setProfile((prev) =>
          prev?.conjFacts ? { ...prev, conjFacts: prev.conjFacts.map(bumpSeen) } : prev,
        );
        return;
      }

      setProfile((prev) => {
        if (!prev?.conjFacts) return prev;

        // Qui monte, qui descend. Accepté ⇒ le fait posé (et lui seul) est
        // crédité. Refusé ⇒ seuls les faits BLÂMÉS redescendent : le fait posé
        // peut n'être pour rien dans l'erreur, il reste alors intact — ni
        // promu, ni puni (§4.5).
        const outcomes = new Map<string, boolean>();
        if (accepted) outcomes.set(posedKey, true);
        else for (const key of judgement.blamedKeys) outcomes.set(key, false);

        // `fast` est calculé par l'écran, qui seul connaît le verdict : un
        // « presque » est accepté, PAS promu (§5.3). Recalculer un seuil ici
        // ferait monter la boîte sur une coquille lexicale tapée vite, en
        // contradiction avec l'étoile sans rayons affichée au même moment — on
        // neutralise donc le seuil plutôt que de trafiquer `timeMs`, qui reste
        // vrai dans l'historique.
        const fastMs = fast ? Number.POSITIVE_INFINITY : 0;

        const conjFacts = prev.conjFacts.map((fact) => {
          const outcome = outcomes.get(fact.key);
          const isPosed = fact.key === posedKey;
          if (outcome === undefined) {
            // Fait posé non blâmé : rien ne bouge côté Leitner, mais une
            // première rencontre reste une introduction.
            return isPosed && !fact.introduced
              ? { ...bumpSeen(fact), introduced: true, introducedAt: today }
              : bumpSeen(fact);
          }
          const updated: ConjFact = processAnswer(
            bumpSeen(fact),
            outcome,
            timeMs,
            today,
            'keypad',
            fastMs,
          );
          // `introduced` seulement pour le fait POSÉ : un fait blâmé par
          // ricochet (la terminaison derrière « seron ») n'a jamais été
          // présenté. Le marquer introduit le sortirait à jamais des candidats
          // à l'introduction (§5.2) et le montrerait découvert sur l'image
          // mystère sans qu'il ait été enseigné.
          if (isPosed && !updated.introduced) {
            updated.introduced = true;
            // Date d'intro RÉELLE, qui pilote l'espacement 48 h des intros de
            // faits en interférence (§3.4).
            updated.introducedAt = today;
          }
          if (isPosed) trackPromotion(fact.key, fact.box, updated.box);
          return updated;
        });

        return { ...prev, conjFacts };
      });
    },
    [trackPromotion],
  );

  // Fin de séance — un seul handler pour les deux modes. Le récap suit le type
  // de séance : 'div' quand la division est débloquée (séance mixte div +
  // entretien tables), 'mult' sinon. Les tables « nouvellement complétées » ne
  // concernent que le mode 'mult' (post-déblocage elles sont déjà toutes en
  // boîte 5 — getCompletedTables renverrait [] de toute façon).
  const handleSessionComplete = useCallback(
    (partial: Omit<SessionResult, 'factsPromoted'>) => {
      if (!profile) return;

      // Une séance appartient à UNE matière. `isConj` gouverne : le récap, la
      // date de séance marquée, et les jalons de niveau (qui n'existent pas en
      // conjugaison).
      // Une séance ne mélange jamais deux matières (§7.2) : le `kind` de sa
      // première question suffit à dire laquelle.
      const isConj = sessionItems[0]?.kind === 'conj';
      const mode: FactKind = isConj ? 'conj' : sessionMode;
      const result: SessionResult = {
        ...partial,
        factsPromoted: sessionPromoted.current.size,
        // Log par-question persisté pour diagnostic (cf. SessionResult.questions).
        // Désormais peuplé pour TOUTES les séances, division comprise.
        questions: sessionQuestionLogs.current,
      };

      const today = todayISO();
      const previousLastSessionDate = profile.lastSessionDate;

      const streakUpdate = applyStreakUpdate(profile, today);
      const longestStreak = Math.max(profile.longestStreak, streakUpdate.currentStreak);

      // Append session result to history, capped at 50
      const sessionHistory = [...profile.sessionHistory, result].slice(-50);

      const updatedProfile: UserProfile = {
        ...profile,
        totalSessions: profile.totalSessions + 1,
        currentStreak: streakUpdate.currentStreak,
        longestStreak,
        // Flamme de série PARTAGÉE : une séance de n'importe quelle matière
        // maintient `lastSessionDate` (spec Verbito §7.2). Les deux dates par
        // matière, elles, disent seulement quelle tuile de l'accueil est déjà
        // faite aujourd'hui.
        lastSessionDate: today,
        ...(isConj ? { lastConjSessionDate: today } : { lastMathSessionDate: today }),
        streakFreezes: streakUpdate.streakFreezes,
        sessionHistory,
      };

      // Pass previousLastSessionDate so PERSEVERANCE badge can check the gap.
      // wasFast = l'étoile dorée enregistrée au moment de la réponse (seuil
      // propre au type de question, séance possiblement mixte). Badge Véloce =
      // 5 étoiles d'affilée.
      const sessionStats = {
        consecutiveCorrect: sessionMaxConsecutiveCorrect.current,
        wasFast: sessionQuestionLogs.current.map((q) => q.fast ?? false),
      };
      const earned = checkBadges(updatedProfile, sessionStats, previousLastSessionDate);
      const previousBadgeIds = new Set(profile.badges.map((b) => b.id));
      const brandNewBadges = earned.filter((b) => !previousBadgeIds.has(b.id));

      updatedProfile.badges = [...profile.badges, ...brandNewBadges];

      // Tables fraîchement complétées (tous faits en boîte 5) de l'opération de
      // la séance : tables × en mode mult, « divisions par N » en mode div,
      // zones par diviseur en mode rem.
      // Pas de « table complétée » en conjugaison : l'unité de célébration y est
      // le badge de temps ou de verbe, pas une ligne de table.
      const completedNow = isConj
        ? []
        : mode === 'rem'
          ? [...getCompletedRemainderTables(updatedProfile.remainderFacts ?? [])].filter(
              (t) => !remainderTablesCompletedBeforeSession.current.has(t),
            )
          : mode === 'div'
            ? [...getCompletedDivisionTables(updatedProfile.divisionFacts ?? [])].filter(
                (t) => !divisionTablesCompletedBeforeSession.current.has(t),
              )
            : [...getCompletedTables(updatedProfile.facts)].filter(
                (t) => !tablesCompletedBeforeSession.current.has(t),
              );

      // Déblocages : la condition (8 badges de table / de divisions) vient de
      // basculer cette séance. Les memos `*Unlocked` reflètent l'état d'AVANT
      // la séance, donc mode est encore celui du niveau précédent ici.
      const divisionUnlockedNow =
        !isConj && !divisionUnlocked && isDivisionUnlocked(updatedProfile);
      const remainderUnlockedNow =
        !isConj && !remainderUnlocked && isRemainderUnlocked(updatedProfile);

      setProfile(updatedProfile);
      setSessionResult(result);
      setNewBadges(brandNewBadges);
      setNewlyCompletedTables(completedNow);
      setDivisionJustUnlocked(divisionUnlockedNow);
      setRemainderJustUnlocked(remainderUnlockedNow);
      setFreezeJustUsed(streakUpdate.freezeJustUsed);
      setFreezeJustEarned(streakUpdate.freezeJustEarned);
      setRecapMode(mode);
      setScreen('recap');

      // Anti-nag du rappel push, des deux côtés : marque qu'une séance a eu lieu
      // aujourd'hui pour que le cron saute l'envoi du soir, ET referme le rappel
      // déjà affiché dans la barre de notifications, devenu caduc. Best-effort
      // (no-op si non abonné / push non configuré), jamais bloquant pour le recap.
      void syncLastSession();

      // Suivi à distance : rafraîchit l'instantané chiffré que consulte le
      // parent sur son propre appareil. Même esprit que ci-dessus — no-op si le
      // profil n'est pas partagé, et un échec (hors-ligne) sera rattrapé par la
      // séance suivante, donc jamais bloquant pour le recap.
      // Import dynamique : lib/watch tire le chiffrement (et transfer.ts) —
      // hors de question de les faire entrer dans le graphe eager du boot pour
      // un chemin qui ne sert qu'aux profils partagés.
      const activeId = getActiveProfileId();
      if (activeId) {
        void import('./lib/watch').then((m) => m.publishWatchSnapshot(activeId, updatedProfile));
      }
    },
    [profile, divisionUnlocked, remainderUnlocked, sessionMode, sessionItems],
  );

  const exitRecap = useCallback((next: Screen) => {
    setSessionResult(null);
    setNewBadges([]);
    setNewlyCompletedTables([]);
    setDivisionJustUnlocked(false);
    setRemainderJustUnlocked(false);
    setFreezeJustUsed(false);
    setFreezeJustEarned(false);
    setRecapMode('mult');
    setScreen(next);
  }, []);

  const handleRecapFinish = useCallback(() => exitRecap('home'), [exitRecap]);

  // Faits du niveau de la séance qui vient de se terminer — alimente la jauge
  // de progression du récap (« Tu connais X / Y »).
  const recapFacts = !profile
    ? []
    : recapMode === 'conj'
      ? (profile.conjFacts ?? [])
      : recapMode === 'rem'
        ? (profile.remainderFacts ?? [])
        : recapMode === 'div'
          ? (profile.divisionFacts ?? [])
          : profile.facts;

  const handleExport = useCallback(() => {
    if (!profile) return;
    const json = exportProfile(profile);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tablito-${profile.name}-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [profile]);

  const handleImport = useCallback((json: string): UserProfile | null => {
    const imported = importProfile(json);
    if (imported) setProfile(imported);
    return imported;
  }, []);

  // Variante pour l'écran d'accueil (migration / nouvel appareil) : importe en
  // tant que NOUVEAU profil (jamais d'écrasement d'un autre enfant) ET navigue
  // vers l'écran adapté au profil restauré — sinon on resterait bloqué sur
  // Welcome (le profil ne pilote pas `screen` tout seul). L'import depuis
  // l'espace parent, lui, écrase le profil actif (restauration de sauvegarde)
  // et ne navigue pas (comportement inchangé).
  const handleWelcomeImport = useCallback((json: string): boolean => {
    const imported = importProfile(json);
    if (!imported) return false;
    addProfile(imported);
    setProfile(imported);
    setScreen(profileHome(imported));
    return true;
  }, []);

  // Transfert scanné depuis le Welcome (QR de l'ancien appareil) : le profil
  // est déjà installé et actif (lib/transfer → storage.installProfile), il ne
  // reste qu'à refléter l'état et naviguer.
  const handleTransferImported = useCallback((imported: UserProfile) => {
    setProfile(imported);
    setScreen(profileHome(imported));
  }, []);

  const handleDeleteProfile = useCallback(() => {
    if (!profile) return;
    const ok = window.confirm(appStrings.confirmDeleteProfile(profile.name));
    if (!ok) return;
    // Le profil part d'ici, donc son suivi à distance n'a plus d'objet : on
    // révoque le dépôt AVANT de perdre l'id qui porte ses identifiants, sinon un
    // instantané relisible survivrait à l'enfant (purgé au mieux après 6 mois).
    const deletedId = getActiveProfileId();
    if (deletedId) {
      void import('./lib/watch').then((m) => m.stopWatch(deletedId));
    }
    deleteActiveProfile();
    // Même décision qu'au boot : plusieurs enfants → « Qui joue ? » ; un seul
    // → son accueil directement ; aucun → onboarding complet.
    const next = loadProfile();
    setProfile(next);
    setScreen(initialScreen(next, listProfiles().length));
  }, [profile, appStrings]);

  return (
    <div className="app">
      {transferNotice && (
        <div
          className={`app-boot-banner app-boot-banner--${transferNotice === 'error' ? 'error' : 'success'}`}
          role={transferNotice === 'error' ? 'alert' : 'status'}
        >
          <span>
            {transferNotice === 'error' ? appStrings.transferFailed : appStrings.transferImported}
          </span>
          <button
            className="app-boot-banner-close"
            onClick={() => setTransferNotice(null)}
            aria-label={appStrings.dismiss}
          >
            ✕
          </button>
        </div>
      )}
      {/* Suspense pour les écrans lazy. Fallback à null : le SW précache
          tous les chunks donc l'attente est imperceptible (cache hit), et
          en 1re visite réseau, un écran vide bref vaut mieux qu'un spinner
          qui flashe. */}
      <Suspense fallback={null}>
      {screen === 'welcome' && (
        <WelcomeScreen
          onComplete={handleWelcomeComplete}
          onImport={handleWelcomeImport}
          onTransferImported={handleTransferImported}
          // Annulable uniquement en mode « ajout d'un enfant » (il existe
          // déjà au moins un profil) : au tout premier onboarding il n'y a
          // nulle part où revenir.
          // Annulable dès qu'il y a un écran d'arrivée ailleurs : un profil
          // local, OU un enfant suivi à distance (sinon le parent qui tape
          // « Créer un profil sur cet appareil » reste piégé dans l'onboarding).
          onCancel={profileCount > 0 || listWatched().length > 0 ? handleWelcomeCancel : undefined}
        />
      )}

      {screen === 'profiles' && (
        <ProfileSelectScreen
          profiles={listProfiles()}
          onSelect={handleSelectProfile}
          onAdd={handleAddProfile}
        />
      )}

      {screen === 'rulesIntro' && profile && (
        <RulesIntroScreen name={profile.name} onComplete={handleRulesIntroComplete} />
      )}

      {screen === 'home' && profile && (
        <HomeScreen
          profile={profile}
          hasSessionAvailable={hasSessionAvailable}
          hasNewRule={hasNewRule}
          divisionUnlocked={divisionUnlocked}
          conjAvailable={conjAvailable}
          hasConjSessionAvailable={hasConjSessionAvailable}
          conjVisible={conjVisible}
          onStartConj={handleStartConj}
          onStart={handleStart}
          onShowProgress={() => {
            // Post-déblocage, les images des niveaux passés sont complètes :
            // on ouvre directement sur celle du niveau actif, à dévoiler.
            setProgressView(sessionMode);
            setScreen('progress');
          }}
          onShowBadges={() => setScreen('badges')}
          onShowRules={handleShowRules}
          onShowParent={() => setScreen('parent')}
          onSwitchProfile={profileCount > 1 ? () => setScreen('profiles') : undefined}
        />
      )}

      {screen === 'conjPlacement' && profile && (
        <ConjPlacementScreen onComplete={handleConjPlacementComplete} />
      )}

      {screen === 'session' && profile && sessionItems.length > 0 && (
        <SessionScreen
          questions={sessionItems}
          onComplete={handleSessionComplete}
          onAnswer={handleSessionItemAnswer}
          onConjAnswer={handleConjAnswer}
        />
      )}

      {screen === 'recap' && profile && sessionResult && (
        <RecapScreen
          name={profile.name}
          result={sessionResult}
          newBadges={newBadges}
          newlyCompletedTables={newlyCompletedTables}
          divisionJustUnlocked={divisionJustUnlocked}
          remainderJustUnlocked={remainderJustUnlocked}
          currentStreak={profile.currentStreak}
          freezeJustUsed={freezeJustUsed}
          freezeJustEarned={freezeJustEarned}
          knownFactsCount={recapFacts.filter((f) => f.box >= 3).length}
          totalFacts={recapFacts.length}
          onFinish={handleRecapFinish}
          onShowProgress={() => { setProgressView(recapMode); exitRecap('progress'); }}
          mode={recapMode}
        />
      )}

      {screen === 'progress' && profile && (
        <ProgressScreen profile={profile} onBack={() => setScreen('home')} initialView={progressView} />
      )}

      {screen === 'badges' && profile && (
        <BadgesScreen
          profile={profile}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'rules' && (
        <RulesScreen onBack={() => setScreen('home')} showRule11={rule11Unlocked} />
      )}

      {/* `watchPairing` compte, y compris quand il vaut 'error' : un parent sans
          Tablito qui scanne un QR périmé n'a ni profil local ni suivi mémorisé,
          et sans ce terme il tomberait sur un écran blanc au lieu de l'espace
          parent, d'où il peut réessayer l'appairage. */}
      {screen === 'parent' && (profile || watchPairing || listWatched().length > 0) && (
        <ParentDashboard
          profile={profile}
          initialWatch={watchPairing && watchPairing !== 'error' ? watchPairing : null}
          openOnWatched={recapRequested}
          // Sans profil local, l'espace parent EST l'app : nulle part où revenir.
          onBack={profile ? () => setScreen('home') : undefined}
          onExport={handleExport}
          onImport={handleImport}
          onAddProfile={handleAddProfile}
          onDeleteProfile={handleDeleteProfile}
          onShowPrivacy={() => setScreen('privacy')}
          onShowChangelog={() => setScreen('changelog')}
        />
      )}

      {screen === 'privacy' && (
        <PrivacyScreen onBack={() => setScreen('parent')} />
      )}

      {screen === 'changelog' && (
        <ChangelogScreen onBack={() => setScreen('parent')} />
      )}
      </Suspense>
    </div>
  );
}
