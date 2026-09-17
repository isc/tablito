import type { DivisionFact, MultiFact, SessionItem } from '../../types';

// Items de séance de maths prêts à poser, pour les tests d'écran — pendant de
// `helpers/conjItems.ts`. Faits introduits, boîte 3, sans historique.

export function multItem(a: number, b: number): SessionItem {
  const fact: MultiFact = {
    a, b, product: a * b, box: 3, lastSeen: '', nextDue: '', history: [], introduced: true,
  };
  return { kind: 'mult', fact, displayA: a, displayB: b, isIntroduction: false, isRetry: false, isBonusReview: false };
}

export function divItem(dividend: number, divisor: number): SessionItem {
  const fact: DivisionFact = {
    dividend, divisor, quotient: dividend / divisor, box: 3, lastSeen: '', nextDue: '', history: [], introduced: true,
  };
  return { kind: 'div', fact, isIntroduction: false, isRetry: false, isBonusReview: false };
}
