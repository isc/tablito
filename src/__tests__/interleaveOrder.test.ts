// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { interleaveOrder } from '../lib/utils';

// Entrelacement (specs §1.3) : l'ordre donné est un ordre de préférence — à
// chaque place, le premier élément qui ne heurte pas le précédent —, avec
// retour sur les choix précédents en cas d'impasse, et l'ordre glouton réparé
// quand aucun ordre sans conflit n'existe. Rien n'y est tiré au sort : l'ordre
// obtenu ne dépend que de l'ordre donné.

/** « personne:étiquette » — deux éléments de la même personne sont en conflit. */
const samePerson = (a: string, b: string) => a.split(':')[0] === b.split(':')[0];

/** Nombre de voisins en conflit, jonction avec `after` comprise. */
function clashes(order: string[], after?: string): number {
  const seq = after === undefined ? order : [after, ...order];
  return seq.slice(1).filter((item, i) => samePerson(seq[i], item)).length;
}

describe('interleaveOrder', () => {
  it('sans impasse : l’ordre glouton, premier candidat sans conflit dans l’ordre donné', () => {
    expect(interleaveOrder(['nous:1', 'je:a', 'nous:2'], samePerson, 'tu:x')).toEqual([
      'nous:1',
      'je:a',
      'nous:2',
    ]);
  });

  it('un élément ne passe devant les précédents que pour éviter un conflit', () => {
    // Comme une séance : trois révisions dues de la même personne, puis deux
    // bonus. Les bonus remontent juste assez pour séparer les révisions, qui
    // gardent leur ordre.
    expect(
      interleaveOrder(['nous:1', 'nous:2', 'nous:3', 'je:bonus', 'tu:bonus'], samePerson, 'il:x'),
    ).toEqual(['nous:1', 'je:bonus', 'nous:2', 'tu:bonus', 'nous:3']);
  });

  it('impasse : revient sur un choix précédent plutôt que d’accoler deux voisins en conflit', () => {
    // Après « tu », le glouton pose je puis nous:1, et nous:2 n'a plus de place.
    // En reprenant le premier choix, nous:1 en tête laisse je les séparer.
    expect(interleaveOrder(['je:a', 'nous:1', 'nous:2'], samePerson, 'tu:x')).toEqual([
      'nous:1',
      'je:a',
      'nous:2',
    ]);
  });

  it('la jonction avec `after` compte : jamais de conflit en tête', () => {
    // La tête suivrait « nous:x » : elle ne peut être que je ou tu.
    const order = interleaveOrder(['je:a', 'tu:b', 'nous:1', 'nous:2'], samePerson, 'nous:x');
    expect(order).toEqual(['je:a', 'nous:1', 'tu:b', 'nous:2']);
    expect(clashes(order, 'nous:x')).toBe(0);
  });

  it('sans `after` : part du premier élément, sauf si aucun ordre sans conflit n’en part', () => {
    // Trois « nous » pour deux séparateurs : seul un ordre qui commence par un
    // « nous » les sépare tous. La recherche revient donc aussi sur le premier
    // choix, je:a, qu'elle aurait gardé sinon.
    const order = interleaveOrder(['je:a', 'nous:1', 'nous:2', 'nous:3', 'tu:b'], samePerson);
    expect(order).toEqual(['nous:1', 'je:a', 'nous:2', 'tu:b', 'nous:3']);
    expect(clashes(order)).toBe(0);
  });

  it('aucun ordre sans conflit : l’ordre glouton réparé (best effort)', () => {
    // Quatre « nous » pour deux séparateurs : un conflit au moins est forcé.
    // Le repli glisse chaque « nous » sans place plus tôt quand il le peut, et
    // n'en accole un qu'en dernier recours — un seul conflit, le minimum.
    const order = interleaveOrder(
      ['je:a', 'tu:b', 'nous:1', 'nous:2', 'nous:3', 'nous:4'],
      samePerson,
      'il:x',
    );
    expect(order).toEqual(['nous:2', 'je:a', 'nous:3', 'tu:b', 'nous:1', 'nous:4']);
    expect(clashes(order, 'il:x')).toBe(1);
  });

  it('cas pathologique : le budget arrête la recherche, chaque paire n’est évaluée qu’une fois', () => {
    // « z » heurte tout le monde : aucun ordre sans conflit, mais seule la
    // dernière place le révèle. Sans budget, il faudrait essayer les 15! ordres
    // des autres avant de conclure.
    const items = [...Array.from({ length: 15 }, (_, i) => `p${i}:x`), 'z:z'];
    const conflicts = vi.fn((a: string, b: string) => a === 'z:z' || b === 'z:z' || samePerson(a, b));

    const order = interleaveOrder(items, conflicts, 'q:x');

    expect([...order].sort()).toEqual([...items].sort());
    expect(conflicts.mock.calls.length).toBeLessThanOrEqual((items.length + 1) * items.length);
  }, 2_000);
});
