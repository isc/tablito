// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { interleaveGreedy } from '../lib/utils';

// Entrelacement (specs §1.3) : l'ordre glouton d'abord, retour sur les choix
// précédents en cas d'impasse, ordre glouton réparé quand aucun ordre sans
// conflit n'existe. `after` est fixé dans la plupart des cas : il décide du
// premier élément, ce qui rend l'ordre déterministe (sans lui, le premier est
// tiré au hasard).

/** « personne:étiquette » — deux éléments de la même personne sont en conflit. */
const samePerson = (a: string, b: string) => a.split(':')[0] === b.split(':')[0];

/** Nombre de voisins en conflit, jonction avec `after` comprise. */
function clashes(order: string[], after?: string): number {
  const seq = after === undefined ? order : [after, ...order];
  return seq.slice(1).filter((item, i) => samePerson(seq[i], item)).length;
}

describe('interleaveGreedy', () => {
  it('sans impasse : l’ordre glouton, premier candidat sans conflit dans l’ordre donné', () => {
    expect(interleaveGreedy(['nous:1', 'je:a', 'nous:2'], samePerson, 'tu:x')).toEqual([
      'nous:1',
      'je:a',
      'nous:2',
    ]);
  });

  it('impasse : revient sur un choix précédent plutôt que d’accoler deux voisins en conflit', () => {
    // Après « tu », le glouton pose je puis nous:1, et nous:2 n'a plus de place.
    // En reprenant le premier choix, nous:1 en tête laisse je les séparer.
    expect(interleaveGreedy(['je:a', 'nous:1', 'nous:2'], samePerson, 'tu:x')).toEqual([
      'nous:1',
      'je:a',
      'nous:2',
    ]);
  });

  it('la jonction avec `after` compte : jamais de conflit en tête', () => {
    // La tête suivrait « nous:x » : elle ne peut être que je ou tu.
    const order = interleaveGreedy(['je:a', 'tu:b', 'nous:1', 'nous:2'], samePerson, 'nous:x');
    expect(order).toEqual(['je:a', 'nous:1', 'tu:b', 'nous:2']);
    expect(clashes(order, 'nous:x')).toBe(0);
  });

  it('premier élément tiré au hasard : trouve quand même un ordre sans conflit', () => {
    // Sans `after`, le premier tirage peut tomber sur un « nous » dont aucun
    // ordre ne part sans conflit : la recherche revient aussi sur ce choix-là.
    const items = ['nous:1', 'nous:2', 'nous:3', 'je:a', 'tu:b'];
    for (let run = 0; run < 50; run++) {
      const order = interleaveGreedy(items, samePerson);
      expect([...order].sort()).toEqual([...items].sort());
      expect(clashes(order)).toBe(0);
    }
  });

  it('aucun ordre sans conflit : l’ordre glouton réparé (best effort)', () => {
    // Quatre « nous » pour deux séparateurs : un conflit au moins est forcé.
    // Le repli glisse chaque « nous » sans place plus tôt quand il le peut, et
    // n'en accole un qu'en dernier recours — un seul conflit, le minimum.
    const order = interleaveGreedy(
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

    const order = interleaveGreedy(items, conflicts, 'q:x');

    expect([...order].sort()).toEqual([...items].sort());
    expect(conflicts.mock.calls.length).toBeLessThanOrEqual((items.length + 1) * items.length);
  }, 2_000);
});
