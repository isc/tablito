import type { UserProfile, BoxLevel, Attempt } from '../types';
import { getFactKey } from './facts';
import { getDivisionFactKey } from './divisionFacts';

// Fait « difficile » unifié × / ÷, pour l'espace parent. Le discriminant `kind`
// porte les champs propres à l'opération (le diviseur/quotient en division).
export type HardFact =
  | { kind: 'mult'; key: string; box: BoxLevel; errorCount: number; a: number; b: number; product: number }
  | { kind: 'div'; key: string; box: BoxLevel; errorCount: number; dividend: number; divisor: number; quotient: number };

function countErrors(history: Attempt[], cutoff: string | null): number {
  return history.filter((h) => !h.correct && (cutoff === null || h.date >= cutoff)).length;
}

/**
 * Liste UNIFIÉE des faits (× et ÷) sur lesquels l'enfant a le plus buté
 * récemment. Fenêtre = les `windowSize` dernières séances : sinon un fait
 * galéré il y a longtemps mais désormais maîtrisé resterait en tête (la boîte
 * reflète l'état courant, pas le cumul d'erreurs). Trié par erreurs
 * décroissantes puis boîte croissante, tronqué à `limit`, sans les faits à 0
 * erreur. Les deux opérations sont mélangées : le parent voit où l'enfant bute
 * en ce moment, toutes opérations confondues.
 */
export function getHardestFacts(
  profile: UserProfile,
  windowSize: number,
  limit: number,
): HardFact[] {
  const sessions = profile.sessionHistory;
  const cutoff =
    sessions.length > windowSize ? sessions[sessions.length - windowSize].date : null;

  const mult: HardFact[] = profile.facts
    .filter((f) => f.introduced)
    .map((f) => ({
      kind: 'mult',
      key: getFactKey(f.a, f.b),
      box: f.box,
      errorCount: countErrors(f.history, cutoff),
      a: f.a,
      b: f.b,
      product: f.product,
    }));

  const div: HardFact[] = (profile.divisionFacts ?? [])
    .filter((f) => f.introduced)
    .map((f) => ({
      kind: 'div',
      key: getDivisionFactKey(f.dividend, f.divisor),
      box: f.box,
      errorCount: countErrors(f.history, cutoff),
      dividend: f.dividend,
      divisor: f.divisor,
      quotient: f.quotient,
    }));

  return [...mult, ...div]
    .sort((a, b) => b.errorCount - a.errorCount || a.box - b.box)
    .slice(0, limit)
    .filter((f) => f.errorCount > 0);
}
