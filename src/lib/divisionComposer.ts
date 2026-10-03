import type { UserProfile, DivisionFact, DivisionSessionQuestion } from '../types';
import { isDue, shouldIntroduceNew, vanDeWalleStage, prioritizeByBoxLevel } from './leitner';
import { getFactKey } from './facts';
import { parentMultiplicationKey } from './divisionFacts';
import { MIN_QUESTIONS, MAX_QUESTIONS, MAX_NEW_FACTS } from './sessionComposer';

/**
 * Deux faits de division en conflit : jamais introduits ensemble, jamais
 * adjacents dans la séance (composeDailySession).
 * - même dividende (56÷7 vs 56÷8) → forte interférence, le cas clé du §11.6 ;
 * - même diviseur → même « table » (règle d'entrelacement).
 */
export function divisionConflict(a: DivisionFact, b: DivisionFact): boolean {
  return a.dividend === b.dividend || a.divisor === b.divisor;
}

/**
 * Règle du dividende (§11.6) : le fait peut-il entrer dans la séance à côté de
 * TOUTES ces divisions ? 56÷7 et 56÷8, hautement confusibles, ne s'y croisent
 * pas. Même filtre pour les révisions dues et les bonus ; deux intros
 * s'écartent déjà par divisionConflict, plus strict.
 */
export function divisionCoexistsWithAll(fact: DivisionFact, others: DivisionFact[]): boolean {
  return others.every((other) => other.dividend !== fact.dividend);
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
 * Sélectionne la part division de la séance quotidienne, miroir de
 * composeSession adapté au niveau 2 (specs §11) :
 *
 * - Introduction GATÉE sur la solidité multiplicative : un fait de division
 *   n'est introduit que si son parent multiplicatif est en boîte 4+ (§11.3),
 *   même seuil que l'ouverture du niveau (isDivisionUnlocked).
 * - Anti-interférence renforcée (§11.6) : jamais deux faits de même dividende
 *   introduits ensemble, ni une révision due au dividende d'une intro du jour.
 *   L'intro passe d'abord (§6.1) et la révision attend la séance suivante :
 *   sauter l'intro à la place doublait le temps d'introduire les 64 divisions.
 *   Entre révisions, la règle ne cède que si la séance n'atteindrait son
 *   plancher qu'avec des bonus.
 * - Pas de variation d'ordre : la division n'est pas commutative (§11.2).
 *
 * `maintenanceCount` : places déjà prises par l'entretien, comptées dans le
 * budget de révisions et le fallback de dividende (cf. composeDailySession).
 *
 * Renvoie les intros et les révisions dues dans l'ordre de PRIORITÉ (les plus
 * fragiles d'abord, §6.1), non entrelacées et sans padding :
 * composeDailySession complète sous le plancher et ordonne la séance entière.
 *
 * Renvoie des listes vides si aucun fait de division n'est encore éligible
 * (niveau pas encore débloqué / aucune table maîtrisée).
 */
export function selectDivisionQuestions(
  profile: UserProfile,
  now: string,
  maintenanceCount: number,
): { intros: DivisionSessionQuestion[]; due: DivisionSessionQuestion[] } {
  const divisionFacts = profile.divisionFacts ?? [];
  const today = now.slice(0, 10);

  // Faits multiplicatifs prêts (boîte 4+) → leurs clés canoniques.
  // Même seuil que l'ouverture du niveau 2 (badges « Table de N » = boîte 4+,
  // cf. isDivisionUnlocked) : sinon un parent bloqué en boîte 4 gèle
  // indéfiniment l'intro de ses divisions (56÷7/56÷8 derrière 7×8 têtu), et
  // pire, un profil avec toutes les tables en boîte 4 mais aucune en boîte 5
  // ouvrirait la division sans aucun fait introductible (specs §11.3).
  const parentReadyKeys = new Set(
    profile.facts.filter((f) => f.box >= 4).map((f) => getFactKey(f.a, f.b)),
  );

  // Intros : faits non introduits dont le parent multiplicatif est prêt.
  // Même pacing que la multiplication : la règle vit dans shouldIntroduceNew
  // (specs §11.6, §3.4bis). Ne pas la paraphraser ici — un recalibrage se
  // ferait sinon par search-and-replace sur les quatre composeurs.
  const newFacts: DivisionFact[] = [];
  if (shouldIntroduceNew(divisionFacts)) {
    const eligible = divisionFacts
      .filter((f) => !f.introduced && parentReadyKeys.has(parentMultiplicationKey(f)))
      .sort(
        (a, b) =>
          vanDeWalleStage(a.divisor, a.quotient) - vanDeWalleStage(b.divisor, b.quotient) ||
          a.dividend - b.dividend,
      );

    for (const fact of eligible) {
      if (newFacts.length >= MAX_NEW_FACTS) break;
      // Ne pas introduire ensemble deux faits qui interfèrent.
      if (newFacts.some((nf) => divisionConflict(nf, fact))) continue;
      newFacts.push(fact);
    }
  }

  // Places déjà prises : les intros du jour et l'entretien.
  const taken = newFacts.length + maintenanceCount;
  const reviewBudget = MAX_QUESTIONS - taken;

  const dueFacts = divisionFacts.filter((f) => f.introduced && isDue(f, today));
  // Une révision au dividende d'une intro du jour attend la séance suivante,
  // même sous le plancher : c'est à l'apprentissage que l'interférence pèse
  // (§1.2), et un bonus prend sa place.
  const prioritized = prioritizeByBoxLevel(dueFacts).filter((f) =>
    divisionCoexistsWithAll(f, newFacts),
  );

  const selected: DivisionFact[] = [];
  for (const fact of prioritized) {
    if (selected.length >= reviewBudget) break;
    if (divisionCoexistsWithAll(fact, selected)) selected.push(fact);
  }

  // Fallback : entre révisions, la règle cède quand la séance, entretien
  // compris, n'atteindrait son plancher qu'avec des bonus. Une révision due,
  // qui fait avancer le Leitner, vaut mieux qu'un bonus de remplissage.
  if (selected.length + taken < MIN_QUESTIONS) {
    for (const fact of prioritized) {
      if (selected.length >= reviewBudget) break;
      if (!selected.includes(fact)) selected.push(fact);
    }
  }

  return {
    intros: newFacts.map((fact) => makeQuestion(fact, { isIntroduction: true })),
    due: selected.map((fact) => makeQuestion(fact)),
  };
}
