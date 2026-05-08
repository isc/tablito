// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { composeSession } from '../lib/sessionComposer';
import { createInitialFacts, getFactKey } from '../lib/facts';
import { computeNextDue, addDays } from '../lib/leitner';
import {
  PLACEMENT_FACTS,
  seedFromPlacement,
  type PlacementResult,
} from '../lib/placement';
import { createNewProfile } from '../lib/storage';
import type { MultiFact, UserProfile, BoxLevel } from '../types';

const TODAY = '2026-05-01';

function profileWith(facts: MultiFact[]): UserProfile {
  return { ...createNewProfile('Zoé'), facts };
}

// Simule un test de placement « très bien réussi » (tous corrects rapides)
// — équivalent du scénario adulte qui ace les 15 questions en 1.5s chacune.
function acePlacement(facts: MultiFact[], today: string): void {
  const results: PlacementResult[] = PLACEMENT_FACTS.map(([a, b]) => ({
    a, b, correct: true, timeMs: 1500,
  }));
  seedFromPlacement(facts, results, today);
}

function introduce(
  facts: MultiFact[],
  a: number,
  b: number,
  box: BoxLevel,
  introDate: string,
  lastSeen: string,
): void {
  const fact = facts.find((f) => getFactKey(f.a, f.b) === getFactKey(a, b))!;
  fact.introduced = true;
  fact.box = box;
  fact.lastSeen = lastSeen;
  fact.nextDue = computeNextDue(box, lastSeen);
  fact.history = [
    { date: introDate, correct: true, responseTimeMs: 2000, answeredWith: null },
  ];
}

describe('composeSession — introduction des derniers faits', () => {
  it('introduit 8×9 ou 9×9 même si la table de 9 est en révision active hier', () => {
    // Setup : 34 faits introduits il y a longtemps, en boîte 5 (peu dus pour
    // laisser de la place à une intro), dont les faits avec un 9 ont été
    // revus hier (lastSeen = hier). Avant le fix, la similarité forte avec
    // un fait vu < 48h bloquait l'intro de 8×9 et 9×9 indéfiniment.
    const facts = createInitialFacts();
    const yesterday = addDays(TODAY, -1);
    const longAgo = addDays(TODAY, -30);

    for (const f of facts) {
      if (
        getFactKey(f.a, f.b) === getFactKey(8, 9) ||
        getFactKey(f.a, f.b) === getFactKey(9, 9)
      ) {
        continue;
      }
      // Tous en boîte 5 et vus hier → pas dus aujourd'hui (place pour intro).
      // Introduits il y a 30 jours, donc hors de la fenêtre « 48h depuis intro ».
      introduce(facts, f.a, f.b, 5, longAgo, yesterday);
    }

    const session = composeSession(profileWith(facts), TODAY);
    const introduced = session.filter((q) => q.isIntroduction).map((q) =>
      getFactKey(q.fact.a, q.fact.b),
    );
    const candidates = [getFactKey(8, 9), getFactKey(9, 9)];
    expect(introduced.some((k) => candidates.includes(k))).toBe(true);
  });

  it("introduit 8×9 ou 9×9 dès la 1ʳᵉ séance le jour du placement", () => {
    // Cas réel : un enfant fait le test de placement « très bien réussi »
    // puis sa 1ʳᵉ séance le même jour. Avant le fix, les faits testés au
    // placement avaient un history avec date=today, donc tous les voisins
    // avec un 8 ou un 9 étaient « récemment introduits » et bloquaient
    // l'intro de 8×9 et 9×9.
    const facts = createInitialFacts();
    acePlacement(facts, TODAY);

    const session = composeSession(profileWith(facts), TODAY);
    const introducedKeys = session
      .filter((q) => q.isIntroduction)
      .map((q) => getFactKey(q.fact.a, q.fact.b));
    const candidates = [getFactKey(8, 9), getFactKey(9, 9)];
    expect(introducedKeys.some((k) => candidates.includes(k))).toBe(true);
  });

  it("introduit 8×9 / 9×9 même si ≥ MAX_QUESTIONS faits sont dus (mode tail)", () => {
    // Cas réel observé sur un profil après ~13 séances : 33 faits introduits
    // en B2/B3 avec lastSeen récent, 15+ faits dus chaque jour. La règle
    // protectrice « max 2 intros par séance, comptées dans le budget de 15 »
    // partageait les slots avec les révisions, qui gagnaient toujours →
    // 8×9 et 9×9 bloqués indéfiniment malgré le mode tail de shouldIntroduceNew.
    const facts = createInitialFacts();
    const longAgo = addDays(TODAY, -30);
    const yesterday = addDays(TODAY, -1);

    for (const f of facts) {
      if (
        getFactKey(f.a, f.b) === getFactKey(8, 9) ||
        getFactKey(f.a, f.b) === getFactKey(9, 9)
      ) {
        continue;
      }
      // Tous en B2 vus hier → tous dus aujourd'hui (33 faits dus, > MAX_QUESTIONS).
      // Introduits il y a 30j, donc hors fenêtre 48h.
      introduce(facts, f.a, f.b, 2, longAgo, yesterday);
    }

    const session = composeSession(profileWith(facts), TODAY);
    const introducedKeys = session
      .filter((q) => q.isIntroduction)
      .map((q) => getFactKey(q.fact.a, q.fact.b));
    const candidates = [getFactKey(8, 9), getFactKey(9, 9)];
    expect(introducedKeys.some((k) => candidates.includes(k))).toBe(true);
  });

  it("n'introduit pas un fait similaire à un fait introduit dans les 48h", () => {
    // Garde-fou pour la spec : 8×9 introduit hier → 9×9 ne doit pas être
    // introduit aujourd'hui (similarité forte, opérande 9 partagé).
    const facts = createInitialFacts();
    const yesterday = addDays(TODAY, -1);
    const longAgo = addDays(TODAY, -30);

    for (const f of facts) {
      if (getFactKey(f.a, f.b) === getFactKey(9, 9)) continue;
      const isRecentIntro = getFactKey(f.a, f.b) === getFactKey(8, 9);
      introduce(
        facts,
        f.a,
        f.b,
        2,
        isRecentIntro ? yesterday : longAgo,
        isRecentIntro ? yesterday : longAgo,
      );
    }

    const session = composeSession(profileWith(facts), TODAY);
    const introducedKeys = session
      .filter((q) => q.isIntroduction)
      .map((q) => getFactKey(q.fact.a, q.fact.b));
    expect(introducedKeys).not.toContain(getFactKey(9, 9));
  });
});

