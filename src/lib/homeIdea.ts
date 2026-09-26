import type { ConjTense } from '../types';
import type { HardFact } from './hardestFacts';
import { conjFactDef, resolveConjQuestion } from './conjugationFacts';
import { getConjStrategy } from './conjugationStrategies';
import { getDivisionStrategy } from './divisionStrategies';
import { introRemainder } from './remainderFacts';
import { getRemainderStrategy } from './remainderStrategies';
import { getStrategy } from './strategies';

// Une idée pour aider l'enfant à la maison, tirée du fait qui lui résiste le
// plus (cf. « À retravailler » de l'espace parent). Ce module choisit l'idée et
// en calcule l'exemple ; la phrase qui l'encadre vit dans i18n/homeIdea.ts.
//
// L'idée REPREND l'astuce que la séance montre pour ce fait — celle des
// modules de stratégies, et non une réécriture : le parent renforce la même
// méthode au lieu d'en proposer une concurrente. Seuls les cas sans astuce en
// séance ont leur idée propre.
export type HomeIdea =
  // L'astuce de la séance : son titre, et un exemple ponctué, prêt à citer.
  | { kind: 'strategy'; title: string; example: string }
  // Table de 2 : pas d'astuce en séance, mais « c'est le double ».
  | { kind: 'double'; n: number }
  // Sans astuce (3 × 3) : la question posée à l'oral.
  | { kind: 'oral'; a: number; b: number }
  // Conjugaison (fr-only) : les exceptions à la règle du temps que la séance
  // enseigne — une forme à retenir par cœur, ou un radical qui change.
  | { kind: 'conjIrregular'; label: string; sentence: string }
  | { kind: 'conjStem'; tense: ConjTense; verb: string; examples: string[] };

export function homeIdea(fact: HardFact): HomeIdea | null {
  switch (fact.kind) {
    case 'mult': {
      const strategy = getStrategy(fact.a, fact.b);
      if (strategy) return { kind: 'strategy', title: strategy.title, example: `${strategy.steps.join(' ')}.` };
      return Math.min(fact.a, fact.b) === 2
        ? { kind: 'double', n: Math.max(fact.a, fact.b) }
        : { kind: 'oral', a: fact.a, b: fact.b };
    }
    case 'div': {
      const strategy = getDivisionStrategy(fact);
      return { kind: 'strategy', title: strategy.title, example: strategy.intro };
    }
    case 'rem': {
      // Le reste de l'écran d'introduction de la zone : les nombres que
      // l'enfant a déjà vus.
      const strategy = getRemainderStrategy({ fact, remainder: introRemainder(fact.divisor) });
      return { kind: 'strategy', title: strategy.title, example: strategy.intro };
    }
    case 'conj': {
      const def = conjFactDef(fact.key);
      if (!def) return null;
      // Deux porteuses, deux exemples : « nous mangerons, nous regarderons ».
      const views = def.carriers.slice(0, 2).map((_, i) => resolveConjQuestion(def, i));
      switch (def.kind) {
        case 'ending': {
          // La règle que la séance affiche pour ce fait (piège du g et du c
          // d'abord), illustrée par les seules porteuses qu'elle couvre.
          const strategy = getConjStrategy(views[0]);
          const covered = views.filter((v) => getConjStrategy(v) === strategy).map((v) => v.label);
          return { kind: 'strategy', title: strategy.title, example: `${covered.join(', ')}.` };
        }
        case 'stem':
          return { kind: 'conjStem', tense: def.tense, verb: def.verb as string, examples: views.map((v) => v.label) };
        case 'irregular':
          return { kind: 'conjIrregular', label: views[0].label, sentence: views[0].sentence };
      }
    }
  }
}
