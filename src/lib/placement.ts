import type { MultiFact, BoxLevel } from '../types';
import { RESPONSE_TIME } from '../types';
import { computeNextDue } from './leitner';

// `a` et `b` sont normalisés (a ≤ b) — même invariant que `MultiFact`,
// nécessaire pour la comparaison de dominance ci-dessous.
export interface PlacementResult {
  a: number;
  b: number;
  correct: boolean;
  timeMs: number;
}

// Ordre progressif (facile → difficile). Combiné à MAX_CONSECUTIVE_FAILURES,
// évite d'épuiser un enfant sur les ×7/×8/×9 inconnus. Voir specs §3.1.
export const PLACEMENT_FACTS: ReadonlyArray<readonly [number, number]> = [
  [2, 5], [2, 8], [3, 4], [5, 5], [3, 6],
  [5, 8], [3, 9], [4, 7], [6, 6],
  [7, 7], [4, 9], [6, 8], [7, 9], [8, 8], [6, 9],
];

export const MAX_CONSECUTIVE_FAILURES = 3;

// Boîte de placement pour un fait correctement résolu. Les faits ratés ou
// « Je ne sais pas » ne sont pas placés du tout (cf. seedFromPlacement).
function boxFromResult(result: PlacementResult): BoxLevel {
  if (result.timeMs < RESPONSE_TIME.FAST) return 3;
  if (result.timeMs < RESPONSE_TIME.SLOW) return 2;
  return 1;
}

// Marque comme introduit tout fait non encore introduit qui est "dominé"
// par au moins un élément de `evidence` : un (eA, eB) domine un fait (a, b)
// si eA ≥ a ET eB ≥ b. Repose sur l'invariant a ≤ b côté facts et evidence.
//
// La boîte de départ dépend de la qualité de la dominance :
// - boîte 3 si au moins un dominant a été répondu correct *et rapide* (< 3s),
//   équivalent au niveau d'un fait testé directement et réussi rapidement ;
// - boîte 2 sinon (dominance par corrects lents 3-5s seulement).
type DominanceEvidence = { a: number; b: number; isFast: boolean };

function markDominated(
  facts: MultiFact[],
  evidence: DominanceEvidence[],
  today: string,
): void {
  for (const fact of facts) {
    if (fact.introduced) continue;
    const dominators = evidence.filter((e) => e.a >= fact.a && e.b >= fact.b);
    if (dominators.length === 0) continue;
    const box: BoxLevel = dominators.some((d) => d.isFast) ? 3 : 2;
    fact.introduced = true;
    fact.box = box;
    fact.lastSeen = today;
    fact.nextDue = computeNextDue(box, today);
  }
}

// Pass 1 : place chaque fait directement testé à la boîte qui correspond
// à la vitesse de réponse.
//
// Pass 2 : marque comme introduits (boîte 2 ou 3 selon la qualité de la
// dominance) les faits non testés mais dominés par un test correct. Sans
// cette passe, 2×2 et 2×3 (jamais testés) restent introduced=false, l'image
// mystère les cache, et shouldIntroduceNew se bloque dès qu'un fait du
// placement est en boîte 1.
export function seedFromPlacement(
  facts: MultiFact[],
  results: PlacementResult[],
  today: string,
): void {
  if (results.length === 0) return;

  // Pas d'history ajouté ici : le placement est un test de calibrage, pas
  // une intro en cours d'apprentissage. Sans cette précision, les faits
  // testés au placement seraient considérés comme « récemment introduits »
  // par le filtre 48h de sessionComposer et bloqueraient l'intro de leurs
  // voisins (ex : 8×9, 9×9 bloqués dès la 1ʳᵉ séance par tous les faits
  // avec un 8 ou un 9 testés au placement).
  //
  // Seuls les faits correctement résolus sont placés. Un raté (faux ou
  // « Je ne sais pas ») reste introduced=false : le placement diagnostique
  // un plancher, il ne charge pas box 1. Les faits non maîtrisés seront
  // proposés via le curriculum naturel (§3.4bis).
  for (const result of results) {
    if (!result.correct) continue;
    const fact = facts.find((f) => f.a === result.a && f.b === result.b);
    if (!fact) continue;
    const box = boxFromResult(result);
    fact.introduced = true;
    fact.box = box;
    fact.lastSeen = today;
    fact.nextDue = computeNextDue(box, today);
  }

  const evidence: DominanceEvidence[] = results
    .filter((r) => r.correct)
    .map((r) => ({ a: r.a, b: r.b, isFast: r.timeMs < RESPONSE_TIME.FAST }));
  markDominated(facts, evidence, today);
}

// Migration : pour les profils créés avant l'ajout de la 2ᵉ passe de
// seedFromPlacement, infère les faits manquants à partir des faits déjà
// introduits qui ont au moins une bonne réponse en historique.
// Idempotent : un profil sain reste inchangé (pas de candidat à inférer).
export function inferIntroductionsFromKnowns(
  facts: MultiFact[],
  today: string,
): void {
  const evidence: DominanceEvidence[] = facts
    .filter((f) => f.introduced && f.history.some((h) => h.correct))
    .map((f) => ({
      a: f.a,
      b: f.b,
      isFast: f.history.some(
        (h) => h.correct && h.responseTimeMs < RESPONSE_TIME.FAST,
      ),
    }));
  if (evidence.length === 0) return;
  markDominated(facts, evidence, today);
}
