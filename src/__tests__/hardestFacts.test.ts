// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { getHardestFacts } from '../lib/hardestFacts';
import { createInitialFacts } from '../lib/facts';
import { createInitialDivisionFacts } from '../lib/divisionFacts';
import type { UserProfile, SessionResult, SessionQuestionLog } from '../types';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    name: 'Zoe',
    startDate: '2026-01-01',
    facts: createInitialFacts(),
    totalSessions: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSessionDate: null,
    streakFreezes: 0,
    badges: [],
    sessionHistory: [],
    hasSeenRulesIntro: true,
    hasSeenRule11: false,
    mysteryTheme: 'market',
    ...overrides,
  };
}

function makeSession(
  date: string,
  questions: Partial<SessionQuestionLog>[] | undefined,
): SessionResult {
  const qs = questions?.map((q) => ({
    a: 2,
    b: 3,
    correct: true,
    responseTimeMs: 2000,
    answeredWith: null,
    isBonusReview: false,
    inputMode: 'keypad' as const,
    ...q,
  }));
  return {
    date,
    questionsCount: qs?.length ?? 10,
    correctCount: qs?.filter((q) => q.correct).length ?? 10,
    averageTimeMs: 2000,
    newFactsIntroduced: 0,
    factsPromoted: 0,
    ...(qs ? { questions: qs } : {}),
  };
}

function introduce(profile: UserProfile, a: number, b: number): void {
  const fact = profile.facts.find((f) => f.a === a && f.b === b)!;
  fact.introduced = true;
}

describe('getHardestFacts — comptage depuis les logs de séance', () => {
  it('compte les erreurs des révisions bonus (absentes de fact.history)', () => {
    // Bug historique : une erreur en révision bonus baissait le taux de bonnes
    // réponses de la séance mais n'apparaissait jamais dans les faits les plus
    // difficiles (fact.history n'enregistre pas les révisions bonus).
    const profile = makeProfile();
    introduce(profile, 7, 8);
    profile.sessionHistory = [
      makeSession('2026-07-19', [
        { a: 7, b: 8, correct: false, isBonusReview: true },
      ]),
    ];

    const hard = getHardestFacts(profile, 10, 5);
    expect(hard).toHaveLength(1);
    expect(hard[0]).toMatchObject({ kind: 'mult', a: 7, b: 8, errorCount: 1 });
  });

  it('ignore les erreurs des séances hors de la fenêtre', () => {
    const profile = makeProfile();
    introduce(profile, 7, 8);
    introduce(profile, 6, 9);
    profile.sessionHistory = [
      makeSession('2026-07-01', [{ a: 7, b: 8, correct: false }]),
      makeSession('2026-07-02', [{ a: 6, b: 9, correct: false }]),
      makeSession('2026-07-03', []),
    ];

    const hard = getHardestFacts(profile, 2, 5);
    expect(hard).toHaveLength(1);
    expect(hard[0]).toMatchObject({ kind: 'mult', a: 6, b: 9 });
  });

  it('cumule les erreurs sur plusieurs séances et trie par erreurs décroissantes', () => {
    const profile = makeProfile();
    introduce(profile, 7, 8);
    introduce(profile, 6, 9);
    profile.sessionHistory = [
      makeSession('2026-07-18', [
        { a: 7, b: 8, correct: false },
        { a: 6, b: 9, correct: false },
      ]),
      makeSession('2026-07-19', [{ a: 7, b: 8, correct: false, isBonusReview: true }]),
    ];

    const hard = getHardestFacts(profile, 10, 5);
    expect(hard.map((f) => [f.key, f.errorCount])).toEqual([
      ['7x8', 2],
      ['6x9', 1],
    ]);
  });

  it('mappe les logs division (a = diviseur, b = quotient) sur le bon fait', () => {
    const profile = makeProfile({ divisionFacts: createInitialDivisionFacts() });
    const fact = profile.divisionFacts!.find((f) => f.dividend === 24 && f.divisor === 3)!;
    fact.introduced = true;
    fact.box = 4;
    profile.sessionHistory = [
      makeSession('2026-07-20', [{ kind: 'div', a: 3, b: 8, correct: false }]),
    ];

    const hard = getHardestFacts(profile, 10, 5);
    expect(hard).toHaveLength(1);
    expect(hard[0]).toMatchObject({
      kind: 'div',
      dividend: 24,
      divisor: 3,
      quotient: 8,
      box: 4,
      errorCount: 1,
    });
  });

  it('exclut les faits sans erreur et tronque à limit', () => {
    const profile = makeProfile();
    const pairs: Array<[number, number]> = [
      [2, 3],
      [2, 4],
      [2, 5],
      [2, 6],
      [2, 7],
      [2, 8],
    ];
    for (const [a, b] of pairs) introduce(profile, a, b);
    profile.sessionHistory = [
      makeSession(
        '2026-07-20',
        pairs.map(([a, b]) => ({ a, b, correct: false })),
      ),
    ];

    const hard = getHardestFacts(profile, 10, 5);
    expect(hard).toHaveLength(5);
    expect(hard.every((f) => f.errorCount > 0)).toBe(true);
  });

  it('repli fact.history quand aucune séance de la fenêtre n’a de log', () => {
    const profile = makeProfile();
    introduce(profile, 7, 8);
    const fact = profile.facts.find((f) => f.a === 7 && f.b === 8)!;
    fact.history = [
      { date: '2026-07-19', correct: false, responseTimeMs: 3000, answeredWith: 54 },
    ];
    profile.sessionHistory = [makeSession('2026-07-19', undefined)];

    const hard = getHardestFacts(profile, 10, 5);
    expect(hard).toHaveLength(1);
    expect(hard[0]).toMatchObject({ kind: 'mult', a: 7, b: 8, errorCount: 1 });
  });
});
