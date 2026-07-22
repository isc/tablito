// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { UserProfile } from '../types';
import { DIVISION_FAST_THRESHOLD_MS } from '../types';
import { createNewProfile } from '../lib/storage';
import { createInitialDivisionFacts, parentMultiplicationKey } from '../lib/divisionFacts';
import { composeDivisionSession } from '../lib/divisionComposer';
import { processAnswer, isDue } from '../lib/leitner';
import { getFactKey } from '../lib/facts';

// Marque les paires multiplicatives données comme prêtes (boîte 4+, boîte 5 par
// défaut). Le gate d'intro division est aligné sur boîte ≥ 4 (isDivisionUnlocked).
function withMastered(masteredPairs: [number, number][], box: 4 | 5 = 5): UserProfile {
  const p = createNewProfile('Zoé');
  const keys = new Set(masteredPairs.map(([a, b]) => getFactKey(a, b)));
  p.facts = p.facts.map((f) =>
    keys.has(getFactKey(f.a, f.b)) ? { ...f, box, introduced: true } : f,
  );
  return p;
}

const NOW = '2026-06-02';

describe('composeDivisionSession — gating sur la maîtrise multiplicative', () => {
  it('ne propose rien si aucune table multiplicative n\'est maîtrisée', () => {
    const p = createNewProfile('Zoé');
    expect(composeDivisionSession(p, NOW)).toEqual([]);
  });

  it('rend éligible un fait de division dès que son parent est en boîte 5', () => {
    const p = withMastered([[2, 2]]); // parent de 4÷2=2
    const session = composeDivisionSession(p, NOW);
    expect(session).toHaveLength(1);
    expect(session[0].isIntroduction).toBe(true);
    expect(session[0].fact.dividend).toBe(4);
    expect(session[0].fact.divisor).toBe(2);
  });

  it('rend éligible un fait de division dès que son parent est en boîte 4', () => {
    // Aligné sur l'ouverture du niveau (badges Table = boîte 4+) : un parent
    // en boîte 4, pas encore en boîte 5, débloque déjà sa division.
    const p = withMastered([[2, 2]], 4); // parent de 4÷2=2, en boîte 4
    const session = composeDivisionSession(p, NOW);
    expect(session).toHaveLength(1);
    expect(session[0].isIntroduction).toBe(true);
    expect(session[0].fact.dividend).toBe(4);
  });

  it('n\'introduit jamais ensemble les deux orientations d\'un même dividende (§11.6)', () => {
    // Seul 7×8 maîtrisé → 56÷7 et 56÷8 éligibles, mais même dividende.
    const p = withMastered([[7, 8]]);
    const session = composeDivisionSession(p, NOW);
    expect(session).toHaveLength(1); // un seul des deux, l'autre est en conflit
    expect(session[0].fact.dividend).toBe(56);
  });

  it('plafonne à 2 nouveaux faits par séance', () => {
    // 3 parents carrés maîtrisés → 3 faits éligibles, dividendes distincts.
    const p = withMastered([[2, 2], [3, 3], [4, 4]]);
    const session = composeDivisionSession(p, NOW);
    const intros = session.filter((q) => q.isIntroduction);
    expect(intros.length).toBe(2);
  });

  it('tout fait introduit a bien un parent multiplicatif prêt (boîte 4+)', () => {
    const p = withMastered([[2, 2], [3, 3]], 4);
    const session = composeDivisionSession(p, NOW);
    const parentReadyKeys = new Set(
      p.facts.filter((f) => f.box >= 4).map((f) => getFactKey(f.a, f.b)),
    );
    for (const q of session) {
      expect(parentReadyKeys.has(parentMultiplicationKey(q.fact))).toBe(true);
    }
  });

  it('n\'introduit pas de nouveau fait si un fait introduit est en boîte 1 (pacing §11.6)', () => {
    const p = withMastered([[2, 2], [3, 3], [4, 4], [5, 5], [6, 6]]);
    // Un fait de division introduit mais retombé en boîte 1 → pas de nouvelle
    // intro tant qu'il n'est pas remonté (même règle que la multiplication).
    p.divisionFacts = p.divisionFacts!.map((f, i) =>
      i === 0 ? { ...f, introduced: true, box: 1 as const, nextDue: '2026-12-31' } : f,
    );
    const session = composeDivisionSession(p, NOW);
    expect(session.filter((q) => q.isIntroduction)).toHaveLength(0);
  });

  it('reprend les intros une fois les faits introduits en boîte ≥ 2', () => {
    const p = withMastered([[2, 2], [3, 3], [4, 4], [5, 5], [6, 6]]);
    p.divisionFacts = p.divisionFacts!.map((f, i) =>
      i === 0 ? { ...f, introduced: true, box: 2 as const, nextDue: '2026-12-31' } : f,
    );
    const session = composeDivisionSession(p, NOW);
    expect(session.filter((q) => q.isIntroduction).length).toBeGreaterThan(0);
  });

  it('inclut les faits de division déjà introduits et dus en révision', () => {
    const p = withMastered([[2, 2], [3, 3], [4, 4], [5, 5]]);
    // Introduit + dû (nextDue vide = dû) quelques faits de division.
    p.divisionFacts = p.divisionFacts!.map((f, i) =>
      i < 5 ? { ...f, introduced: true, box: 2 as const, nextDue: '' } : f,
    );
    const session = composeDivisionSession(p, NOW);
    const reviews = session.filter((q) => !q.isIntroduction);
    expect(reviews.length).toBeGreaterThan(0);
  });

  it('chaque question respecte dividend = divisor × quotient (pas de flip)', () => {
    const p = withMastered([[2, 2], [3, 3], [4, 4]]);
    const session = composeDivisionSession(p, NOW);
    for (const q of session) {
      expect(q.fact.dividend).toBe(q.fact.divisor * q.fact.quotient);
    }
  });
});

