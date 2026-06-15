import type { BoxLevel, Attempt } from '../types';
import { BOX_INTERVALS, FAST_THRESHOLD_MS } from '../types';
import { shuffle } from './utils';

// Forme minimale de planification Leitner, commune à MultiFact et DivisionFact.
// Les fonctions ci-dessous opèrent uniquement sur ces champs (jamais sur a/b/
// product ni dividend/divisor) : elles sont donc agnostiques au type de fait
// et réutilisées telles quelles par le niveau 2 division (cf. specs §11.6).
type Schedulable = {
  box: BoxLevel;
  lastSeen: string;
  nextDue: string;
  history: Attempt[];
};

/**
 * Adds `days` calendar days to an ISO date string and returns the new ISO date string.
 */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Computes the next due date for a fact based on its box level.
 */
export function computeNextDue(box: BoxLevel, lastSeen: string): string {
  const interval = BOX_INTERVALS[box];
  return addDays(lastSeen, interval);
}

/**
 * Returns true if a fact is due for review (nextDue <= now).
 * A fact with no nextDue (empty string) is always due.
 */
export function isDue(fact: { nextDue: string }, now: string): boolean {
  if (!fact.nextDue) return true;
  return fact.nextDue <= now;
}

/**
 * Processes an answer and returns the updated MultiFact.
 *
 * Rules (cf. spec §3.3 + §3.7) :
 * - Correct + assez rapide (< seuil mode) : montée de boîte (max 5)
 * - Correct + lent : pas de changement de boîte, l'attempt est quand même
 *   enregistré et nextDue recalculé depuis aujourd'hui
 * - Incorrect : retour boîte 1
 *
 * Le seuil dépend du mode de saisie : 5 s en clavier (compense le surcoût
 * moteur du pavé numérique chez un enfant), 3 s en voix (proche de la mesure
 * d'automaticité de la littérature, l'output STT étant rapide).
 */
export function processAnswer<T extends Schedulable>(
  fact: T,
  correct: boolean,
  responseTimeMs: number,
  now: string,
  inputMode: 'keypad' | 'voice',
  // Seuil de rapidité (montée de boîte). Par défaut celui de la multiplication ;
  // la division passe un seuil plus généreux (specs §11.6).
  fastThresholdMs: number = FAST_THRESHOLD_MS[inputMode],
): T {
  const attempt: Attempt = {
    date: now,
    correct,
    responseTimeMs,
    answeredWith: null, // the caller can fill this in before calling
  };

  const updatedHistory = [...fact.history, attempt].slice(-30);

  if (!correct) {
    const newBox: BoxLevel = 1;
    return {
      ...fact,
      box: newBox,
      lastSeen: now,
      nextDue: computeNextDue(newBox, now),
      history: updatedHistory,
    };
  }

  // Correct answer
  const isFastEnough = responseTimeMs < fastThresholdMs;

  if (isFastEnough) {
    const newBox = Math.min(fact.box + 1, 5) as BoxLevel;
    return {
      ...fact,
      box: newBox,
      lastSeen: now,
      nextDue: computeNextDue(newBox, now),
      history: updatedHistory,
    };
  }

  // Correct but slow: no box change
  return {
    ...fact,
    lastSeen: now,
    nextDue: computeNextDue(fact.box, now),
    history: updatedHistory,
  };
}

// Phase finale : seuil sous lequel on introduit les derniers faits restants
// même si certains faits sont en boîte 1. Sans ça, un seul fait raté en
// boîte 1 bloque indéfiniment l'intro des derniers faits après le seeding par
// dominance du test de placement (qui ne peut inférer aucun fait du coin
// difficile non couvert par les réponses correctes). À ce stade, l'enfant
// maîtrise déjà la quasi-totalité ; la règle protectrice du début n'a plus
// d'utilité.
//
// Le trou de dominance n'est pas limité à 8×9/9×9 : il couvre tout le coin
// difficile au-delà du dernier fait réussi au placement (ex : 7×9, 8×9, 9×9 —
// 3 faits). Le seuil englobe ce coin avec marge (≤ 7 restants ⇔ ≥ 29/36
// introduits = clairement en fin de parcours).
const TAIL_INTRO_THRESHOLD = 7;

