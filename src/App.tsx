import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { setBusy as setSwBusy } from 'virtual:pwa-register';
import type { UserProfile, SessionItem, SessionResult, SessionQuestionLog, MultiFact, DivisionFact, Badge, BoxLevel } from './types';
import { FAST_THRESHOLD_MS, DIVISION_FAST_THRESHOLD_MS } from './types';
import { composeSession } from './lib/sessionComposer';
import { composeDailySession } from './lib/dailyComposer';
import { processAnswer } from './lib/leitner';
import { checkBadges, getCompletedTables, isRule11Unlocked, isDivisionUnlocked } from './lib/badges';
import { loadProfile, saveProfile, clearStoredProfile, createNewProfile, exportProfile, importProfile } from './lib/storage';
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

function initialScreen(profile: UserProfile | null): Screen {
  if (!profile) return 'welcome';
  if (!profile.hasSeenRulesIntro) return 'rulesIntro';
  return 'home';
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile());
  const [screen, setScreen] = useState<Screen>(() => initialScreen(profile));
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
  // une mise à jour SW (= reload). Seul `home` l'est ici : ailleurs, un
  // reload casserait l'état mémoire en cours (séance, recap animations,
  // navigation parent, etc.). Quand on revient sur home, un éventuel
  // SW en attente est appliqué automatiquement.
  useEffect(() => {
    setSwBusy(screen !== 'home');
  }, [screen]);

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

  // Welcome: create new profile with optional placement test results
  const handleWelcomeComplete = useCallback((name: string, placementResults: PlacementResult[]) => {
    const newProfile = createNewProfile(name);
    seedFromPlacement(newProfile.facts, placementResults, todayISO());
    setProfile(newProfile);
    setScreen('rulesIntro');
  }, []);

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
    // Snapshot des tables maîtrisées (célébration de complétion, parcours v1).
    tablesCompletedBeforeSession.current = getCompletedTables(profile.facts);
    setSessionItems(pendingItems);
    setScreen('session');
  }, [profile, pendingItems, resetSessionTracking]);

  // Aiguille une réponse vers la bonne piste selon le type de question.
  const handleSessionItemAnswer = useCallback(
    (
      item: SessionItem,
      correct: boolean,
      timeMs: number,
      answered: number | null,
      inputMode: 'keypad' | 'voice',
    ) => {
      if (item.kind === 'div') {
        handleDivisionAnswer(item.fact, correct, timeMs, answered, item.isBonusReview, inputMode);
      } else {
        handleAnswer(item.fact, correct, timeMs, answered, item.isBonusReview, inputMode);
      }
    },
    // handleAnswer / handleDivisionAnswer sont stables (useCallback [] / [profile]).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Handle individual answer — use functional updater to avoid stale fact on retries
  const handleAnswer = useCallback(
    (
      fact: MultiFact,
      correct: boolean,
      timeMs: number,
      answered: number | null,
      isBonusReview: boolean,
      inputMode: 'keypad' | 'voice',
    ) => {
      sessionQuestionLogs.current.push({
        a: fact.a,
        b: fact.b,
        correct,
        responseTimeMs: timeMs,
        answeredWith: answered,
        isBonusReview,
        inputMode,
        fast: correct && timeMs < FAST_THRESHOLD_MS[inputMode],
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

      // Bonus review: feedback and session stats only, no Leitner state change
      if (isBonusReview) return;

      const today = todayISO();

      setProfile((prev) => {
        if (!prev) return prev;
        // Use the current fact from profile state, not the stale snapshot from the question
        const currentFact = prev.facts.find((f) => f.a === fact.a && f.b === fact.b) ?? fact;
        const updatedFact = processAnswer(currentFact, correct, timeMs, today, inputMode);

        if (updatedFact.history.length > 0) {
          updatedFact.history[updatedFact.history.length - 1].answeredWith = answered;
        }
        if (!updatedFact.introduced) {
          updatedFact.introduced = true;
        }

        // Idempotent set ops — safe under React strict-mode double-invocation
        // of this reducer.
        const factKey = getFactKey(fact.a, fact.b);
        if (!sessionInitialBoxes.current.has(factKey)) {
          sessionInitialBoxes.current.set(factKey, currentFact.box);
        }
        const initialBox = sessionInitialBoxes.current.get(factKey)!;
        if (updatedFact.box > initialBox) {
          sessionPromoted.current.add(factKey);
        } else {
          sessionPromoted.current.delete(factKey);
        }

        const updatedFacts = prev.facts.map((f) =>
          f.a === fact.a && f.b === fact.b ? updatedFact : f,
        );
        return { ...prev, facts: updatedFacts };
      });
    },
    [],
  );

  // Session complete
  const handleSessionComplete = useCallback(
    (partial: Omit<SessionResult, 'factsPromoted'>) => {
      if (!profile) return;

      const result: SessionResult = {
        ...partial,
        factsPromoted: sessionPromoted.current.size,
        questions: sessionQuestionLogs.current,
      };

      const today = todayISO();
      const previousLastSessionDate = profile.lastSessionDate;

      const streakUpdate = applyStreakUpdate(profile, today);
      const longestStreak = Math.max(profile.longestStreak, streakUpdate.currentStreak);

      // Append session result to history, capped at 50
      const previousHistory = profile.sessionHistory;
      const sessionHistory = [...previousHistory, result].slice(-50);

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
      // propre au type de question). Le badge Véloce = 5 étoiles d'affilée.
      const sessionStats = {
        consecutiveCorrect: sessionMaxConsecutiveCorrect.current,
        wasFast: sessionQuestionLogs.current.map((q) => q.fast ?? false),
      };
      const earned = checkBadges(updatedProfile, sessionStats, previousLastSessionDate);
      const previousBadgeIds = new Set(profile.badges.map((b) => b.id));
      const brandNewBadges = earned.filter((b) => !previousBadgeIds.has(b.id));

      updatedProfile.badges = [...profile.badges, ...brandNewBadges];

      // Detect newly completed tables (all facts at box >= 5)
      const completedNow = [...getCompletedTables(updatedProfile.facts)]
        .filter((t) => !tablesCompletedBeforeSession.current.has(t));

      setProfile(updatedProfile);
      setSessionResult(result);
      setNewBadges(brandNewBadges);
      setNewlyCompletedTables(completedNow);
      setFreezeJustUsed(streakUpdate.freezeJustUsed);
      setFreezeJustEarned(streakUpdate.freezeJustEarned);
      setRecapMode('mult');
      setScreen('recap');

      // Anti-nag du rappel push : marque qu'une séance a eu lieu aujourd'hui
      // pour que le cron saute l'envoi du soir. Best-effort (no-op si non
      // abonné / push non configuré), jamais bloquant pour le recap.
      void syncLastSession();
    },
    [profile],
  );

  // Division — réponse individuelle (met à jour profile.divisionFacts via le
  // même processAnswer générique). Les logs sont poussés pour les stats de
  // badges (Machine/Véloce) mais PAS persistés dans le résultat, pour ne pas
  // polluer le dashboard parent (top des multiplications difficiles).
  const handleDivisionAnswer = useCallback(
    (
      fact: DivisionFact,
      correct: boolean,
      timeMs: number,
      answered: number | null,
      isBonusReview: boolean,
      inputMode: 'keypad' | 'voice',
    ) => {
      sessionQuestionLogs.current.push({
        a: fact.divisor,
        b: fact.quotient,
        correct,
        responseTimeMs: timeMs,
        answeredWith: answered,
        isBonusReview,
        inputMode,
        fast: correct && timeMs < DIVISION_FAST_THRESHOLD_MS[inputMode],
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

      if (isBonusReview) return;

      const today = todayISO();

      setProfile((prev) => {
        if (!prev || !prev.divisionFacts) return prev;
        const currentFact =
          prev.divisionFacts.find(
            (f) => f.dividend === fact.dividend && f.divisor === fact.divisor,
          ) ?? fact;
        const updatedFact = processAnswer(
          currentFact,
          correct,
          timeMs,
          today,
          inputMode,
          DIVISION_FAST_THRESHOLD_MS[inputMode],
        );

        if (updatedFact.history.length > 0) {
          updatedFact.history[updatedFact.history.length - 1].answeredWith = answered;
        }
        if (!updatedFact.introduced) {
          updatedFact.introduced = true;
        }

        const key = getDivisionFactKey(fact.dividend, fact.divisor);
        if (!sessionInitialBoxes.current.has(key)) {
          sessionInitialBoxes.current.set(key, currentFact.box);
        }
        const initialBox = sessionInitialBoxes.current.get(key)!;
        if (updatedFact.box > initialBox) {
          sessionPromoted.current.add(key);
        } else {
          sessionPromoted.current.delete(key);
        }

        const divisionFacts = prev.divisionFacts.map((f) =>
          f.dividend === fact.dividend && f.divisor === fact.divisor ? updatedFact : f,
        );
        return { ...prev, divisionFacts };
      });
    },
    [],
  );

  // Division — fin de séance. Compte comme la séance du jour (streak + récap),
  // récap en mode 'div'.
  const handleDivisionSessionComplete = useCallback(
    (partial: Omit<SessionResult, 'factsPromoted'>) => {
      if (!profile) return;

      const result: SessionResult = {
        ...partial,
        factsPromoted: sessionPromoted.current.size,
      };

      const today = todayISO();
      const previousLastSessionDate = profile.lastSessionDate;

      const streakUpdate = applyStreakUpdate(profile, today);
      const longestStreak = Math.max(profile.longestStreak, streakUpdate.currentStreak);
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

      // Séance potentiellement mixte (division + entretien tables) : on s'appuie
      // sur l'étoile dorée enregistrée par question (seuil propre à son type)
      // plutôt que de recalculer avec un seuil unique. Badge Véloce = 5 d'affilée.
      const sessionStats = {
        consecutiveCorrect: sessionMaxConsecutiveCorrect.current,
        wasFast: sessionQuestionLogs.current.map((q) => q.fast ?? false),
      };
      const earned = checkBadges(updatedProfile, sessionStats, previousLastSessionDate);
      const previousBadgeIds = new Set(profile.badges.map((b) => b.id));
      const brandNewBadges = earned.filter((b) => !previousBadgeIds.has(b.id));
      updatedProfile.badges = [...profile.badges, ...brandNewBadges];

      setProfile(updatedProfile);
      setSessionResult(result);
      setNewBadges(brandNewBadges);
      setNewlyCompletedTables([]);
      setFreezeJustUsed(streakUpdate.freezeJustUsed);
      setFreezeJustEarned(streakUpdate.freezeJustEarned);
      setRecapMode('div');
      setScreen('recap');

      void syncLastSession();
    },
    [profile],
  );

  const exitRecap = useCallback((next: Screen) => {
    setSessionResult(null);
    setNewBadges([]);
    setNewlyCompletedTables([]);
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
    a.download = `multiplix-${profile.name}-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [profile]);

  const handleImport = useCallback((json: string) => {
    const imported = importProfile(json);
    if (imported) {
      setProfile(imported);
    }
  }, []);

  const handleResetProfile = useCallback(() => {
    const ok = window.confirm(
      'Réinitialiser le profil ?\n\nLe prénom, les séances, les badges, la série et le test de placement seront effacés. Cette action est irréversible.',
    );
    if (!ok) return;
    clearStoredProfile();
    setProfile(null);
    setScreen('welcome');
  }, []);

  return (
    <div className="app">
      {/* Suspense pour les écrans lazy. Fallback à null : le SW précache
          tous les chunks donc l'attente est imperceptible (cache hit), et
          en 1re visite réseau, un écran vide bref vaut mieux qu'un spinner
          qui flashe. */}
      <Suspense fallback={null}>
      {screen === 'welcome' && (
        <WelcomeScreen onComplete={handleWelcomeComplete} />
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
        />
      )}

      {screen === 'session' && profile && sessionItems.length > 0 && (
        <SessionScreen
          questions={sessionItems}
          onComplete={divisionUnlocked ? handleDivisionSessionComplete : handleSessionComplete}
          onAnswer={handleSessionItemAnswer}
        />
      )}

      {screen === 'recap' && profile && sessionResult && (
        <RecapScreen
          name={profile.name}
          result={sessionResult}
          newBadges={newBadges}
          newlyCompletedTables={newlyCompletedTables}
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
          onResetProfile={handleResetProfile}
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
