import type { SessionResult, UserProfile } from '../types';
import { addDays } from './utils';

// « Le point de la semaine » de l'espace parent : ce que l'enfant a fait ces 7
// derniers jours, et comment ça se compare aux 7 d'avant. Fonction pure, pour
// un profil local comme pour un instantané suivi à distance.
//
// Une fenêtre glissante (aujourd'hui compris) plutôt que la semaine du
// calendrier : le mercredi, « 2 jours sur 3 » ne dirait rien. Le dimanche soir,
// quand part le recap hebdomadaire, les deux se confondent de toute façon.

export const WEEK_DAYS = 7;

export interface SubjectWeek {
  sessions: number;
  /** Bonnes réponses, en pourcentage entier. */
  accuracy: number;
  /** Écart avec la semaine d'avant, en points ; null sans comparaison juste. */
  accuracyDelta: number | null;
}

export interface MathWeek extends SubjectWeek {
  /** Temps moyen par calcul, en secondes, au dixième. */
  seconds: number;
  /** Écart avec la semaine d'avant (négatif : plus rapide) ; null sans comparaison juste. */
  secondsDelta: number | null;
}

export interface WeekSummary {
  /** Jours avec au moins une séance, sur les 7. */
  days: number;
  /** Écart avec la semaine d'avant ; null si l'enfant n'avait pas encore commencé. */
  daysDelta: number | null;
  math: MathWeek | null;
  conj: SubjectWeek | null;
  /** Faits montés d'une boîte pendant la semaine. */
  promoted: number;
  /** Faits découverts pendant la semaine. */
  discovered: number;
}

// Totaux d'un lot de séances. Le temps moyen de chaque séance est repondéré par
// son nombre de questions : une séance courte ne pèse pas autant qu'une longue.
function totals(sessions: SessionResult[]) {
  let questions = 0;
  let correct = 0;
  let timeMs = 0;
  for (const s of sessions) {
    questions += s.questionsCount;
    correct += s.correctCount;
    timeMs += s.averageTimeMs * s.questionsCount;
  }
  return { questions, correct, timeMs };
}

const percent = ({ questions, correct }: ReturnType<typeof totals>) =>
  Math.round((correct / questions) * 100);
const tenths = (n: number) => Math.round(n * 10) / 10;
const seconds = ({ questions, timeMs }: ReturnType<typeof totals>) => tenths(timeMs / questions / 1000);

// `compare` : la semaine d'avant a des séances comparables à celles-ci.
function subjectWeek(current: SessionResult[], previous: SessionResult[], compare: boolean): SubjectWeek | null {
  const now = totals(current);
  if (now.questions === 0) return null;
  return {
    sessions: current.length,
    accuracy: percent(now),
    // Écart entre les valeurs AFFICHÉES : « 83 % » et « 6 points de mieux »
    // doivent se lire ensemble, sans reste d'arrondi.
    accuracyDelta: compare ? percent(now) - percent(totals(previous)) : null,
  };
}

/**
 * Le point des 7 derniers jours (`today` compris), comparé aux 7 d'avant.
 * `withConj` : la conjugaison est visible (cf. isConjVisible) ; masquée, elle ne
 * compte nulle part, comme dans le bandeau d'activité.
 */
export function weekSummary(profile: UserProfile, today: string, withConj: boolean): WeekSummary {
  const start = addDays(today, -(WEEK_DAYS - 1));
  const previousStart = addDays(start, -WEEK_DAYS);
  const counted = profile.sessionHistory.filter((s) => withConj || s.kind !== 'conj');
  const current = counted.filter((s) => s.date >= start && s.date <= today);
  const previous = counted.filter((s) => s.date >= previousStart && s.date < start);

  const isMath = (s: SessionResult) => s.kind !== 'conj';
  const mathNow = current.filter(isMath);
  const mathBefore = previous.filter(isMath);
  // Une séance de maths porte le niveau en cours (×, ÷ ou avec reste). Un
  // niveau débloqué dans la fenêtre fausserait la comparaison — la division
  // avec reste est plus lente que les tables —, d'où une comparaison seulement
  // à niveau égal sur les deux semaines.
  const mathCompare =
    mathBefore.length > 0 && new Set([...mathNow, ...mathBefore].map((s) => s.kind)).size === 1;
  const mathBase = subjectWeek(mathNow, mathBefore, mathCompare);
  const math: MathWeek | null = mathBase && {
    ...mathBase,
    seconds: seconds(totals(mathNow)),
    secondsDelta: mathCompare ? tenths(seconds(totals(mathNow)) - seconds(totals(mathBefore))) : null,
  };

  const isConj = (s: SessionResult) => s.kind === 'conj';
  const conjBefore = previous.filter(isConj);
  const conj = subjectWeek(current.filter(isConj), conjBefore, conjBefore.length > 0);

  const days = new Set(current.map((s) => s.date)).size;
  const previousDays = new Set(previous.map((s) => s.date)).size;

  return {
    days,
    // Un enfant qui a commencé en cours de route n'a pas eu sept jours pour
    // pratiquer la semaine d'avant : comparer ses jours serait injuste.
    daysDelta: profile.startDate <= previousStart ? days - previousDays : null,
    math,
    conj,
    promoted: current.reduce((sum, s) => sum + s.factsPromoted, 0),
    discovered: current.reduce((sum, s) => sum + s.newFactsIntroduced, 0),
  };
}

export type Trend = 'better' | 'same' | 'worse';

/** Sous 3 points d'écart, la réussite est « comme la semaine d'avant ». */
export function accuracyTrend(delta: number): Trend {
  return Math.abs(delta) < 3 ? 'same' : delta > 0 ? 'better' : 'worse';
}

/** Sous 0,2 s d'écart par calcul, la rapidité est « comme la semaine d'avant ». */
export function speedTrend(delta: number): Trend {
  return Math.abs(delta) < 0.2 ? 'same' : delta < 0 ? 'better' : 'worse';
}
