// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UserProfile } from '../types';
import { BADGE_IDS } from '../types';
import {
  checkBadges,
  isDivisionUnlocked,
  visibleBadgeDefinitions,
  factsForDivisionTable,
  DIVISION_BADGE_DEFINITIONS,
} from '../lib/badges';
import { createNewProfile } from '../lib/storage';

function profile(): UserProfile {
  return createNewProfile('Zoé');
}

function earn(p: UserProfile, id: string): void {
  p.badges.push({ id, name: id, description: '', earnedDate: '2026-06-02', icon: '' });
}

describe('isDivisionUnlocked', () => {
  it('faux par défaut, vrai dès le badge Génie de la multiplication', () => {
    const p = profile();
    expect(isDivisionUnlocked(p)).toBe(false);
    earn(p, BADGE_IDS.GENIE_MATHS);
    expect(isDivisionUnlocked(p)).toBe(true);
  });
});

describe('visibleBadgeDefinitions', () => {
  it('masque les badges division tant que le niveau n\'est pas débloqué', () => {
    const p = profile();
    const ids = new Set(visibleBadgeDefinitions(p).map((d) => d.id));
    expect(ids.has(BADGE_IDS.DIV_GENIE)).toBe(false);
  });

  it('révèle les badges division une fois débloqué', () => {
    const p = profile();
    earn(p, BADGE_IDS.GENIE_MATHS);
    const ids = new Set(visibleBadgeDefinitions(p).map((d) => d.id));
    expect(ids.has(BADGE_IDS.DIV_GENIE)).toBe(true);
    expect(ids.has(BADGE_IDS.DIV_PREMIERE_MAITRISE)).toBe(true);
    // 1 + 8 tables + 1 = 10 badges division
    expect(DIVISION_BADGE_DEFINITIONS).toHaveLength(10);
  });
});

describe('checkBadges — division', () => {
  it('n\'attribue aucun badge division sur un profil neuf', () => {
    const p = profile();
    const earned = checkBadges(p);
    expect(earned.some((b) => b.id.startsWith('div-'))).toBe(false);
  });

  it('attribue « Première division maîtrisée » dès un fait en boîte 5', () => {
    const p = profile();
    earn(p, BADGE_IDS.GENIE_MATHS); // niveau débloqué (précondition réelle)
    p.divisionFacts = p.divisionFacts!.map((f, i) => (i === 0 ? { ...f, box: 5 as const } : f));
    const earned = checkBadges(p);
    expect(earned.some((b) => b.id === BADGE_IDS.DIV_PREMIERE_MAITRISE)).toBe(true);
  });

  it('attribue « Divisions par 2 » quand toutes les ÷2 sont en boîte 4+', () => {
    const p = profile();
    earn(p, BADGE_IDS.GENIE_MATHS);
    p.divisionFacts = p.divisionFacts!.map((f) =>
      f.divisor === 2 ? { ...f, box: 4 as const } : f,
    );
    const earned = checkBadges(p);
    expect(earned.some((b) => b.id === `${BADGE_IDS.DIV_TABLE_PREFIX}2`)).toBe(true);
    expect(factsForDivisionTable(p.divisionFacts!, 2)).toHaveLength(8);
  });

  it('attribue « Maître de la division » quand les 64 faits sont en boîte 5', () => {
    const p = profile();
    earn(p, BADGE_IDS.GENIE_MATHS);
    p.divisionFacts = p.divisionFacts!.map((f) => ({ ...f, box: 5 as const }));
    const earned = checkBadges(p);
    expect(earned.some((b) => b.id === BADGE_IDS.DIV_GENIE)).toBe(true);
  });
});
