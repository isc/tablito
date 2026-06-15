import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { setBusy as setSwBusy } from 'virtual:pwa-register';
import type { UserProfile, SessionItem, SessionResult, SessionQuestionLog, Badge, BoxLevel } from './types';
import { FAST_THRESHOLD_MS, DIVISION_FAST_THRESHOLD_MS } from './types';
import { composeSession } from './lib/sessionComposer';
import { composeDailySession } from './lib/dailyComposer';
import { processAnswer } from './lib/leitner';
import {
  checkBadges,
  getCompletedTables,
  getCompletedDivisionTables,
  isRule11Unlocked,
  isDivisionUnlocked,
} from './lib/badges';
import {
  loadProfile,
  loadProfileById,
  saveProfile,
  addProfile,
  deleteActiveProfile,
  setActiveProfile,
  listProfiles,
  createNewProfile,
  exportProfile,
  importProfile,
} from './lib/storage';
import { getFactKey } from './lib/facts';
import { getDivisionFactKey } from './lib/divisionFacts';
import { seedFromPlacement } from './lib/placement';
import type { PlacementResult } from './lib/placement';
import { todayISO } from './lib/utils';
import { applyStreakUpdate } from './lib/streak';
import { isStandalone, clearInstallSkipped } from './lib/install';
import { preflightMicPermission } from './lib/micPreflight';
import { syncLastSession } from './lib/push';
import { isVoiceMode } from './hooks/useInputMode';
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
// Lazy : écrans secondaires (consultation, parent, infos) — ouverts
// occasionnellement, leur coût parse/CPU au cold launch est gaspillé
// pour la majorité des sessions. Précachés par le SW → cache hit
// instantané quand l'utilisateur clique.
const ProgressScreen   = lazy(() => import('./screens/ProgressScreen'));
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
  if (!profile) return 'welcome';
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

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile());
  const [screen, setScreen] = useState<Screen>(() => initialScreen(profile, listProfiles().length));
  // Pilote l'affichage du bouton « changer de joueur » sur Home et le retour
  // du Welcome « ajout d'un enfant ». Lu à chaque render : l'index est
  // minuscule et ne change que via des flows qui re-rendent déjà App.
  const profileCount = listProfiles().length;
  // Liste unifiée de la séance en cours : 100% multiplication avant déblocage,
  // mixte (division + entretien des tables) après (specs §11.6).
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
  // Quelle « saveur » de récap afficher (multiplication vs division) — pilote
  // le nom affiché, le badge de complétion surveillé et l'écran image cible.
  const [recapMode, setRecapMode] = useState<'mult' | 'div'>('mult');
  // Onglet ouvert à l'arrivée sur l'écran progression (« Mes images ») : sur
  // l'image division quand on y va depuis le récap d'une séance de division.
  const [progressView, setProgressView] = useState<'mult' | 'div'>('mult');
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [newBadges, setNewBadges] = useState<Badge[]>([]);
  const [newlyCompletedTables, setNewlyCompletedTables] = useState<number[]>([]);
  // Vrai sur le récap de la séance où le 8e badge de table tombe : c'est le
  // moment du déblocage du niveau 2 (division), célébré une seule fois.
  const [divisionJustUnlocked, setDivisionJustUnlocked] = useState(false);
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
  const sessionDone = !!profile && profile.lastSessionDate === today;
  const pendingItems = useMemo<SessionItem[]>(() => {
    if (!profile || sessionDone) return [];
    if (divisionUnlocked) return composeDailySession(profile, today);
    return composeSession(profile, today).map((q): SessionItem => ({ kind: 'mult', ...q }));
  }, [profile, sessionDone, divisionUnlocked, today]);
  const hasSessionAvailable = pendingItems.length > 0;

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
    // Snapshot des tables maîtrisées (célébration de complétion) — × et ÷.
    tablesCompletedBeforeSession.current = getCompletedTables(profile.facts);
    divisionTablesCompletedBeforeSession.current = getCompletedDivisionTables(
      profile.divisionFacts ?? [],
    );
    setSessionItems(pendingItems);
    setScreen('session');
  }, [profile, pendingItems, resetSessionTracking]);

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
    ) => {
      const fastMs = (item.kind === 'div' ? DIVISION_FAST_THRESHOLD_MS : FAST_THRESHOLD_MS)[inputMode];

      sessionQuestionLogs.current.push({
        kind: item.kind,
        a: item.kind === 'div' ? item.fact.divisor : item.fact.a,
        b: item.kind === 'div' ? item.fact.quotient : item.fact.b,
        correct,
        responseTimeMs: timeMs,
        answeredWith: answered,
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
          if (!updated.introduced) {
            updated.introduced = true;
            // Posé par symétrie avec la multiplication ; pas encore lu côté
            // division (composeDivisionSession n'a pas de fenêtre 48h, §11.6).
            updated.introducedAt = today;
          }
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

  // Fin de séance — un seul handler pour les deux modes. Le récap suit le type
  // de séance : 'div' quand la division est débloquée (séance mixte div +
  // entretien tables), 'mult' sinon. Les tables « nouvellement complétées » ne
  // concernent que le mode 'mult' (post-déblocage elles sont déjà toutes en
  // boîte 5 — getCompletedTables renverrait [] de toute façon).
  const handleSessionComplete = useCallback(
    (partial: Omit<SessionResult, 'factsPromoted'>) => {
      if (!profile) return;

      const mode: 'mult' | 'div' = divisionUnlocked ? 'div' : 'mult';
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
        lastSessionDate: today,
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
      // la séance : tables × en mode mult, « divisions par N » en mode div.
      const completedNow =
        mode === 'div'
          ? [...getCompletedDivisionTables(updatedProfile.divisionFacts ?? [])].filter(
              (t) => !divisionTablesCompletedBeforeSession.current.has(t),
            )
          : [...getCompletedTables(updatedProfile.facts)].filter(
              (t) => !tablesCompletedBeforeSession.current.has(t),
            );

      // Déblocage du niveau 2 : la condition (8 badges de table) vient de
      // basculer cette séance. `divisionUnlocked` reflète l'état d'AVANT la
      // séance (memo sur `profile`), donc mode est encore 'mult' ici.
      const divisionUnlockedNow = !divisionUnlocked && isDivisionUnlocked(updatedProfile);

      setProfile(updatedProfile);
      setSessionResult(result);
      setNewBadges(brandNewBadges);
      setNewlyCompletedTables(completedNow);
      setDivisionJustUnlocked(divisionUnlockedNow);
      setFreezeJustUsed(streakUpdate.freezeJustUsed);
      setFreezeJustEarned(streakUpdate.freezeJustEarned);
      setRecapMode(mode);
      setScreen('recap');

      // Anti-nag du rappel push : marque qu'une séance a eu lieu aujourd'hui
      // pour que le cron saute l'envoi du soir. Best-effort (no-op si non
      // abonné / push non configuré), jamais bloquant pour le recap.
      void syncLastSession();
    },
    [profile, divisionUnlocked],
  );

  const exitRecap = useCallback((next: Screen) => {
    setSessionResult(null);
    setNewBadges([]);
    setNewlyCompletedTables([]);
    setDivisionJustUnlocked(false);
    setFreezeJustUsed(false);
    setFreezeJustEarned(false);
    setRecapMode('mult');
    setScreen(next);
  }, []);

  const handleRecapFinish = useCallback(() => exitRecap('home'), [exitRecap]);

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

  const handleDeleteProfile = useCallback(() => {
    if (!profile) return;
    const ok = window.confirm(
      `Supprimer le profil de ${profile.name} ?\n\nLe prénom, les séances, les badges et la série seront effacés de cet appareil. Cette action est irréversible.`,
    );
    if (!ok) return;
    deleteActiveProfile();
    // Même décision qu'au boot : plusieurs enfants → « Qui joue ? » ; un seul
    // → son accueil directement ; aucun → onboarding complet.
    const next = loadProfile();
    setProfile(next);
    setScreen(initialScreen(next, listProfiles().length));
  }, [profile]);

  return (
    <div className="app">
      {/* Suspense pour les écrans lazy. Fallback à null : le SW précache
          tous les chunks donc l'attente est imperceptible (cache hit), et
          en 1re visite réseau, un écran vide bref vaut mieux qu'un spinner
          qui flashe. */}
      <Suspense fallback={null}>
      {screen === 'welcome' && (
        <WelcomeScreen
          onComplete={handleWelcomeComplete}
          onImport={handleWelcomeImport}
          // Annulable uniquement en mode « ajout d'un enfant » (il existe
          // déjà au moins un profil) : au tout premier onboarding il n'y a
          // nulle part où revenir.
          onCancel={profileCount > 0 ? handleWelcomeCancel : undefined}
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
          onStart={handleStart}
          onShowProgress={() => {
            // Post-déblocage, l'image des tables est complète (tout en boîte 5) :
            // on ouvre directement sur la division, celle qui reste à dévoiler.
            setProgressView(divisionUnlocked ? 'div' : 'mult');
            setScreen('progress');
          }}
          onShowBadges={() => setScreen('badges')}
          onShowRules={handleShowRules}
          onShowParent={() => setScreen('parent')}
          onSwitchProfile={profileCount > 1 ? () => setScreen('profiles') : undefined}
        />
      )}

      {screen === 'session' && profile && sessionItems.length > 0 && (
        <SessionScreen
          questions={sessionItems}
          onComplete={handleSessionComplete}
          onAnswer={handleSessionItemAnswer}
        />
      )}

      {screen === 'recap' && profile && sessionResult && (
        <RecapScreen
          name={profile.name}
          result={sessionResult}
          newBadges={newBadges}
          newlyCompletedTables={newlyCompletedTables}
          divisionJustUnlocked={divisionJustUnlocked}
          currentStreak={profile.currentStreak}
          freezeJustUsed={freezeJustUsed}
          freezeJustEarned={freezeJustEarned}
          knownFactsCount={
            recapMode === 'div'
              ? (profile.divisionFacts ?? []).filter((f) => f.box >= 3).length
              : profile.facts.filter((f) => f.box >= 3).length
          }
          totalFacts={
            recapMode === 'div' ? (profile.divisionFacts ?? []).length : profile.facts.length
          }
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

      {screen === 'parent' && profile && (
        <ParentDashboard
          profile={profile}
          onBack={() => setScreen('home')}
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
