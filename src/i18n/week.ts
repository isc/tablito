import { formatList, useStrings, type Lang } from './lang';
import type { ConjTense } from '../types';
import type { HomeIdea } from '../lib/homeIdea';
import type { Trend } from '../lib/weekSummary';

// Strings du « point de la semaine » de l'espace parent (ParentWeekCard) et de
// l'idée pour aider à la maison, sous « À retravailler » (ParentHomeIdea). Les
// nombres arrivent déjà formatés (pourcentage, secondes) par les formats de
// l'espace parent, pour s'écrire partout pareil.

interface WeekStrings {
  title: string;
  note: string;
  noSession: string;
  days: (days: number) => string;
  daysVsBefore: (delta: number) => string;
  mathAccuracy: (percent: string) => string;
  conjAccuracy: (percent: string) => string;
  accuracyVsBefore: (trend: Trend, points: number) => string;
  speed: (seconds: string) => string;
  speedVsBefore: (trend: Trend, seconds: string) => string;
  promoted: (count: number) => string;
  discoveredToo: (count: number) => string;
  discovered: (count: number) => string;
  ideaHeading: string;
  idea: (idea: HomeIdea) => string;
}

// Les idées de conjugaison ne s'affichent qu'en français (matière fr-only) :
// leur version anglaise existe pour que la table reste totale.
const TENSE_INTRO_FR: Record<ConjTense, string> = {
  present: 'Au présent',
  imparfait: 'À l’imparfait',
  futur: 'Au futur',
};

const fr: WeekStrings = {
  title: 'Le point de la semaine',
  note: 'Les 7 derniers jours, comparés aux 7 jours d’avant.',
  noSession: 'Aucune séance ces 7 derniers jours',
  days: (days) => `${days} jour${days > 1 ? 's' : ''} sur 7`,
  daysVsBefore: (delta) =>
    delta === 0
      ? 'Autant que la semaine d’avant.'
      : `${Math.abs(delta)} de ${delta > 0 ? 'plus' : 'moins'} que la semaine d’avant.`,
  mathAccuracy: (percent) => `${percent} de bonnes réponses en maths`,
  conjAccuracy: (percent) => `${percent} de bonnes réponses en conjugaison`,
  accuracyVsBefore: (trend, points) => {
    if (trend === 'same') return 'Comme la semaine d’avant.';
    const n = Math.abs(points);
    return `${n} point${n > 1 ? 's' : ''} de ${trend === 'better' ? 'mieux' : 'moins'} que la semaine d’avant.`;
  },
  speed: (seconds) => `${seconds} par calcul`,
  speedVsBefore: (trend, seconds) =>
    trend === 'same'
      ? 'Aussi rapide que la semaine d’avant.'
      : trend === 'better'
        ? `Plus rapide de ${seconds} que la semaine d’avant.`
        : `${seconds} de plus que la semaine d’avant.`,
  promoted: (count) => `${count} fait${count > 1 ? 's ont' : ' a'} gagné une boîte`,
  discoveredToo: (count) =>
    `Et ${count} nouveau${count > 1 ? 'x ont été découverts' : ' a été découvert'}.`,
  discovered: (count) => `${count} nouveau${count > 1 ? 'x faits découverts' : ' fait découvert'}`,
  ideaHeading: 'Une idée pour l’aider',
  idea: (idea) => {
    switch (idea.kind) {
      case 'strategy':
        return `Rappelez-lui l’astuce vue dans Tablito\u00a0: «\u00a0${idea.title}\u00a0» Par exemple\u00a0: ${idea.example}.`;
      case 'double':
        return `× 2, c’est le double. Demandez-lui le double de ${idea.n}\u00a0: ${idea.n} + ${idea.n} = ${idea.n * 2}, donc 2 × ${idea.n} = ${idea.n * 2}.`;
      case 'oral':
        return `Posez-lui la question à l’oral, en voiture ou à table\u00a0: «\u00a0${idea.a} × ${idea.b}\u00a0?\u00a0» Quelques secondes, plusieurs fois dans la semaine, suffisent.`;
      case 'division':
        return `Transformez la division en question de table\u00a0: «\u00a0Dans ${idea.dividend}, combien de fois ${idea.divisor}\u00a0?\u00a0» La réponse se trouve dans la table de ${idea.divisor}.`;
      case 'remainder':
        return `Demandez-lui\u00a0: «\u00a0Dans ${idea.dividend}, combien de fois ${idea.divisor}\u00a0? Et combien reste-t-il\u00a0?\u00a0» Cherchez ensemble le plus grand nombre de la table de ${idea.divisor} qui ne dépasse pas ${idea.dividend}.`;
      case 'conjEnding': {
        const examples = `${idea.examples.join(', ')}.`;
        const rule =
          idea.tense === 'futur'
            ? `Au futur, on garde l’infinitif entier et on ajoute -${idea.ending} avec «\u00a0${idea.person}\u00a0»\u00a0: ${examples}`
            : idea.tense === 'present'
              ? `Au présent, les verbes en -er prennent -${idea.ending} avec «\u00a0${idea.person}\u00a0»\u00a0: ${examples}`
              : `${TENSE_INTRO_FR[idea.tense]}, la terminaison est toujours -${idea.ending} avec «\u00a0${idea.person}\u00a0»\u00a0: ${examples}`;
        return `${rule} Jouez à trouver d’autres verbes qui suivent la même règle.`;
      }
      case 'conjIrregular':
        return `«\u00a0${idea.label}\u00a0» ne suit pas la règle\u00a0: c’est une forme à retenir par cœur. Faites-la-lui employer dans une phrase, comme «\u00a0${idea.sentence}\u00a0»`;
      case 'conjStem':
        return `${TENSE_INTRO_FR[idea.tense]}, «\u00a0${idea.verb}\u00a0» change de radical\u00a0: ${idea.examples.join(', ')}. Les terminaisons, elles, restent celles de tous les verbes. Faites-lui réciter les autres personnes.`;
    }
  },
};

