import type { UserProfile, SessionItem } from '../types';
import { isDue, pickBonusReviewFacts } from './leitner';
import { composeDivisionSession } from './divisionComposer';
import { randomDisplayOrder } from './sessionComposer';
import { getFactKey } from './facts';
import { getDivisionFactKey } from './divisionFacts';
import { computeSimilarity } from './similarity';
import { shuffle, interleaveGreedy } from './utils';

// Cible haute d'une séance (cf. sessionComposer / specs §6).
const TARGET_QUESTIONS = 15;
// Plancher de longueur, identique à sessionComposer (mult-only) et
// composeDivisionSession : sous ce seuil, on complète par des révisions bonus.
const MIN_QUESTIONS = 12;
// Plafond de faits de tables en entretien par séance : on ne noie pas la
// division (le vrai apprentissage) sous la maintenance. Les faits dus au-delà
// sont repris la séance suivante — sans danger en boîte 5 (specs §11.6).
const MAX_MULT_MAINTENANCE = 6;

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

function divItem(fact: NonNullable<UserProfile['divisionFacts']>[number]): SessionItem {
  return { kind: 'div', fact, isIntroduction: false, isRetry: false, isBonusReview: true };
}

function itemTable(item: SessionItem): number {
  return item.kind === 'div'
    ? item.fact.divisor
    : Math.min(item.displayA, item.displayB);
}

// Deux éléments à ne pas rendre adjacents. Entre types différents (× vs ÷), pas
// de conflit. Même type : on réutilise les règles de chaque piste (dividende
// partagé en division §11.6, table partagée / forte similarité en multiplication).
function itemConflict(a: SessionItem, b: SessionItem): boolean {
  if (a.kind === 'div' && b.kind === 'div') {
    return a.fact.dividend === b.fact.dividend || a.fact.divisor === b.fact.divisor;
  }
  if (a.kind === 'mult' && b.kind === 'mult') {
    return itemTable(a) === itemTable(b) || computeSimilarity(a.fact, b.fact) === 'strong';
  }
  return false;
}

/**
 * Compose la séance quotidienne du niveau 2 (specs §11.6).
 *
 * Principe : la division est l'activité du jour ; on y intègre les faits de
 * tables RÉELLEMENT dus en révision (entretien, §5.1) plutôt que de leur
 * consacrer une séance entière — la division n'est jamais préemptée, et la
 * maintenance n'est jamais en retard. Les × et ÷ sont entrelacés.
 *
 * Les intros de division passent en tête (comme en multiplication) ; le reste
 * (révisions division + entretien tables + éventuel padding bonus) est entrelacé.
 *
 * Plancher de longueur : les premiers jours post-déblocage, peu de divisions
 * sont introduites (rythme 2/séance) et peu de tables sont dues — sans filet, la
 * séance tomberait à 2-5 questions. On comble donc sous MIN_QUESTIONS par des
 * révisions bonus (sans toucher au Leitner, cf. pickBonusReviewFacts) : divisions
 * introduites d'abord, puis tables (réserve inépuisable, toutes introduites au
 * déblocage). Le filet se résorbe de lui-même quand la division grossit.
 */
export function composeDailySession(profile: UserProfile, now: string): SessionItem[] {
  const today = now.slice(0, 10);

  const divItems: SessionItem[] = composeDivisionSession(profile, today).map((q) => ({
    kind: 'div',
    ...q,
  }));
  const divIntros = divItems.filter((i) => i.isIntroduction);
  const divReviews = divItems.filter((i) => !i.isIntroduction);

  // Faits de tables dus aujourd'hui → révisions d'entretien (jamais des intros :
  // post-déblocage les tables sont toutes introduites et maîtrisées).
  const maintenance: SessionItem[] = shuffle(
    profile.facts.filter((f) => f.introduced && isDue(f, today)),
  )
    .slice(0, MAX_MULT_MAINTENANCE)
    .map((fact) => multItem(fact));

  // L'entretien remplace des révisions division pour viser ~TARGET sans gonfler
  // la séance. Intros division gardées en priorité.
  const divReviewBudget = Math.max(0, TARGET_QUESTIONS - divIntros.length - maintenance.length);
  const core: SessionItem[] = [...divReviews.slice(0, divReviewBudget), ...maintenance];

  // Padding bonus si la séance reste sous le plancher.
  const deficit = MIN_QUESTIONS - (divIntros.length + core.length);
  if (deficit > 0) {
    core.push(...bonusPadding(profile, [...divIntros, ...core], deficit));
  }

  return [...divIntros, ...interleaveGreedy(core, itemConflict)];
}

// Révisions bonus pour combler une séance courte : divisions introduites en
// priorité (cohérent avec le niveau en cours), puis tables. Exclut les faits
// déjà présents dans la séance.
function bonusPadding(profile: UserProfile, used: SessionItem[], count: number): SessionItem[] {
  const usedDivKeys = new Set(
    used
      .filter((i) => i.kind === 'div')
      .map((i) => getDivisionFactKey(i.fact.dividend, i.fact.divisor)),
  );
  const divBonus = pickBonusReviewFacts(
    profile.divisionFacts ?? [],
    (f) => usedDivKeys.has(getDivisionFactKey(f.dividend, f.divisor)),
    count,
  ).map(divItem);

  if (divBonus.length >= count) return divBonus;

  const usedMultKeys = new Set(
    used.filter((i) => i.kind === 'mult').map((i) => getFactKey(i.fact.a, i.fact.b)),
  );
  const multBonus = pickBonusReviewFacts(
    profile.facts,
    (f) => usedMultKeys.has(getFactKey(f.a, f.b)),
    count - divBonus.length,
  ).map((fact) => multItem(fact, true));

  return [...divBonus, ...multBonus];
}
