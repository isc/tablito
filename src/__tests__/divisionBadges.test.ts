// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UserProfile } from '../types';
import { BADGE_IDS } from '../types';
import {
  checkBadges,
  isDivisionUnlocked,
  visibleBadgeDefinitions,
  factsForDivisionTable,
  getCompletedDivisionTables,
  getDivisionBadgeDefinitions,
} from '../lib/badges';
import { createNewProfile } from '../lib/storage';

function profile(): UserProfile {
  return createNewProfile('Zoé');
}

function earn(p: UserProfile, id: string): void {
  p.badges.push({ id, earnedDate: '2026-06-02', icon: '' });
}

// Débloque le niveau 2 : les 8 badges de table (n=2..9). C'est désormais le
// critère réel, pas « Génie de la multiplication » (boîte 5 partout).
function unlockDivision(p: UserProfile): void {
  for (let n = 2; n <= 9; n++) earn(p, `${BADGE_IDS.TABLE_PREFIX}${n}`);
}

describe('isDivisionUnlocked', () => {
  it('faux par défaut, vrai dès les 8 badges de table', () => {
    const p = profile();
    expect(isDivisionUnlocked(p)).toBe(false);
    // 7 tables ne suffisent pas.
    for (let n = 2; n <= 8; n++) earn(p, `${BADGE_IDS.TABLE_PREFIX}${n}`);
    expect(isDivisionUnlocked(p)).toBe(false);
    earn(p, `${BADGE_IDS.TABLE_PREFIX}9`);
    expect(isDivisionUnlocked(p)).toBe(true);
  });

  it('le badge Génie seul ne débloque PAS (découplé du niveau 2)', () => {
    const p = profile();
    earn(p, BADGE_IDS.GENIE_MATHS);
    expect(isDivisionUnlocked(p)).toBe(false);
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
    unlockDivision(p);
    const ids = new Set(visibleBadgeDefinitions(p).map((d) => d.id));
    expect(ids.has(BADGE_IDS.DIV_GENIE)).toBe(true);
    expect(ids.has(BADGE_IDS.DIV_PREMIERE_MAITRISE)).toBe(true);
    // 1 + 8 tables + 1 = 10 badges division
    expect(getDivisionBadgeDefinitions()).toHaveLength(10);
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
    unlockDivision(p); // niveau débloqué (précondition réelle)
    p.divisionFacts = p.divisionFacts!.map((f, i) => (i === 0 ? { ...f, box: 5 as const } : f));
    const earned = checkBadges(p);
    expect(earned.some((b) => b.id === BADGE_IDS.DIV_PREMIERE_MAITRISE)).toBe(true);
  });

  it('attribue « Divisions par 2 » quand toutes les ÷2 sont en boîte 4+', () => {
    const p = profile();
    unlockDivision(p);
    p.divisionFacts = p.divisionFacts!.map((f) =>
      f.divisor === 2 ? { ...f, box: 4 as const } : f,
    );
    const earned = checkBadges(p);
    expect(earned.some((b) => b.id === `${BADGE_IDS.DIV_TABLE_PREFIX}2`)).toBe(true);
    expect(factsForDivisionTable(p.divisionFacts!, 2)).toHaveLength(8);
  });

  it('attribue « Maître de la division » quand les 64 faits sont en boîte 5', () => {
    const p = profile();
    unlockDivision(p);
    p.divisionFacts = p.divisionFacts!.map((f) => ({ ...f, box: 5 as const }));
    const earned = checkBadges(p);
    expect(earned.some((b) => b.id === BADGE_IDS.DIV_GENIE)).toBe(true);
  });
});

describe('getCompletedDivisionTables', () => {
  it('ne compte une « table » de division complète qu\'à la boîte 5 de tous ses faits', () => {
    const p = profile();
    // ÷2 toutes en boîte 5 → complète ; ÷3 en boîte 4 → pas encore.
    p.divisionFacts = p.divisionFacts!.map((f) => {
      if (f.divisor === 2) return { ...f, box: 5 as const };
      if (f.divisor === 3) return { ...f, box: 4 as const };
      return f;
    });
    const completed = getCompletedDivisionTables(p.divisionFacts!);
    expect(completed.has(2)).toBe(true);
    expect(completed.has(3)).toBe(false);
    expect(completed.has(7)).toBe(false);
  });

  it('vide sur un profil neuf', () => {
    expect(getCompletedDivisionTables(profile().divisionFacts!).size).toBe(0);
  });
});
