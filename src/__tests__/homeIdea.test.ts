// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { homeIdea } from '../lib/homeIdea';
import type { HardFact } from '../lib/hardestFacts';

// ---------------------------------------------------------------------------
// L'idée pour aider à la maison reprend ce que l'app enseigne déjà : l'astuce
// de la séance pour un calcul, la règle de la terminaison en conjugaison.
// ---------------------------------------------------------------------------

const base = { key: 'k', box: 1 as const, errorCount: 3 };

describe('homeIdea', () => {
  it("reprend l'astuce de la séance, avec ses seules lignes de calcul", () => {
    const idea = homeIdea({ ...base, kind: 'mult', a: 7, b: 9, product: 63 });
    expect(idea).toEqual({
      kind: 'strategy',
      title: '× 9, c’est comme × 10 mais on enlève une fois.',
      example: '7 × 9 = 7 × 10 − 7 = 70 − 7 = 63',
    });
  });

  it("laisse de côté la consigne « On compte » de l'astuce × 5", () => {
    const idea = homeIdea({ ...base, kind: 'mult', a: 3, b: 5, product: 15 });
    expect(idea).toMatchObject({ kind: 'strategy', example: '3 × 5 = 5 + 5 + 5 = 15' });
  });

  it('la table de 2 devient le double', () => {
    expect(homeIdea({ ...base, kind: 'mult', a: 2, b: 7, product: 14 })).toEqual({ kind: 'double', n: 7 });
  });

  it("sans astuce, la question à l'oral", () => {
    expect(homeIdea({ ...base, kind: 'mult', a: 3, b: 3, product: 9 })).toEqual({ kind: 'oral', a: 3, b: 3 });
  });

  it('la division devient une question de table', () => {
    const fact: HardFact = { ...base, kind: 'div', dividend: 56, divisor: 7, quotient: 8 };
    expect(homeIdea(fact)).toEqual({ kind: 'division', dividend: 56, divisor: 7 });
  });

  it('la division avec reste part du milieu de la zone', () => {
    // Zone 6 × 4 : de 24 à 29 ; reste 3.
    expect(homeIdea({ ...base, kind: 'rem', divisor: 6, quotient: 4 })).toEqual({
      kind: 'remainder',
      dividend: 27,
      divisor: 6,
    });
    // Par 2 : le seul reste possible, 1.
    expect(homeIdea({ ...base, kind: 'rem', divisor: 2, quotient: 5 })).toMatchObject({ dividend: 11 });
  });

  it('une terminaison donne sa règle et deux exemples', () => {
    const idea = homeIdea({ ...base, kind: 'conj', key: 'fut-nous', label: 'nous mangerons' });
    expect(idea).toEqual({
      kind: 'conjEnding',
      tense: 'futur',
      person: 'nous',
      ending: 'ons',
      examples: ['nous mangerons', 'nous regarderons'],
    });
  });

  it('une forme irrégulière se retient dans une phrase', () => {
    const idea = homeIdea({ ...base, kind: 'conj', key: 'pres-etre-nous', label: 'nous sommes' });
    expect(idea).toEqual({
      kind: 'conjIrregular',
      label: 'nous sommes',
      sentence: 'Aujourd’hui, nous sommes huit à table.',
    });
  });

  it('un radical irrégulier montre le radical en contexte', () => {
    const idea = homeIdea({ ...base, kind: 'conj', key: 'fut-etre', label: 'je serai' });
    expect(idea).toEqual({ kind: 'conjStem', tense: 'futur', verb: 'être', examples: ['je serai', 'nous serons'] });
  });

  it("un fait de conjugaison disparu de l'inventaire n'a pas d'idée", () => {
    expect(homeIdea({ ...base, kind: 'conj', key: 'inconnu', label: '' })).toBeNull();
  });
});
