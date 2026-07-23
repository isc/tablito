import type { RemainderFact } from '../types';
import { getDivisionFactKey } from './divisionFacts';

/**
 * Clé d'une zone de division avec reste.
 *
 * Comme la division (et contrairement à la multiplication), AUCUNE
 * normalisation : (7,6) → "7r6" (dividendes 42-48 ÷ 7) et (6,7) → "6r7"
 * (dividendes 42-47 ÷ 6) sont deux zones distinctes.
 */
export function getRemainderFactKey(divisor: number, quotient: number): string {
  return `${divisor}r${quotient}`;
}

/**
 * Génère les 64 zones de division avec reste.
 *
 * Pour chaque couple (divisor, quotient) ∈ [2..9]², la zone couvrant les
 * dividendes de divisor×quotient inclus à divisor×(quotient+1) exclu
 * (specs §12.2). Bijection parfaite avec la grille 8×8, comme la division.
 * Chaque zone démarre en boîte 1, non introduite.
 */
export function createInitialRemainderFacts(): RemainderFact[] {
  const facts: RemainderFact[] = [];

  for (let divisor = 2; divisor <= 9; divisor++) {
    for (let quotient = 2; quotient <= 9; quotient++) {
      facts.push({
        divisor,
        quotient,
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
 * Clé du fait de division PARENT (la division exacte de la même case de la
 * grille du niveau 2 : divisor×quotient ÷ divisor) dont la solidité
 * conditionne l'introduction de cette zone (specs §12.3). Les coordonnées
 * coïncident exactement d'une grille à l'autre.
 */
export function parentDivisionKey(fact: RemainderFact): string {
  return getDivisionFactKey(fact.divisor * fact.quotient, fact.divisor);
}

/**
 * Bornes [min, max] des dividendes couverts par une zone (specs §12.2) :
 * de divisor×quotient inclus à divisor×(quotient+1) exclu.
 */
export function remainderZoneBounds(
  fact: Pick<RemainderFact, 'divisor' | 'quotient'>,
): [number, number] {
  const lo = fact.divisor * fact.quotient;
  return [lo, lo + fact.divisor - 1];
}

/**
 * Reste canonique d'une zone, utilisé pour l'ÉCRAN D'INTRODUCTION (et sa
 * question immédiate). Déterministe — les MP3 d'intro sont pré-générés par
 * zone et doivent coller aux nombres affichés. Milieu de la plage 1..d-1 :
 * un reste non nul montre le concept (« ce qui ne rentre pas »), et un
 * exemple central évite les cas dégénérés (reste = 1 partout).
 */
export function introRemainder(divisor: number): number {
  return Math.max(1, Math.floor(divisor / 2));
}

/**
 * Tire le reste d'une présentation de révision : uniforme dans 0..divisor-1.
 * Le cas 0 (probabilité 1/divisor) garde vivante la discrimination « est-ce
 * que ça tombe juste ? » et entretient au passage la division exacte
 * (specs §12.2).
 */
export function drawRemainder(divisor: number): number {
  return Math.floor(Math.random() * divisor);
}
