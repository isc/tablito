// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { BoxLevel } from '../types';
import { conjFactDefs, conjFactDef, requireConjFactDef } from '../lib/conjugationFacts';
import {
  CONJ_CONSOLIDATED_BOX,
  canConjBeAdjacent,
  canConjCoexist,
  conjFactsInterfere,
  conjKeysInterfere,
  ezRole,
} from '../lib/conjugationInterference';

const at = (key: string, box: BoxLevel) => ({ key, box });

describe('paires à haut risque (§3.4)', () => {
  it('met en interférence les quatre monosyllabes en -ont', () => {
    const ont = ['pres-etre-ils', 'pres-avoir-ils', 'pres-aller-ils', 'pres-faire-ils'];
    for (const a of ont) {
      for (const b of ont) {
        expect(conjKeysInterfere(a, b)).toBe(a !== b);
      }
    }
  });

  it('met en interférence tu es / il est', () => {
    expect(conjKeysInterfere('pres-etre-tu', 'pres-etre-il')).toBe(true);
    expect(conjKeysInterfere('pres-etre-il', 'pres-etre-tu')).toBe(true);
  });

  it('oppose vous êtes / faites / dites à la règle vous → -ez', () => {
    const exceptions = ['pres-etre-vous', 'pres-faire-vous', 'pres-dire-vous'];
    const reguliers = [
      'pres-g1-vous',
      'pres-avoir-vous',
      'pres-aller-vous',
      'pres-venir-vous',
      'pres-voir-vous',
      'fut-vous',
    ];
    for (const e of exceptions) {
      expect(ezRole(requireConjFactDef(e))).toBe('exception');
      for (const r of reguliers) expect(conjKeysInterfere(e, r)).toBe(true);
      // …et les exceptions sont confusibles entre elles.
      for (const other of exceptions) expect(conjKeysInterfere(e, other)).toBe(e !== other);
    }
    for (const r of reguliers) expect(ezRole(requireConjFactDef(r))).toBe('regular');
  });

  it('ne confond pas -iez (imparfait) avec la règle -ez', () => {
    expect(ezRole(requireConjFactDef('imp-vous'))).toBe('none');
    expect(conjKeysInterfere('pres-etre-vous', 'imp-vous')).toBe(false);
  });

  it('met en interférence le futur -ai et l’imparfait -ais', () => {
    expect(conjKeysInterfere('fut-je', 'imp-je')).toBe(true);
    // Uniquement à la 1re personne : c'est là que la confusion vit.
    expect(conjKeysInterfere('fut-tu', 'imp-tu')).toBe(false);
  });

  it('laisse tranquilles deux faits sans rapport', () => {
    expect(conjKeysInterfere('pres-g1-je', 'fut-ils')).toBe(false);
    expect(conjKeysInterfere('pres-g1-je', 'pres-g1-je')).toBe(false);
    // Clé inconnue (profil d'une version future) : jamais de faux conflit.
    expect(conjKeysInterfere('pres-g1-je', 'inexistant')).toBe(false);
  });

  it('est symétrique sur tout l’inventaire', () => {
    for (const a of conjFactDefs()) {
      for (const b of conjFactDefs()) {
        expect(conjFactsInterfere(a, b)).toBe(conjFactsInterfere(b, a));
      }
    }
  });
});

describe('cohabitation et adjacence', () => {
  it('interdit la même séance tant que les deux ne sont pas consolidés', () => {
    expect(canConjCoexist(at('pres-etre-ils', 1), at('pres-avoir-ils', 5))).toBe(false);
    expect(canConjCoexist(at('pres-etre-ils', 2), at('pres-avoir-ils', 3))).toBe(false);
    expect(
      canConjCoexist(
        at('pres-etre-ils', CONJ_CONSOLIDATED_BOX),
        at('pres-avoir-ils', CONJ_CONSOLIDATED_BOX),
      ),
    ).toBe(true);
  });

  it('garde deux faits confusibles non adjacents même consolidés', () => {
    expect(canConjBeAdjacent(at('pres-etre-ils', 5), at('pres-avoir-ils', 5))).toBe(false);
  });

  it('entrelace délibérément futur -ai et imparfait -ais dès la boîte 3', () => {
    expect(canConjBeAdjacent(at('fut-je', 2), at('imp-je', 5))).toBe(false);
    expect(canConjCoexist(at('fut-je', 2), at('imp-je', 5))).toBe(false);
    expect(canConjBeAdjacent(at('fut-je', 3), at('imp-je', 3))).toBe(true);
    expect(canConjCoexist(at('fut-je', 3), at('imp-je', 3))).toBe(true);
  });

  it('ignore les clés inconnues plutôt que de bloquer une séance', () => {
    expect(canConjBeAdjacent(at('inexistant', 1), at('pres-g1-je', 1))).toBe(true);
    expect(conjFactDef('inexistant')).toBeUndefined();
  });
});
