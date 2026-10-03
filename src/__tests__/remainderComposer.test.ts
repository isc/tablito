// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UserProfile, BoxLevel } from '../types';
import { REMAINDER_FAST_THRESHOLD_MS, remainderDividend } from '../types';
import { createNewProfile } from '../lib/storage';
import {
  createInitialRemainderFacts,
  parentDivisionKey,
  introRemainder,
} from '../lib/remainderFacts';
import { selectRemainderQuestions } from '../lib/remainderComposer';
import { MAX_MAINTENANCE } from '../lib/dailyComposer';
import { processAnswer, isDue, MAX_FRAGILE } from '../lib/leitner';
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

// Sélection du jour, `maintenance` places d'entretien déjà prises.
const select = (p: UserProfile, maintenance = 0) => selectRemainderQuestions(p, NOW, maintenance);

describe('selectRemainderQuestions — gating sur la maîtrise des divisions', () => {
  it("ne propose rien si aucune division n'est maîtrisée", () => {
    const p = createNewProfile('Zoé');
    expect(select(p)).toEqual({ intros: [], due: [] });
  });

  it('rend éligible une zone dès que sa division parente est en boîte 5', () => {
    const p = withMasteredDivisions([[2, 2]]); // parent de la zone (2,2)
    const { intros, due } = select(p);
    expect(due).toEqual([]);
    expect(intros).toHaveLength(1);
    expect(intros[0].isIntroduction).toBe(true);
    expect(intros[0].fact.divisor).toBe(2);
    expect(intros[0].fact.quotient).toBe(2);
  });

  it('rend éligible une zone dès que sa division parente est en boîte 4', () => {
    const p = withMasteredDivisions([[2, 2]], 4);
    expect(select(p).intros).toHaveLength(1);
  });

  it("l'intro utilise le reste canonique de la zone (audio pré-généré)", () => {
    const p = withMasteredDivisions([[7, 6]]);
    const { intros } = select(p);
    expect(intros).toHaveLength(1);
    expect(intros[0].remainder).toBe(introRemainder(7)); // 3 → 45 ÷ 7
    expect(remainderDividend(intros[0])).toBe(45);
  });

  it("n'introduit jamais ensemble deux zones de même diviseur (§12.7)", () => {
    const p = withMasteredDivisions([[2, 2], [2, 3]]);
    expect(select(p).intros).toHaveLength(1);
  });

  it('plafonne à 2 nouvelles zones par séance', () => {
    const p = withMasteredDivisions([[2, 2], [3, 3], [4, 4]]);
    expect(select(p).intros).toHaveLength(2);
  });

  it('toute zone introduite a bien une division parente prête (boîte 4+)', () => {
    const p = withMasteredDivisions([[2, 2], [3, 3]], 4);
    const parentReadyKeys = new Set(
      p.divisionFacts!.filter((f) => f.box >= 4).map((f) => getDivisionFactKey(f.dividend, f.divisor)),
    );
    for (const q of select(p).intros) {
      expect(parentReadyKeys.has(parentDivisionKey(q.fact))).toBe(true);
    }
  });

  it("n'introduit pas de nouvelle zone si la pile fragile dépasse le plafond (pacing)", () => {
    const p = withMasteredDivisions([[2, 2], [3, 3], [4, 4], [5, 5], [6, 6]]);
    p.remainderFacts = p.remainderFacts!.map((f, i) =>
      i <= MAX_FRAGILE ? { ...f, introduced: true, box: 1 as const, nextDue: '2026-12-31' } : f,
    );
    expect(select(p).intros).toHaveLength(0);
  });

  it('le reste tiré reste toujours dans 0..divisor-1 et le dividende dans la zone', () => {
    const p = withMasteredDivisions([[2, 2], [3, 3], [4, 4], [5, 5]]);
    p.remainderFacts = p.remainderFacts!.map((f, i) =>
      i < 8 ? { ...f, introduced: true, box: 2 as const, nextDue: '' } : f,
    );
    for (let run = 0; run < 10; run++) {
      const { intros, due } = select(p);
      for (const q of [...intros, ...due]) {
        expect(q.remainder).toBeGreaterThanOrEqual(0);
        expect(q.remainder).toBeLessThan(q.fact.divisor);
        const dividend = remainderDividend(q);
        expect(dividend).toBeGreaterThanOrEqual(q.fact.divisor * q.fact.quotient);
        expect(dividend).toBeLessThan(q.fact.divisor * (q.fact.quotient + 1));
      }
    }
  });

  // Zones (2,2) et (3,3) à introduire, une zone due par boîte de `boxes`, puis
  // `reserve` zones introduites non dues.
  function withDueZones(boxes: readonly BoxLevel[], reserve = 0): UserProfile {
    const p = withMasteredDivisions([[2, 2], [3, 3]]);
    let due = 0;
    let bonus = 0;
    p.remainderFacts = p.remainderFacts!.map((f) => {
      if (f.divisor === f.quotient && f.divisor <= 3) return f;
      if (due < boxes.length) return { ...f, introduced: true, box: boxes[due++], nextDue: '' };
      if (bonus++ < reserve) return { ...f, introduced: true, box: 2 as const, nextDue: '2026-12-31' };
      return f;
    });
    return p;
  }

  it('renvoie intros et révisions dues des plus fragiles aux plus solides, sans bonus', () => {
    // 2 + 6 < 12 et 8 zones introduites non dues seraient disponibles : le
    // plancher reste l'affaire de composeDailySession.
    const selection = select(withDueZones([5, 3, 1, 5, 3, 5], 8));

    expect(selection.intros).toHaveLength(2);
    expect(selection.due.map((q) => q.fact.box)).toEqual([1, 3, 3, 5, 5, 5]);
  });

  it("le budget de révisions compte les places de l'entretien et garde les plus fragiles", () => {
    const p = withDueZones([5, 5, 3, 1, 3, 5, 1, 3, 5, 1, 3, 5]);
    const boxesOf = (maintenance: number) => select(p, maintenance).due.map((q) => q.fact.box);

    expect(boxesOf(0)).toHaveLength(12);
    // 15 − 2 intros − 6 places d'entretien : 7 révisions, les plus fragiles.
    expect(boxesOf(MAX_MAINTENANCE)).toEqual([1, 1, 1, 3, 3, 3, 3]);
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
