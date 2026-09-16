// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { shouldIntroduceNew } from '../lib/leitner';
import { createInitialFacts } from '../lib/facts';
import type { BoxLevel, MultiFact } from '../types';

function intro(fact: MultiFact, box: 1 | 2 | 3 | 4 | 5): MultiFact {
  return { ...fact, introduced: true, box };
}

describe('shouldIntroduceNew', () => {
  it('renvoie true si aucun fait n\'est introduit', () => {
    expect(shouldIntroduceNew(createInitialFacts())).toBe(true);
  });

  it('renvoie true si tous les introduits sont en boîte ≥ 2', () => {
    const facts = createInitialFacts().map((f) => intro(f, 2));
    expect(shouldIntroduceNew(facts)).toBe(true);
  });

  it('renvoie false si un fait introduit est en boîte 1 (cas général)', () => {
    const facts = createInitialFacts();
    facts[0] = intro(facts[0], 1);
    for (let i = 1; i < 10; i++) facts[i] = intro(facts[i], 2);
    // 10 introduits dont 1 en boîte 1, 26 non introduits → cas général
    expect(shouldIntroduceNew(facts)).toBe(false);
  });

  it('relâche la règle quand il ne reste que ≤ 7 faits à introduire (fin de parcours)', () => {
    // 33 introduits dont 1 en boîte 1, 3 non introduits (cas réel : trou de
    // dominance du placement = 7×9/8×9/9×9). L'ancien seuil (2) bloquait ici.
    const facts = createInitialFacts();
    for (let i = 0; i < 33; i++) {
      facts[i] = intro(facts[i], i === 0 ? 1 : 2);
    }
    expect(shouldIntroduceNew(facts)).toBe(true);
  });

  it('relâche la règle aussi avec 1 seul fait restant', () => {
    const facts = createInitialFacts();
    for (let i = 0; i < 35; i++) {
      facts[i] = intro(facts[i], i === 0 ? 1 : 3);
    }
    expect(shouldIntroduceNew(facts)).toBe(true);
  });

  it('ne relâche PAS si beaucoup de faits restent à introduire (> 7, début de parcours)', () => {
    const facts = createInitialFacts();
    for (let i = 0; i < 20; i++) {
      facts[i] = intro(facts[i], i === 0 ? 1 : 2);
    }
    // 20 introduits dont 1 en boîte 1, 16 non introduits → protection maintenue
    expect(shouldIntroduceNew(facts)).toBe(false);
  });

  it('garde la frontière exacte des specs en multiplication : 7 oui, 8 non', () => {
    // §3.4bis : « ≤ 7 faits à introduire (soit ≥ 29/36 introduits) ».
    const at = (introducedCount: number) => {
      const facts = createInitialFacts();
      for (let i = 0; i < introducedCount; i++) facts[i] = intro(facts[i], i === 0 ? 1 : 2);
      return shouldIntroduceNew(facts);
    };
    expect(at(29)).toBe(true); // 7 restants
    expect(at(28)).toBe(false); // 8 restants
  });
});

// Le seuil de phase finale doit suivre la TAILLE du jeu de faits : écrit en dur
// à 7, il était calibré sur les 36 multiplications et gelait l'introduction des
// jeux plus gros (64 divisions, 64 restes, 63 faits de conjugaison) bien plus
// tôt que prévu — cas remonté en prod : 52/64 divisions introduites, tout le
// reste en boîte 4-5, plus aucune intro pendant des semaines.
describe('shouldIntroduceNew — phase finale sur les jeux de faits plus grands', () => {
  // Jeu générique de `total` faits : `introducedCount` introduits, dont le
  // premier laissé en boîte 1 (l'erreur de la dernière séance).
  function deck(total: number, introducedCount: number) {
    return Array.from({ length: total }, (_, i) => ({
      introduced: i < introducedCount,
      box: (i === 0 ? 1 : 4) as BoxLevel,
    }));
  }

  it('place la frontière au cinquième du jeu : 12 restants oui, 13 non (64 faits)', () => {
    // 52/64 est exactement le cas remonté par un parent : il bascule du bon côté.
    expect(shouldIntroduceNew(deck(64, 52))).toBe(true); // 12 restants
    expect(shouldIntroduceNew(deck(64, 51))).toBe(false); // 13 restants
  });

  it('suit aussi le jeu de conjugaison (63 faits) : 12 restants oui, 13 non', () => {
    expect(shouldIntroduceNew(deck(63, 51))).toBe(true); // 12 restants
    expect(shouldIntroduceNew(deck(63, 50))).toBe(false); // 13 restants
  });

  it('ne relâche rien tant qu\'aucun fait introduit n\'est bloqué', () => {
    // Même jeu, mais tout en boîte ≥ 2 : la règle générale suffit déjà.
    const facts = deck(64, 40).map((f) => ({ ...f, box: 3 as BoxLevel }));
    expect(shouldIntroduceNew(facts)).toBe(true);
  });
});
