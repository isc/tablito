import type { UserProfile, Badge, MultiFact, DivisionFact } from '../types';
import { BADGE_IDS } from '../types';
import { todayISO, daysBetween } from './utils';

function hasBadge(profile: UserProfile, id: string): boolean {
  return profile.badges.some((b) => b.id === id);
}

// Faits de division d'une « table » (regroupés par diviseur) : ÷2, ÷3, …, ÷9.
export function factsForDivisionTable(facts: DivisionFact[], divisor: number): DivisionFact[] {
  return facts.filter((f) => f.divisor === divisor);
}

const NUM_DIV_TABLE_BADGES = 8;

/**
 * Vrai quand le niveau 2 (division) est débloqué : on gate sur le badge
 * « Génie de la multiplication » (toutes les multiplications en boîte 5). Critère basé
 * sur un badge ⇒ permanent (specs §11.3), cohérent avec la règle bonus ×11.
 */
export function isDivisionUnlocked(profile: UserProfile): boolean {
  return hasBadge(profile, BADGE_IDS.GENIE_MATHS);
}

function makeBadge(def: BadgeDefinition, now: string): Badge {
  return { id: def.id, name: def.name, description: def.description, earnedDate: now, icon: def.icon };
}

export function factsForTable(facts: MultiFact[], table: number): MultiFact[] {
  return facts.filter((f) => f.a === table || f.b === table);
}

// Tables 2..9 ⇒ 8 badges TABLE_N possibles. Source de vérité partagée
// entre la génération des badges (ALL_BADGE_DEFINITIONS) et le critère
// de déblocage de la règle bonus ×11.
const NUM_TABLE_BADGES = 8;

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

// Pendant division de getCompletedTables : une « table » de division regroupe
// les faits d'un même diviseur (÷2, …, ÷9), complète quand tous sont en boîte 5.
// Alimente la célébration « Tu as maîtrisé les divisions par N ! » du récap.
export function getCompletedDivisionTables(facts: DivisionFact[]): Set<number> {
  const completed = new Set<number>();
  for (let n = 2; n <= 9; n++) {
    const tf = factsForDivisionTable(facts, n);
    if (tf.length > 0 && tf.every((f) => f.box >= 5)) {
      completed.add(n);
    }
  }
  return completed;
}

/**
 * Vrai quand les 8 badges « Table de N » (n=2..9) ont été obtenus.
 *
 * On compte les badges plutôt que de tester `facts.every(box >= 4)` :
 * les badges sont permanents, donc la révélation persiste même si des
 * faits régressent ensuite — la « découverte » reste un événement one-shot.
 */
