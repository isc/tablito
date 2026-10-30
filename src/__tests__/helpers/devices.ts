import { applyStreakUpdate } from '../../lib/streak';
import { processAnswer } from '../../lib/leitner';
import { createNewProfile } from '../../lib/storage';
import type { MultiFact, UserProfile } from '../../types';
import { makeSession } from './sessions';

// Un enfant qui joue sur plusieurs appareils (specs §14.4), joués dans le même
// processus : chaque appareil a son localStorage, échangé à la bascule. Sous
// `helpers/` et sans suffixe `.test`, donc jamais collecté par vitest.

const storages = new Map<string, Record<string, string>>();
let current: string | null = null;

/** Oublie tous les appareils (à appeler en beforeEach). */
export function resetDevices(): void {
  storages.clear();
  current = null;
  localStorage.clear();
}

/** Passe sur un autre appareil : son localStorage remplace celui en cours. */
export function onDevice(name: string): void {
  if (current) storages.set(current, { ...localStorage });
  localStorage.clear();
  const saved = storages.get(name) ?? { 'multiplix-lang': 'fr', 'multiplix-skip-install': '1' };
  for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v);
  current = name;
}

export const fact78 = (p: UserProfile): MultiFact => p.facts.find((f) => f.a === 7 && f.b === 8)!;

/** Léa, qui pratique depuis un moment : 40 séances, une série de 12 au
 *  23/10/2026, un gel en réserve, 7×8 en boîte 3. */
export function practising(): UserProfile {
  const p = createNewProfile('Léa');
  p.hasSeenRulesIntro = true;
  p.startDate = '2026-09-01';
  p.totalSessions = 40;
  p.currentStreak = 12;
  p.longestStreak = 12;
  p.lastSessionDate = '2026-10-23';
  p.lastMathSessionDate = '2026-10-23';
  p.freezeProgress = 3;
  p.streakFreezes = 1;
  Object.assign(fact78(p), { introduced: true, box: 3, lastSeen: '2026-10-20', nextDue: '2026-10-23' });
  return p;
}

/** Une séance d'une question sur `day`, close comme App la clôt : la réponse
 *  sur le fait, la séance dans l'historique, la série et le compteur. */
export function playSession(
  p: UserProfile,
  day: string,
  correct: boolean,
  id: string,
  [a, b]: [number, number] = [7, 8],
): UserProfile {
  const streak = applyStreakUpdate(p, day);
  return {
    ...p,
    facts: p.facts.map((f) =>
      f.a === a && f.b === b ? processAnswer(f, correct, correct ? 2000 : 4000, day, 'keypad') : f,
    ),
    totalSessions: p.totalSessions + 1,
    sessionHistory: [...p.sessionHistory, makeSession(day, { id, questionsCount: 1, correctCount: correct ? 1 : 0 })],
    currentStreak: streak.currentStreak,
    longestStreak: Math.max(p.longestStreak, streak.currentStreak),
    streakFreezes: streak.streakFreezes,
    freezeSettledDate: streak.freezeSettledDate,
    freezeProgress: streak.freezeProgress,
    lastSessionDate: day,
    lastMathSessionDate: day,
  };
}
