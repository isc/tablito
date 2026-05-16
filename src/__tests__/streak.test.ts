// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  getActiveStreak,
  isStreakProtectedByFreeze,
  applyStreakUpdate,
  STREAK_FREEZE_INTERVAL,
  STREAK_FREEZE_MAX,
} from '../lib/streak';
import { createNewProfile } from '../lib/storage';
import type { UserProfile } from '../types';

function makeProfile(overrides: Partial<UserProfile>): UserProfile {
  return { ...createNewProfile('Test'), ...overrides };
}

describe('getActiveStreak', () => {
  it('renvoie 0 quand aucune séance n\'a jamais été complétée', () => {
    const profile = makeProfile({ lastSessionDate: null, currentStreak: 0 });
    expect(getActiveStreak(profile, '2026-04-30')).toBe(0);
  });

  it('renvoie la valeur stockée si la dernière séance est aujourd\'hui', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-30', currentStreak: 5 });
    expect(getActiveStreak(profile, '2026-04-30')).toBe(5);
  });

  it('renvoie la valeur stockée si la dernière séance est hier (la série peut encore être prolongée)', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-29', currentStreak: 3 });
    expect(getActiveStreak(profile, '2026-04-30')).toBe(3);
  });

  it('renvoie 0 si la dernière séance date d\'avant-hier sans gel disponible (série rompue)', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-28', currentStreak: 7, streakFreezes: 0 });
    expect(getActiveStreak(profile, '2026-04-30')).toBe(0);
  });

  it('renvoie la valeur stockée si la dernière séance date d\'avant-hier ET qu\'un gel est disponible (série protégée)', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-28', currentStreak: 7, streakFreezes: 1 });
    expect(getActiveStreak(profile, '2026-04-30')).toBe(7);
  });

  it('renvoie 0 si la dernière séance date d\'il y a 3 jours, même avec des gels (un gel ne couvre qu\'1 jour)', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-27', currentStreak: 12, streakFreezes: 2 });
    expect(getActiveStreak(profile, '2026-04-30')).toBe(0);
  });

  it('renvoie 0 si la dernière séance date d\'il y a une semaine', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-23', currentStreak: 12 });
    expect(getActiveStreak(profile, '2026-04-30')).toBe(0);
  });
});

describe('isStreakProtectedByFreeze', () => {
  it('est faux si jamais joué', () => {
    const profile = makeProfile({ lastSessionDate: null, streakFreezes: 2 });
    expect(isStreakProtectedByFreeze(profile, '2026-04-30')).toBe(false);
  });

  it('est faux si la dernière séance est aujourd\'hui', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-30', streakFreezes: 1 });
    expect(isStreakProtectedByFreeze(profile, '2026-04-30')).toBe(false);
  });

  it('est faux si la dernière séance est hier (série naturellement active)', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-29', streakFreezes: 1 });
    expect(isStreakProtectedByFreeze(profile, '2026-04-30')).toBe(false);
  });

  it('est vrai si la dernière séance est avant-hier ET qu\'un gel est disponible', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-28', streakFreezes: 1 });
    expect(isStreakProtectedByFreeze(profile, '2026-04-30')).toBe(true);
  });

  it('est faux si la dernière séance est avant-hier mais aucun gel', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-28', streakFreezes: 0 });
    expect(isStreakProtectedByFreeze(profile, '2026-04-30')).toBe(false);
  });
});

