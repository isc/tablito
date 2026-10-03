// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { composeSession } from '../lib/sessionComposer';
import { createInitialFacts, getFactKey } from '../lib/facts';
import { computeNextDue, addDays, processAnswer } from '../lib/leitner';
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
  fact.introducedAt = introDate; // date d'intro réelle → pilote la fenêtre 48h
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

  it('introduit la queue (7×9/8×9/9×9) en quelques séances même si l\'enfant rate la table de 9 (régression feedback Gwennaelle)', () => {
    // Profil réel reconstruit : 33 faits introduits par DOMINANCE au placement
    // (donc SANS introducedAt), en boîte 2 et dus chaque jour ; 7×9/8×9/9×9
    // jamais introduits (indominables). Avant le fix, deux verrous se cumulaient
    // pour bloquer la queue à vie : (a) la table de 9 en révision active passait
    // pour « introduite récemment » (history[0].date) et bloquait l'intro des
    // faits similaires ; (b) la gate (seuil 2) refusait l'intro avec 3 restants.
    const tail = [getFactKey(7, 9), getFactKey(8, 9), getFactKey(9, 9)];
    const facts = createInitialFacts();
    const yesterday = addDays(TODAY, -1);
    for (const f of facts) {
      if (tail.includes(getFactKey(f.a, f.b))) continue;
      f.introduced = true; // dominance placement : volontairement PAS d'introducedAt
      f.box = 2;
      f.lastSeen = yesterday;
      f.nextDue = computeNextDue(2, yesterday); // dus aujourd'hui
    }
    const profile = profileWith(facts);

    // Rejoue 10 séances ; l'enfant rate systématiquement les faits ×9 (donc
    // ils restent en boîte 1, révisés en permanence — le pire cas).
    let day = TODAY;
    for (let s = 0; s < 10; s++) {
      for (const q of composeSession(profile, day)) {
        const f = profile.facts.find((x) => x.a === q.fact.a && x.b === q.fact.b)!;
        if (q.isIntroduction && !f.introduced) {
          f.introduced = true;
          f.introducedAt = day; // réplique le comportement de App.tsx
        }
        const isNine = f.a === 9 || f.b === 9;
        Object.assign(f, processAnswer(f, !isNine, isNine ? 4000 : 2000, day, 'keypad'));
      }
      day = addDays(day, 1);
    }

    for (const k of tail) {
      const f = profile.facts.find((x) => getFactKey(x.a, x.b) === k)!;
      expect(f.introduced, `${k} doit finir introduit`).toBe(true);
    }
  });
});

describe('composeSession — ordre de la séance', () => {
  it('ordonne révisions dues et bonus ensemble : les bonus séparent les révisions d’une même table', () => {
    // Quatre faits ratés de la table de 2 (boîte 1, dus), en conflit deux à
    // deux : ordonnés à part des bonus, ils s'enchaînaient. Trois carrés pas
    // encore dus, qui ne heurtent rien, les séparent. Avec plus de trois faits
    // fragiles, la séance n'introduit rien de neuf (§3.4bis).
    const facts = createInitialFacts();
    for (const b of [3, 4, 5, 6]) introduce(facts, 2, b, 1, '2026-04-01', '2026-04-30');
    for (const n of [7, 8, 9]) introduce(facts, n, n, 3, '2026-04-01', '2026-04-30');

    const session = composeSession(profileWith(facts), TODAY);

    // Les révisions dues d'abord : un bonus ne passe devant que pour en séparer deux.
    expect(session.map((q) => q.isBonusReview)).toEqual([false, true, false, true, false, true, false]);
    for (let i = 1; i < session.length; i++) {
      const [prev, next] = [session[i - 1].fact, session[i].fact];
      expect([prev.a, prev.b].some((n) => n === next.a || n === next.b)).toBe(false);
    }
  });

  it('la première révision ne heurte pas la dernière intro', () => {
    // Intros du jour : 2×2 puis 2×3, les doubles d'abord. Des deux révisions
    // dues, 3×7 partage le 3 de la dernière intro : c'est 5×8 qui la suit.
    const facts = createInitialFacts();
    introduce(facts, 3, 7, 2, '2026-04-01', '2026-04-29');
    introduce(facts, 5, 8, 2, '2026-04-01', '2026-04-29');

    const session = composeSession(profileWith(facts), TODAY);

    expect(session.map((q) => getFactKey(q.fact.a, q.fact.b))).toEqual(
      [[2, 2], [2, 3], [5, 8], [3, 7]].map(([a, b]) => getFactKey(a, b)),
    );
    expect(session.map((q) => q.isIntroduction)).toEqual([true, true, false, false]);
  });
});

describe('composeSession — bonus reviews', () => {
  // Math.random seedé : générateur LCG simple, déterministe et reproductible.
  // composeSession utilise random() pour l'ordre d'affichage, le shuffle des
  // faits de même priorité et celui des bonus.
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
