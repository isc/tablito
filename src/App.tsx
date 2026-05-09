import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { setBusy as setSwBusy } from 'virtual:pwa-register';
import type { UserProfile, SessionQuestion, SessionResult, MultiFact, Badge, BoxLevel } from './types';
import { composeSession } from './lib/sessionComposer';
import { processAnswer } from './lib/leitner';
import { checkBadges, getCompletedTables } from './lib/badges';
import { loadProfile, saveProfile, createNewProfile, exportProfile, importProfile } from './lib/storage';
import { getFactKey } from './lib/facts';
import { seedFromPlacement } from './lib/placement';
import type { PlacementResult } from './lib/placement';
import { todayISO, daysBetween } from './lib/utils';
import { isStandalone, hasSkippedInstall, clearInstallSkipped } from './lib/install';
import { preflightMicPermission } from './lib/micPreflight';
import { isVoiceMode } from './hooks/useInputMode';
import LandingScreen from './screens/LandingScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import HomeScreen from './screens/HomeScreen';
import SessionScreen from './screens/SessionScreen';
import RecapScreen from './screens/RecapScreen';
import ProgressScreen from './screens/ProgressScreen';
import BadgesScreen from './screens/BadgesScreen';
import RulesScreen from './screens/RulesScreen';
import RulesIntroScreen from './screens/RulesIntroScreen';
import ParentDashboard from './screens/ParentDashboard';
import PrivacyScreen from './screens/PrivacyScreen';
import ChangelogScreen from './screens/ChangelogScreen';
import './App.css';

