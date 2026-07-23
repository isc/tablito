// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UserProfile } from '../types';
import { BADGE_IDS, remainderDividend } from '../types';
import { createNewProfile } from '../lib/storage';
import { composeDailySession } from '../lib/dailyComposer';
import { createInitialRemainderFacts, introRemainder, drawRemainder } from '../lib/remainderFacts';
import { getRemainderFactKey, parentDivisionKey } from '../lib/remainderFacts';

const NOW = '2026-07-23';

// Profil niveau 3 : tables et divisions toutes en boîte 5 (non dues), badges
// de déblocage présents (tables + divisions par N).
function level3Profile(): UserProfile {
  const p = createNewProfile('Zoé');
  p.facts = p.facts.map((f) => ({
    ...f,
    box: 5 as const,
    introduced: true,
    lastSeen: '2026-07-01',
    nextDue: '2099-12-31',
  }));
  p.divisionFacts = p.divisionFacts!.map((f) => ({
    ...f,
    box: 5 as const,
    introduced: true,
    lastSeen: '2026-07-01',
    nextDue: '2099-12-31',
  }));
  for (let n = 2; n <= 9; n++) {
    p.badges.push({ id: `${BADGE_IDS.TABLE_PREFIX}${n}`, earnedDate: '2026-06-01', icon: '' });
    p.badges.push({ id: `${BADGE_IDS.DIV_TABLE_PREFIX}${n}`, earnedDate: '2026-07-01', icon: '' });
  }
  return p;
}

describe('composeDailySession — niveau 3 actif (specs §12.3)', () => {
  it('niveau 3 débloqué → la séance du jour contient des questions avec reste', () => {
    const p = level3Profile();
    const session = composeDailySession(p, NOW);
    expect(session.length).toBeGreaterThanOrEqual(1);
    expect(session.some((i) => i.kind === 'rem')).toBe(true);
    // Les intros passent en tête, plafonnées à 2.
    const intros = session.filter((i) => i.isIntroduction);
    expect(intros.length).toBeLessThanOrEqual(2);
    expect(intros.every((i) => i.kind === 'rem')).toBe(true);
  });

  it('divisions par N pas toutes badgées → séance division (niveau 2), pas de reste', () => {
    const p = level3Profile();
    p.badges = p.badges.filter((b) => b.id !== `${BADGE_IDS.DIV_TABLE_PREFIX}9`);
    const session = composeDailySession(p, NOW);
    expect(session.some((i) => i.kind === 'rem')).toBe(false);
  });

  it("l'entretien × et ÷ dus est intégré, plafonné à 6 au total", () => {
    const p = level3Profile();
    // 5 tables et 5 divisions dues → 10 candidats, plafond 6.
    p.facts = p.facts.map((f, i) => (i < 5 ? { ...f, nextDue: '' } : f));
    p.divisionFacts = p.divisionFacts!.map((f, i) => (i < 5 ? { ...f, nextDue: '' } : f));
    // Zones déjà bien avancées pour que la séance ne soit pas dominée par le padding.
    p.remainderFacts = p.remainderFacts!.map((f) => ({
      ...f,
      introduced: true,
      box: 3 as const,
      nextDue: '',
    }));
    const session = composeDailySession(p, NOW);
    const maintenance = session.filter(
      (i) => (i.kind === 'mult' || i.kind === 'div') && !i.isBonusReview,
    );
    expect(maintenance.length).toBeGreaterThan(0);
    expect(maintenance.length).toBeLessThanOrEqual(6);
    expect(session.some((i) => i.kind === 'rem')).toBe(true);
  });

  it('PLANCHER — premiers jours du niveau 3 : la séance atteint ~12 questions via du bonus', () => {
    const p = level3Profile();
    const session = composeDailySession(p, NOW);
    expect(session.length).toBeGreaterThanOrEqual(12);
    // Le padding vient des niveaux précédents (réserve inépuisable).
    expect(session.some((i) => i.isBonusReview)).toBe(true);
  });

  // NB : l'entrelacement anti-interférence est best-effort (interleaveGreedy,
  // « quand c'est possible » §6.2) — pas d'assertion d'adjacence stricte ici ;
  // le conflit même-diviseur est couvert par les tests d'intro du composer.
});

describe('remainderFacts — inventaire (specs §12.2)', () => {
  it('64 zones, un couple (diviseur, quotient) chacun dans 2..9', () => {
    const facts = createInitialRemainderFacts();
    expect(facts).toHaveLength(64);
    const keys = new Set(facts.map((f) => getRemainderFactKey(f.divisor, f.quotient)));
    expect(keys.size).toBe(64);
    for (const f of facts) {
      expect(f.divisor).toBeGreaterThanOrEqual(2);
      expect(f.divisor).toBeLessThanOrEqual(9);
      expect(f.quotient).toBeGreaterThanOrEqual(2);
      expect(f.quotient).toBeLessThanOrEqual(9);
      expect(f.box).toBe(1);
      expect(f.introduced).toBe(false);
    }
  });

  it('la clé parente pointe la division exacte de la même case', () => {
    const facts = createInitialRemainderFacts();
    const zone = facts.find((f) => f.divisor === 7 && f.quotient === 6)!;
    expect(parentDivisionKey(zone)).toBe('42/7');
  });

  it('introRemainder est non nul et dans la zone ; drawRemainder couvre 0..d-1', () => {
    for (let d = 2; d <= 9; d++) {
      const r = introRemainder(d);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThan(d);
      const seen = new Set<number>();
      for (let i = 0; i < 500; i++) seen.add(drawRemainder(d));
      expect(seen.size).toBe(d); // 0..d-1 tous atteints
    }
  });

  it('remainderDividend recompose le dividende affiché', () => {
    const zone = createInitialRemainderFacts().find((f) => f.divisor === 7 && f.quotient === 6)!;
    expect(remainderDividend({ fact: zone, remainder: 3 })).toBe(45);
    expect(remainderDividend({ fact: zone, remainder: 0 })).toBe(42);
  });
});
