import type { UserProfile, SessionItem } from '../types';
import { remainderDividend } from '../types';
import { isDue, pickBonusReviewFacts } from './leitner';
import { composeDivisionSession } from './divisionComposer';
import { composeRemainderSession } from './remainderComposer';
import { randomDisplayOrder } from './sessionComposer';
import { getFactKey } from './facts';
import { getDivisionFactKey } from './divisionFacts';
import { getRemainderFactKey, drawRemainder } from './remainderFacts';
import { isRemainderUnlocked } from './badges';
import { computeSimilarity } from './similarity';
import { shuffle, interleaveGreedy } from './utils';

// Cible haute d'une séance (cf. sessionComposer / specs §6).
const TARGET_QUESTIONS = 15;
// Plancher de longueur, identique à sessionComposer (mult-only) et
// composeDivisionSession : sous ce seuil, on complète par des révisions bonus.
const MIN_QUESTIONS = 12;
// Plafond de faits des niveaux précédents en entretien par séance : on ne noie
// pas le niveau actif (le vrai apprentissage) sous la maintenance. Les faits
// dus au-delà sont repris la séance suivante — sans danger en boîte 5. Au
// niveau 3, le régime de croisière (36 tables + 64 divisions revues tous les
// 21 jours ≈ 5 dus/jour) tient sous ce plafond (specs §12.3).
const MAX_MAINTENANCE = 6;

function multItem(fact: UserProfile['facts'][number], isBonusReview = false): SessionItem {
  return {
    kind: 'mult',
    fact,
    ...randomDisplayOrder(fact),
    isIntroduction: false,
    isRetry: false,
    isBonusReview,
  };
}

function divItem(
  fact: NonNullable<UserProfile['divisionFacts']>[number],
  isBonusReview = false,
): SessionItem {
  return { kind: 'div', fact, isIntroduction: false, isRetry: false, isBonusReview };
}

function remBonusItem(fact: NonNullable<UserProfile['remainderFacts']>[number]): SessionItem {
  return {
    kind: 'rem',
    fact,
    remainder: drawRemainder(fact.divisor),
    isIntroduction: false,
    isRetry: false,
    isBonusReview: true,
  };
}

function itemTable(item: SessionItem): number {
  return item.kind === 'mult'
    ? Math.min(item.displayA, item.displayB)
    : item.fact.divisor;
}

// Deux éléments à ne pas rendre adjacents. Même type : règles de chaque piste
// (dividende/diviseur partagés en ÷ et reste, table partagée / forte similarité
// en ×). Entre types : un élément du niveau 3 est en conflit avec la division
// de même diviseur ou de même dividende (45÷7 juste à côté de 42÷7 ou de 45÷9
// serait confusible) et avec la multiplication ancre de sa zone (7×6 juste
// avant la zone (7,6) soufflerait l'encadrement). × vs ÷ exacts : pas de
// conflit (inchangé, specs §11.6).
function itemConflict(a: SessionItem, b: SessionItem): boolean {
  if (a.kind === 'div' && b.kind === 'div') {
    return a.fact.dividend === b.fact.dividend || a.fact.divisor === b.fact.divisor;
  }
  if (a.kind === 'mult' && b.kind === 'mult') {
    return itemTable(a) === itemTable(b) || computeSimilarity(a.fact, b.fact) === 'strong';
  }
  if (a.kind === 'rem' && b.kind === 'rem') {
    return (
      a.fact.divisor === b.fact.divisor || remainderDividend(a) === remainderDividend(b)
    );
  }
  if (a.kind === 'rem') return remCrossConflict(a, b);
  if (b.kind === 'rem') return remCrossConflict(b, a);
  return false;
}

// Conflit entre un item niveau 3 et un item d'entretien (× ou ÷ exact).
function remCrossConflict(
  rem: Extract<SessionItem, { kind: 'rem' }>,
  other: SessionItem,
): boolean {
  if (other.kind === 'div') {
    return (
      other.fact.divisor === rem.fact.divisor ||
      other.fact.dividend === remainderDividend(rem)
    );
  }
  if (other.kind === 'mult') {
    // Conflit si c'est le fait ancre de la zone (7×6 juste avant la zone (7,6)) —
    // getFactKey normalise la paire (min×max) des deux côtés.
    return getFactKey(other.fact.a, other.fact.b) === getFactKey(rem.fact.divisor, rem.fact.quotient);
  }
  return false;
}

/**
 * Compose la séance quotidienne post-déblocage (specs §11.6, §12.3).
 *
 * Principe : le niveau actif est l'activité du jour — division exacte
 * (niveau 2), puis division avec reste dès que ses 8 badges « Divisions
 * par N » sont acquis (niveau 3). On y intègre les faits des niveaux
 * précédents RÉELLEMENT dus en révision (entretien) plutôt que de leur
 * consacrer une séance entière — le niveau actif n'est jamais préempté, et
 * la maintenance n'est jamais en retard. Tous types entrelacés.
 *
 * Les intros du niveau actif passent en tête (comme en multiplication) ; le
 * reste (révisions + entretien + éventuel padding bonus) est entrelacé.
 *
 * Plancher de longueur : les premiers jours post-déblocage, peu de faits du
 * niveau actif sont introduits (rythme 2/séance) et peu d'entretien est dû —
 * sans filet, la séance tomberait à 2-5 questions. On comble donc sous
 * MIN_QUESTIONS par des révisions bonus (sans toucher au Leitner, cf.
 * pickBonusReviewFacts) : niveau actif d'abord, puis niveaux précédents
 * (réserve inépuisable). Le filet se résorbe quand le niveau grossit.
 */
