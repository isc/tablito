import type { BoxLevel, Attempt, FactKind, UserProfile } from '../types';
import { BOX_INTERVALS, FAST_THRESHOLD_MS } from '../types';
import { addDays, shuffle } from './utils';

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

// `addDays` a rejoint utils.ts (à côté de daysBetween/todayISO) : c'est de
// l'arithmétique de calendrier, pas de la planification Leitner. Ré-exporté
// ici pour les appelants historiques.
export { addDays };

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
  // Réponse donnée (nombre, ou forme écrite + attendue en conjugaison),
  // consignée telle quelle dans la tentative.
  answer: Pick<Attempt, 'answeredWith' | 'expectedForm'> = { answeredWith: null },
): T {
  const attempt: Attempt = {
    date: now,
    correct,
    responseTimeMs,
    ...answer,
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
//
// ⚠ Le seuil est RELATIF à la taille du jeu de faits, pas absolu. Écrit en dur
// à 7, il était calibré sur les 36 multiplications (7/36 ≈ 20 %) et réutilisé
// tel quel par la division (64), le reste (64) et la conjugaison (63) — où
// « ≤ 7 restants » veut dire 89 % du jeu introduit au lieu de 81 %. Vécu en
// prod : un profil avec 52/64 divisions introduites et tout le reste en boîte
// 4-5 n'introduisait plus rien pendant des semaines — le mode tail ne s'ouvrait
// qu'à 57/64, et entre-temps la règle boîte≥2 exigeait une séance SANS AUCUNE
// erreur (une seule faute renvoie un fait en boîte 1 et gèle l'intro jusqu'à ce
// qu'il remonte). Sur 52 faits introduits, cette séance parfaite n'arrive
// presque jamais. Le cinquième du jeu redonne à chaque matière la fin de
// parcours prévue par les specs : 7/36 (inchangé), 12/64, 12/63.
function tailIntroThreshold(total: number): number {
  return Math.floor(total / 5);
}

// « N'empile pas du neuf sur du fragile » : on mesure la TAILLE de la pile
// fragile, pas son existence.
//
// La règle historique était `introduced.every((f) => f.box >= 2)` — aucun fait
// en boîte 1, sinon rien de neuf. Une faute renvoyant un fait en boîte 1 sans
// condition (cf. processAnswer), ça revient à exiger une séance SANS LA MOINDRE
// ERREUR pour avancer d'un cran. Or c'est un « pour tout » sur un ensemble qui
// grossit : facile à 8 faits introduits, quasi impossible à 50. L'exigence se
// durcissait donc à mesure que l'enfant progressait — exactement l'inverse de
// l'intention.
//
// ⚠ Absolu, là où tailIntroThreshold (juste au-dessus) est proportionnel : les
// deux ne mesurent pas la même chose. L'AVANCEMENT (« suis-je en fin de
// parcours ? ») n'a de sens que rapporté au jeu de faits. La CAPACITÉ (« combien
// de fragile l'enfant porte-t-il en même temps ? ») se compare au budget d'une
// séance, qui ne dépend pas de la taille du jeu. L'invariant est d'ailleurs
// MAX_FRAGILE ≈ 1,5 × le plafond de faits neufs par séance (2) : l'enfant peut
// traîner une séance de neuf, pas trois. « 3 » n'est que la conséquence.
//
// Protocole de calibrage et chiffres (simulation sur les composeurs réels) :
// specs §3.4bis. Ils n'y sont qu'une fois — ne pas les recopier ici.
export const MAX_FRAGILE = 3;

/**
 * Returns true if a new fact should be introduced.
 * Condition: au plus MAX_FRAGILE faits déjà introduits sont en boîte 1.
 *
 * Agnostique au type de fait (multiplication ou division) : ne lit que
 * `introduced` et `box`. Réutilisé tel quel par le niveau 2 (specs §11.6).
 */
export function shouldIntroduceNew(facts: { introduced: boolean; box: BoxLevel }[]): boolean {
  const introduced = facts.filter((f) => f.introduced);
  if (introduced.length === 0) return true;
  // Le filet de fin de parcours reste EN PLUS du plafond, malgré les
  // apparences : un enfant durablement au-dessus du plafond resterait bloqué
  // sans lui (chiffres en specs §3.4bis).
  if (facts.length - introduced.length <= tailIntroThreshold(facts.length)) return true;
  return introduced.filter((f) => f.box === 1).length <= MAX_FRAGILE;
}

// Seuil de « maîtrise » partagé : un fait est considéré maîtrisé dès la boîte 4
// (1ère case quasi-nette de l'image mystère ; cf. badge « Première case »).
export const MASTERY_BOX: BoxLevel = 4;

/**
 * Un groupe de faits (un temps, un verbe, une famille de verbes) est-il
 * maîtrisé ? Non vide, et tous ses faits en boîte ≥ MASTERY_BOX — le critère
 * des badges de groupe des matières, comme « Table de N » côté maths.
 */
export function allMastered(facts: { box: BoxLevel }[]): boolean {
  return facts.length > 0 && facts.every((f) => f.box >= MASTERY_BOX);
}

/**
 * Boîte de départ d'un fait réussi au placement d'une matière, selon sa
 * vitesse : sous le seuil « rapide », boîte 3 ; sous le double, boîte 2.
 */
export function placementBox(timeMs: number, fastMs: number): BoxLevel {
  if (timeMs < fastMs) return 3;
  if (timeMs < fastMs * 2) return 2;
  return 1;
}

/**
 * Place un fait démontré au placement : introduit, à la boîte donnée, dû au
 * prochain intervalle. Aucun `history` : c'est un calibrage, pas une révision.
 */
export function placeFact(
  fact: { introduced: boolean; box: BoxLevel; lastSeen: string; nextDue: string },
  box: BoxLevel,
  today: string,
): void {
  fact.introduced = true;
  fact.box = box;
  fact.lastSeen = today;
  fact.nextDue = computeNextDue(box, today);
}

/** Nombre de faits maîtrisés (boîte ≥ MASTERY_BOX), × ou ÷. */
export function countMastered(facts: { box: BoxLevel }[]): number {
  return facts.filter((f) => f.box >= MASTERY_BOX).length;
}

/**
 * Inventaire Leitner d'un niveau de maths ou d'une matière (conjugaison,
 * verbes irréguliers), tel que le profil le stocke — vide pour une matière
 * jamais ouverte.
 */
export function factsOf(
  profile: UserProfile,
  kind: FactKind,
): Array<{ box: BoxLevel; introduced: boolean }> {
  switch (kind) {
    case 'mult':
      return profile.facts;
    case 'div':
      return profile.divisionFacts ?? [];
    case 'rem':
      return profile.remainderFacts ?? [];
    case 'conj':
      return profile.conjFacts ?? [];
    case 'irr':
      return profile.irrFacts ?? [];
  }
}

/**
 * Nombre de faits par boîte : l'indice 0 compte les faits pas encore
 * introduits, les indices 1 à 5 les boîtes B1 à B5 ; la somme vaut
 * `facts.length`. Un fait déjà en boîte de maîtrise y compte même sans avoir
 * été introduit, comme pour countMastered : le compte des maîtrisées et sa
 * répartition ne se contredisent jamais.
 */
export function boxCounts(facts: { box: BoxLevel; introduced: boolean }[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const f of facts) counts[f.introduced || f.box >= MASTERY_BOX ? f.box : 0]++;
  return counts;
}

/**
 * Les boîtes regroupées en trois paliers lisibles par un parent, pour le
 * résumé d'une matière sur l'accueil de l'espace parent (sa page détaille les
 * boîtes elles-mêmes). Ce qui n'est dans aucun palier n'a pas encore été vu.
 */
export interface MasteryBuckets {
  // Boîtes 4 et 5 : ce que compte countMastered, que lisent les autres écrans.
  mastered: number;
  // Boîte 3 : revu plusieurs fois sans erreur, pas encore ancré.
  onTrack: number;
  // Boîtes 1 et 2 : récent, ou retombé après une erreur.
  fragile: number;
}

export function masteryBuckets(facts: { box: BoxLevel; introduced: boolean }[]): MasteryBuckets {
  const [, b1, b2, b3, b4, b5] = boxCounts(facts);
  return { mastered: b4 + b5, onTrack: b3, fragile: b1 + b2 };
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
