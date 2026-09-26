import type { ConjPerson, ConjTense } from '../types';
import type { HardFact } from './hardestFacts';
import { conjFactDef, resolveConjQuestion } from './conjugationFacts';
import { getStrategy } from './strategies';

// Une idée pour aider l'enfant à la maison, tirée du fait qui lui résiste le
// plus (cf. « À retravailler » de l'espace parent). Ce module choisit l'idée et
// en calcule les exemples ; les phrases, elles, vivent dans i18n/week.ts.
//
// Autant que possible, l'idée REPREND ce que l'app enseigne déjà (l'astuce de
// la séance, la règle de la terminaison) : le parent renforce la même méthode
// au lieu d'en proposer une concurrente.
export type HomeIdea =
  // L'astuce que la séance montre pour ce calcul (× 9 = × 10 moins une fois…).
  | { kind: 'strategy'; title: string; example: string }
  // Table de 2 : pas d'astuce en séance, mais « c'est le double ».
  | { kind: 'double'; n: number }
  // Sans astuce (3 × 3) : la question posée à l'oral.
  | { kind: 'oral'; a: number; b: number }
  | { kind: 'division'; dividend: number; divisor: number }
  | { kind: 'remainder'; dividend: number; divisor: number }
  // Conjugaison (fr-only) : la règle de la terminaison, la forme à retenir par
  // cœur, ou le radical qui change.
  | { kind: 'conjEnding'; tense: ConjTense; person: ConjPerson; ending: string; examples: string[] }
  | { kind: 'conjIrregular'; label: string; sentence: string }
  | { kind: 'conjStem'; tense: ConjTense; verb: string; examples: string[] };

export function homeIdea(fact: HardFact): HomeIdea | null {
  switch (fact.kind) {
    case 'mult': {
      const strategy = getStrategy(fact.a, fact.b);
      if (strategy) {
        // Les lignes de calcul seulement : « On compte : 5 → 10 → … » (× 5)
        // est une consigne pour l'enfant, pas un exemple.
        const example = strategy.lines.filter((line) => !/\p{L}/u.test(line)).join(' ');
        return { kind: 'strategy', title: strategy.title, example };
      }
      return Math.min(fact.a, fact.b) === 2
        ? { kind: 'double', n: Math.max(fact.a, fact.b) }
        : { kind: 'oral', a: fact.a, b: fact.b };
    }
    case 'div':
      return { kind: 'division', dividend: fact.dividend, divisor: fact.divisor };
    case 'rem': {
      // Un dividende au milieu de la zone : ni le multiple exact (reste nul,
      // c'est alors une division sans reste), ni le reste maximal. 6 × 4 → 27.
      const remainder = Math.ceil((fact.divisor - 1) / 2);
      return { kind: 'remainder', dividend: fact.divisor * fact.quotient + remainder, divisor: fact.divisor };
    }
    case 'conj': {
      const def = conjFactDef(fact.key);
      if (!def) return null;
      // Deux porteuses, deux exemples : « nous mangeons, nous chantons ».
      const views = def.carriers.slice(0, 2).map((_, i) => resolveConjQuestion(def, i));
      const examples = [...new Set(views.map((v) => v.label))];
      switch (def.kind) {
        case 'ending':
          return { kind: 'conjEnding', tense: def.tense, person: views[0].person, ending: def.ending as string, examples };
        case 'stem':
          return { kind: 'conjStem', tense: def.tense, verb: def.verb as string, examples };
        case 'irregular':
          return { kind: 'conjIrregular', label: views[0].label, sentence: views[0].sentence };
      }
    }
  }
}
