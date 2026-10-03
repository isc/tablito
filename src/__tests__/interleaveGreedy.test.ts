// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { interleaveGreedy } from '../lib/utils';

// Entrelacement glouton (specs §1.3), impasses comprises. `after` est fixé dans
// chaque cas : il décide du premier élément, ce qui rend l'ordre déterministe
// (sans lui, le premier est tiré au hasard).

/** « personne:étiquette » — deux éléments de la même personne sont en conflit. */
const samePerson = (a: string, b: string) => a.split(':')[0] === b.split(':')[0];

describe('interleaveGreedy', () => {
  it('sans impasse : le premier candidat sans conflit, dans l’ordre donné', () => {
    expect(interleaveGreedy(['nous:1', 'je:a', 'nous:2'], samePerson, 'tu:x')).toEqual([
      'nous:1',
      'je:a',
      'nous:2',
    ]);
  });

  it('impasse : l’élément se glisse plus tôt, entre deux voisins qu’il ne heurte pas', () => {
    // Après « tu », le glouton pose je puis nous:1 — et nous:2 n'a plus de place
    // derrière nous:1. Sa place est en tête, entre « tu » (after) et « je ».
    expect(interleaveGreedy(['je:a', 'nous:1', 'nous:2'], samePerson, 'tu:x')).toEqual([
      'nous:2',
      'je:a',
      'nous:1',
    ]);
  });

  it('la jonction avec `after` compte : pas de glissement en tête derrière un conflit', () => {
    // La tête suivrait « nous:x » : nous:2 va donc entre je et tu.
    expect(interleaveGreedy(['je:a', 'tu:b', 'nous:1', 'nous:2'], samePerson, 'nous:x')).toEqual([
      'je:a',
      'nous:2',
      'tu:b',
      'nous:1',
    ]);
  });

  it('aucune place nulle part : posé en fin de liste (best effort)', () => {
    expect(interleaveGreedy(['nous:1', 'nous:2'], samePerson, 'tu:x')).toEqual(['nous:1', 'nous:2']);
  });
});
