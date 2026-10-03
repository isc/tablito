import type { UserProfile, RemainderFact, RemainderSessionQuestion } from '../types';
import { isDue, shouldIntroduceNew, vanDeWalleStage, prioritizeByBoxLevel } from './leitner';
import { getDivisionFactKey } from './divisionFacts';
import { parentDivisionKey, introRemainder, drawRemainder } from './remainderFacts';
import { MAX_QUESTIONS, MAX_NEW_FACTS } from './sessionComposer';

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

/**
 * Sélectionne la part « division avec reste » de la séance quotidienne, miroir
 * de selectDivisionQuestions adapté au niveau 3 (specs §12) :
 *
 * - Introduction GATÉE sur la solidité du niveau 2 : une zone n'est introduite
 *   que si sa division exacte parente est en boîte 4+ — même seuil que
 *   l'ouverture du niveau (isRemainderUnlocked = badges « Divisions par N » =
 *   boîte 4+), et même assouplissement que le niveau 2 vis-à-vis du « boîte 5 »
 *   des specs : sinon un profil fraîchement débloqué (tout en boîte 4, rien en
 *   boîte 5) n'aurait AUCUNE zone introductible.
 * - Anti-interférence : jamais deux zones de même diviseur introduites
 *   ensemble (§12.7).
 * - Pas de variation d'ordre : la question est toujours « dividende ÷ diviseur ».
 *
 * Comme selectDivisionQuestions : `maintenanceCount` (places déjà prises par
 * l'entretien) compte dans le budget de révisions, et la sélection revient
 * dans l'ordre de PRIORITÉ, sans padding (cf. composeDailySession).
 *
 * Renvoie des listes vides si aucune zone n'est encore éligible.
 */
export function selectRemainderQuestions(
  profile: UserProfile,
  now: string,
  maintenanceCount: number,
): { intros: RemainderSessionQuestion[]; due: RemainderSessionQuestion[] } {
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

  const reviewBudget = Math.max(0, MAX_QUESTIONS - newFacts.length - maintenanceCount);

  const dueFacts = remainderFacts.filter((f) => f.introduced && isDue(f, today));
  const selected = prioritizeByBoxLevel(dueFacts).slice(0, reviewBudget);

  // Révision : reste tiré au sort (0..d-1). Intro : reste canonique de la zone
  // (les MP3 d'intro sont pré-générés et doivent coller aux nombres affichés).
  return {
    intros: newFacts.map((fact) =>
      makeQuestion(fact, introRemainder(fact.divisor), { isIntroduction: true }),
    ),
    due: selected.map((fact) => makeQuestion(fact, drawRemainder(fact.divisor))),
  };
}
