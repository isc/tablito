import type { UserProfile } from '../types';
import { addDays } from './utils';

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
}

// Reconstruit la fenêtre (le dernier jour étant `today`) depuis l'historique
// des séances. Fonction pure : elle sert aussi bien au profil local qu'à un
// instantané suivi à distance.
export function buildActivityDays(profile: UserProfile, today: string): ActivityDay[] {
  const mathDays = new Set<string>();
  const conjDays = new Set<string>();
  let firstConjDate: string | null = null;
  for (const session of profile.sessionHistory) {
    if (session.kind === 'conj') {
      conjDays.add(session.date);
      // L'historique est append-only chronologique : la première rencontrée
      // est la plus ancienne.
      firstConjDate ??= session.date;
    } else {
      mathDays.add(session.date);
    }
  }

  // Borne d'ouverture de la matière. Le profil ne mémorise que le booléen
  // `hasSeenConjIntro`, jamais la date : la première séance de conjugaison de
  // l'historique en est la meilleure approximation disponible.
  //
  // Le repli sur `lastConjSessionDate` n'est pas décoratif : l'historique est
  // plafonné à 50 séances (App `handleSessionComplete`), donc un enfant qui
  // fait ses maths tous les jours finit par n'y avoir PLUS AUCUNE séance de
  // conjugaison — et sans ce repli la ligne s'effacerait juste au moment où
  // elle a quelque chose à dire (matière abandonnée). Cette date-là, elle,
  // n'est jamais rognée, et un jour où la conjugaison a été faite est
  // forcément postérieur à son ouverture.
  const conjOpenedFrom = firstConjDate ?? profile.lastConjSessionDate ?? today;

  const out: ActivityDay[] = [];
  for (let i = ACTIVITY_WINDOW_DAYS - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    out.push({
      date,
      math: mathDays.has(date),
      conj: date < conjOpenedFrom ? null : conjDays.has(date),
    });
  }
  return out;
}
