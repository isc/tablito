import type { UserProfile, Badge, MultiFact } from '../types';
import { BADGE_IDS } from '../types';
import { todayISO, daysBetween } from './utils';

function hasBadge(profile: UserProfile, id: string): boolean {
  return profile.badges.some((b) => b.id === id);
}

function makeBadge(def: BadgeDefinition, now: string): Badge {
  return { id: def.id, name: def.name, description: def.description, earnedDate: now, icon: def.icon };
}

export function factsForTable(facts: MultiFact[], table: number): MultiFact[] {
  return facts.filter((f) => f.a === table || f.b === table);
}

export function getCompletedTables(facts: MultiFact[]): Set<number> {
  const completed = new Set<number>();
  for (let t = 2; t <= 9; t++) {
    const tf = factsForTable(facts, t);
    if (tf.length > 0 && tf.every((f) => f.box >= 5)) {
      completed.add(t);
    }
  }
  return completed;
}

// Single source of truth for all badge metadata
export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const ALL_BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: BADGE_IDS.PREMIER_PAS, name: 'Premier pas', description: 'Terminer la première séance', icon: '🌱' },
  { id: BADGE_IDS.PREMIERE_CASE, name: 'Première case révélée', description: 'Une multiplication presque maîtrisée', icon: '🖼️' },
  { id: BADGE_IDS.PREMIERE_MAITRISE, name: 'Première multiplication maîtrisée', description: 'Une multiplication au top niveau', icon: '🥇' },
  { id: BADGE_IDS.REGULIER, name: 'Régularité', description: '7 jours consécutifs', icon: '🔥' },
  { id: BADGE_IDS.MACHINE, name: 'Machine', description: '10 bonnes réponses de suite', icon: '⚡' },
  { id: BADGE_IDS.EXPLORATION, name: 'Exploration', description: 'Avoir vu tous les faits', icon: '🗺️' },
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `${BADGE_IDS.TABLE_PREFIX}${i + 2}`,
    name: `Table de ${i + 2}`,
    description: `Maîtriser la table de ${i + 2}`,
    icon: `${i + 2}️⃣`,
  })),
  { id: BADGE_IDS.GENIE_MATHS, name: 'Génie des maths', description: 'Tous les faits en boîte 5', icon: '🏆' },
  { id: BADGE_IDS.VELOCE, name: 'Véloce', description: '5 réponses < 2s de suite', icon: '🚀' },
  { id: BADGE_IDS.PERSEVERANCE, name: 'Persévérance', description: 'Revenir après 3+ jours', icon: '💪' },
  { id: BADGE_IDS.FLAMME_ETERNELLE, name: 'Flamme éternelle', description: '30 jours consécutifs', icon: '🌟' },
];

const BADGE_MAP = new Map(ALL_BADGE_DEFINITIONS.map((d) => [d.id, d]));

/**
 * Checks all badge conditions and returns the list of *newly earned* badges.
 *
 * @param previousLastSessionDate - The lastSessionDate BEFORE this session's update,
 *   needed to check the PERSEVERANTE badge (comeback after 3+ days).
 */
export function checkBadges(
  profile: UserProfile,
  sessionStats?: { consecutiveCorrect: number; fastAnswers: number[] },
  previousLastSessionDate?: string | null,
): Badge[] {
  const now = todayISO();
  const newBadges: Badge[] = [];

  function earn(id: string) {
    const def = BADGE_MAP.get(id);
    if (def && !hasBadge(profile, id)) {
      newBadges.push(makeBadge(def, now));
    }
  }

  if (profile.totalSessions >= 1) earn(BADGE_IDS.PREMIER_PAS);
  if (profile.currentStreak >= 7) earn(BADGE_IDS.REGULIER);
  if (profile.currentStreak >= 30) earn(BADGE_IDS.FLAMME_ETERNELLE);
  if (profile.facts.some((f) => f.box >= 4)) earn(BADGE_IDS.PREMIERE_CASE);
  if (profile.facts.some((f) => f.box === 5)) earn(BADGE_IDS.PREMIERE_MAITRISE);
  if (profile.facts.every((f) => f.introduced)) earn(BADGE_IDS.EXPLORATION);
  if (profile.facts.every((f) => f.box === 5)) earn(BADGE_IDS.GENIE_MATHS);

  if (sessionStats?.consecutiveCorrect && sessionStats.consecutiveCorrect >= 10) {
    earn(BADGE_IDS.MACHINE);
  }

  if (sessionStats && hasConsecutiveFastAnswers(sessionStats.fastAnswers, 5, 2000)) {
    earn(BADGE_IDS.VELOCE);
  }

  // Persévérance: check against the PREVIOUS lastSessionDate (before this session updated it)
  if (previousLastSessionDate && daysBetween(previousLastSessionDate, now) >= 3) {
    earn(BADGE_IDS.PERSEVERANCE);
  }

  for (let n = 2; n <= 9; n++) {
    const tableFacts = factsForTable(profile.facts, n);
    if (tableFacts.length > 0 && tableFacts.every((f) => f.box >= 4)) {
      earn(`${BADGE_IDS.TABLE_PREFIX}${n}`);
    }
  }

  return newBadges;
}

