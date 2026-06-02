// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  createInitialDivisionFacts,
  getDivisionFactKey,
  parentMultiplicationKey,
} from '../lib/divisionFacts';

describe('createInitialDivisionFacts', () => {
  const facts = createInitialDivisionFacts();

  it('génère exactement 64 faits', () => {
    expect(facts).toHaveLength(64);
  });

  it('génère 64 clés (dividend/divisor) distinctes — bijection', () => {
    const keys = new Set(facts.map((f) => getDivisionFactKey(f.dividend, f.divisor)));
    expect(keys.size).toBe(64);
  });

  it('respecte dividend = divisor × quotient, avec divisor et quotient ∈ [2..9]', () => {
    for (const f of facts) {
      expect(f.dividend).toBe(f.divisor * f.quotient);
      expect(f.divisor).toBeGreaterThanOrEqual(2);
      expect(f.divisor).toBeLessThanOrEqual(9);
      expect(f.quotient).toBeGreaterThanOrEqual(2);
      expect(f.quotient).toBeLessThanOrEqual(9);
    }
  });

  it('démarre tous les faits en boîte 1, non introduits', () => {
    for (const f of facts) {
      expect(f.box).toBe(1);
      expect(f.introduced).toBe(false);
      expect(f.history).toEqual([]);
    }
  });

  it('contient bien les deux orientations distinctes d\'un même dividende', () => {
    const div56by7 = facts.find((f) => f.dividend === 56 && f.divisor === 7);
    const div56by8 = facts.find((f) => f.dividend === 56 && f.divisor === 8);
    expect(div56by7?.quotient).toBe(8);
    expect(div56by8?.quotient).toBe(7);
  });
});

describe('getDivisionFactKey', () => {
  it('ne normalise PAS (division non commutative)', () => {
    expect(getDivisionFactKey(24, 3)).toBe('24/3');
    expect(getDivisionFactKey(24, 8)).toBe('24/8');
    expect(getDivisionFactKey(24, 3)).not.toBe(getDivisionFactKey(24, 8));
  });
});

describe('parentMultiplicationKey', () => {
  it('mappe les deux orientations vers le même parent canonique', () => {
    const facts = createInitialDivisionFacts();
    const div56by7 = facts.find((f) => f.dividend === 56 && f.divisor === 7)!;
    const div56by8 = facts.find((f) => f.dividend === 56 && f.divisor === 8)!;
    expect(parentMultiplicationKey(div56by7)).toBe('7x8');
    expect(parentMultiplicationKey(div56by8)).toBe('7x8');
  });

  it('normalise min×max (12÷4 et 12÷3 → parents 3x4)', () => {
    const facts = createInitialDivisionFacts();
    const div12by4 = facts.find((f) => f.dividend === 12 && f.divisor === 4)!;
    const div12by3 = facts.find((f) => f.dividend === 12 && f.divisor === 3)!;
    expect(parentMultiplicationKey(div12by4)).toBe('3x4');
    expect(parentMultiplicationKey(div12by3)).toBe('3x4');
  });
});
