import type { UserProfile, Badge, MultiFact, DivisionFact } from '../types';
import { BADGE_IDS } from '../types';
import { todayISO, daysBetween } from './utils';
import { getBadgeI18n } from '../i18n/badges';
import { getLang, type Lang } from '../i18n/lang';

function hasBadge(profile: UserProfile, id: string): boolean {
  return profile.badges.some((b) => b.id === id);
}

// Faits de division d'une « table » (regroupés par diviseur) : ÷2, ÷3, …, ÷9.
export function factsForDivisionTable(facts: DivisionFact[], divisor: number): DivisionFact[] {
  return facts.filter((f) => f.divisor === divisor);
}

const NUM_DIV_TABLE_BADGES = 8;

/**
 * Vrai quand le niveau 2 (division) est débloqué : on gate sur l'obtention des
 * 8 badges « Table de N » (toutes les multiplications en boîte 4+), et NON sur
 * « Génie de la multiplication » (boîte 5 partout).
 *
 * Pourquoi pas Génie : la division est avant tout un outil d'entretien des
 * multiplications (les faits dus sont entrelacés dans chaque séance, cf.
 * dailyComposer). Exiger la boîte 5 partout AVANT d'ouvrir le niveau, c'est
 * imposer un long palier de pur grind boîte 4→5 sans contenu nouveau — trop
 * sévère. Une fois toutes les tables maîtrisées (8 badges = le moment « je
 * connais toutes mes tables »), on ouvre la division ; le passage boîte 4→5
 * continue ensuite via l'entretien, et Génie reste un trophée de complétion
 * décroché PENDANT le niveau 2.
 *
 * Critère basé sur des badges ⇒ permanent (specs §11.3), même condition que
 * la règle bonus ×11 (isRule11Unlocked).
 */
