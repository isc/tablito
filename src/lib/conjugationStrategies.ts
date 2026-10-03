import type { ConjFact } from '../types';
import {
  conjFactDef,
  regularStem,
  resolveConjQuestion,
  type ConjQuestionView,
} from './conjugationFacts';
import {
  CONJ_RULES,
  FUTUR_RULE,
  IMPARFAIT_RULE,
  PERSON_MARKS,
  SON_DOUX_RULE,
  type ConjStrategy,
} from './conjugationRules';

// Quelle règle de conjugaison (conjugationRules.ts, où vivent leurs textes et
// leurs blocs visuels) la séance montre pour une question, et lesquelles
// l'enfant a déjà rencontrées.

/**
 * L'astuce à afficher pour une question donnée (§5.3 : seulement pour les faits
 * en boîte ≤ 2). Une seule règle à la fois — jamais un mur de règles.
 *
 * Priorité au piège de son quand il s'applique : c'est LUI qui vient de faire
 * rater la question (le radical affiché a changé sous les doigts de l'enfant),
 * pas la règle générale du temps.
 */
export function getConjStrategy(view: ConjQuestionView): ConjStrategy {
  // Le radical affiché a-t-il été raboté par l'euphonie (man|geons) ?
  const euphonyApplies =
    view.def.kind === 'ending' && view.segment[0] !== regularStem(view.verb, view.def.tense);
  if (euphonyApplies) return SON_DOUX_RULE;
  if (view.def.tense === 'imparfait') return IMPARFAIT_RULE;
  if (view.def.tense === 'futur') return FUTUR_RULE;
  return PERSON_MARKS;
}

/**
 * Les règles que l'enfant a déjà rencontrées, dans l'ordre de `CONJ_RULES` :
 * celles que la séance montre (introduction, correction) pour au moins un fait
 * déjà introduit — par une introduction, ou par le test de placement.
 *
 * L'écran « Mes règles » les révèle ainsi au fil de la matière — pourquoi, et
 * ce que ça garantit pour l'interférence futur -ai / imparfait -ais : spec
 * §15.3.
 *
 * Dérivé de `getConjStrategy`, jamais d'une table à part : une règle est listée
 * exactement quand la séance l'afficherait pour un fait de l'enfant. Un test
 * vérifie que `CONJ_RULES` contient toutes celles que la séance peut montrer.
 */
export function metConjRules(facts: readonly Pick<ConjFact, 'key' | 'introduced'>[]): ConjStrategy[] {
  const met = new Set<ConjStrategy>();
  for (const fact of facts) {
    if (!fact.introduced) continue;
    const def = conjFactDef(fact.key);
    if (!def) continue;
    // Toutes les porteuses : « ils mangeaient » appelle le piège du g et du c,
    // les deux autres phrases du même fait la règle de l'imparfait.
    def.carriers.forEach((_, i) => met.add(getConjStrategy(resolveConjQuestion(def, i))));
  }
  return CONJ_RULES.filter((rule) => met.has(rule));
}
