import type { MultiFact, UserProfile, SessionQuestion } from '../types';
import {
  isDue,
  shouldIntroduceNew,
  vanDeWalleStage,
  prioritizeByBoxLevel,
  pickBonusReviewFacts,
} from './leitner';
import { getFactKey } from './facts';
import { computeSimilarity } from './similarity';
import { daysBetween, interleaveGreedy } from './utils';

// Target range: 12-15 questions (~5 min at ~20-30s per question with feedback).
// MIN_QUESTIONS is a soft target, not an absolute floor: if fewer distinct facts
// are available, the session is shorter rather than repeating facts (massed
// practice is counterproductive — Cepeda et al. 2008). See specs §6.2.
const MIN_QUESTIONS = 12;
const MAX_QUESTIONS = 15;
const MAX_NEW_FACTS = 2;

/**
 * Returns a random display order for a fact (a*b or b*a).
 * For squares (a === b), returns the original order.
 */
export function randomDisplayOrder(fact: MultiFact): { displayA: number; displayB: number } {
  if (fact.a === fact.b) {
    return { displayA: fact.a, displayB: fact.b };
  }
  return Math.random() < 0.5
    ? { displayA: fact.a, displayB: fact.b }
    : { displayA: fact.b, displayB: fact.a };
}

/**
 * Returns which "table" a question belongs to (the smaller operand displayed).
 * Used for interleaving: we never want two consecutive questions from the same table.
 */
function questionTable(q: SessionQuestion): number {
  return Math.min(q.displayA, q.displayB);
}

/**
 * Checks if placing `candidate` right after `prev` would violate
 * the interleaving rule (same table) or the anti-interference rule (strong similarity).
 */
function isAdjacentConflict(prev: SessionQuestion, candidate: SessionQuestion): boolean {
  // Same table check
  if (questionTable(prev) === questionTable(candidate)) {
    return true;
  }
  // Strong similarity check
  if (computeSimilarity(prev.fact, candidate.fact) === 'strong') {
    return true;
  }
  return false;
}

/**
 * Composes a session of 12-15 questions following the spec:
 *
 * Priority order (§6.1):
 *   1. Box 1 facts that are due (highest priority)
 *   2. Box 2-3 facts that are due
 *   3. Box 4-5 facts that are due
 *   4. New facts to introduce (max 2)
 *
 * Constraints (§6.2):
 *   - Anti-interference: no two facts with strong similarity adjacent
 *   - Interleaving: never two consecutive questions from the same table
 *   - Max 2 new facts introduced per session
 *   - Vary display order (a*b vs b*a)
 */
export function composeSession(profile: UserProfile, now: string): SessionQuestion[] {
  const { facts } = profile;
  const today = now.slice(0, 10);

  // Intros choisies AVANT les révisions : sinon, avec ~33 faits introduits en
  // B2/B3 (15+ dus/jour), les révisions remplissent les MAX_QUESTIONS slots et
  // affament l'intro des derniers faits — 8×9 et 9×9 jamais posés malgré le
  // mode tail de shouldIntroduceNew.
  //
  // Similarité 48h (specs §1.2) : on espace les *introductions*, pas les
  // révisions actives — l'interférence joue à l'apprentissage. On s'appuie sur
  // `introducedAt`, posé uniquement lors de l'écran d'intro réel. Un fait dominé
  // au placement (introduit sans écran) n'a pas d'`introducedAt` → il n'entre
  // jamais ici, même une fois révisé : sinon une table en révision active
  // bloquerait à jamais l'intro de ses derniers faits (ex 7×9/8×9/9×9).
  const recentlyIntroduced = facts.filter(
    (f) => f.introducedAt && daysBetween(f.introducedAt, today) < 2,
  );

  const newFacts: MultiFact[] = [];
  if (shouldIntroduceNew(facts)) {
    const notIntroduced = facts.filter((f) => !f.introduced);
    const sorted = [...notIntroduced].sort(
      (a, b) =>
        vanDeWalleStage(a.a, a.b) - vanDeWalleStage(b.a, b.b) || a.product - b.product,
    );

    for (const fact of sorted) {
      if (newFacts.length >= MAX_NEW_FACTS) break;

      const hasSimilarRecent = recentlyIntroduced.some(
        (recent) => computeSimilarity(recent, fact) !== 'none',
      );
      if (hasSimilarRecent) continue;

      newFacts.push(fact);
    }
  }

  const reviewBudget = MAX_QUESTIONS - newFacts.length;

  const dueFacts = facts.filter((f) => f.introduced && isDue(f, today));
  const prioritized = prioritizeByBoxLevel(dueFacts);

  const selected: MultiFact[] = [];
  for (const fact of prioritized) {
    if (selected.length >= reviewBudget) break;
    const hasStrongConflict = selected.some(
      (s) => computeSimilarity(s, fact) === 'strong',
    );
    if (!hasStrongConflict) {
      selected.push(fact);
    }
  }

  // Fallback : on relâche la contrainte de similarité forte plutôt que de
  // livrer une séance sous MIN_QUESTIONS quand le pool dû ne suffit pas.
  if (selected.length + newFacts.length < MIN_QUESTIONS) {
    for (const fact of prioritized) {
      if (selected.length >= reviewBudget) break;
      if (!selected.includes(fact)) {
        selected.push(fact);
      }
    }
  }

  // Build SessionQuestion objects
  const reviewQuestions: SessionQuestion[] = selected.map((fact) => ({
    fact,
    ...randomDisplayOrder(fact),
    isIntroduction: false,
    isRetry: false,
    isBonusReview: false,
  }));

  const introQuestions: SessionQuestion[] = newFacts.map((fact) => ({
    fact,
    ...randomDisplayOrder(fact),
    isIntroduction: true,
    isRetry: false,
    isBonusReview: false,
  }));

  // Combine: intro questions are placed at the front, then interleave the rest.
  // The spec says intro happens before practice, so intro questions come first.
  const allReview = interleaveGreedy(reviewQuestions, isAdjacentConflict);
  const result = [...introQuestions, ...allReview];

  // Padding par bonus reviews (feedback normal, sans toucher au Leitner :
  // le calendrier de répétition espacée est préservé — cf. pickBonusReviewFacts).
  if (result.length < MIN_QUESTIONS) {
    const sessionFactKeys = new Set(result.map((q) => getFactKey(q.fact.a, q.fact.b)));
    const bonusQuestions: SessionQuestion[] = pickBonusReviewFacts(
      facts,
      (f) => sessionFactKeys.has(getFactKey(f.a, f.b)),
      MIN_QUESTIONS - result.length,
    ).map((fact) => ({
      fact,
      ...randomDisplayOrder(fact),
      isIntroduction: false,
      isRetry: false,
      isBonusReview: true,
    }));
    result.push(...interleaveGreedy(bonusQuestions, isAdjacentConflict));
  }

  return result;
}