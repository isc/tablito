// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { shouldIntroduceNew } from '../lib/leitner';
import { createInitialFacts } from '../lib/facts';
import type { MultiFact } from '../types';

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
});