describe('composeSession — bonus reviews', () => {
  // Math.random seedé : générateur LCG simple, déterministe et reproductible.
  // composeSession utilise random() pour l'ordre d'affichage, le shuffle des
  // bonus, et l'index de départ d'interleave.
  let seed = 0;
  beforeEach(() => {
    seed = 1;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (seed * 1664525 + 1013904223) % 0x100000000;
      return seed / 0x100000000;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("n'enchaîne pas plusieurs questions de la même table en 1ʳᵉ séance post-placement", () => {
    // Le jour du placement, aucun fait n'est dû (nextDue = J+3) et 8×9/9×9
    // sont les seuls candidats à intro mais peuvent être bloqués par les
    // contraintes. La séance se remplit alors de bonus reviews. Sans
    // interleave, l'ordre de tri (box, nextDue, key) enchaîne toute la
    // table de 2 puis le début de la table de 3.
    const facts = createInitialFacts();
    acePlacement(facts, TODAY);

    const session = composeSession(profileWith(facts), TODAY);
    const bonus = session.filter((q) => q.isBonusReview);
    expect(bonus.length).toBeGreaterThan(2);

    // Sans shuffle ni interleave, on enchaînerait 8 questions de la table
    // de 2 d'affilée (l'ordre de createInitialFacts). Avec shuffle des
    // égaux + interleave best-effort, on doit rester ≤ 2.
    let maxRun = 1;
    let run = 1;
    for (let i = 1; i < bonus.length; i++) {
      const sameTable =
        Math.min(bonus[i - 1].displayA, bonus[i - 1].displayB) ===
        Math.min(bonus[i].displayA, bonus[i].displayB);
      run = sameTable ? run + 1 : 1;
      if (run > maxRun) maxRun = run;
    }
    expect(maxRun).toBeLessThanOrEqual(2);
  });
});
