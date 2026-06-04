import type { UserProfile, SessionItem } from '../types';
import { isDue } from './leitner';
import { composeDivisionSession } from './divisionComposer';
import { randomDisplayOrder } from './sessionComposer';
import { computeSimilarity } from './similarity';
import { shuffle, interleaveGreedy } from './utils';

// Cible haute d'une séance (cf. sessionComposer / specs §6).
const TARGET_QUESTIONS = 15;
// Plafond de faits de tables en entretien par séance : on ne noie pas la
// division (le vrai apprentissage) sous la maintenance. Les faits dus au-delà
// sont repris la séance suivante — sans danger en boîte 5 (specs §11.6).
const MAX_MULT_MAINTENANCE = 6;

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
 * (révisions division + entretien tables) est entrelacé.
 */
export function composeDailySession(profile: UserProfile, now: string): SessionItem[] {
  const today = now.slice(0, 10);

  const divItems: SessionItem[] = composeDivisionSession(profile, today).map((q) => ({
    kind: 'div',
    ...q,
  }));

  // Faits de tables dus aujourd'hui → révisions d'entretien (jamais des intros :
  // post-déblocage les tables sont toutes introduites et maîtrisées).
  const maintenance: SessionItem[] = shuffle(
    profile.facts.filter((f) => f.introduced && isDue(f, today)),
  )
    .slice(0, MAX_MULT_MAINTENANCE)
    .map((fact) => ({
      kind: 'mult',
      fact,
      ...randomDisplayOrder(fact),
      isIntroduction: false,
      isRetry: false,
      isBonusReview: false,
    }));

  if (maintenance.length === 0) return divItems;

  const divIntros = divItems.filter((i) => i.isIntroduction);
  const divReviews = divItems.filter((i) => !i.isIntroduction);

  // L'entretien remplace des révisions division pour viser ~TARGET sans gonfler
  // la séance. Intros division gardées en priorité.
  const reviewSlots = Math.max(0, TARGET_QUESTIONS - divIntros.length - maintenance.length);
  const rest = interleaveGreedy(
    [...divReviews.slice(0, reviewSlots), ...maintenance],
    itemConflict,
  );

  return [...divIntros, ...rest];
}
