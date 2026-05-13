// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { checkBadges, getBadgeDetail, isRule11Unlocked } from '../lib/badges';
import { createInitialFacts } from '../lib/facts';
import { importProfile } from '../lib/storage';
import type { UserProfile } from '../types';
import { BADGE_IDS } from '../types';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    name: 'Zoe',
    startDate: '2026-01-01',
    facts: createInitialFacts(),
    totalSessions: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSessionDate: null,
    badges: [],
    sessionHistory: [],
    hasSeenRulesIntro: true,
    hasSeenRule11: false,
    mysteryTheme: 'market',
    ...overrides,
  };
}

describe('badge "Première case révélée" (1er fait en boîte 4)', () => {
  it("ne se déclenche pas tant qu'aucun fait n'a atteint la boîte 4", () => {
    const profile = makeProfile({ totalSessions: 1 });
    profile.facts[0].box = 3;
    profile.facts[1].box = 3;
    const earned = checkBadges(profile);
    expect(earned.some((b) => b.id === BADGE_IDS.PREMIERE_CASE)).toBe(false);
  });

  it('se déclenche dès qu’un seul fait atteint la boîte 4', () => {
    const profile = makeProfile({ totalSessions: 1 });
    profile.facts[0].box = 4;
    const earned = checkBadges(profile);
    expect(earned.some((b) => b.id === BADGE_IDS.PREMIERE_CASE)).toBe(true);
  });

  it('se déclenche aussi si un fait atteint directement la boîte 5', () => {
    const profile = makeProfile({ totalSessions: 1 });
    profile.facts[0].box = 5;
    const earned = checkBadges(profile);
    expect(earned.some((b) => b.id === BADGE_IDS.PREMIERE_CASE)).toBe(true);
  });

  it('n’est plus rendu si déjà débloqué (anti-doublon)', () => {
    const profile = makeProfile({
      totalSessions: 2,
      badges: [
        {
          id: BADGE_IDS.PREMIERE_CASE,
          name: 'Première case révélée',
          description: 'Une multiplication presque maîtrisée',
          earnedDate: '2026-01-02',
          icon: '🖼️',
        },
      ],
    });
    profile.facts[0].box = 4;
    profile.facts[1].box = 4;
    const earned = checkBadges(profile);
    expect(earned.some((b) => b.id === BADGE_IDS.PREMIERE_CASE)).toBe(false);
  });

  it('progress: 0/1 quand aucun fait en boîte 4', () => {
    const profile = makeProfile();
    profile.facts[0].box = 3;
    const detail = getBadgeDetail(BADGE_IDS.PREMIERE_CASE, profile);
    expect(detail.progress).toEqual({ current: 0, target: 1, unitLabel: 'en boîte 4' });
  });

  it('progress: 1/1 plafonné même si plusieurs faits en boîte 4', () => {
    const profile = makeProfile();
    profile.facts[0].box = 4;
    profile.facts[1].box = 5;
    const detail = getBadgeDetail(BADGE_IDS.PREMIERE_CASE, profile);
    expect(detail.progress).toEqual({ current: 1, target: 1, unitLabel: 'en boîte 4' });
  });
});