describe('applyStreakUpdate', () => {
  it('démarre la série à 1 quand jamais joué', () => {
    const profile = makeProfile({ lastSessionDate: null, currentStreak: 0, streakFreezes: 0 });
    const r = applyStreakUpdate(profile, '2026-04-30');
    expect(r.currentStreak).toBe(1);
    expect(r.streakFreezes).toBe(0);
    expect(r.freezeJustUsed).toBe(false);
    expect(r.freezeJustEarned).toBe(false);
  });

  it('ne touche à rien sur une séance le même jour', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-30', currentStreak: 4, streakFreezes: 1 });
    const r = applyStreakUpdate(profile, '2026-04-30');
    expect(r.currentStreak).toBe(4);
    expect(r.streakFreezes).toBe(1);
    expect(r.freezeJustUsed).toBe(false);
    expect(r.freezeJustEarned).toBe(false);
  });

  it('incrémente la série si la séance précédente est hier', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-29', currentStreak: 3, streakFreezes: 0 });
    const r = applyStreakUpdate(profile, '2026-04-30');
    expect(r.currentStreak).toBe(4);
    expect(r.streakFreezes).toBe(0);
    expect(r.freezeJustUsed).toBe(false);
    expect(r.freezeJustEarned).toBe(false);
  });

  it('attribue un gel quand la série atteint un multiple de 7', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-29', currentStreak: 6, streakFreezes: 0 });
    const r = applyStreakUpdate(profile, '2026-04-30');
    expect(r.currentStreak).toBe(7);
    expect(r.streakFreezes).toBe(1);
    expect(r.freezeJustEarned).toBe(true);
    expect(r.freezeJustUsed).toBe(false);
  });

  it('n\'attribue pas de gel quand le cap est atteint', () => {
    const profile = makeProfile({
      lastSessionDate: '2026-04-29',
      currentStreak: 13,
      streakFreezes: STREAK_FREEZE_MAX,
    });
    const r = applyStreakUpdate(profile, '2026-04-30');
    expect(r.currentStreak).toBe(14);
    expect(r.streakFreezes).toBe(STREAK_FREEZE_MAX);
    expect(r.freezeJustEarned).toBe(false);
  });

  it('consomme un gel et préserve la série après 1 jour manqué', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-28', currentStreak: 5, streakFreezes: 1 });
    const r = applyStreakUpdate(profile, '2026-04-30');
    expect(r.currentStreak).toBe(6);
    expect(r.streakFreezes).toBe(0);
    expect(r.freezeJustUsed).toBe(true);
    expect(r.freezeJustEarned).toBe(false);
  });

  it('reset la série à 1 après 1 jour manqué si pas de gel (les gels actuels sont conservés)', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-28', currentStreak: 5, streakFreezes: 0 });
    const r = applyStreakUpdate(profile, '2026-04-30');
    expect(r.currentStreak).toBe(1);
    expect(r.streakFreezes).toBe(0);
    expect(r.freezeJustUsed).toBe(false);
  });

  it('reset la série à 1 après 2+ jours manqués, même avec des gels en réserve (1 gel = 1 jour seulement)', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-27', currentStreak: 10, streakFreezes: 2 });
    const r = applyStreakUpdate(profile, '2026-04-30');
    expect(r.currentStreak).toBe(1);
    expect(r.streakFreezes).toBe(2);
    expect(r.freezeJustUsed).toBe(false);
  });

  it('conserve les gels quand la série casse vraiment', () => {
    const profile = makeProfile({ lastSessionDate: '2026-04-20', currentStreak: 8, streakFreezes: 2 });
    const r = applyStreakUpdate(profile, '2026-04-30');
    expect(r.currentStreak).toBe(1);
    expect(r.streakFreezes).toBe(2);
  });

  it('peut consommer un gel ET en gagner un dans le même tour (cas limite)', () => {
    // série à 6, +2 jours, gel disponible : consomme → série passe à 7 → multiple de 7 → +1 gel
    const profile = makeProfile({ lastSessionDate: '2026-04-28', currentStreak: 6, streakFreezes: 1 });
    const r = applyStreakUpdate(profile, '2026-04-30');
    expect(r.currentStreak).toBe(7);
    expect(r.streakFreezes).toBe(1);
    expect(r.freezeJustUsed).toBe(true);
    expect(r.freezeJustEarned).toBe(true);
  });

  it(`STREAK_FREEZE_INTERVAL vaut 7 (vérifie le contrat documenté)`, () => {
    expect(STREAK_FREEZE_INTERVAL).toBe(7);
  });
});