/**
 * Returns true if a new fact should be introduced.
 * Condition: all previously introduced facts are at box 2 or above.
 *
 * Agnostique au type de fait (multiplication ou division) : ne lit que
 * `introduced` et `box`. Réutilisé tel quel par le niveau 2 (specs §11.6).
 */
export function shouldIntroduceNew(facts: { introduced: boolean; box: BoxLevel }[]): boolean {
  const introduced = facts.filter((f) => f.introduced);
  if (introduced.length === 0) return true;
  if (facts.length - introduced.length <= TAIL_INTRO_THRESHOLD) return true;
  return introduced.every((f) => f.box >= 2);
}

// Seuil de « maîtrise » partagé : un fait est considéré maîtrisé dès la boîte 4
// (1ère case quasi-nette de l'image mystère ; cf. badge « Première case »).
export const MASTERY_BOX: BoxLevel = 4;

/** Nombre de faits maîtrisés (boîte ≥ MASTERY_BOX), × ou ÷. */
export function countMastered(facts: { box: BoxLevel }[]): number {
  return facts.filter((f) => f.box >= MASTERY_BOX).length;
}

/** Libellé lisible du niveau d'un fait selon sa boîte (espace parent, images). */
export function boxLevelLabel(box: BoxLevel): string {
  if (box === 5) return 'Maîtrisé !';
  if (box === 1) return 'En apprentissage';
  return `Boîte ${box}/5`;
}

// --- Briques de composition de séance, partagées par les composeurs × et ÷ ---
// (la séparation des composeurs est volontaire — politiques d'intro/conflit
// distinctes ; seules les briques mécaniques ci-dessous sont mutualisées).

/**
 * Rang dans la séquence canonique d'introduction (Van de Walle / Wichita 2014,
 * specs §3.4bis), à partir des deux nombres caractéristiques d'un fait :
 * (a, b) en multiplication, (diviseur, quotient) en division.
 */
export function vanDeWalleStage(x: number, y: number): number {
  if (x === 2 || y === 2) return 1; // Doubles
  if (x === 5 || y === 5) return 2; // Fives
  if (x === 9 || y === 9) return 3; // Nines
  if (x === y) return 4;            // Carrés
  return 5;                          // Dérivés
}

/**
 * Priorise les faits dus pour remplir une séance (specs §6.1) : boîte 1 (les
 * plus fragiles) d'abord, puis B2-3, puis B4-5 ; shuffle à l'intérieur de chaque
 * palier (les ex-aequo ne suivent pas l'ordre de création).
 */
export function prioritizeByBoxLevel<T extends { box: BoxLevel }>(due: T[]): T[] {
  return [
    ...shuffle(due.filter((f) => f.box === 1)),
    ...shuffle(due.filter((f) => f.box === 2 || f.box === 3)),
    ...shuffle(due.filter((f) => f.box === 4 || f.box === 5)),
  ];
}

/**
 * Faits de « révision bonus » pour compléter une séance trop courte SANS toucher
 * au calendrier Leitner (specs §6.2) : parmi les faits introduits non déjà
 * présents (`isUsed`), les plus faibles d'abord (boîte puis nextDue). Shuffle
 * préalable pour casser l'ordre de création sur les ex-aequo. L'appelant
 * fabrique les questions (ordre d'affichage, flags) et les entrelace.
 */
export function pickBonusReviewFacts<T extends Schedulable & { introduced: boolean }>(
  facts: T[],
  isUsed: (fact: T) => boolean,
  count: number,
): T[] {
  return shuffle(facts.filter((f) => f.introduced && !isUsed(f)))
    .sort((a, b) => a.box - b.box || a.nextDue.localeCompare(b.nextDue))
    .slice(0, count);
}