function hasConsecutiveFastAnswers(times: number[], count: number, thresholdMs: number): boolean {
  let consecutive = 0;
  for (const time of times) {
    if (time < thresholdMs) {
      consecutive++;
      if (consecutive >= count) return true;
    } else {
      consecutive = 0;
    }
  }
  return false;
}

export function medallionColorFor(id: string): string {
  if (id === BADGE_IDS.PREMIER_PAS) return 'var(--sage)';
  if (id === BADGE_IDS.PREMIERE_CASE) return 'var(--sky)';
  if (id === BADGE_IDS.PREMIERE_MAITRISE) return 'var(--honey)';
  if (id === BADGE_IDS.REGULIER) return 'var(--coral)';
  if (id === BADGE_IDS.MACHINE) return 'var(--honey)';
  if (id === BADGE_IDS.EXPLORATION) return 'var(--sky)';
  if (id.startsWith(BADGE_IDS.TABLE_PREFIX)) return 'var(--indigo)';
  if (id === BADGE_IDS.GENIE_MATHS) return 'var(--honey)';
  if (id === BADGE_IDS.VELOCE) return 'var(--coral)';
  if (id === BADGE_IDS.PERSEVERANCE) return 'var(--sage)';
  if (id === BADGE_IDS.FLAMME_ETERNELLE) return 'var(--coral)';
  return 'var(--honey)';
}

export interface BadgeDetail {
  conditionText: string;
  progress?: { current: number; target: number; unitLabel: string };
}

export function getBadgeDetail(badgeId: string, profile: UserProfile): BadgeDetail {
  if (badgeId === BADGE_IDS.PREMIER_PAS) {
    return {
      conditionText: 'Termine ta toute première séance.',
      progress: { current: Math.min(profile.totalSessions, 1), target: 1, unitLabel: 'séance' },
    };
  }

  if (badgeId === BADGE_IDS.PREMIERE_CASE) {
    const ready = profile.facts.filter((f) => f.box >= 4).length;
    return {
      conditionText: 'Place ta toute première multiplication en boîte 4 — une case s’éclaircit sur ton image mystère !',
      progress: { current: Math.min(ready, 1), target: 1, unitLabel: 'en boîte 4' },
    };
  }

  if (badgeId === BADGE_IDS.PREMIERE_MAITRISE) {
    const ready = profile.facts.filter((f) => f.box === 5).length;
    return {
      conditionText: 'Place ta toute première multiplication en boîte 5 — la case est complètement dévoilée !',
      progress: { current: Math.min(ready, 1), target: 1, unitLabel: 'en boîte 5' },
    };
  }

  if (badgeId === BADGE_IDS.REGULIER) {
    return {
      conditionText: 'Joue 7 jours d’affilée sans en sauter un seul.',
      progress: { current: Math.min(profile.currentStreak, 7), target: 7, unitLabel: 'jours' },
    };
  }

  if (badgeId === BADGE_IDS.FLAMME_ETERNELLE) {
    return {
      conditionText: 'Joue 30 jours d’affilée. La grande flamme !',
      progress: { current: Math.min(profile.currentStreak, 30), target: 30, unitLabel: 'jours' },
    };
  }

  if (badgeId === BADGE_IDS.EXPLORATION) {
    const total = profile.facts.length;
    const seen = profile.facts.filter((f) => f.introduced).length;
    return {
      conditionText: 'Découvre toutes les multiplications du jeu.',
      progress: { current: seen, target: total, unitLabel: 'découvertes' },
    };
  }

  if (badgeId === BADGE_IDS.GENIE_MATHS) {
    const total = profile.facts.length;
    const mastered = profile.facts.filter((f) => f.box === 5).length;
    return {
      conditionText: 'Place toutes les multiplications dans la boîte 5 (le top niveau !).',
      progress: { current: mastered, target: total, unitLabel: 'en boîte 5' },
    };
  }

  if (badgeId === BADGE_IDS.MACHINE) {
    return {
      conditionText: 'Enchaîne 10 bonnes réponses de suite, sans aucune faute, dans une même séance.',
    };
  }

  if (badgeId === BADGE_IDS.VELOCE) {
    return {
      conditionText: 'Réponds correctement 5 fois de suite en moins de 2 secondes à chaque fois.',
    };
  }

  if (badgeId === BADGE_IDS.PERSEVERANCE) {
    return {
      conditionText: 'Reviens jouer après une pause de 3 jours ou plus. Le retour du champion !',
    };
  }

  if (badgeId.startsWith(BADGE_IDS.TABLE_PREFIX)) {
    const n = parseInt(badgeId.slice(BADGE_IDS.TABLE_PREFIX.length), 10);
    const tableFacts = factsForTable(profile.facts, n);
    const ready = tableFacts.filter((f) => f.box >= 4).length;
    return {
      conditionText: `Place toutes les multiplications de la table de ${n} dans la boîte 4 ou 5.`,
      progress: { current: ready, target: tableFacts.length, unitLabel: 'en boîte 4+' },
    };
  }

  return { conditionText: '' };
}

