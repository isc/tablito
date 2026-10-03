import type { BoxLevel, UserProfile } from '../../types';
import { getDivisionFactKey } from '../../lib/divisionFacts';

// Divisions introduites à la carte, pour les tests de composition. Partagé par
// divisionComposer.test.ts et dailyComposer.test.ts : la règle du dividende
// (§11.6) dicte où les placer, et deux copies se corrigeaient à la main. Sous
// `helpers/` et sans suffixe `.test`, donc jamais collecté par vitest.

/**
 * Introduit une division par dividende, une par état (boîte, échéance), des
 * plus grands dividendes aux plus petits : sans deux faits de même dividende,
 * ni fait au dividende des intros du jour (4÷2 et 6÷3, en tête de l'ordre
 * canonique), la règle du dividende ne joue pas.
 */
export function withOneDivisionPerDividend(
  p: UserProfile,
  states: { box: BoxLevel; nextDue: string }[],
): UserProfile {
  const seen = new Set<number>();
  p.divisionFacts = p.divisionFacts!.toSorted((a, b) => b.dividend - a.dividend).map((f) => {
    if (seen.size >= states.length || seen.has(f.dividend)) return f;
    const state = states[seen.size];
    seen.add(f.dividend);
    return { ...f, ...state, introduced: true, lastSeen: '2026-01-01' };
  });
  return p;
}

/** Introduit les divisions `keys` (« 56/7 »…), en boîte 3 et dues. */
export function withDueDivisions(p: UserProfile, keys: string[]): UserProfile {
  const due = new Set(keys);
  p.divisionFacts = p.divisionFacts!.map((f) =>
    due.has(getDivisionFactKey(f.dividend, f.divisor))
      ? { ...f, introduced: true, box: 3 as const, lastSeen: '2026-01-01', nextDue: '' }
      : f,
  );
  return p;
}