const TENSE_INTRO_EN: Record<ConjTense, string> = {
  present: 'In the present tense',
  imparfait: 'In the imperfect',
  futur: 'In the future tense',
};

const en: WeekStrings = {
  title: 'The week at a glance',
  note: 'The last 7 days, compared with the 7 days before.',
  noSession: 'No sessions in the last 7 days',
  days: (days) => `${days} day${days > 1 ? 's' : ''} out of 7`,
  daysVsBefore: (delta) =>
    delta === 0
      ? 'Same as the week before.'
      : `${Math.abs(delta)} ${delta > 0 ? 'more' : 'fewer'} than the week before.`,
  mathAccuracy: (percent) => `${percent} correct in math`,
  conjAccuracy: (percent) => `${percent} correct in conjugation`,
  accuracyVsBefore: (trend, points) => {
    if (trend === 'same') return 'Same as the week before.';
    const n = Math.abs(points);
    return `${n} point${n > 1 ? 's' : ''} ${trend === 'better' ? 'higher' : 'lower'} than the week before.`;
  },
  speed: (seconds) => `${seconds} per calculation`,
  speedVsBefore: (trend, seconds) =>
    trend === 'same'
      ? 'As fast as the week before.'
      : `${seconds} ${trend === 'better' ? 'faster' : 'slower'} than the week before.`,
  promoted: (count) => `${count} fact${count > 1 ? 's' : ''} moved up a box`,
  discoveredToo: (count) => `And ${count} new one${count > 1 ? 's' : ''} discovered.`,
  discovered: (count) => `${count} new fact${count > 1 ? 's' : ''} discovered`,
  ideaHeading: 'An idea to help',
  idea: (idea) => {
    switch (idea.kind) {
      case 'strategy':
        return `Remind them of the trick from Tablito: "${idea.title}" For example: ${idea.example}.`;
      case 'double':
        return `× 2 means doubling. Ask for double ${idea.n}: ${idea.n} + ${idea.n} = ${idea.n * 2}, so 2 × ${idea.n} = ${idea.n * 2}.`;
      case 'oral':
        return `Ask out loud, in the car or at dinner: "${idea.a} × ${idea.b}?" A few seconds, a few times a week, is enough.`;
      case 'division':
        return `Turn the division into a times-table question: "How many ${idea.divisor}s make ${idea.dividend}?" The answer is in the ${idea.divisor} times table.`;
      case 'remainder':
        return `Ask: "How many ${idea.divisor}s fit in ${idea.dividend}? And how many are left over?" Look together for the biggest number in the ${idea.divisor} times table that doesn't go over ${idea.dividend}.`;
      case 'conjEnding':
        return `${TENSE_INTRO_EN[idea.tense]}, "${idea.person}" takes -${idea.ending}: ${formatList(idea.examples, 'en')}.`;
      case 'conjIrregular':
        return `"${idea.label}" is irregular: it has to be learned by heart, for example in "${idea.sentence}"`;
      case 'conjStem':
        return `${TENSE_INTRO_EN[idea.tense]}, "${idea.verb}" changes its stem: ${formatList(idea.examples, 'en')}.`;
    }
  },
};

const weekStrings: Record<Lang, WeekStrings> = { fr, en };

export function useWeekStrings(): WeekStrings {
  return useStrings(weekStrings);
}
