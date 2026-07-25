import type { UserProfile, RemainderFact, RemainderSessionQuestion } from '../types';
import { remainderDividend } from '../types';
import {
  isDue,
  shouldIntroduceNew,
  vanDeWalleStage,
  prioritizeByBoxLevel,
  pickBonusReviewFacts,
} from './leitner';
import { getDivisionFactKey } from './divisionFacts';
import {
  getRemainderFactKey,
  parentDivisionKey,
  introRemainder,
  drawRemainder,
} from './remainderFacts';
import { interleaveGreedy } from './utils';

// Mêmes bornes que les niveaux 1 et 2 (cf. sessionComposer.ts, specs §6).
const MIN_QUESTIONS = 12;
const MAX_QUESTIONS = 15;
const MAX_NEW_FACTS = 2;

/**
 * Deux questions de division avec reste en conflit si elles ne doivent pas
 * être adjacentes (specs §12.7) :
 * - même diviseur → même « table », et couvre les zones à quotients adjacents
 *   ((7,6) et (7,7) se touchent à un point près : 48÷7 contre 49÷7) ;
 * - même dividende TIRÉ (45÷7 vs 45÷6) → deux lectures du même nombre,
 *   hautement confusibles dans la même série.
 */
function questionConflict(a: RemainderSessionQuestion, b: RemainderSessionQuestion): boolean {
  return (
    a.fact.divisor === b.fact.divisor || remainderDividend(a) === remainderDividend(b)
  );
}

function interleave(questions: RemainderSessionQuestion[]): RemainderSessionQuestion[] {
  return interleaveGreedy(questions, questionConflict);
}

function makeQuestion(
  fact: RemainderFact,
  remainder: number,
  flags: Partial<RemainderSessionQuestion> = {},
): RemainderSessionQuestion {
  return {
    fact,
    remainder,
    isIntroduction: false,
    isRetry: false,
    isBonusReview: false,
    ...flags,
  };
}

// Révision : reste tiré au sort (0..d-1). Intro : reste canonique de la zone
// (les MP3 d'intro sont pré-générés et doivent coller aux nombres affichés).
function reviewQuestion(fact: RemainderFact, flags: Partial<RemainderSessionQuestion> = {}) {
  return makeQuestion(fact, drawRemainder(fact.divisor), flags);
}

/**
 * Compose une séance de division avec reste (12-15 questions), miroir de
 * composeDivisionSession adapté au niveau 3 (specs §12) :
 *
 * - Introduction GATÉE sur la solidité du niveau 2 : une zone n'est introduite
 *   que si sa division exacte parente est en boîte 4+ — même seuil que
 *   l'ouverture du niveau (isRemainderUnlocked = badges « Divisions par N » =
 *   boîte 4+), et même assouplissement que le niveau 2 vis-à-vis du « boîte 5 »
 *   des specs : sinon un profil fraîchement débloqué (tout en boîte 4, rien en
 *   boîte 5) n'aurait AUCUNE zone introductible.
 * - Anti-interférence : jamais deux zones de même diviseur adjacentes, jamais
 *   deux dividendes tirés identiques adjacents (§12.7).
 * - Pas de variation d'ordre : la question est toujours « dividende ÷ diviseur ».
 *
 * Renvoie une liste vide si aucune zone n'est encore éligible.
 */
export function composeRemainderSession(
  profile: UserProfile,
  now: string,
): RemainderSessionQuestion[] {
  const remainderFacts = profile.remainderFacts ?? [];
  const today = now.slice(0, 10);

  // Divisions exactes prêtes (boîte 4+) → clés (dividend/divisor).
  const parentReadyKeys = new Set(
    (profile.divisionFacts ?? [])
      .filter((f) => f.box >= 4)
      .map((f) => getDivisionFactKey(f.dividend, f.divisor)),
  );

  // Intros : zones non introduites dont la division parente est prête. Même
  // pacing que les niveaux précédents (specs §12.3, §3.4bis).
  const newFacts: RemainderFact[] = [];
  if (shouldIntroduceNew(remainderFacts)) {
    const eligible = remainderFacts
      .filter((f) => !f.introduced && parentReadyKeys.has(parentDivisionKey(f)))
      .sort(
        (a, b) =>
          vanDeWalleStage(a.divisor, a.quotient) - vanDeWalleStage(b.divisor, b.quotient) ||
          a.divisor * a.quotient - b.divisor * b.quotient,
      );

    for (const fact of eligible) {
      if (newFacts.length >= MAX_NEW_FACTS) break;
      // Ne pas introduire ensemble deux zones de même diviseur.
      if (newFacts.some((nf) => nf.divisor === fact.divisor)) continue;
      newFacts.push(fact);
    }
  }

  const reviewBudget = MAX_QUESTIONS - newFacts.length;

  const dueFacts = remainderFacts.filter((f) => f.introduced && isDue(f, today));
  const prioritized = prioritizeByBoxLevel(dueFacts);
  const selected = prioritized.slice(0, reviewBudget);

  const reviewQuestions = selected.map((fact) => reviewQuestion(fact));
  const introQuestions = newFacts.map((fact) =>
    makeQuestion(fact, introRemainder(fact.divisor), { isIntroduction: true }),
  );

  const result = [...introQuestions, ...interleave(reviewQuestions)];

  // Padding par révisions bonus (pas de modification Leitner — cf. §6.2).
  if (result.length < MIN_QUESTIONS) {
    const usedKeys = new Set(
      result.map((q) => getRemainderFactKey(q.fact.divisor, q.fact.quotient)),
    );
    const bonus = pickBonusReviewFacts(
      remainderFacts,
      (f) => usedKeys.has(getRemainderFactKey(f.divisor, f.quotient)),
      MIN_QUESTIONS - result.length,
    ).map((fact) => reviewQuestion(fact, { isBonusReview: true }));
    result.push(...interleave(bonus));
  }

  return result;
}
