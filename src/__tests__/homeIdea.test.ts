// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { homeIdea } from '../lib/homeIdea';
import type { HardFact } from '../lib/hardestFacts';

// ---------------------------------------------------------------------------
// L'idée pour aider à la maison reprend l'astuce que la séance montre pour ce
// fait — celle des modules de stratégies, jamais une réécriture. Seuls les cas
// sans astuce en séance ont leur idée propre.
// ---------------------------------------------------------------------------

const base = { key: 'k', box: 1 as const, errorCount: 3 };

describe('homeIdea', () => {
  it("reprend l'astuce de la séance, avec ses seules étapes de calcul", () => {
    expect(homeIdea({ ...base, kind: 'mult', a: 7, b: 9, product: 63 })).toEqual({
      kind: 'strategy',
      title: '× 9, c’est comme × 10 mais on enlève une fois.',
      example: '7 × 9 = 7 × 10 − 7 = 70 − 7 = 63.',
    });
  });

  it("laisse de côté la consigne « On compte » de l'astuce × 5", () => {
    const idea = homeIdea({ ...base, kind: 'mult', a: 3, b: 5, product: 15 });
    expect(idea).toMatchObject({ kind: 'strategy', example: '3 × 5 = 5 + 5 + 5 = 15.' });
  });

  it('la table de 2 devient le double', () => {
    expect(homeIdea({ ...base, kind: 'mult', a: 2, b: 7, product: 14 })).toEqual({ kind: 'double', n: 7 });
  });

  it("sans astuce, la question à l'oral", () => {
    expect(homeIdea({ ...base, kind: 'mult', a: 3, b: 3, product: 9 })).toEqual({ kind: 'oral', a: 3, b: 3 });
  });

  it('la division reprend « pense à la multiplication »', () => {
    const fact: HardFact = { ...base, kind: 'div', dividend: 56, divisor: 7, quotient: 8 };
    expect(homeIdea(fact)).toEqual({
      kind: 'strategy',
      title: 'Pense à la multiplication',
      example: "56 ÷ 7, c'est : 7 fois combien font 56 ?",
    });
  });

  it("la division avec reste reprend le multiple juste en dessous, sur les nombres de l'introduction", () => {
    // Zone 6 × 4 : de 24 à 29 ; l'écran d'introduction tire le reste 3.
    expect(homeIdea({ ...base, kind: 'rem', divisor: 6, quotient: 4 })).toEqual({
      kind: 'strategy',
      title: 'Cherche le multiple juste en dessous',
      example: "27 ÷ 6, c'est : 6 fois combien font presque 27, sans dépasser ?",
    });
  });

  it('une terminaison reprend la règle du temps, avec deux exemples', () => {
    expect(homeIdea({ ...base, kind: 'conj', key: 'fut-nous', label: 'nous mangerons' })).toEqual({
      kind: 'strategy',
      title: 'Le futur se fabrique avec l’infinitif',
      example: 'nous mangerons, nous regarderons.',
    });
  });

  it('le piège du g passe devant la règle générale, avec ses seuls exemples', () => {
    // « nous mangeons » : le e de l'euphonie ; « nous chantons » n'en a pas.
    expect(homeIdea({ ...base, kind: 'conj', key: 'pres-g1-nous', label: 'nous mangeons' })).toEqual({
      kind: 'strategy',
      title: 'Le piège du g et du c',
      example: 'nous mangeons.',
    });
  });

  it('une forme irrégulière se retient dans une phrase', () => {
    expect(homeIdea({ ...base, kind: 'conj', key: 'pres-etre-nous', label: 'nous sommes' })).toEqual({
      kind: 'conjIrregular',
      label: 'nous sommes',
      sentence: 'Aujourd’hui, nous sommes huit à table.',
    });
  });

  it('un radical irrégulier montre le radical en contexte', () => {
    expect(homeIdea({ ...base, kind: 'conj', key: 'fut-etre', label: 'je serai' })).toEqual({
      kind: 'conjStem',
      tense: 'futur',
      verb: 'être',
      examples: ['je serai', 'nous serons'],
    });
  });

  it("un fait de conjugaison disparu de l'inventaire n'a pas d'idée", () => {
    expect(homeIdea({ ...base, kind: 'conj', key: 'inconnu', label: '' })).toBeNull();
  });
});
