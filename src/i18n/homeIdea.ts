import { useStrings, type Lang } from './lang';
import { tenseFr } from './tense';
import type { HomeIdea } from '../lib/homeIdea';
import { IRR_FAMILY_HINTS } from './irregular';

// Strings de l'idée pour aider à la maison, sous « À retravailler » de
// l'accueil de l'espace parent (ParentHomeIdea). L'essentiel du texte vient
// des stratégies de séance (cf. lib/homeIdea) : ce module ne fait que
// l'encadrer.

interface HomeIdeaStrings {
  heading: string;
  idea: (idea: HomeIdea) => string;
}

// « × 9, c’est comme × 10 mais on enlève une fois. » devient une proposition
// citée après deux-points : minuscule initiale, sans point final.
const quoted = (title: string) => `${title.charAt(0).toLowerCase()}${title.slice(1)}`.replace(/\.$/, '');

const fr: HomeIdeaStrings = {
  heading: 'Une idée pour l’aider',
  idea: (idea) => {
    switch (idea.kind) {
      case 'strategy':
        return `Rappelez-lui ce que Tablito lui apprend\u00a0: ${quoted(idea.title)}. Par exemple\u00a0: ${idea.example}`;
      case 'double':
        return `× 2, c’est le double. Demandez-lui le double de ${idea.n}\u00a0: ${idea.n} + ${idea.n} = ${idea.n * 2}, donc 2 × ${idea.n} = ${idea.n * 2}.`;
      case 'oral':
        return `Posez-lui la question à l’oral, en voiture ou à table\u00a0: «\u00a0${idea.a} × ${idea.b}\u00a0?\u00a0» Quelques secondes, plusieurs fois dans la semaine, suffisent.`;
      case 'conjIrregular':
        return `«\u00a0${idea.label}\u00a0» ne suit pas la règle\u00a0: c’est une forme à retenir par cœur. Faites-la-lui employer dans une phrase, comme «\u00a0${idea.sentence}\u00a0»`;
      case 'conjStem': {
        const at = tenseFr(idea.tense, 'à');
        return `${at.charAt(0).toUpperCase()}${at.slice(1)}, «\u00a0${idea.verb}\u00a0» change de radical\u00a0: ${idea.examples.join(', ')}. Les terminaisons, elles, restent celles de tous les verbes. Faites-lui réciter les autres personnes.`;
      }
      case 'irrRecite': {
        const hint = idea.family === 'unique' ? '' : ` Astuce de Tablito\u00a0: ${IRR_FAMILY_HINTS[idea.family].charAt(0).toLowerCase()}${IRR_FAMILY_HINTS[idea.family].slice(1)}`;
        return `Faites-lui réciter le verbe à voix haute, en anglais\u00a0: «\u00a0${idea.recitation}\u00a0». Le dire aide à le retenir.${hint}`;
      }
    }
  },
};

const en: HomeIdeaStrings = {
  heading: 'An idea to help',
  idea: (idea) => {
    switch (idea.kind) {
      case 'strategy':
        return `Remind them of what Tablito teaches: ${quoted(idea.title)}. For example: ${idea.example}`;
      case 'double':
        return `× 2 means doubling. Ask for double ${idea.n}: ${idea.n} + ${idea.n} = ${idea.n * 2}, so 2 × ${idea.n} = ${idea.n * 2}.`;
      case 'oral':
        return `Ask out loud, in the car or at dinner: "${idea.a} × ${idea.b}?" A few seconds, a few times a week, is enough.`;
      // Conjugaison et verbes irréguliers sont masqués en anglais : leurs idées
      // ne s'affichent jamais ici, et une traduction serait du texte mort.
      case 'conjIrregular':
      case 'conjStem':
      case 'irrRecite':
        return fr.idea(idea);
    }
  },
};

const homeIdeaStrings: Record<Lang, HomeIdeaStrings> = { fr, en };

export function useHomeIdeaStrings(): HomeIdeaStrings {
  return useStrings(homeIdeaStrings);
}
