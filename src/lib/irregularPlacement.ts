import type { BoxLevel, IrrFact } from '../types';
import { irrFastThresholdMs } from '../types';
import { computeNextDue } from './leitner';
import { irrExpectedLetters, irrVerbDefs, requireIrrVerbDef } from './irregularVerbs';

// === Placement des verbes irréguliers (specs §16.8) ===
//
// Quelques sondes sur les verbes les plus fréquents — ceux que la classe a le
// plus de chances d'avoir déjà vus —, « Je ne sais pas » toujours à portée,
// arrêt après 3 échecs consécutifs. Mais PAS d'inférence par dominance : chaque
// irrégulier est une forme stockée, savoir « went » ne dit rien de « took ».
// Seuls les verbes réussis sont ensemencés.

/** Nombre de sondes : les verbes les plus fréquents de l'inventaire. */
export const IRR_PLACEMENT_PROBE_COUNT = 10;

export const IRR_MAX_CONSECUTIVE_FAILURES = 3;

export function irrPlacementProbes(): string[] {
  return irrVerbDefs()
    .slice(0, IRR_PLACEMENT_PROBE_COUNT)
    .map((def) => def.key);
}

export interface IrrPlacementResult {
  key: string;
  /** « Je ne sais pas » est un échec sans réponse : correct = false. */
  correct: boolean;
  timeMs: number;
  /** Surface qui a produit la réponse : le seuil n'est pas le même. */
  inputMode: 'keypad' | 'voice';
}

function boxFromResult(result: IrrPlacementResult): BoxLevel {
  const fast = irrFastThresholdMs(irrExpectedLetters(requireIrrVerbDef(result.key)), result.inputMode);
  if (result.timeMs < fast) return 3;
  if (result.timeMs < fast * 2) return 2;
  return 1;
}

/**
 * Ensemence les boîtes à partir des sondes réussies, à la boîte que dit leur
 * vitesse (cf. seedConjFromPlacement). Un raté n'est pas placé : le placement
 * diagnostique un plancher, il ne charge pas la boîte 1. Aucun `history`
 * ajouté : c'est un calibrage, pas une révision.
 */
export function seedIrrFromPlacement(
  facts: IrrFact[],
  results: IrrPlacementResult[],
  today: string,
): void {
  const byKey = new Map(facts.map((f) => [f.key, f]));
  for (const result of results) {
    if (!result.correct) continue;
    const fact = byKey.get(result.key);
    if (!fact) continue;
    const box = boxFromResult(result);
    fact.introduced = true;
    fact.box = box;
    fact.lastSeen = today;
    fact.nextDue = computeNextDue(box, today);
  }
}