export function composeDailySession(profile: UserProfile, now: string): SessionItem[] {
  const today = now.slice(0, 10);
  return isRemainderUnlocked(profile)
    ? composeRemainderDaily(profile, today)
    : composeDivisionDaily(profile, today);
}

// Niveau 2 actif : division + entretien des tables (specs §11.6).
function composeDivisionDaily(profile: UserProfile, today: string): SessionItem[] {
  const divItems: SessionItem[] = composeDivisionSession(profile, today).map((q) => ({
    kind: 'div',
    ...q,
  }));
  const intros = divItems.filter((i) => i.isIntroduction);
  const reviews = divItems.filter((i) => !i.isIntroduction);

  // Faits de tables dus aujourd'hui → révisions d'entretien (jamais des intros :
  // post-déblocage les tables sont toutes introduites et maîtrisées).
  const maintenance: SessionItem[] = shuffle(
    profile.facts.filter((f) => f.introduced && isDue(f, today)),
  )
    .slice(0, MAX_MAINTENANCE)
    .map((fact) => multItem(fact));

  return assemble(profile, intros, reviews, maintenance);
}

// Niveau 3 actif : division avec reste + entretien des tables ET des divisions
// exactes, plafonnés ensemble (specs §12.3).
function composeRemainderDaily(profile: UserProfile, today: string): SessionItem[] {
  const remItems: SessionItem[] = composeRemainderSession(profile, today).map((q) => ({
    kind: 'rem',
    ...q,
  }));
  const intros = remItems.filter((i) => i.isIntroduction);
  const reviews = remItems.filter((i) => !i.isIntroduction);

  const dueMult = profile.facts
    .filter((f) => f.introduced && isDue(f, today))
    .map((fact) => multItem(fact));
  const dueDiv = (profile.divisionFacts ?? [])
    .filter((f) => f.introduced && isDue(f, today))
    .map((fact) => divItem(fact));
  const maintenance = shuffle([...dueMult, ...dueDiv]).slice(0, MAX_MAINTENANCE);

  return assemble(profile, intros, reviews, maintenance);
}

// Tronc commun : l'entretien remplace des révisions du niveau actif pour viser
// ~TARGET sans gonfler la séance (intros gardées en priorité), puis padding
// bonus sous le plancher, puis entrelacement.
function assemble(
  profile: UserProfile,
  intros: SessionItem[],
  reviews: SessionItem[],
  maintenance: SessionItem[],
): SessionItem[] {
  const reviewBudget = Math.max(0, TARGET_QUESTIONS - intros.length - maintenance.length);
  const core: SessionItem[] = [...reviews.slice(0, reviewBudget), ...maintenance];

  const deficit = MIN_QUESTIONS - (intros.length + core.length);
  if (deficit > 0) {
    core.push(...bonusPadding(profile, [...intros, ...core], deficit));
  }

  return [...intros, ...interleaveGreedy(core, itemConflict)];
}

// Révisions bonus pour combler une séance courte : niveau le plus récent
// d'abord (cohérent avec le niveau en cours), puis les précédents. Exclut les
// faits déjà présents dans la séance.
function bonusPadding(profile: UserProfile, used: SessionItem[], count: number): SessionItem[] {
  const usedRemKeys = new Set(
    used
      .filter((i) => i.kind === 'rem')
      .map((i) => getRemainderFactKey(i.fact.divisor, i.fact.quotient)),
  );
  const remBonus = isRemainderUnlocked(profile)
    ? pickBonusReviewFacts(
        profile.remainderFacts ?? [],
        (f) => usedRemKeys.has(getRemainderFactKey(f.divisor, f.quotient)),
        count,
      ).map(remBonusItem)
    : [];
  if (remBonus.length >= count) return remBonus;

  const usedDivKeys = new Set(
    used
      .filter((i) => i.kind === 'div')
      .map((i) => getDivisionFactKey(i.fact.dividend, i.fact.divisor)),
  );
  const divBonus = pickBonusReviewFacts(
    profile.divisionFacts ?? [],
    (f) => usedDivKeys.has(getDivisionFactKey(f.dividend, f.divisor)),
    count - remBonus.length,
  ).map((fact) => divItem(fact, true));

  if (remBonus.length + divBonus.length >= count) return [...remBonus, ...divBonus];

  const usedMultKeys = new Set(
    used.filter((i) => i.kind === 'mult').map((i) => getFactKey(i.fact.a, i.fact.b)),
  );
  const multBonus = pickBonusReviewFacts(
    profile.facts,
    (f) => usedMultKeys.has(getFactKey(f.a, f.b)),
    count - remBonus.length - divBonus.length,
  ).map((fact) => multItem(fact, true));

  return [...remBonus, ...divBonus, ...multBonus];
}
