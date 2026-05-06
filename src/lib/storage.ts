import type { UserProfile } from '../types';
import { MYSTERY_POOL } from '../types';
import { checkBadges } from './badges';
import { createInitialFacts } from './facts';
import { inferIntroductionsFromKnowns } from './placement';
import { pickRandom, todayISO } from './utils';

export const STORAGE_KEY = 'multiplix-profile';

/**
 * Loads the user profile from localStorage.
 * Returns null if no profile exists or if parsing fails.
 */
export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidProfile(parsed)) return null;
    return migrateProfile(parsed as UserProfile);
  } catch {
    return null;
  }
}

/**
 * Saves the user profile to localStorage.
 */
export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

/**
 * Exports a profile as a JSON string (for backup / transfer).
 */
export function exportProfile(profile: UserProfile): string {
  return JSON.stringify(profile, null, 2);
}

/**
 * Imports a profile from a JSON string.
 * Returns null if the JSON is invalid or doesn't match the expected shape.
 */
export function importProfile(json: string): UserProfile | null {
  try {
    const parsed = JSON.parse(json);
    if (!isValidProfile(parsed)) return null;
    return migrateProfile(parsed as UserProfile);
  } catch {
    return null;
  }
}

/**
 * Creates a fresh user profile with the given name.
 * All 36 facts start in box 1, not yet introduced.
 */
export function createNewProfile(name: string): UserProfile {
  const now = todayISO();
  return {
    name,
    startDate: now,
    facts: createInitialFacts(),
    totalSessions: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSessionDate: null,
    badges: [],
    sessionHistory: [],
    hasSeenRulesIntro: false,
    mysteryTheme: pickRandom(MYSTERY_POOL),
  };
}

/**
 * Migrates older profiles to the current shape.
 * Ensures backward compatibility when new fields are added.
 */
function migrateProfile(profile: UserProfile): UserProfile {
  if (!Array.isArray(profile.sessionHistory)) {
    profile.sessionHistory = [];
  }
  if (typeof profile.hasSeenRulesIntro !== 'boolean') {
    profile.hasSeenRulesIntro = true;
  }
  // `village` est accepté tel quel (guide utilisateur) ; sinon le thème
  // doit appartenir au pool, et à défaut on en retire un au hasard.
  const t = profile.mysteryTheme;
  if (t !== 'village' && !MYSTERY_POOL.includes(t)) {
    profile.mysteryTheme = pickRandom(MYSTERY_POOL);
  }
  // Strip deprecated mascotLevel field from older profiles
  delete (profile as UserProfile & { mascotLevel?: number }).mascotLevel;
  // Fix les profils créés avant l'ajout de l'inférence par dominance lors
  // du test de placement : si des faits restent non introduits alors qu'on
  // a une preuve de réussite sur des faits plus durs, on les introduit.
  inferIntroductionsFromKnowns(profile.facts, todayISO());
  // Rétro-attribue les badges d'état déjà mérités mais absents du profil :
  // sans ça, un nouveau badge ajouté après coup demande une séance de plus
  // pour se débloquer. Les badges contextuels (MACHINE/VELOCE/PERSEVERANCE)
  // ne se déclenchent pas ici, faute de stats de séance.
  profile.badges = [...profile.badges, ...checkBadges(profile)];
  return profile;
}

/**
 * Basic structural validation of a profile object.
 */
function isValidProfile(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;

  const p = obj as Record<string, unknown>;

  if (typeof p.name !== 'string') return false;
  if (typeof p.startDate !== 'string') return false;
  if (!Array.isArray(p.facts)) return false;
  if (typeof p.totalSessions !== 'number') return false;
  if (typeof p.currentStreak !== 'number') return false;
  if (typeof p.longestStreak !== 'number') return false;
  if (!Array.isArray(p.badges)) return false;

  // Validate each fact has the expected shape
  for (const fact of p.facts) {
    if (typeof fact !== 'object' || fact === null) return false;
    const f = fact as Record<string, unknown>;
    if (typeof f.a !== 'number' || typeof f.b !== 'number') return false;
    // a ≤ b est garanti par createInitialFacts ; la dominance s'appuie dessus.
    if (f.a > f.b) return false;
    if (typeof f.product !== 'number') return false;
    if (typeof f.box !== 'number' || f.box < 1 || f.box > 5) return false;
    if (typeof f.introduced !== 'boolean') return false;
    if (!Array.isArray(f.history)) return false;
  }

  return true;
}
