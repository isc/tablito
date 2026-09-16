// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { MAX_FRAGILE, shouldIntroduceNew } from '../lib/leitner';
import { createInitialFacts } from '../lib/facts';
import type { BoxLevel } from '../types';

// Jeu générique : `total` faits, `introducedCount` introduits, dont
// `fragileCount` laissés en boîte 1 (les ratés des dernières séances) et le
// reste en boîte 4.
function deck(total: number, introducedCount: number, fragileCount: number) {
  return Array.from({ length: total }, (_, i) => ({
    introduced: i < introducedCount,
    box: (i < fragileCount ? 1 : 4) as BoxLevel,
  }));
}

describe('shouldIntroduceNew', () => {
  it('renvoie true si aucun fait n\'est introduit', () => {
    expect(shouldIntroduceNew(createInitialFacts())).toBe(true);
  });

  // Le cœur de la règle : on mesure la TAILLE de la pile fragile, pas son
  // existence. L'ancienne version (`every(box >= 2)`) bloquait dès UN fait en
  // boîte 1 — donc exigeait une séance sans la moindre erreur, exigence qui se
  // durcissait à mesure que l'ensemble introduit grandissait. Les deux cas sont
  // pris loin de la fin de parcours (16 restants sur 36), sinon c'est le filet
  // qui répondrait et non le plafond.
  it('place la frontière du plafond à MAX_FRAGILE faits en boîte 1', () => {
    expect(shouldIntroduceNew(deck(36, 20, MAX_FRAGILE))).toBe(true);
    expect(shouldIntroduceNew(deck(36, 20, MAX_FRAGILE + 1))).toBe(false);
  });

  it('ne bloque rien quand aucun fait introduit n\'est en boîte 1', () => {
    expect(shouldIntroduceNew(deck(36, 20, 0))).toBe(true);
  });

  it('garde la frontière exacte des specs en multiplication : 7 oui, 8 non', () => {
    // §3.4bis : « ≤ 7 faits à introduire (soit ≥ 29/36 introduits) ». Pile
    // fragile au-dessus du plafond, sinon c'est le plafond qu'on testerait —
    // et le filet doit passer DEVANT lui, si fragile que soit la pile.
    expect(shouldIntroduceNew(deck(36, 29, 8))).toBe(true); // 7 restants
    expect(shouldIntroduceNew(deck(36, 28, 8))).toBe(false); // 8 restants
  });
});

// Le seuil de phase finale doit suivre la TAILLE du jeu de faits : écrit en dur
// à 7, il était calibré sur les 36 multiplications et gelait l'introduction des
// jeux plus gros (64 divisions, 64 restes, 63 faits de conjugaison) bien plus
// tôt que prévu — cas remonté en prod : 52/64 divisions introduites, tout le
// reste en boîte 4-5, plus aucune intro pendant des semaines.
describe('shouldIntroduceNew — phase finale sur les jeux de faits plus grands', () => {
  it('place la frontière au cinquième du jeu : 12 restants oui, 13 non (64 faits)', () => {
    expect(shouldIntroduceNew(deck(64, 52, 8))).toBe(true); // 12 restants
    expect(shouldIntroduceNew(deck(64, 51, 8))).toBe(false); // 13 restants
  });

  it('suit aussi le jeu de conjugaison (63 faits) : 12 restants oui, 13 non', () => {
    expect(shouldIntroduceNew(deck(63, 51, 8))).toBe(true); // 12 restants
    expect(shouldIntroduceNew(deck(63, 50, 8))).toBe(false); // 13 restants
  });

  it('débloque le cas remonté par un parent, par le plafond seul', () => {
    // Le gel d'origine : des divisions introduites, tout en boîte 4-5 sauf une
    // faute de la veille. 40/64 laisse 24 restants, bien au-delà du filet
    // (12) : c'est donc bien le plafond qui répond. Le cas exact du parent
    // (52/64) tombe pile SUR le filet — il ne discriminerait pas le plafond.
    expect(shouldIntroduceNew(deck(64, 40, 1))).toBe(true);
  });
});
