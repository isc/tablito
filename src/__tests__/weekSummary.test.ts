// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { accuracyTrend, speedTrend, weekSummary } from '../lib/weekSummary';
import { createNewProfile } from '../lib/storage';
import type { SessionResult, UserProfile } from '../types';

// ---------------------------------------------------------------------------
// Le point de la semaine : les 7 derniers jours (aujourd'hui compris) comparés
// aux 7 d'avant, et seulement quand la comparaison est juste.
// ---------------------------------------------------------------------------

const TODAY = '2026-09-20';
// Fenêtres : cette semaine du 14 au 20, la semaine d'avant du 7 au 13.

type Session = Partial<SessionResult> & { date: string };

function session(over: Session): SessionResult {
  return {
    kind: 'mult',
    questionsCount: 10,
    correctCount: 8,
    averageTimeMs: 3000,
    newFactsIntroduced: 0,
    factsPromoted: 0,
    ...over,
  };
}

// Un profil commencé bien avant les deux semaines, sauf mention contraire.
function profileWith(sessions: Session[], extra: Partial<UserProfile> = {}): UserProfile {
  return { ...createNewProfile('Zoé'), startDate: '2026-06-01', sessionHistory: sessions.map(session), ...extra };
}

describe('weekSummary', () => {
  it('compte les jours pratiqués, pas les séances', () => {
    const week = weekSummary(
      profileWith([
        { date: '2026-09-15' },
        { date: '2026-09-15', kind: 'conj' },
        { date: '2026-09-18' },
        { date: TODAY, kind: 'conj' },
      ]),
      TODAY,
      true,
    );
    expect(week.days).toBe(3);
    expect(week.math?.sessions).toBe(2);
    expect(week.conj?.sessions).toBe(2);
  });

  it("borne la semaine à aujourd'hui et aux 6 jours d'avant", () => {
    const week = weekSummary(profileWith([{ date: '2026-09-13' }, { date: '2026-09-14' }]), TODAY, false);
    expect(week.days).toBe(1);
  });

  it("compare les jours à la semaine d'avant", () => {
    const week = weekSummary(
      profileWith([{ date: '2026-09-08' }, { date: '2026-09-14' }, { date: '2026-09-16' }]),
      TODAY,
      false,
    );
    expect(week.daysDelta).toBe(1);
  });

  it("ne compare pas les jours d'un enfant qui n'avait pas encore commencé", () => {
    const week = weekSummary(profileWith([{ date: '2026-09-15' }], { startDate: '2026-09-10' }), TODAY, false);
    expect(week.daysDelta).toBeNull();
  });

  it('pondère la réussite et la rapidité par le nombre de questions', () => {
    const week = weekSummary(
      profileWith([
        { date: '2026-09-15', questionsCount: 10, correctCount: 10, averageTimeMs: 2000 },
        { date: '2026-09-16', questionsCount: 30, correctCount: 21, averageTimeMs: 4000 },
      ]),
      TODAY,
      false,
    );
    // 31 bonnes sur 40 ; (10 × 2 s + 30 × 4 s) / 40 = 3,5 s.
    expect(week.math).toMatchObject({ accuracy: 78, seconds: 3.5 });
  });

  it("compare réussite et rapidité à la semaine d'avant, au même niveau", () => {
    const week = weekSummary(
      profileWith([
        { date: '2026-09-08', correctCount: 7, averageTimeMs: 3100 },
        { date: '2026-09-15', correctCount: 9, averageTimeMs: 2600 },
      ]),
      TODAY,
      false,
    );
    expect(week.math).toMatchObject({ accuracyDelta: 20, secondsDelta: -0.5 });
  });

  it('ne compare pas les maths à travers un changement de niveau', () => {
    const week = weekSummary(
      profileWith([
        { date: '2026-09-08', kind: 'div' },
        { date: '2026-09-15', kind: 'rem' },
      ]),
      TODAY,
      false,
    );
    expect(week.math).toMatchObject({ accuracyDelta: null, secondsDelta: null });
  });

  it("ne compare rien sans séance la semaine d'avant", () => {
    const week = weekSummary(profileWith([{ date: '2026-09-15' }]), TODAY, false);
    expect(week.math).toMatchObject({ accuracyDelta: null, secondsDelta: null });
  });

  it('ignore la conjugaison quand elle est masquée', () => {
    const week = weekSummary(profileWith([{ date: '2026-09-15', kind: 'conj', factsPromoted: 4 }]), TODAY, false);
    expect(week).toMatchObject({ days: 0, math: null, conj: null, promoted: 0 });
  });

  it('additionne les faits promus et découverts de la semaine', () => {
    const week = weekSummary(
      profileWith([
        { date: '2026-09-08', factsPromoted: 9, newFactsIntroduced: 9 },
        { date: '2026-09-15', factsPromoted: 3, newFactsIntroduced: 2 },
        { date: '2026-09-16', kind: 'conj', factsPromoted: 4, newFactsIntroduced: 1 },
      ]),
      TODAY,
      true,
    );
    expect(week).toMatchObject({ promoted: 7, discovered: 3 });
  });

  it('une semaine sans séance', () => {
    const week = weekSummary(profileWith([{ date: '2026-09-01' }]), TODAY, true);
    expect(week).toMatchObject({ days: 0, math: null, conj: null, promoted: 0, discovered: 0 });
  });
});

describe('tendances', () => {
  it('la réussite est stable sous 3 points', () => {
    expect(accuracyTrend(2)).toBe('same');
    expect(accuracyTrend(-2)).toBe('same');
    expect(accuracyTrend(3)).toBe('better');
    expect(accuracyTrend(-3)).toBe('worse');
  });

  it('la rapidité progresse quand le temps baisse, au-delà de 0,2 s', () => {
    expect(speedTrend(-0.1)).toBe('same');
    expect(speedTrend(-0.2)).toBe('better');
    expect(speedTrend(0.4)).toBe('worse');
  });
});
