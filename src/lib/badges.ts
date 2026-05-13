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

/**
 * Vrai quand l'enfant a obtenu les 8 badges « Table de N » (n=2..9).
 * Critère utilisé pour révéler la règle bonus ×11 dans l'écran Règles.
 *
 * On compte les badges plutôt que de re-vérifier `facts.every(box >= 4)` :
 * les badges sont permanents (jamais retirés du profil), donc la règle
 * reste révélée même si des faits régressent ensuite. Si on testait les
 * boîtes en direct, une mauvaise journée ferait disparaître la carte de
 * l'écran Règles — ce qui contredirait la nature "découverte one-shot"
 * de la révélation.
 */
export function isRule11Unlocked(profile: UserProfile): boolean {
  const tableBadges = profile.badges.filter((b) => b.id.startsWith(BADGE_IDS.TABLE_PREFIX));
  return tableBadges.length === 8;
}

// Single source of truth for all badge metadata
export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  conditionText: string;
  progressFor?: (profile: UserProfile) => { current: number; target: number; unitLabel: string };
}

export const ALL_BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: BADGE_IDS.PREMIER_PAS,
    name: 'Premier pas',
    description: 'Terminer la première séance',
    icon: '🌱',
    color: 'var(--sage)',
    conditionText: 'Termine ta toute première séance.',
    progressFor: (p) => ({ current: Math.min(p.totalSessions, 1), target: 1, unitLabel: 'séance' }),
  },
  {
    id: BADGE_IDS.PREMIERE_CASE,
    name: 'Première case révélée',
    description: 'Une multiplication presque maîtrisée',
    icon: '🖼️',
    color: 'var(--sky)',
    conditionText: 'Place ta toute première multiplication en boîte 4 — une case s’éclaircit sur ton image mystère !',
    progressFor: (p) => {
      const ready = p.facts.filter((f) => f.box >= 4).length;
      return { current: Math.min(ready, 1), target: 1, unitLabel: 'en boîte 4' };
    },
  },
  {
    id: BADGE_IDS.PREMIERE_MAITRISE,
    name: 'Première multiplication maîtrisée',
    description: 'Une multiplication au top niveau',
    icon: '🥇',
    color: 'var(--honey)',
    conditionText: 'Place ta toute première multiplication en boîte 5 — la case est complètement dévoilée !',
    progressFor: (p) => {
      const ready = p.facts.filter((f) => f.box === 5).length;
      return { current: Math.min(ready, 1), target: 1, unitLabel: 'en boîte 5' };
    },
  },
  {
    id: BADGE_IDS.REGULIER,
    name: 'Régularité',
    description: '7 jours consécutifs',
    icon: '🔥',
    color: 'var(--coral)',
    conditionText: 'Joue 7 jours d’affilée sans en sauter un seul.',
    progressFor: (p) => ({ current: Math.min(p.currentStreak, 7), target: 7, unitLabel: 'jours' }),
  },
  {
    id: BADGE_IDS.MACHINE,
    name: 'Machine',
    description: '10 bonnes réponses de suite',
    icon: '⚡',
    color: 'var(--honey)',
    conditionText: 'Enchaîne 10 bonnes réponses de suite, sans aucune faute, dans une même séance.',
  },
  {
    id: BADGE_IDS.EXPLORATION,
    name: 'Exploration',
    description: 'Avoir vu tous les faits',
    icon: '🗺️',
    color: 'var(--sky)',
    conditionText: 'Découvre toutes les multiplications du jeu.',
    progressFor: (p) => ({
      current: p.facts.filter((f) => f.introduced).length,
      target: p.facts.length,
      unitLabel: 'découvertes',
    }),
  },
  ...Array.from({ length: 8 }, (_, i) => {
    const n = i + 2;
    return {
      id: `${BADGE_IDS.TABLE_PREFIX}${n}`,
      name: `Table de ${n}`,
      description: `Maîtriser la table de ${n}`,
      icon: `${n}️⃣`,
      color: 'var(--indigo)',
      conditionText: `Place toutes les multiplications de la table de ${n} dans la boîte 4 ou 5.`,
      progressFor: (p: UserProfile) => {
        const tableFacts = factsForTable(p.facts, n);
        return {
          current: tableFacts.filter((f) => f.box >= 4).length,
          target: tableFacts.length,
          unitLabel: 'en boîte 4+',
        };
      },
    };
  }),
  {
    id: BADGE_IDS.GENIE_MATHS,
    name: 'Génie des maths',
    description: 'Tous les faits en boîte 5',
    icon: '🏆',
    color: 'var(--honey)',
    conditionText: 'Place toutes les multiplications dans la boîte 5 (le top niveau !).',
    progressFor: (p) => ({
      current: p.facts.filter((f) => f.box === 5).length,
      target: p.facts.length,
      unitLabel: 'en boîte 5',
    }),
  },
  {
    id: BADGE_IDS.VELOCE,
    name: 'Véloce',
    description: '5 réponses < 2s de suite',
    icon: '🚀',
    color: 'var(--coral)',
    conditionText: 'Réponds correctement 5 fois de suite en moins de 2 secondes à chaque fois.',
  },
  {
    id: BADGE_IDS.PERSEVERANCE,
    name: 'Persévérance',
    description: 'Revenir après 3+ jours',
    icon: '💪',
    color: 'var(--sage)',
    conditionText: 'Reviens jouer après une pause de 3 jours ou plus. Le retour du champion !',
  },
  {
    id: BADGE_IDS.FLAMME_ETERNELLE,
    name: 'Flamme éternelle',
    description: '30 jours consécutifs',
    icon: '🌟',
    color: 'var(--coral)',
    conditionText: 'Joue 30 jours d’affilée. La grande flamme !',
    progressFor: (p) => ({ current: Math.min(p.currentStreak, 30), target: 30, unitLabel: 'jours' }),
  },
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
  return BADGE_MAP.get(id)?.color ?? 'var(--honey)';
}

export interface BadgeDetail {
  conditionText: string;
  progress?: { current: number; target: number; unitLabel: string };
}

export function progressPercent(progress: { current: number; target: number }): number {
  if (progress.target <= 0) return 0;
  return Math.min(100, Math.round((progress.current / progress.target) * 100));
}

export function getBadgeDetail(badgeId: string, profile: UserProfile): BadgeDetail {
  const def = BADGE_MAP.get(badgeId);
  if (!def) return { conditionText: '' };
  return { conditionText: def.conditionText, progress: def.progressFor?.(profile) };
}