export function isRule11Unlocked(profile: UserProfile): boolean {
  const tableBadges = profile.badges.filter((b) => b.id.startsWith(BADGE_IDS.TABLE_PREFIX));
  return tableBadges.length === NUM_TABLE_BADGES;
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
  ...Array.from({ length: NUM_TABLE_BADGES }, (_, i) => {
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
    name: 'Génie de la multiplication',
    description: 'Toutes les multiplications maîtrisées',
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
    description: '5 étoiles dorées de suite',
    icon: '🚀',
    color: 'var(--coral)',
    conditionText: 'Décroche 5 étoiles dorées d’affilée — une réponse rapide ET correcte à la suite, sans faute ni hésitation.',
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

// Badges du niveau 2 — division. Tenus à part d'ALL_BADGE_DEFINITIONS pour
// rester MASQUÉS tant que le niveau n'est pas débloqué (cf.
// visibleBadgeDefinitions), mais inclus dans BADGE_MAP pour pouvoir être
// attribués par checkBadges.
export const DIVISION_BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: BADGE_IDS.DIV_PREMIERE_MAITRISE,
    name: 'Première division maîtrisée',
    description: 'Une division au top niveau',
    icon: '🥈',
    color: 'var(--honey)',
    conditionText: 'Place ta toute première division en boîte 5.',
    progressFor: (p) => {
      const ready = (p.divisionFacts ?? []).filter((f) => f.box === 5).length;
      return { current: Math.min(ready, 1), target: 1, unitLabel: 'en boîte 5' };
    },
  },
  ...Array.from({ length: NUM_DIV_TABLE_BADGES }, (_, i) => {
    const n = i + 2;
    return {
      id: `${BADGE_IDS.DIV_TABLE_PREFIX}${n}`,
      name: `Divisions par ${n}`,
      description: `Maîtriser les divisions par ${n}`,
      icon: '➗',
      color: 'var(--indigo)',
      conditionText: `Place toutes les divisions par ${n} dans la boîte 4 ou 5.`,
      progressFor: (p: UserProfile) => {
        const tableFacts = factsForDivisionTable(p.divisionFacts ?? [], n);
        return {
          current: tableFacts.filter((f) => f.box >= 4).length,
          target: tableFacts.length,
          unitLabel: 'en boîte 4+',
        };
      },
    };
  }),
  {
    id: BADGE_IDS.DIV_GENIE,
    name: 'Maître de la division',
    description: 'Toutes les divisions en boîte 5',
    icon: '🎓',
    color: 'var(--honey)',
    conditionText: 'Place toutes les divisions dans la boîte 5 (le top niveau !).',
    progressFor: (p) => {
      const facts = p.divisionFacts ?? [];
      return {
        current: facts.filter((f) => f.box === 5).length,
        target: facts.length,
        unitLabel: 'en boîte 5',
      };
    },
  },
];

const BADGE_MAP = new Map(
  [...ALL_BADGE_DEFINITIONS, ...DIVISION_BADGE_DEFINITIONS].map((d) => [d.id, d]),
);

/**
 * Définitions de badges à afficher pour ce profil : les badges multiplication
 * toujours, les badges division uniquement une fois le niveau débloqué — on ne
 * spoile pas la division à un enfant qui apprend encore ses tables (même
 * logique que la révélation différée de la règle ×11, specs §2.3).
 */
export function visibleBadgeDefinitions(profile: UserProfile): BadgeDefinition[] {
  return isDivisionUnlocked(profile)
    ? [...ALL_BADGE_DEFINITIONS, ...DIVISION_BADGE_DEFINITIONS]
    : ALL_BADGE_DEFINITIONS;
}

/**
 * Checks all badge conditions and returns the list of *newly earned* badges.
 *
 * @param previousLastSessionDate - The lastSessionDate BEFORE this session's update,
 *   needed to check the PERSEVERANTE badge (comeback after 3+ days).
 */
export function checkBadges(
  profile: UserProfile,
  sessionStats?: { consecutiveCorrect: number; wasFast: boolean[] },
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

  if (sessionStats && hasConsecutiveTrue(sessionStats.wasFast, 5)) {
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

  // Niveau 2 — badges division. Évalués seulement une fois le niveau débloqué :
  // avant cela les faits de division sont tous en boîte 1 (aucun badge gagnable),
  // donc on évite ces passes inutiles pour la grande majorité des profils.
  const divFacts = profile.divisionFacts;
  if (divFacts && divFacts.length > 0 && isDivisionUnlocked(profile)) {
    if (divFacts.some((f) => f.box === 5)) earn(BADGE_IDS.DIV_PREMIERE_MAITRISE);
    if (divFacts.every((f) => f.box === 5)) earn(BADGE_IDS.DIV_GENIE);
    for (let n = 2; n <= 9; n++) {
      const tableFacts = factsForDivisionTable(divFacts, n);
      if (tableFacts.length > 0 && tableFacts.every((f) => f.box >= 4)) {
        earn(`${BADGE_IDS.DIV_TABLE_PREFIX}${n}`);
      }
    }
  }

  return newBadges;
}

function hasConsecutiveTrue(values: boolean[], count: number): boolean {
  let consecutive = 0;
  for (const v of values) {
    if (v) {
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

