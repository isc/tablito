// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { weekSummary } from '../lib/weekSummary';
import { createNewProfile } from '../lib/storage';
import type { SessionResult, UserProfile } from '../types';
import { makeSession } from './helpers/sessions';

// ---------------------------------------------------------------------------
// Le point de la semaine : les 7 derniers jours (aujourd'hui compris) comparés
// aux 7 d'avant, et seulement quand la comparaison est juste.
// ---------------------------------------------------------------------------

const TODAY = '2026-09-20';
// Fenêtres : cette semaine du 14 au 20, la semaine d'avant du 7 au 13.

// Un profil commencé bien avant les deux semaines, sauf mention contraire.
function profileWith(sessions: SessionResult[], extra: Partial<UserProfile> = {}): UserProfile {
  return { ...createNewProfile('Zoé'), startDate: '2026-06-01', sessionHistory: sessions, ...extra };
}

const MATH = ['math' as const];
const BOTH = ['math' as const, 'conj' as const];

describe('weekSummary', () => {
  it('compte les jours pratiqués, pas les séances', () => {
    const week = weekSummary(
      profileWith([
        makeSession('2026-09-15'),
        makeSession('2026-09-15', { kind: 'conj' }),
        makeSession('2026-09-18'),
        makeSession(TODAY, { kind: 'conj' }),
      ]),
      TODAY,
      BOTH,
    );
    expect(week?.days).toBe(3);
  });

  it("borne la semaine à aujourd'hui et aux 6 jours d'avant", () => {
    const week = weekSummary(profileWith([makeSession('2026-09-13'), makeSession('2026-09-14')]), TODAY, MATH);
    expect(week?.days).toBe(1);
  });

  it("compare les jours à la semaine d'avant", () => {
    const week = weekSummary(
      profileWith([makeSession('2026-09-08'), makeSession('2026-09-14'), makeSession('2026-09-16')]),
      TODAY,
      MATH,
    );
    expect(week?.daysVs).toEqual({ delta: 1, trend: 'better' });
  });

  it("ne compare pas les jours d'un enfant qui n'avait pas encore commencé", () => {
    const week = weekSummary(profileWith([makeSession('2026-09-15')], { startDate: '2026-09-10' }), TODAY, MATH);
    expect(week?.daysVs).toBeNull();
  });

  it('pondère la réussite et la rapidité par le nombre de questions', () => {
    const week = weekSummary(
      profileWith([
        makeSession('2026-09-15', { questionsCount: 10, correctCount: 10, averageTimeMs: 2000 }),
        makeSession('2026-09-16', { questionsCount: 30, correctCount: 21, averageTimeMs: 4000 }),
      ]),
      TODAY,
      MATH,
    );
    // 31 bonnes sur 40 ; (10 × 2 s + 30 × 4 s) / 40 = 3,5 s.
    expect(week?.math).toMatchObject({ accuracy: 78, seconds: 3.5 });
  });

  it("compare réussite et rapidité à la semaine d'avant, au même niveau", () => {
    const week = weekSummary(
      profileWith([
        makeSession('2026-09-08', { correctCount: 7, averageTimeMs: 3100 }),
        makeSession('2026-09-15', { correctCount: 9, averageTimeMs: 2600 }),
      ]),
      TODAY,
      MATH,
    );
    expect(week?.math).toMatchObject({
      accuracyVs: { delta: 20, trend: 'better' },
      secondsVs: { delta: -0.5, trend: 'better' },
    });
  });

  it('un écart négligeable est « comme la semaine d’avant »', () => {
    const week = weekSummary(
      profileWith([
        makeSession('2026-09-08', { questionsCount: 50, correctCount: 40, averageTimeMs: 3000 }),
        makeSession('2026-09-15', { questionsCount: 50, correctCount: 41, averageTimeMs: 2900 }),
      ]),
      TODAY,
      MATH,
    );
    // + 2 points, − 0,1 s : sous les seuils de 3 points et 0,2 s.
    expect(week?.math).toMatchObject({
      accuracyVs: { delta: 2, trend: 'same' },
      secondsVs: { delta: -0.1, trend: 'same' },
    });
  });

  it('plus lent, c’est un recul', () => {
    const week = weekSummary(
      profileWith([makeSession('2026-09-08'), makeSession('2026-09-15', { averageTimeMs: 3400 })]),
      TODAY,
      MATH,
    );
    expect(week?.math?.secondsVs).toEqual({ delta: 0.4, trend: 'worse' });
  });

  it('ne compare pas les maths à travers un changement de niveau', () => {
    const week = weekSummary(
      profileWith([makeSession('2026-09-08', { kind: 'div' }), makeSession('2026-09-15', { kind: 'rem' })]),
      TODAY,
      MATH,
    );
    expect(week?.math).toMatchObject({ accuracyVs: null, secondsVs: null });
  });

  it("ne compare rien sans séance la semaine d'avant", () => {
    const week = weekSummary(profileWith([makeSession('2026-09-15')]), TODAY, MATH);
    expect(week?.math).toMatchObject({ accuracyVs: null, secondsVs: null });
  });

  it('additionne les faits promus et découverts de la semaine', () => {
    const week = weekSummary(
      profileWith([
        makeSession('2026-09-08', { factsPromoted: 9, newFactsIntroduced: 9 }),
        makeSession('2026-09-15', { factsPromoted: 3, newFactsIntroduced: 2 }),
        makeSession('2026-09-16', { kind: 'conj', factsPromoted: 4, newFactsIntroduced: 1 }),
      ]),
      TODAY,
      BOTH,
    );
    expect(week).toMatchObject({ promoted: 7, discovered: 3 });
  });

  it('une semaine sans séance', () => {
    const week = weekSummary(profileWith([makeSession('2026-09-01')]), TODAY, BOTH);
    expect(week).toMatchObject({ days: 0, math: null, conj: null, promoted: 0, discovered: 0 });
  });

  it("rien à résumer sans aucune séance des matières lues — une matière masquée ne compte pas", () => {
    expect(weekSummary(profileWith([]), TODAY, BOTH)).toBeNull();
    expect(weekSummary(profileWith([makeSession('2026-09-15', { kind: 'conj' })]), TODAY, MATH)).toBeNull();
  });
});
