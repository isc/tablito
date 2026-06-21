import type { UserProfile } from '../types';
import { daysBetween } from './utils';

// Gel de série : 1 gagné tous les 7 jours d'affilée, plafonné à 2 en réserve
// (pour borner le feature et éviter qu'un enfant régulier accumule
// indéfiniment une protection invisible). Un gel couvre 1 jour d'absence, et
// les gels se consomment un par jour manqué (modèle Duolingo) : 2 gels en
// réserve protègent donc 2 jours d'absence consécutifs. Au-delà du nombre de
// gels disponibles, la série casse.
export const STREAK_FREEZE_INTERVAL = 7;
export const STREAK_FREEZE_MAX = 2;

// Renvoie la série affichable à `today`. La valeur stockée
// (`profile.currentStreak`) est figée à la dernière séance complétée et ne
// décroît pas toute seule — sans cette dérivation, un utilisateur qui rate
// plusieurs jours voit toujours sa vieille série affichée jusqu'à ce qu'une
// nouvelle séance se termine. La série est « active » si la dernière séance
// date d'aujourd'hui/hier, OU si les jours manqués depuis sont couverts par
// autant de gels en réserve (la série est alors « protégée » : la prochaine
// séance d'aujourd'hui consommera les gels silencieusement et la fera repartir).
export function getActiveStreak(profile: UserProfile, today: string): number {
  if (!profile.lastSessionDate) return 0;
  const diff = daysBetween(profile.lastSessionDate, today);
  if (diff <= 1) return profile.currentStreak;
  const missedDays = diff - 1;
  if (profile.streakFreezes >= missedDays) return profile.currentStreak;
  return 0;
}

// Vrai si la série est encore là uniquement parce que des gels la protègent
// (= l'enfant a manqué au moins 1 jour, mais a assez de gels en réserve pour
// les couvrir). Utile pour signaler visuellement « tes gels vont te sauver si
// tu joues aujourd'hui ».
export function isStreakProtectedByFreeze(profile: UserProfile, today: string): boolean {
  if (!profile.lastSessionDate || profile.streakFreezes <= 0) return false;
  const missedDays = daysBetween(profile.lastSessionDate, today) - 1;
  return missedDays >= 1 && profile.streakFreezes >= missedDays;
}

export interface StreakUpdate {
  currentStreak: number;
  streakFreezes: number;
  freezeJustUsed: boolean;
  freezeJustEarned: boolean;
}

// Calcule l'évolution de la série + des gels suite à une séance complétée
// aujourd'hui. Fonction pure (testable isolément) ; le caller mettra à jour
// le profil et passera les flags au Recap pour les célébrer.
//
// Règles :
//   - même jour (diff=0) : aucun changement (séance bonus, pas de double comptage)
//   - +1 jour : série++ ; si la nouvelle série atteint un multiple de 7, +1 gel (cap 2)
//   - jours manqués couverts par autant de gels : 1 gel consommé par jour manqué,
//     série++ (comme si pas de trou) ; un nouveau gel peut être gagné au même tour
//     si on retombe sur un multiple de 7. Ex : 2 gels couvrent 2 jours manqués.
//   - jours manqués > gels disponibles : série repart à 1, gels conservés
//   - jamais joué : série = 1
export function applyStreakUpdate(profile: UserProfile, today: string): StreakUpdate {
  let currentStreak = profile.currentStreak;
  let streakFreezes = profile.streakFreezes;
  let freezeJustUsed = false;
  let freezeJustEarned = false;

  const previousLastSessionDate = profile.lastSessionDate;
  if (!previousLastSessionDate) {
    currentStreak = 1;
  } else {
    const diff = daysBetween(previousLastSessionDate, today);
    if (diff === 0) {
      // Séance multiple le même jour : on ne touche à rien.
      return { currentStreak, streakFreezes, freezeJustUsed, freezeJustEarned };
    }
    const missedDays = diff - 1;
    if (diff === 1) {
      currentStreak += 1;
    } else if (streakFreezes >= missedDays) {
      // Jours manqués entièrement couverts : 1 gel consommé par jour manqué.
      streakFreezes -= missedDays;
      freezeJustUsed = true;
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }
  }

  if (
    currentStreak > 0 &&
    currentStreak % STREAK_FREEZE_INTERVAL === 0 &&
    streakFreezes < STREAK_FREEZE_MAX
  ) {
    streakFreezes += 1;
    freezeJustEarned = true;
  }

  return { currentStreak, streakFreezes, freezeJustUsed, freezeJustEarned };
}
