import type { SessionResult, UserProfile } from '../types';
import { sessionsOfSubject, type Subject } from './hardestFacts';
import { addDays } from './utils';

// « Le point de la semaine » de l'espace parent : ce que l'enfant a fait ces 7
// derniers jours, et comment ça se compare aux 7 d'avant. Fonction pure, pour
// un profil local comme pour un instantané suivi à distance.
//
// Une fenêtre glissante (aujourd'hui compris) plutôt que la semaine du
// calendrier : le mercredi, « 2 jours sur 3 » ne dirait rien. Le dimanche soir,
// quand part le recap hebdomadaire, les deux se confondent de toute façon.

const WEEK_DAYS = 7;

// Écarts négligeables : sous 1 jour, 3 points de réussite ou 0,2 s par calcul,
// la semaine est « comme la semaine d'avant ».
const SAME_DAYS = 1;
const SAME_ACCURACY = 3;
const SAME_SECONDS = 0.2;

export type Trend = 'better' | 'same' | 'worse';

/** Écart avec la semaine d'avant, et son sens. */
export interface Versus {
  delta: number;
  trend: Trend;
}

export interface SubjectWeek {
  /** Bonnes réponses, en pourcentage entier. */
  accuracy: number;
  /** null sans comparaison juste. */
  accuracyVs: Versus | null;
}

export interface MathWeek extends SubjectWeek {
  /** Temps moyen par calcul, en secondes, au dixième. */
  seconds: number;
  secondsVs: Versus | null;
}

export interface WeekSummary {
  /** Jours avec au moins une séance, sur les 7. */
  days: number;
  /** null si l'enfant n'avait pas encore commencé la semaine d'avant. */
  daysVs: Versus | null;
  math: MathWeek | null;
  conj: SubjectWeek | null;
  /** Faits montés d'une boîte pendant la semaine. */
  promoted: number;
  /** Faits découverts pendant la semaine. */
  discovered: number;
}

// Un écart sous `same` ne change rien ; au-delà, son signe dit si c'est un
// progrès — à l'envers pour un temps, où moins est mieux.
function versus(delta: number, same: number, lowerIsBetter = false): Versus {
  const gain = lowerIsBetter ? -delta : delta;
  return { delta, trend: Math.abs(delta) < same ? 'same' : gain > 0 ? 'better' : 'worse' };
}

interface Totals {
  questions: number;
  correct: number;
  timeMs: number;
}

// Le temps moyen de chaque séance est repondéré par son nombre de questions :
// une séance courte ne pèse pas autant qu'une longue.
function totals(sessions: SessionResult[]): Totals {
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

const percent = (t: Totals) => Math.round((t.correct / t.questions) * 100);
const tenths = (n: number) => Math.round(n * 10) / 10;
const seconds = (t: Totals) => tenths(t.timeMs / t.questions / 1000);

// `before` : la semaine d'avant, quand la comparaison est juste. Les écarts
// portent sur les valeurs AFFICHÉES : « 83 % » et « 6 points de mieux »
// doivent se lire ensemble, sans reste d'arrondi.
function subjectWeek(now: Totals, before: Totals | null): SubjectWeek {
  const accuracy = percent(now);
  return { accuracy, accuracyVs: before && versus(accuracy - percent(before), SAME_ACCURACY) };
}

/**
 * Le point des 7 derniers jours (`today` compris), comparé aux 7 d'avant, sur
 * les matières visibles (cf. getHardestFactsAcross) ; null tant qu'aucune
 * séance de ces matières n'existe.
 */
export function weekSummary(profile: UserProfile, today: string, subjects: Subject[]): WeekSummary | null {
  const bySubject = (subject: Subject) =>
    subjects.includes(subject) ? sessionsOfSubject(profile.sessionHistory, subject) : [];
  const math = bySubject('math');
  const conj = bySubject('conj');
  if (math.length + conj.length === 0) return null;

  const start = addDays(today, -(WEEK_DAYS - 1));
  const previousStart = addDays(start, -WEEK_DAYS);
  const thisWeek = (s: SessionResult) => s.date >= start && s.date <= today;
  const weekBefore = (s: SessionResult) => s.date >= previousStart && s.date < start;
  const [mathNow, mathBefore] = [math.filter(thisWeek), math.filter(weekBefore)];
  const [conjNow, conjBefore] = [conj.filter(thisWeek), conj.filter(weekBefore)];
  const now = [...mathNow, ...conjNow];
  const days = new Set(now.map((s) => s.date)).size;
  const previousDays = new Set([...mathBefore, ...conjBefore].map((s) => s.date)).size;

  // Une séance de maths porte le niveau en cours (×, ÷ ou avec reste). Un
  // niveau débloqué dans la fenêtre fausserait la comparaison — la division
  // avec reste est plus lente que les tables —, d'où une comparaison seulement
  // à niveau égal sur les deux semaines.
  const mathTotals = totals(mathNow);
  const mathBaseline =
    mathBefore.length > 0 && new Set([...mathNow, ...mathBefore].map((s) => s.kind)).size === 1
      ? totals(mathBefore)
      : null;
  const conjTotals = totals(conjNow);

  return {
    days,
    // Un enfant qui a commencé en cours de route n'a pas eu sept jours pour
    // pratiquer la semaine d'avant : comparer ses jours serait injuste.
    daysVs: profile.startDate <= previousStart ? versus(days - previousDays, SAME_DAYS) : null,
    math:
      mathTotals.questions === 0
        ? null
        : {
            ...subjectWeek(mathTotals, mathBaseline),
            seconds: seconds(mathTotals),
            secondsVs:
              mathBaseline && versus(tenths(seconds(mathTotals) - seconds(mathBaseline)), SAME_SECONDS, true),
          },
    conj:
      conjTotals.questions === 0
        ? null
        : subjectWeek(conjTotals, conjBefore.length > 0 ? totals(conjBefore) : null),
    promoted: now.reduce((sum, s) => sum + s.factsPromoted, 0),
    discovered: now.reduce((sum, s) => sum + s.newFactsIntroduced, 0),
  };
}
