// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  PLACEMENT_FACTS,
  seedFromPlacement,
  type PlacementResult,
} from '../lib/placement';
import { createInitialFacts, getFactKey } from '../lib/facts';
import { createNewProfile, normalizeProfile } from '../lib/storage';
import type { MultiFact } from '../types';

const TODAY = '2026-04-29';

function findFact(facts: MultiFact[], a: number, b: number): MultiFact {
  const f = facts.find((x) => getFactKey(x.a, x.b) === getFactKey(a, b));
  if (!f) throw new Error(`fact ${a}×${b} not found`);
  return f;
}

describe('seedFromPlacement', () => {
  it('laisse les faits intacts si aucun résultat', () => {
    const facts = createInitialFacts();
    seedFromPlacement(facts, [], TODAY);
    for (const f of facts) {
      expect(f.introduced).toBe(false);
      expect(f.box).toBe(1);
    }
  });

  it('place un fait correctement résolu rapidement en boîte 3', () => {
    const facts = createInitialFacts();
    const results: PlacementResult[] = [
      { a: 3, b: 4, correct: true, timeMs: 1500 },
    ];
    seedFromPlacement(facts, results, TODAY);
    const f = findFact(facts, 3, 4);
    expect(f.introduced).toBe(true);
    expect(f.box).toBe(3);
    expect(f.lastSeen).toBe(TODAY);
  });

  it('place un fait correct mais lent (3-5s) en boîte 2', () => {
    const facts = createInitialFacts();
    const results: PlacementResult[] = [
      { a: 6, b: 9, correct: true, timeMs: 4200 },
    ];
    seedFromPlacement(facts, results, TODAY);
    expect(findFact(facts, 6, 9).box).toBe(2);
  });

  it('n\'introduit PAS un fait raté (réponse fausse ou « Je ne sais pas »)', () => {
    const facts = createInitialFacts();
    const results: PlacementResult[] = [
      { a: 7, b: 8, correct: false, timeMs: 6000 },
    ];
    seedFromPlacement(facts, results, TODAY);
    const f = findFact(facts, 7, 8);
    expect(f.introduced).toBe(false);
    expect(f.box).toBe(1);
    expect(f.lastSeen).toBe('');
  });

  it('infère 2×3 en boîte 3 si dominé par un correct rapide (< 3s)', () => {
    const facts = createInitialFacts();
    const results: PlacementResult[] = [
      { a: 3, b: 9, correct: true, timeMs: 2000 },
    ];
    seedFromPlacement(facts, results, TODAY);
    const f = findFact(facts, 2, 3);
    expect(f.introduced).toBe(true);
    expect(f.box).toBe(3);
  });

  it('infère 2×3 en boîte 2 si dominé seulement par des corrects lents (3-5s)', () => {
    const facts = createInitialFacts();
    const results: PlacementResult[] = [
      { a: 3, b: 9, correct: true, timeMs: 4200 },
    ];
    seedFromPlacement(facts, results, TODAY);
    const f = findFact(facts, 2, 3);
    expect(f.introduced).toBe(true);
    expect(f.box).toBe(2);
  });

  it("un seul dominant rapide suffit à hisser le fait dominé en boîte 3", () => {
    const facts = createInitialFacts();
    const results: PlacementResult[] = [
      { a: 3, b: 4, correct: true, timeMs: 4500 }, // lent
      { a: 3, b: 9, correct: true, timeMs: 1500 }, // rapide
    ];
    seedFromPlacement(facts, results, TODAY);
    expect(findFact(facts, 2, 3).box).toBe(3);
  });

  it('n\'infère que dans la table du plus petit nombre, jusqu\'au plus grand', () => {
    const facts = createInitialFacts();
    seedFromPlacement(facts, [{ a: 5, b: 8, correct: true, timeMs: 1500 }], TODAY);
    const introduced = facts.filter((f) => f.introduced).map((f) => getFactKey(f.a, f.b));
    expect(introduced.sort()).toEqual(['2x5', '3x5', '4x5', '5x5', '5x6', '5x7', '5x8']);
  });

  it('n\'infère PAS un fait non dominé (9×9 ne peut être inféré par rien)', () => {
    const facts = createInitialFacts();
    const results: PlacementResult[] = PLACEMENT_FACTS.map(([a, b]) => ({
      a, b, correct: true, timeMs: 1500,
    }));
    seedFromPlacement(facts, results, TODAY);
    expect(findFact(facts, 9, 9).introduced).toBe(false);
    expect(findFact(facts, 8, 9).introduced).toBe(false);
    const stillNotIntroduced = facts.filter((f) => !f.introduced);
    expect(stillNotIntroduced.map((f) => getFactKey(f.a, f.b))).toEqual(['2x9', '5x9', '8x9', '9x9']);
  });

  it("ne marque PAS un fait testé directement et raté, même s'il est dominé par un correct plus dur", () => {
    // L'enfant rate 4×7 directement (« Je ne sais pas ») mais réussit 4×9.
    // Sans cette protection, 4×9 domine 4×7 et le marquerait introduit en
    // boîte 3 → en séance, 4×7 sortirait en bonus review sans intro
    // pédagogique, alors que l'enfant vient de dire qu'il ne le connaît pas.
    const facts = createInitialFacts();
    const results: PlacementResult[] = [
      { a: 4, b: 9, correct: true, timeMs: 1500 },
      { a: 4, b: 7, correct: false, timeMs: 6000 },
    ];
    seedFromPlacement(facts, results, TODAY);
    expect(findFact(facts, 4, 7).introduced).toBe(false);
    // En revanche, les faits dominés non testés directement sont bien
    // inférés à partir de [4,9] (ex : 4×6).
    expect(findFact(facts, 4, 6).introduced).toBe(true);
  });

  it('n\'infère PAS à partir d\'un test raté', () => {
    const facts = createInitialFacts();
    const results: PlacementResult[] = [
      { a: 6, b: 9, correct: false, timeMs: 8000 },
    ];
    seedFromPlacement(facts, results, TODAY);
    expect(findFact(facts, 2, 3).introduced).toBe(false);
  });

  it('un test direct domine un test inféré (priorité au direct)', () => {
    const facts = createInitialFacts();
    const results: PlacementResult[] = [
      { a: 3, b: 4, correct: true, timeMs: 4500 },
      { a: 3, b: 9, correct: true, timeMs: 1500 },
    ];
    seedFromPlacement(facts, results, TODAY);
    // 3×4 testé lent → box 2. Sans la priorité au direct, il aurait été
    // inféré en box 3 par la dominance de 3×9 rapide.
    expect(findFact(facts, 3, 4).box).toBe(2);
  });

  it("un enfant qui ne connaît que 2/3/5 ne place aucun fait raté en box 1", () => {
    const facts = createInitialFacts();
    const knows = (a: number, b: number) =>
      a === 2 || b === 2 || a === 3 || b === 3 || a === 5 || b === 5;
    const results: PlacementResult[] = PLACEMENT_FACTS.map(([a, b]) => ({
      a,
      b,
      correct: knows(a, b),
      timeMs: knows(a, b) ? 2000 : 5000,
    }));
    seedFromPlacement(facts, results, TODAY);

    expect(facts.filter((f) => f.introduced && f.box === 1)).toEqual([]);
    // Réussir 5×8 ne dit rien de la table de 4 : seules les tables vues
    // sont ensemencées (l'ancienne dominance « a' ≥ a ET b' ≥ b » plaçait
    // 4×4, 4×6 et 4×8 en révision dès la 1re séance — avis du 16/11/2026).
    const seeded = facts.filter((f) => f.introduced);
    expect(seeded.filter((f) => !knows(f.a, f.b)).map((f) => getFactKey(f.a, f.b))).toEqual([]);

    // Faits ratés non dominés par un correct : restent à introduire via le
    // curriculum naturel (factStage), pas par le placement.
    const nonDominated = [[7, 7], [7, 9], [8, 8], [6, 9], [4, 9], [6, 6], [6, 8]] as const;
    for (const [a, b] of nonDominated) {
      expect(findFact(facts, a, b).introduced, `${a}×${b}`).toBe(false);
    }
  });

  it('le placement complet d\'un enfant qui aces tout introduit 32 faits sur 36', () => {
    const facts = createInitialFacts();
    const results: PlacementResult[] = PLACEMENT_FACTS.map(([a, b]) => ({
      a, b, correct: true, timeMs: 1500,
    }));
    seedFromPlacement(facts, results, TODAY);
    const introduced = facts.filter((f) => f.introduced);
    expect(introduced).toHaveLength(32);
  });
});

describe('chargement du profil', () => {
  it("n'introduit pas en silence les faits « dominés » par un fait appris en séance", () => {
    // Une migration d'avril 2026 rejouait la dominance à chaque chargement :
    // 5×8 réussi en séance faisait entrer 4×4 à 4×7 sans écran d'introduction.
    const profile = createNewProfile('Sacha');
    const f58 = findFact(profile.facts, 5, 8);
    f58.introduced = true;
    f58.introducedAt = TODAY;
    f58.box = 2;
    f58.history = [{ date: TODAY, correct: true, responseTimeMs: 1500, answeredWith: 40 }];
    normalizeProfile(profile);
    expect(profile.facts.filter((f) => f.introduced)).toEqual([f58]);
  });
});
