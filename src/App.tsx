import { useState, useEffect, useCallback, useRef } from 'react';
import type { UserProfile, SessionQuestion, SessionResult, MultiFact, Badge } from './types';
import { BOX_INTERVALS, RESPONSE_TIME } from './types';
import { composeSession } from './lib/sessionComposer';
import { processAnswer, addDays } from './lib/leitner';
import { checkBadges, computeMascotLevel, factsForTable } from './lib/badges';
import { loadProfile, saveProfile, createNewProfile, exportProfile, importProfile } from './lib/storage';
import { getFactKey } from './lib/facts';
import { todayISO, daysBetween } from './lib/utils';
import type { PlacementResult } from './screens/WelcomeScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import HomeScreen from './screens/HomeScreen';
import SessionScreen from './screens/SessionScreen';
import RecapScreen from './screens/RecapScreen';
import ProgressScreen from './screens/ProgressScreen';
import BadgesScreen from './screens/BadgesScreen';
import ParentDashboard from './screens/ParentDashboard';
import './App.css';

type Screen =
  | 'welcome'
  | 'home'
  | 'session'
  | 'recap'
  | 'progress'
  | 'badges'
  | 'parent';

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<SessionQuestion[]>([]);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [newBadges, setNewBadges] = useState<Badge[]>([]);
  const [newlyCompletedTables, setNewlyCompletedTables] = useState<number[]>([]);
  const [previousMascotLevel, setPreviousMascotLevel] = useState(1);
  const [loading, setLoading] = useState(true);

  // Track session stats for badge checking
  const sessionConsecutiveCorrect = useRef(0);
  const sessionMaxConsecutiveCorrect = useRef(0);
  const sessionResponseTimes = useRef<number[]>([]);

  // Snapshot of tables already mastered before the session starts
  const tablesCompletedBeforeSession = useRef<Set<number>>(new Set());

  // Skip the initial save-to-localStorage on mount
  const isInitialLoad = useRef(true);

  // Load profile from localStorage on mount
  useEffect(() => {
    const stored = loadProfile();
    if (stored) {
      setProfile(stored);
      setScreen('home');
    } else {
      setScreen('welcome');
    }
    setLoading(false);
  }, []);

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

  // Welcome: create new profile with optional placement test results
  const handleWelcomeComplete = useCallback((name: string, placementResults: PlacementResult[]) => {
    const newProfile = createNewProfile(name);
    const today = todayISO();

    if (placementResults.length > 0) {
      for (const result of placementResults) {
        const fact = newProfile.facts.find((f) => getFactKey(f.a, f.b) === result.factKey);
        if (!fact) continue;

        fact.introduced = true;
        fact.lastSeen = today;

        if (result.correct && result.timeMs < RESPONSE_TIME.FAST) {
          fact.box = 3;
        } else if (result.correct && result.timeMs < RESPONSE_TIME.SLOW) {
          fact.box = 2;
        } else {
          fact.box = 1;
        }

        fact.nextDue = addDays(today, BOX_INTERVALS[fact.box]);
        fact.history = [{
          date: today,
          correct: result.correct,
          responseTimeMs: result.timeMs,
          answeredWith: null,
        }];
      }
    }

    setProfile(newProfile);
    setScreen('home');
  }, []);

  // Start session
  const handleStartSession = useCallback(() => {
    if (!profile) return;

    const today = todayISO();
    const questions = composeSession(profile, today);

    sessionConsecutiveCorrect.current = 0;
    sessionMaxConsecutiveCorrect.current = 0;
    sessionResponseTimes.current = [];

    // Snapshot which tables are already fully mastered (box >= 5) before the session
    const alreadyComplete = new Set<number>();
    for (let t = 2; t <= 9; t++) {
      const tf = factsForTable(profile.facts, t);
      if (tf.length > 0 && tf.every((f) => f.box >= 5)) {
        alreadyComplete.add(t);
      }
    }
    tablesCompletedBeforeSession.current = alreadyComplete;

    if (questions.length === 0) {
      return;
    }

    setSessionQuestions(questions);
    setScreen('session');
  }, [profile]);

  // Handle individual answer — use functional updater to avoid stale fact on retries
  const handleAnswer = useCallback(
    (fact: MultiFact, correct: boolean, timeMs: number, answered: number | null) => {
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
    (result: SessionResult) => {
      if (!profile) return;

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

      const updatedProfile: UserProfile = {
        ...profile,
        totalSessions: profile.totalSessions + 1,
        currentStreak,
        longestStreak,
        lastSessionDate: today,
      };

      setPreviousMascotLevel(profile.mascotLevel);
      updatedProfile.mascotLevel = computeMascotLevel(updatedProfile);

      // Pass previousLastSessionDate so PERSEVERANTE badge can check the gap
      const sessionStats = {
        consecutiveCorrect: sessionMaxConsecutiveCorrect.current,
        fastAnswers: sessionResponseTimes.current,
      };
      const earned = checkBadges(updatedProfile, sessionStats, previousLastSessionDate);
      const previousBadgeIds = new Set(profile.badges.map((b) => b.id));
      const brandNewBadges = earned.filter((b) => !previousBadgeIds.has(b.id));

      updatedProfile.badges = [...profile.badges, ...brandNewBadges];

      // Detect newly completed tables (all facts at box >= 5)
      const completedNow: number[] = [];
      for (let t = 2; t <= 9; t++) {
        if (tablesCompletedBeforeSession.current.has(t)) continue;
        const tf = factsForTable(updatedProfile.facts, t);
        if (tf.length > 0 && tf.every((f) => f.box >= 5)) {
          completedNow.push(t);
        }
      }

      setProfile(updatedProfile);
      setSessionResult(result);
      setNewBadges(brandNewBadges);
      setNewlyCompletedTables(completedNow);
      setScreen('recap');
    },
    [profile],
  );

  const handleRecapFinish = useCallback(() => {
    setSessionResult(null);
    setNewBadges([]);
    setNewlyCompletedTables([]);
    setScreen('home');
  }, []);

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

  if (loading) {
    return (
      <div className="app">
        <div className="app-loading">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="app">
      {screen === 'welcome' && (
        <WelcomeScreen onComplete={handleWelcomeComplete} />
      )}

      {screen === 'home' && profile && (
        <HomeScreen
          profile={profile}
          onStart={handleStartSession}
          onShowProgress={() => setScreen('progress')}
          onShowBadges={() => setScreen('badges')}
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
          result={sessionResult}
          newBadges={newBadges}
          newlyCompletedTables={newlyCompletedTables}
          mascotLevel={profile.mascotLevel}
          previousMascotLevel={previousMascotLevel}
          onFinish={handleRecapFinish}
        />
      )}

      {screen === 'progress' && profile && (
        <ProgressScreen profile={profile} onBack={() => setScreen('home')} />
      )}

      {screen === 'badges' && profile && (
        <BadgesScreen
          earnedBadges={profile.badges}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'parent' && profile && (
        <ParentDashboard
          profile={profile}
          onBack={() => setScreen('home')}
          onExport={handleExport}
          onImport={handleImport}
        />
      )}
    </div>
  );
}
