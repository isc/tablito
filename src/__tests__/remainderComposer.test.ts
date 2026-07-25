// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UserProfile } from '../types';
import { REMAINDER_FAST_THRESHOLD_MS, remainderDividend } from '../types';
import { createNewProfile } from '../lib/storage';
import {
  createInitialRemainderFacts,
  parentDivisionKey,
  introRemainder,
} from '../lib/remainderFacts';
import { composeRemainderSession } from '../lib/remainderComposer';
import { processAnswer, isDue } from '../lib/leitner';
import { getDivisionFactKey } from '../lib/divisionFacts';

// Marque les divisions exactes données comme prêtes (boîte 4+, boîte 5 par
// défaut). Le gate d'intro niveau 3 est aligné sur boîte ≥ 4
// (isRemainderUnlocked = badges « Divisions par N » = boîte 4+).
function withMasteredDivisions(pairs: [number, number][], box: 4 | 5 = 5): UserProfile {
  const p = createNewProfile('Zoé');
  const keys = new Set(pairs.map(([divisor, quotient]) => getDivisionFactKey(divisor * quotient, divisor)));
  p.divisionFacts = p.divisionFacts!.map((f) =>
    keys.has(getDivisionFactKey(f.dividend, f.divisor)) ? { ...f, box, introduced: true } : f,
  );
  return p;
}

const NOW = '2026-07-23';

describe('composeRemainderSession — gating sur la maîtrise des divisions', () => {
  it("ne propose rien si aucune division n'est maîtrisée", () => {
    const p = createNewProfile('Zoé');
    expect(composeRemainderSession(p, NOW)).toEqual([]);
  });

  it('rend éligible une zone dès que sa division parente est en boîte 5', () => {
    const p = withMasteredDivisions([[2, 2]]); // parent de la zone (2,2)
    const session = composeRemainderSession(p, NOW);
    expect(session).toHaveLength(1);
    expect(session[0].isIntroduction).toBe(true);
    expect(session[0].fact.divisor).toBe(2);
    expect(session[0].fact.quotient).toBe(2);
  });

  it('rend éligible une zone dès que sa division parente est en boîte 4', () => {
    const p = withMasteredDivisions([[2, 2]], 4);
    const session = composeRemainderSession(p, NOW);
    expect(session).toHaveLength(1);
    expect(session[0].isIntroduction).toBe(true);
  });

  it("l'intro utilise le reste canonique de la zone (audio pré-généré)", () => {
    const p = withMasteredDivisions([[7, 6]]);
    const session = composeRemainderSession(p, NOW);
    expect(session).toHaveLength(1);
    expect(session[0].remainder).toBe(introRemainder(7)); // 3 → 45 ÷ 7
    expect(remainderDividend(session[0])).toBe(45);
  });

  it("n'introduit jamais ensemble deux zones de même diviseur (§12.7)", () => {
    const p = withMasteredDivisions([[2, 2], [2, 3]]);
    const session = composeRemainderSession(p, NOW);
    const intros = session.filter((q) => q.isIntroduction);
    expect(intros).toHaveLength(1);
  });

  it('plafonne à 2 nouvelles zones par séance', () => {
    const p = withMasteredDivisions([[2, 2], [3, 3], [4, 4]]);
    const session = composeRemainderSession(p, NOW);
    expect(session.filter((q) => q.isIntroduction)).toHaveLength(2);
  });

  it('toute zone introduite a bien une division parente prête (boîte 4+)', () => {
    const p = withMasteredDivisions([[2, 2], [3, 3]], 4);
    const session = composeRemainderSession(p, NOW);
    const parentReadyKeys = new Set(
      p.divisionFacts!.filter((f) => f.box >= 4).map((f) => getDivisionFactKey(f.dividend, f.divisor)),
    );
    for (const q of session) {
      expect(parentReadyKeys.has(parentDivisionKey(q.fact))).toBe(true);
    }
  });

  it("n'introduit pas de nouvelle zone si une zone introduite est en boîte 1 (pacing)", () => {
    const p = withMasteredDivisions([[2, 2], [3, 3], [4, 4], [5, 5], [6, 6]]);
    p.remainderFacts = p.remainderFacts!.map((f, i) =>
      i === 0 ? { ...f, introduced: true, box: 1 as const, nextDue: '2026-12-31' } : f,
    );
    const session = composeRemainderSession(p, NOW);
    expect(session.filter((q) => q.isIntroduction)).toHaveLength(0);
  });

  it('le reste tiré reste toujours dans 0..divisor-1 et le dividende dans la zone', () => {
    const p = withMasteredDivisions([[2, 2], [3, 3], [4, 4], [5, 5]]);
    p.remainderFacts = p.remainderFacts!.map((f, i) =>
      i < 8 ? { ...f, introduced: true, box: 2 as const, nextDue: '' } : f,
    );
    for (let run = 0; run < 10; run++) {
      const session = composeRemainderSession(p, NOW);
      for (const q of session) {
        expect(q.remainder).toBeGreaterThanOrEqual(0);
        expect(q.remainder).toBeLessThan(q.fact.divisor);
        const dividend = remainderDividend(q);
        expect(dividend).toBeGreaterThanOrEqual(q.fact.divisor * q.fact.quotient);
        expect(dividend).toBeLessThan(q.fact.divisor * (q.fact.quotient + 1));
      }
    }
  });

  it('complète une séance courte avec des révisions bonus de zones introduites', () => {
    const p = withMasteredDivisions([[2, 2]]);
    // Beaucoup de zones introduites mais non dues → réserve de bonus.
    p.remainderFacts = p.remainderFacts!.map((f) =>
      f.divisor <= 5 ? { ...f, introduced: true, box: 3 as const, nextDue: '2026-12-31' } : f,
    );
    const session = composeRemainderSession(p, NOW);
    expect(session.length).toBeGreaterThanOrEqual(12);
    expect(session.some((q) => q.isBonusReview)).toBe(true);
  });
});

describe('Leitner réutilisé pour le niveau 3 (specs §12.7)', () => {
  it('processAnswer préserve la forme RemainderFact et fait monter de boîte', () => {
    const fact = createInitialRemainderFacts()[0]; // zone (2,2), boîte 1
    const after = processAnswer(fact, true, 1000, NOW, 'keypad');
    expect(after.box).toBe(2);
    expect(after.divisor).toBe(fact.divisor);
    expect(after.quotient).toBe(fact.quotient);
    expect(after.history).toHaveLength(1);
  });

  it('isDue fonctionne sur un RemainderFact', () => {
    const fact = createInitialRemainderFacts()[0];
    expect(isDue(fact, NOW)).toBe(true);
    expect(isDue({ ...fact, nextDue: '2026-12-31' }, NOW)).toBe(false);
  });

  it('seuil de vitesse niveau 3 encore plus généreux : 7 s au clavier fait monter de boîte', () => {
    const fact = createInitialRemainderFacts()[0];
    // 7000 ms : trop lent pour la division (seuil 6000), mais sous le seuil
    // niveau 3 (8000) → la boîte doit monter.
    const asDiv = processAnswer(fact, true, 7000, NOW, 'keypad', 6000);
    expect(asDiv.box).toBe(1);
    const asRem = processAnswer(fact, true, 7000, NOW, 'keypad', REMAINDER_FAST_THRESHOLD_MS.keypad);
    expect(asRem.box).toBe(2);
  });
});
