import type { MultiFact } from '../types';

/**
 * Returns the decade of a number (e.g., 42 -> 4, 8 -> 0).
 */
function decade(n: number): number {
  return Math.floor(n / 10);
}

/**
 * Returns the set of digits in a number (e.g., 48 -> {4, 8}).
 */
function digits(n: number): Set<number> {
  const s = new Set<number>();
  const str = String(n);
  for (const ch of str) {
    s.add(Number(ch));
  }
  return s;
}

/**
 * Checks whether two sets share at least one element.
 */
function setsIntersect(a: Set<number>, b: Set<number>): boolean {
  for (const v of a) {
    if (b.has(v)) return true;
  }
  return false;
}

/**
 * Computes the similarity between two multiplication facts.
 *
 * - Strong: shared operand (any of a or b from factA matches any of a or b from factB)
 * - Medium: results are in the same decade, or share a digit in the result
 * - None: otherwise
 */
export function computeSimilarity(
  factA: MultiFact,
  factB: MultiFact,
): 'strong' | 'medium' | 'none' {
  // Build the set of operands for each fact
  const opsA = new Set([factA.a, factA.b]);
  const opsB = new Set([factB.a, factB.b]);

  // Strong: shared operand
  if (setsIntersect(opsA, opsB)) {
    return 'strong';
  }

  // Medium: same decade for results
  if (decade(factA.product) === decade(factB.product)) {
    return 'medium';
  }

  // Medium: shared digit in result
  const digitsA = digits(factA.product);
  const digitsB = digits(factB.product);
  if (setsIntersect(digitsA, digitsB)) {
    return 'medium';
  }

  return 'none';
}