describe('badge "Première multiplication maîtrisée" (1er fait en boîte 5)', () => {
  it("ne se déclenche pas tant qu'aucun fait n'a atteint la boîte 5", () => {
    const profile = makeProfile({ totalSessions: 1 });
    profile.facts[0].box = 4;
    profile.facts[1].box = 4;
    const earned = checkBadges(profile);
    expect(earned.some((b) => b.id === BADGE_IDS.PREMIERE_MAITRISE)).toBe(false);
  });

  it('se déclenche dès qu’un seul fait atteint la boîte 5', () => {
    const profile = makeProfile({ totalSessions: 1 });
    profile.facts[0].box = 5;
    const earned = checkBadges(profile);
    expect(earned.some((b) => b.id === BADGE_IDS.PREMIERE_MAITRISE)).toBe(true);
  });

  it('progress: 0/1 quand aucun fait en boîte 5', () => {
    const profile = makeProfile();
    profile.facts[0].box = 4;
    const detail = getBadgeDetail(BADGE_IDS.PREMIERE_MAITRISE, profile);
    expect(detail.progress).toEqual({ current: 0, target: 1, unitLabel: 'en boîte 5' });
  });

  it('progress: 1/1 plafonné même si plusieurs faits en boîte 5', () => {
    const profile = makeProfile();
    profile.facts[0].box = 5;
    profile.facts[1].box = 5;
    const detail = getBadgeDetail(BADGE_IDS.PREMIERE_MAITRISE, profile);
    expect(detail.progress).toEqual({ current: 1, target: 1, unitLabel: 'en boîte 5' });
  });
});

describe('rétro-attribution des badges au chargement du profil', () => {
  it('attribue un badge dont le critère est déjà rempli mais absent du profil (nouveau badge ajouté après coup)', () => {
    const profile = makeProfile({ totalSessions: 3 });
    profile.facts[0].box = 4;
    profile.facts[1].box = 5;

    const loaded = importProfile(JSON.stringify(profile))!;

    const ids = new Set(loaded.badges.map((b) => b.id));
    expect(ids.has(BADGE_IDS.PREMIER_PAS)).toBe(true);
    expect(ids.has(BADGE_IDS.PREMIERE_CASE)).toBe(true);
    expect(ids.has(BADGE_IDS.PREMIERE_MAITRISE)).toBe(true);
  });

  it('ne dédouble pas les badges déjà présents dans le profil', () => {
    const profile = makeProfile({
      totalSessions: 3,
      badges: [
        {
          id: BADGE_IDS.PREMIER_PAS,
          name: 'Premier pas',
          description: 'Terminer la première séance',
          earnedDate: '2026-01-02',
          icon: '🌱',
        },
      ],
    });
    profile.facts[0].box = 4;

    const loaded = importProfile(JSON.stringify(profile))!;

    const premierPasCount = loaded.badges.filter((b) => b.id === BADGE_IDS.PREMIER_PAS).length;
    expect(premierPasCount).toBe(1);
  });
});

describe('isRule11Unlocked (règle bonus ×11)', () => {
  it('renvoie false sur un profil neuf (faits en boîte 1)', () => {
    expect(isRule11Unlocked(makeProfile())).toBe(false);
  });

  it("renvoie false tant qu'un seul fait est encore en boîte ≤ 3", () => {
    const profile = makeProfile();
    profile.facts.forEach((f) => { f.box = 4; });
    profile.facts[0].box = 3;
    expect(isRule11Unlocked(profile)).toBe(false);
  });

  it('renvoie true dès que tous les faits sont en boîte ≥ 4', () => {
    const profile = makeProfile();
    profile.facts.forEach((f) => { f.box = 4; });
    expect(isRule11Unlocked(profile)).toBe(true);
  });

  it('renvoie true aussi avec un mix boîtes 4 et 5', () => {
    const profile = makeProfile();
    profile.facts.forEach((f, i) => { f.box = i % 2 === 0 ? 4 : 5; });
    expect(isRule11Unlocked(profile)).toBe(true);
  });
});

describe('migration UserProfile.hasSeenRule11', () => {
  it('défaut à false pour un profil legacy sans le champ', () => {
    const legacy = makeProfile() as Partial<UserProfile>;
    delete legacy.hasSeenRule11;
    const loaded = importProfile(JSON.stringify(legacy))!;
    expect(loaded.hasSeenRule11).toBe(false);
  });

  it('préserve true si le profil l\'a déjà à true', () => {
    const profile = makeProfile({ hasSeenRule11: true });
    const loaded = importProfile(JSON.stringify(profile))!;
    expect(loaded.hasSeenRule11).toBe(true);
  });
});