export function isDivisionUnlocked(profile: UserProfile): boolean {
  return hasAllTableBadges(profile);
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
 * les badges sont permanents, donc le déblocage persiste même si des
 * faits régressent ensuite — c'est un événement one-shot, jamais repris.
 * Sert à la fois au déblocage de la règle bonus ×11 et du niveau 2 division.
 */
export function hasAllTableBadges(profile: UserProfile): boolean {
  const tableBadges = profile.badges.filter((b) => b.id.startsWith(BADGE_IDS.TABLE_PREFIX));
  return tableBadges.length === NUM_TABLE_BADGES;
}

export function isRule11Unlocked(profile: UserProfile): boolean {
  return hasAllTableBadges(profile);
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

// Définitions des badges de multiplication, construites pour la langue
// d'interface courante (les chaînes viennent de i18n/badges, le reste — icône,
// couleur, logique de progression — est figé ici).
function buildAllBadgeDefinitions(): BadgeDefinition[] {
  const i = getBadgeI18n();
  const u = i.units;
  return [
    {
      id: BADGE_IDS.PREMIER_PAS,
      ...i.premierPas,
      icon: '🌱',
      color: 'var(--sage)',
      progressFor: (p) => ({ current: Math.min(p.totalSessions, 1), target: 1, unitLabel: u.session }),
    },
    {
      id: BADGE_IDS.PREMIERE_CASE,
      ...i.premiereCase,
      icon: '🖼️',
      color: 'var(--sky)',
      progressFor: (p) => {
        const ready = p.facts.filter((f) => f.box >= 4).length;
        return { current: Math.min(ready, 1), target: 1, unitLabel: u.box4 };
      },
    },
    {
      id: BADGE_IDS.PREMIERE_MAITRISE,
      ...i.premiereMaitrise,
      icon: '🥇',
      color: 'var(--honey)',
      progressFor: (p) => {
        const ready = p.facts.filter((f) => f.box === 5).length;
        return { current: Math.min(ready, 1), target: 1, unitLabel: u.box5 };
      },
    },
    {
      id: BADGE_IDS.REGULIER,
      ...i.regulier,
      icon: '🔥',
      color: 'var(--coral)',
      progressFor: (p) => ({ current: Math.min(p.currentStreak, 7), target: 7, unitLabel: u.days }),
    },
    {
      id: BADGE_IDS.MACHINE,
      ...i.machine,
      icon: '⚡',
      color: 'var(--honey)',
    },
    {
      id: BADGE_IDS.EXPLORATION,
      ...i.exploration,
      icon: '🗺️',
      color: 'var(--sky)',
      progressFor: (p) => ({
        current: p.facts.filter((f) => f.introduced).length,
        target: p.facts.length,
        unitLabel: u.discovered,
      }),
    },
    ...Array.from({ length: NUM_TABLE_BADGES }, (_, idx) => {
      const n = idx + 2;
      return {
        id: `${BADGE_IDS.TABLE_PREFIX}${n}`,
        ...i.table(n),
        icon: `${n}️⃣`,
        color: 'var(--indigo)',
        progressFor: (p: UserProfile) => {
          const tableFacts = factsForTable(p.facts, n);
          return {
            current: tableFacts.filter((f) => f.box >= 4).length,
            target: tableFacts.length,
            unitLabel: u.box4plus,
          };
        },
      };
    }),
    {
      id: BADGE_IDS.GENIE_MATHS,
      ...i.genieMaths,
      icon: '🏆',
      color: 'var(--honey)',
      progressFor: (p) => ({
        current: p.facts.filter((f) => f.box === 5).length,
        target: p.facts.length,
        unitLabel: u.box5,
      }),
    },
    {
      id: BADGE_IDS.VELOCE,
      ...i.veloce,
      icon: '🚀',
      color: 'var(--coral)',
    },
    {
      id: BADGE_IDS.PERSEVERANCE,
      ...i.perseverance,
      icon: '💪',
      color: 'var(--sage)',
    },
    {
      id: BADGE_IDS.FLAMME_ETERNELLE,
      ...i.flammeEternelle,
      icon: '🌟',
      color: 'var(--coral)',
      progressFor: (p) => ({ current: Math.min(p.currentStreak, 30), target: 30, unitLabel: u.days }),
    },
  ];
}

// Badges du niveau 2 — division. Tenus à part des badges multiplication pour
// rester MASQUÉS tant que le niveau n'est pas débloqué (cf.
// visibleBadgeDefinitions), mais inclus dans la map pour pouvoir être
// attribués par checkBadges.
function buildDivisionBadgeDefinitions(): BadgeDefinition[] {
  const i = getBadgeI18n();
  const u = i.units;
  return [
    {
      id: BADGE_IDS.DIV_PREMIERE_MAITRISE,
      ...i.divPremiereMaitrise,
      icon: '🥈',
      color: 'var(--honey)',
      progressFor: (p) => {
        const ready = (p.divisionFacts ?? []).filter((f) => f.box === 5).length;
        return { current: Math.min(ready, 1), target: 1, unitLabel: u.box5 };
      },
    },
    ...Array.from({ length: NUM_DIV_TABLE_BADGES }, (_, idx) => {
      const n = idx + 2;
      return {
        id: `${BADGE_IDS.DIV_TABLE_PREFIX}${n}`,
        ...i.divTable(n),
        icon: '➗',
        color: 'var(--indigo)',
        progressFor: (p: UserProfile) => {
          const tableFacts = factsForDivisionTable(p.divisionFacts ?? [], n);
          return {
            current: tableFacts.filter((f) => f.box >= 4).length,
            target: tableFacts.length,
            unitLabel: u.box4plus,
          };
        },
      };
    }),
    {
      id: BADGE_IDS.DIV_GENIE,
      ...i.divGenie,
      icon: '🎓',
      color: 'var(--honey)',
      progressFor: (p) => {
        const facts = p.divisionFacts ?? [];
        return {
          current: facts.filter((f) => f.box === 5).length,
          target: facts.length,
          unitLabel: u.box5,
        };
      },
    },
  ];
}

// Cache mémoïsé par langue : les définitions ne dépendent que de la langue
// (les chaînes), pas du profil (passé en argument à progressFor). On les
// reconstruit donc seulement au changement de langue, pas à chaque appel —
// medallionColorFor/getBadgeDetail sont appelés une fois par badge dans les
// boucles de rendu de BadgesScreen.
let cacheLang: Lang | null = null;
let cachedAll: BadgeDefinition[] = [];
let cachedDivision: BadgeDefinition[] = [];
let cachedMap: Map<string, BadgeDefinition> = new Map();

function ensureCache(): void {
  const lang = getLang();
  if (cacheLang === lang) return;
  cachedAll = buildAllBadgeDefinitions();
  cachedDivision = buildDivisionBadgeDefinitions();
  cachedMap = new Map([...cachedAll, ...cachedDivision].map((d) => [d.id, d]));
  cacheLang = lang;
}

export function getAllBadgeDefinitions(): BadgeDefinition[] {
  ensureCache();
  return cachedAll;
}

export function getDivisionBadgeDefinitions(): BadgeDefinition[] {
  ensureCache();
  return cachedDivision;
}

function badgeMap(): Map<string, BadgeDefinition> {
  ensureCache();
  return cachedMap;
}

/**
 * Définitions de badges à afficher pour ce profil : les badges multiplication
 * toujours, les badges division uniquement une fois le niveau débloqué — on ne
 * spoile pas la division à un enfant qui apprend encore ses tables (même
 * logique que la révélation différée de la règle ×11, specs §2.3).
 */
export function visibleBadgeDefinitions(profile: UserProfile): BadgeDefinition[] {
  return isDivisionUnlocked(profile)
    ? [...getAllBadgeDefinitions(), ...getDivisionBadgeDefinitions()]
    : getAllBadgeDefinitions();
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

  const map = badgeMap();
  function earn(id: string) {
    const def = map.get(id);
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
  return badgeMap().get(id)?.color ?? 'var(--honey)';
}

/**
 * Nom localisé d'un badge par son id (langue d'interface courante). Sert à
 * afficher un badge stocké (dont le nom a pu être figé dans une autre langue
 * au moment du gain) toujours dans la langue active. Renvoie null si l'id est
 * inconnu.
 */
export function badgeName(id: string): string | null {
  return badgeMap().get(id)?.name ?? null;
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
  const def = badgeMap().get(badgeId);
  if (!def) return { conditionText: '' };
  return { conditionText: def.conditionText, progress: def.progressFor?.(profile) };
}

