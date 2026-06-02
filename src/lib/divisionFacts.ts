import type { DivisionFact } from '../types';
import { getFactKey } from './facts';

/**
 * Clé d'un fait de division.
 *
 * La division n'étant PAS commutative, AUCUNE normalisation (contrairement à
 * getFactKey) : le couple (dividend, divisor) est unique pour chacun des 64
 * faits. 56÷7 → "56/7" et 56÷8 → "56/8" sont deux clés distinctes.
 */
export function getDivisionFactKey(dividend: number, divisor: number): string {
  return `${dividend}/${divisor}`;
}

/**
 * Génère les 64 faits de division.
 *
 * Pour chaque couple (a, b) ∈ [2..9]², le fait « (a×b) ÷ a = b ».
 * Bijection parfaite : 64 couples ↔ 64 faits, un par case de la grille 8×8
 * (specs §11.2 / §11.5). Chaque fait démarre en boîte 1, non introduit.
 */
export function createInitialDivisionFacts(): DivisionFact[] {
  const facts: DivisionFact[] = [];

  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      facts.push({
        dividend: a * b,
        divisor: a,
        quotient: b,
        box: 1,
        lastSeen: '',
        nextDue: '',
        history: [],
        introduced: false,
      });
    }
  }

  return facts;
}

/**
 * Clé du fait multiplicatif PARENT dont la maîtrise (boîte 5) conditionne
 * l'introduction de ce fait de division (specs §11.3). Canonique (min×max),
 * car 56÷7 et 56÷8 partagent le même parent 7×8.
 */
export function parentMultiplicationKey(fact: DivisionFact): string {
  return getFactKey(fact.divisor, fact.quotient);
}