describe('Leitner réutilisé pour la division (specs §11.6)', () => {
  it('processAnswer fait monter de boîte et préserve la forme DivisionFact', () => {
    const fact = createInitialDivisionFacts()[0]; // 4÷2=2, boîte 1
    const after = processAnswer(fact, true, 1000, NOW, 'keypad');
    expect(after.box).toBe(2);
    expect(after.dividend).toBe(fact.dividend);
    expect(after.divisor).toBe(fact.divisor);
    expect(after.quotient).toBe(fact.quotient);
    expect(after.history).toHaveLength(1);
  });

  it('processAnswer renvoie en boîte 1 sur erreur', () => {
    const fact = { ...createInitialDivisionFacts()[0], box: 4 as const };
    const after = processAnswer(fact, false, 1000, NOW, 'keypad');
    expect(after.box).toBe(1);
  });

  it('isDue fonctionne sur un DivisionFact', () => {
    const fact = createInitialDivisionFacts()[0]; // nextDue '' → dû
    expect(isDue(fact, NOW)).toBe(true);
    expect(isDue({ ...fact, nextDue: '2026-12-31' }, NOW)).toBe(false);
  });

  it('seuil de vitesse division plus généreux (§11.6) : 5,5 s au clavier fait monter de boîte', () => {
    const fact = createInitialDivisionFacts()[0]; // boîte 1
    // 5500 ms : trop lent pour la multiplication (seuil 5000), mais sous le
    // seuil division (6000) → la boîte doit monter.
    const mult = processAnswer(fact, true, 5500, NOW, 'keypad');
    expect(mult.box).toBe(1); // seuil multiplication par défaut → pas de montée
    const div = processAnswer(fact, true, 5500, NOW, 'keypad', DIVISION_FAST_THRESHOLD_MS.keypad);
    expect(div.box).toBe(2); // seuil division → montée
  });
});
