import type { UserProfile, DivisionFact, DivisionSessionQuestion } from '../types';
import { isDue } from './leitner';
import { getFactKey } from './facts';
import { getDivisionFactKey, parentMultiplicationKey } from './divisionFacts';
import { shuffle, interleaveGreedy } from './utils';

// Mêmes bornes que la multiplication (cf. sessionComposer.ts, specs §6).
const MIN_QUESTIONS = 12;
const MAX_QUESTIONS = 15;
const MAX_NEW_FACTS = 2;

// Ordre d'introduction, calqué sur la séquence multiplicative (Van de Walle)
// appliquée au couple (divisor, quotient). En pratique l'éligibilité est déjà
// pilotée par la maîtrise du parent multiplicatif, donc cet ordre ne fait que
// départager les faits devenus éligibles en même temps.
function divisionStage(fact: DivisionFact): number {
  const a = fact.divisor;
  const b = fact.quotient;
  if (a === 2 || b === 2) return 1; // Doubles
  if (a === 5 || b === 5) return 2; // Fives
  if (a === 9 || b === 9) return 3; // Nines
  if (a === b) return 4;            // Carrés
  return 5;                          // Dérivés
}

/**
 * Deux faits de division en conflit s'ils ne doivent pas être adjacents :
 * - même dividende (56÷7 vs 56÷8) → forte interférence, le cas clé du §11.6 ;
 * - même diviseur → même « table » (règle d'entrelacement).
 */
function questionConflict(a: DivisionFact, b: DivisionFact): boolean {
  return a.dividend === b.dividend || a.divisor === b.divisor;
}

// Entrelacement : deux questions adjacentes ne doivent pas être en conflit
// (même dividende ou même diviseur, cf. questionConflict).
function interleave(questions: DivisionSessionQuestion[]): DivisionSessionQuestion[] {
  return interleaveGreedy(questions, (a, b) => questionConflict(a.fact, b.fact));
}

function makeQuestion(
  fact: DivisionFact,
  flags: Partial<DivisionSessionQuestion> = {},
): DivisionSessionQuestion {
  return {
    fact,
    isIntroduction: false,
    isRetry: false,
    isBonusReview: false,
    ...flags,
  };
}

/**
 * Compose une séance de division (12-15 questions), miroir de composeSession
 * adapté au niveau 2 (specs §11) :
 *
 * - Introduction GATÉE sur la maîtrise multiplicative : un fait de division
 *   n'est introduit que si son parent multiplicatif est en boîte 5 (§11.3).
 * - Anti-interférence renforcée : jamais deux faits de même dividende
 *   adjacents (§11.6).
 * - Pas de variation d'ordre : la division n'est pas commutative (§11.2).
 *
 * Renvoie une liste vide si aucun fait de division n'est encore éligible
 * (niveau pas encore débloqué / aucune table maîtrisée).
 */
export function composeDivisionSession(
  profile: UserProfile,
  now: string,
): DivisionSessionQuestion[] {
  const divisionFacts = profile.divisionFacts ?? [];
  const today = now.slice(0, 10);

  // Faits multiplicatifs maîtrisés (boîte 5) → leurs clés canoniques.
  const masteredKeys = new Set(
    profile.facts.filter((f) => f.box === 5).map((f) => getFactKey(f.a, f.b)),
  );

  // Intros : faits non introduits dont le parent multiplicatif est maîtrisé.
  const eligible = divisionFacts
    .filter((f) => !f.introduced && masteredKeys.has(parentMultiplicationKey(f)))
    .sort((a, b) => divisionStage(a) - divisionStage(b) || a.dividend - b.dividend);

  const newFacts: DivisionFact[] = [];
  for (const fact of eligible) {
    if (newFacts.length >= MAX_NEW_FACTS) break;
    // Ne pas introduire ensemble deux faits qui interfèrent.
    if (newFacts.some((nf) => questionConflict(nf, fact))) continue;
    newFacts.push(fact);
  }

  const reviewBudget = MAX_QUESTIONS - newFacts.length;

  const dueFacts = divisionFacts.filter((f) => f.introduced && isDue(f, today));
  const box1 = shuffle(dueFacts.filter((f) => f.box === 1));
  const box23 = shuffle(dueFacts.filter((f) => f.box === 2 || f.box === 3));
  const box45 = shuffle(dueFacts.filter((f) => f.box === 4 || f.box === 5));
  const prioritized = [...box1, ...box23, ...box45];

  const selected: DivisionFact[] = [];
  for (const fact of prioritized) {
    if (selected.length >= reviewBudget) break;
    // Évite d'embarquer deux orientations du même dividende dans la séance.
    if (!selected.some((s) => s.dividend === fact.dividend)) {
      selected.push(fact);
    }
  }

  // Fallback : relâche la contrainte de dividende plutôt que livrer une séance
  // trop courte quand le pool dû ne suffit pas.
  if (selected.length + newFacts.length < MIN_QUESTIONS) {
    for (const fact of prioritized) {
      if (selected.length >= reviewBudget) break;
      if (!selected.includes(fact)) selected.push(fact);
    }
  }

  const reviewQuestions = selected.map((fact) => makeQuestion(fact));
  const introQuestions = newFacts.map((fact) => makeQuestion(fact, { isIntroduction: true }));

  const result = [...introQuestions, ...interleave(reviewQuestions)];

  // Padding par révisions bonus (pas de modification Leitner — cf. §6.2).
  if (result.length < MIN_QUESTIONS) {
    const usedKeys = new Set(
      result.map((q) => getDivisionFactKey(q.fact.dividend, q.fact.divisor)),
    );
    const slotsLeft = MIN_QUESTIONS - result.length;
    const bonus = shuffle(
      divisionFacts.filter(
        (f) => f.introduced && !usedKeys.has(getDivisionFactKey(f.dividend, f.divisor)),
      ),
    )
      .sort((a, b) => a.box - b.box || a.nextDue.localeCompare(b.nextDue))
      .slice(0, slotsLeft)
      .map((fact) => makeQuestion(fact, { isBonusReview: true }));
    result.push(...interleave(bonus));
  }

  return result;
}
