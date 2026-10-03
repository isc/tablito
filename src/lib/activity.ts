import type { UserProfile } from '../types';
import { addDays } from './utils';
import { LAST_SESSION_DATE_FIELD, subjectOf, type Subject } from './hardestFacts';

// Fenêtre du bandeau d'activité de l'espace parent : deux semaines pleines,
// donc deux fois chaque jour de la semaine — assez pour qu'un « il ne fait
// jamais rien le week-end » saute aux yeux, assez court pour tenir en 14
// colonnes sur un écran de téléphone.
export const ACTIVITY_WINDOW_DAYS = 14;

export interface ActivityDay {
  date: string;
  // Séance de maths faite ce jour-là. Une matière ne peut être faite qu'UNE
  // fois par jour (App.tsx ferme la journée sur `lastMathSessionDate` /
  // `lastConjSessionDate`), d'où des booléens et non des compteurs.
  math: boolean;
  // `null` = la conjugaison n'existait pas encore pour cet enfant ce jour-là.
  // Sans cette troisième valeur, les jours antérieurs à l'ouverture de la
  // matière s'afficheraient comme des jours manqués — un reproche pour une
  // matière que l'enfant n'avait pas.
  conj: boolean | null;
  // Verbes irréguliers anglais (specs §16) : même règle, même `null`.
  irr: boolean | null;
}

// Reconstruit la fenêtre (le dernier jour étant `today`) depuis l'historique
// des séances. Fonction pure : elle sert aussi bien au profil local qu'à un
// instantané suivi à distance.
export function buildActivityDays(profile: UserProfile, today: string): ActivityDay[] {
  const days: Record<Subject, Set<string>> = { math: new Set(), conj: new Set(), irr: new Set() };
  const first: Partial<Record<Subject, string>> = {};
  for (const session of profile.sessionHistory) {
    const subject = subjectOf(session);
    days[subject].add(session.date);
    // L'historique est append-only chronologique : la première rencontrée est
    // la plus ancienne.
    first[subject] ??= session.date;
  }

  // Borne d'ouverture d'une matière (conjugaison, verbes). Le profil ne
  // mémorise que le booléen `hasSeen…Intro`, jamais la date : la première
  // séance de la matière dans l'historique en est la meilleure approximation
  // disponible.
  //
  // Le repli sur la date de dernière séance de la matière n'est pas décoratif :
  // l'historique est plafonné à 50 séances (App `handleSessionComplete`), donc
  // un enfant qui fait ses maths tous les jours finit par n'y avoir PLUS AUCUNE
  // séance de conjugaison — et sans ce repli la ligne s'effacerait juste au
  // moment où elle a quelque chose à dire (matière abandonnée). Cette date-là,
  // elle, n'est jamais rognée, et un jour où la matière a été faite est
  // forcément postérieur à son ouverture.
  const openedFrom = (subject: 'conj' | 'irr') =>
    first[subject] ?? profile[LAST_SESSION_DATE_FIELD[subject]] ?? today;
  const conjOpenedFrom = openedFrom('conj');
  const irrOpenedFrom = openedFrom('irr');

  const out: ActivityDay[] = [];
  for (let i = ACTIVITY_WINDOW_DAYS - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    out.push({
      date,
      math: days.math.has(date),
      conj: date < conjOpenedFrom ? null : days.conj.has(date),
      irr: date < irrOpenedFrom ? null : days.irr.has(date),
    });
  }
  return out;
}
