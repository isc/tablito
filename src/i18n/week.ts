import { useStrings, type Lang } from './lang';
import type { Trend } from '../lib/weekSummary';

// Strings du « point de la semaine » de l'espace parent (ParentWeekCard). Les
// nombres arrivent déjà formatés (pourcentage, secondes) par les formats de
// l'espace parent, pour s'écrire partout pareil ; chaque comparaison reçoit son
// sens (cf. lib/weekSummary) et l'écart, en valeur absolue.

interface WeekStrings {
  title: string;
  note: string;
  noSession: string;
  days: (days: number) => string;
  daysVsBefore: (trend: Trend, days: number) => string;
  mathAccuracy: (percent: string) => string;
  conjAccuracy: (percent: string) => string;
  accuracyVsBefore: (trend: Trend, points: number) => string;
  speed: (seconds: string) => string;
  speedVsBefore: (trend: Trend, seconds: string) => string;
  promoted: (count: number) => string;
  discoveredToo: (count: number) => string;
  discovered: (count: number) => string;
}

const fr: WeekStrings = {
  title: 'Le point de la semaine',
  note: 'Les 7 derniers jours, comparés aux 7 jours d’avant.',
  noSession: 'Aucune séance ces 7 derniers jours',
  days: (days) => `${days} jour${days > 1 ? 's' : ''} sur 7`,
  daysVsBefore: (trend, days) =>
    trend === 'same'
      ? 'Autant que la semaine d’avant.'
      : `${days} de ${trend === 'better' ? 'plus' : 'moins'} que la semaine d’avant.`,
  mathAccuracy: (percent) => `${percent} de bonnes réponses en maths`,
  conjAccuracy: (percent) => `${percent} de bonnes réponses en conjugaison`,
  accuracyVsBefore: (trend, points) =>
    trend === 'same'
      ? 'Comme la semaine d’avant.'
      : `${points} point${points > 1 ? 's' : ''} de ${trend === 'better' ? 'mieux' : 'moins'} que la semaine d’avant.`,
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
};

const en: WeekStrings = {
  title: 'The week at a glance',
  note: 'The last 7 days, compared with the 7 days before.',
  noSession: 'No sessions in the last 7 days',
  days: (days) => `${days} day${days > 1 ? 's' : ''} out of 7`,
  daysVsBefore: (trend, days) =>
    trend === 'same'
      ? 'Same as the week before.'
      : `${days} ${trend === 'better' ? 'more' : 'fewer'} than the week before.`,
  mathAccuracy: (percent) => `${percent} correct in math`,
  conjAccuracy: (percent) => `${percent} correct in conjugation`,
  accuracyVsBefore: (trend, points) =>
    trend === 'same'
      ? 'Same as the week before.'
      : `${points} point${points > 1 ? 's' : ''} ${trend === 'better' ? 'higher' : 'lower'} than the week before.`,
  speed: (seconds) => `${seconds} per calculation`,
  speedVsBefore: (trend, seconds) =>
    trend === 'same'
      ? 'As fast as the week before.'
      : `${seconds} ${trend === 'better' ? 'faster' : 'slower'} than the week before.`,
  promoted: (count) => `${count} fact${count > 1 ? 's' : ''} moved up a box`,
  discoveredToo: (count) => `And ${count} new one${count > 1 ? 's' : ''} discovered.`,
  discovered: (count) => `${count} new fact${count > 1 ? 's' : ''} discovered`,
};

const weekStrings: Record<Lang, WeekStrings> = { fr, en };

export function useWeekStrings(): WeekStrings {
  return useStrings(weekStrings);
}