type Screen =
  | 'landing'
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
  // Si l'app tourne en mode standalone (PWA installée), pas besoin de landing.
  // Sinon, on montre la landing tant que l'utilisateur n'a pas dit "essayer
  // dans le navigateur". Une fois standalone, on n'a plus rien à pousser.
  if (!isStandalone() && !hasSkippedInstall() && !profile) return 'landing';
  if (!profile) return 'welcome';
  if (!profile.hasSeenRulesIntro) return 'rulesIntro';
  return 'home';
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile());
  const [screen, setScreen] = useState<Screen>(() => initialScreen(profile));
  const [sessionQuestions, setSessionQuestions] = useState<SessionQuestion[]>([]);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [newBadges, setNewBadges] = useState<Badge[]>([]);
  const [newlyCompletedTables, setNewlyCompletedTables] = useState<number[]>([]);
  // Tracked in state so a date rollover (app left open past minuit) re-déclenche
  // les memos qui dépendent du jour courant (ex: disponibilité de la séance).
  const [today, setToday] = useState<string>(() => todayISO());

  // Track session stats for badge checking
  const sessionConsecutiveCorrect = useRef(0);
  const sessionMaxConsecutiveCorrect = useRef(0);
  const sessionResponseTimes = useRef<number[]>([]);
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
  // une mise à jour SW (= reload). Seuls landing et home le sont : ailleurs,
  // un reload casserait l'état mémoire en cours (séance, recap animations,
  // navigation parent, etc.). Quand on revient sur landing/home, un éventuel
  // SW en attente est appliqué automatiquement.
  useEffect(() => {
    const safe = screen === 'landing' || screen === 'home';
    setSwBusy(!safe);
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

  const handleLandingSkip = useCallback(() => {
    setScreen(profile ? 'home' : 'welcome');
  }, [profile]);

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

  // Pre-compute the next session so we can check availability without re-running
  // composeSession on every render, and reuse it when the user clicks "start".
  const pendingSession = useMemo(() => {
    if (!profile) return [];
    if (profile.lastSessionDate === today) return [];
    return composeSession(profile, today);
  }, [profile, today]);

  // Start session
  const handleStartSession = useCallback(async () => {
    if (!profile || pendingSession.length === 0) return;

    // En mode vocal, on attend la réponse au prompt micro avant d'entrer en
    // séance — sinon la première question (et son timer) démarrerait pendant
    // que l'utilisateur décide.
    if (isVoiceMode()) {
      await preflightMicPermission();
    }

    sessionConsecutiveCorrect.current = 0;
    sessionMaxConsecutiveCorrect.current = 0;
    sessionResponseTimes.current = [];
    sessionInitialBoxes.current = new Map();
    sessionPromoted.current = new Set();

    tablesCompletedBeforeSession.current = getCompletedTables(profile.facts);

    setSessionQuestions(pendingSession);
    setScreen('session');
  }, [profile, pendingSession]);

  // Handle individual answer — use functional updater to avoid stale fact on retries
  const handleAnswer = useCallback(
    (fact: MultiFact, correct: boolean, timeMs: number, answered: number | null, isBonusReview: boolean) => {
      sessionResponseTimes.current.push(timeMs);
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
        const updatedFact = processAnswer(currentFact, correct, timeMs, today);

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
      };

      const today = todayISO();
      const previousLastSessionDate = profile.lastSessionDate;

      // Update streak
      let currentStreak = profile.currentStreak;
      if (previousLastSessionDate) {
        const diff = daysBetween(previousLastSessionDate, today);
        if (diff === 1) {
          currentStreak += 1;
        } else if (diff !== 0) {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }

      const longestStreak = Math.max(profile.longestStreak, currentStreak);

      // Append session result to history, capped at 50
      const previousHistory = profile.sessionHistory;
      const sessionHistory = [...previousHistory, result].slice(-50);

      const updatedProfile: UserProfile = {
        ...profile,
        totalSessions: profile.totalSessions + 1,
        currentStreak,
        longestStreak,
        lastSessionDate: today,
        sessionHistory,
      };

      // Pass previousLastSessionDate so PERSEVERANCE badge can check the gap
      const sessionStats = {
        consecutiveCorrect: sessionMaxConsecutiveCorrect.current,
        fastAnswers: sessionResponseTimes.current,
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
      setScreen('recap');
    },
    [profile],
  );

  const exitRecap = useCallback((next: Screen) => {
    setSessionResult(null);
    setNewBadges([]);
    setNewlyCompletedTables([]);
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

  return (
    <div className="app">
      {screen === 'landing' && (
        <LandingScreen onSkip={handleLandingSkip} />
      )}

      {screen === 'welcome' && (
        <WelcomeScreen onComplete={handleWelcomeComplete} />
      )}

      {screen === 'rulesIntro' && profile && (
        <RulesIntroScreen name={profile.name} onComplete={handleRulesIntroComplete} />
      )}

      {screen === 'home' && profile && (
        <HomeScreen
          profile={profile}
          hasSessionAvailable={pendingSession.length > 0}
          onStart={handleStartSession}
          onShowProgress={() => setScreen('progress')}
          onShowBadges={() => setScreen('badges')}
          onShowRules={() => setScreen('rules')}
          onShowParent={() => setScreen('parent')}
        />
      )}

      {screen === 'session' && profile && sessionQuestions.length > 0 && (
        <SessionScreen
          questions={sessionQuestions}
          onComplete={handleSessionComplete}
          onAnswer={handleAnswer}
        />
      )}

      {screen === 'recap' && profile && sessionResult && (
        <RecapScreen
          name={profile.name}
          result={sessionResult}
          newBadges={newBadges}
          newlyCompletedTables={newlyCompletedTables}
          knownFactsCount={profile.facts.filter((f) => f.box >= 3).length}
          totalFacts={profile.facts.length}
          onFinish={handleRecapFinish}
          onShowProgress={() => exitRecap('progress')}
        />
      )}

      {screen === 'progress' && profile && (
        <ProgressScreen profile={profile} onBack={() => setScreen('home')} />
      )}

      {screen === 'badges' && profile && (
        <BadgesScreen
          profile={profile}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'rules' && (
        <RulesScreen onBack={() => setScreen('home')} />
      )}

      {screen === 'parent' && profile && (
        <ParentDashboard
          profile={profile}
          onBack={() => setScreen('home')}
          onExport={handleExport}
          onImport={handleImport}
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
    </div>
  );
}
