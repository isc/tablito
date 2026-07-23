// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UserProfile } from '../types';
import { BADGE_IDS } from '../types';
import {
  checkBadges,
  isRemainderUnlocked,
  visibleBadgeDefinitions,
  getCompletedRemainderTables,
  getRemainderBadgeDefinitions,
} from '../lib/badges';
import { createNewProfile } from '../lib/storage';

function profile(): UserProfile {
  return createNewProfile('Zoé');
}

function earn(p: UserProfile, id: string): void {
  p.badges.push({ id, earnedDate: '2026-07-23', icon: '' });
}

// Débloque le niveau 3 : les 8 badges « Divisions par N » (specs §12.3).
function unlockRemainder(p: UserProfile): void {
  for (let n = 2; n <= 9; n++) earn(p, `${BADGE_IDS.DIV_TABLE_PREFIX}${n}`);
}

describe('isRemainderUnlocked', () => {
  it('faux par défaut, vrai dès les 8 badges « Divisions par N »', () => {
    const p = profile();
    expect(isRemainderUnlocked(p)).toBe(false);
    for (let n = 2; n <= 8; n++) earn(p, `${BADGE_IDS.DIV_TABLE_PREFIX}${n}`);
    expect(isRemainderUnlocked(p)).toBe(false);
    earn(p, `${BADGE_IDS.DIV_TABLE_PREFIX}9`);
    expect(isRemainderUnlocked(p)).toBe(true);
  });

  it('le badge Maître de la division seul ne débloque PAS (découplé, cf. §12.3)', () => {
    const p = profile();
    earn(p, BADGE_IDS.DIV_GENIE);
    expect(isRemainderUnlocked(p)).toBe(false);
  });
});

describe('visibleBadgeDefinitions — niveau 3', () => {
  it("masque les badges niveau 3 tant qu'il n'est pas débloqué", () => {
    const p = profile();
    const ids = new Set(visibleBadgeDefinitions(p).map((d) => d.id));
    expect(ids.has(BADGE_IDS.REM_GENIE)).toBe(false);
    expect(ids.has(BADGE_IDS.REM_PREMIERE_MAITRISE)).toBe(false);
  });

  it('révèle les badges niveau 3 une fois débloqué', () => {
    const p = profile();
    unlockRemainder(p);
    const ids = new Set(visibleBadgeDefinitions(p).map((d) => d.id));
    expect(ids.has(BADGE_IDS.REM_GENIE)).toBe(true);
    expect(ids.has(BADGE_IDS.REM_PREMIERE_MAITRISE)).toBe(true);
    // 1 + 8 diviseurs + 1 = 10 badges niveau 3.
    expect(getRemainderBadgeDefinitions()).toHaveLength(10);
  });
});

describe('checkBadges — badges niveau 3', () => {
  it("n'attribue rien tant que le niveau n'est pas débloqué, même avec des zones en boîte 5", () => {
    const p = profile();
    p.remainderFacts = p.remainderFacts!.map((f) => ({ ...f, box: 5 as const, introduced: true }));
    expect(checkBadges(p).filter((b) => b.id.startsWith('rem-'))).toHaveLength(0);
  });

  it('attribue Premier reste maîtrisé, les 8 « Division avec reste par N » et Grand maître', () => {
    const p = profile();
    unlockRemainder(p);
    p.remainderFacts = p.remainderFacts!.map((f) => ({ ...f, box: 5 as const, introduced: true }));
    const earned = checkBadges(p);
    const ids = new Set(earned.map((b) => b.id));
    expect(ids.has(BADGE_IDS.REM_PREMIERE_MAITRISE)).toBe(true);
    expect(ids.has(BADGE_IDS.REM_GENIE)).toBe(true);
    for (let n = 2; n <= 9; n++) {
      expect(ids.has(`${BADGE_IDS.REM_TABLE_PREFIX}${n}`)).toBe(true);
    }
  });

  it('badge par diviseur dès la boîte 4 sur les 8 zones du diviseur', () => {
    const p = profile();
    unlockRemainder(p);
    p.remainderFacts = p.remainderFacts!.map((f) =>
      f.divisor === 7 ? { ...f, box: 4 as const, introduced: true } : f,
    );
    const ids = new Set(checkBadges(p).map((b) => b.id));
    expect(ids.has(`${BADGE_IDS.REM_TABLE_PREFIX}7`)).toBe(true);
    expect(ids.has(`${BADGE_IDS.REM_TABLE_PREFIX}8`)).toBe(false);
  });
});

describe('getCompletedRemainderTables', () => {
  it('un diviseur est complet quand ses 8 zones sont en boîte 5', () => {
    const p = profile();
    p.remainderFacts = p.remainderFacts!.map((f) =>
      f.divisor === 3 ? { ...f, box: 5 as const, introduced: true } : f,
    );
    const completed = getCompletedRemainderTables(p.remainderFacts!);
    expect(completed.has(3)).toBe(true);
    expect(completed.size).toBe(1);
  });
});
