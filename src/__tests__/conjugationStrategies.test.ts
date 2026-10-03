// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getConjStrategy, metConjRules } from '../lib/conjugationStrategies';
import { CONJ_RULES } from '../lib/conjugationRules';
import { conjFactDefs, requireConjFactDef, resolveConjQuestion } from '../lib/conjugationFacts';
import type { ConjTense } from '../types';

// ---------------------------------------------------------------------------
// Les règles de conjugaison de l'écran « Mes règles » (spec §15.3) : celles que
// la séance montre pour un fait déjà introduit, révélées au fil de la matière
// et rangées dans l'ordre de la spec, quel que soit l'ordre des faits.
// ---------------------------------------------------------------------------

const [MARKS, IMPARFAIT, FUTUR, SON_DOUX] = CONJ_RULES;

/** Les faits donnés, introduits ; tous les autres de l'inventaire, non. */
function introduced(...keys: string[]) {
  return conjFactDefs().map((def) => ({ key: def.key, introduced: keys.includes(def.key) }));
}

function keysOfTense(tense: ConjTense): string[] {
  return conjFactDefs()
    .filter((def) => def.tense === tense)
    .map((def) => def.key);
}

describe('CONJ_RULES', () => {
  it('range les quatre règles dans l’ordre de la spec : marques, imparfait, futur, piège de son', () => {
    // Les mêmes objets que ceux de la séance : l'écran n'en réécrit aucune.
    const strategyOf = (key: string) => getConjStrategy(resolveConjQuestion(requireConjFactDef(key), 0));
    expect(strategyOf('pres-g1-je')).toBe(MARKS);
    expect(strategyOf('imp-je')).toBe(IMPARFAIT);
    expect(strategyOf('fut-je')).toBe(FUTUR);
    expect(strategyOf('pres-g1-nous')).toBe(SON_DOUX);
    expect(CONJ_RULES).toHaveLength(4);
  });

  it('contient toutes les règles que la séance peut montrer, et elles seules', () => {
    // metConjRules filtre sur cette liste : une astuce ajoutée à
    // getConjStrategy mais oubliée ici disparaîtrait de « Mes règles » sans bruit.
    const shown = new Set(
      conjFactDefs().flatMap((def) =>
        def.carriers.map((_, i) => getConjStrategy(resolveConjQuestion(def, i))),
      ),
    );
    expect(shown).toEqual(new Set(CONJ_RULES));
  });
});

describe('metConjRules', () => {
  it('rien tant qu’aucun fait n’est introduit', () => {
    expect(metConjRules(introduced())).toEqual([]);
    expect(metConjRules([])).toEqual([]);
  });

  it('le premier fait du présent apporte les marques de personne', () => {
    expect(metConjRules(introduced('pres-g1-je'))).toEqual([MARKS]);
    expect(metConjRules(introduced('pres-etre-nous'))).toEqual([MARKS]);
  });

  it('« nous mangeons » apporte aussi le piège du g et du c', () => {
    // Porteuse 0 : nous man|geons (piège) ; les deux autres : les marques.
    expect(metConjRules(introduced('pres-g1-nous'))).toEqual([MARKS, SON_DOUX]);
  });

  it('chaque porteuse compte : « ils mangeaient » appelle le piège à l’imparfait', () => {
    expect(metConjRules(introduced('imp-ils'))).toEqual([IMPARFAIT, SON_DOUX]);
  });

  it('la règle d’un temps n’apparaît qu’avec un fait de ce temps', () => {
    const presentAndImparfait = [...keysOfTense('present'), ...keysOfTense('imparfait')];
    expect(metConjRules(introduced(...presentAndImparfait))).not.toContain(FUTUR);
    expect(metConjRules(introduced(...keysOfTense('present')))).not.toContain(IMPARFAIT);
    // Le radical ét- suffit à ouvrir la règle de l'imparfait, ser- celle du futur.
    expect(metConjRules(introduced('imp-etre'))).toEqual([IMPARFAIT]);
    expect(metConjRules(introduced('fut-etre'))).toEqual([FUTUR]);
  });

  it('range les règles dans l’ordre de CONJ_RULES, quel que soit l’ordre des faits', () => {
    const facts = introduced('fut-je', 'pres-g1-nous', 'imp-je').reverse();
    expect(metConjRules(facts)).toEqual([MARKS, IMPARFAIT, FUTUR, SON_DOUX]);
  });

  it('tout l’inventaire introduit : les quatre règles', () => {
    expect(metConjRules(conjFactDefs().map((def) => ({ key: def.key, introduced: true })))).toEqual(
      CONJ_RULES,
    );
  });

  it('ignore une clé inconnue (profil d’une version future)', () => {
    expect(metConjRules([{ key: 'pres-g2-je', introduced: true }])).toEqual([]);
  });
});
