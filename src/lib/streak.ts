import type { UserProfile } from '../types';
import { addDays, daysBetween } from './utils';

// Gel de série : 1 gagné tous les 7 jours d'affilée, plafonné à 2 en réserve
// (pour borner le feature et éviter qu'un enfant régulier accumule
// indéfiniment une protection invisible). Un gel couvre 1 jour d'absence, et
// les gels se consomment un par jour manqué (modèle Duolingo) : 2 gels en
// réserve protègent donc 2 jours d'absence consécutifs. Au-delà, la série
// casse — et les gels dépensés en chemin le restent (cf. settleStreak).
export const STREAK_FREEZE_INTERVAL = 7;
export const STREAK_FREEZE_MAX = 2;

export interface StreakSettlement {
  currentStreak: number;
  streakFreezes: number;
  // Dernier jour d'absence déjà payé (null tant qu'aucun jour n'a été manqué
  // depuis la dernière séance).
  freezeSettledDate: string | null;
  // Jours entiers écoulés depuis la dernière séance sans séance (0 si la
  // dernière séance est d'aujourd'hui ou d'hier). Évite aux lecteurs de
  // recalculer leur propre `daysBetween`.
  missedDays: number;
  // Vrai si ce règlement change l'état du profil — le caller doit persister.
  changed: boolean;
}

// Projette un règlement sur le profil : ce que le caller persiste.
export function applySettlement(profile: UserProfile, s: StreakSettlement): UserProfile {
  return {
    ...profile,
    currentStreak: s.currentStreak,
    streakFreezes: s.streakFreezes,
    freezeSettledDate: s.freezeSettledDate,
  };
}

// Règle les jours d'absence ÉCOULÉS : chaque jour manqué non encore payé
// consomme un gel tout de suite, et à défaut de gel la série tombe à 0.
//
// Le débit a lieu au jour manqué (au chargement de l'app), pas à la séance
// suivante : sinon le compteur affiche une réserve intacte à côté d'un message
// disant qu'un gel protège déjà la série — incohérence remontée en feedback le
// 22/08/2026. `freezeSettledDate` mémorise jusqu'où on a payé, sans quoi
// chaque chargement redébiterait les mêmes jours.
//
// Fonction pure et IDEMPOTENTE : la rappeler le même jour ne change rien.
export function settleStreak(profile: UserProfile, today: string): StreakSettlement {
  const currentStreak = profile.currentStreak;
  const streakFreezes = profile.streakFreezes;
  const freezeSettledDate = profile.freezeSettledDate ?? null;
  // Jours entiers écoulés sans séance : la journée en cours reste rattrapable,
  // donc jamais comptée. `daysBetween` peut être négatif si l'horloge recule
  // (voyage vers l'ouest, réglage manuel) — d'où le plancher à 0.
  const missedDays = profile.lastSessionDate
    ? Math.max(0, daysBetween(profile.lastSessionDate, today) - 1)
    : 0;
  const unchanged = {
    currentStreak,
    streakFreezes,
    freezeSettledDate,
    missedDays,
    changed: false,
  };

  // Série déjà cassée (ou jamais commencée) : plus rien à protéger, donc plus
  // aucun gel à débiter — sans ce garde-fou, une longue absence après une
  // casse viderait la réserve pour rien.
  if (!profile.lastSessionDate || currentStreak <= 0) return unchanged;

  // Jours manqués pas encore facturés (`freezeSettledDate` = dernier jour payé).
  const paidDays = freezeSettledDate
    ? Math.max(0, daysBetween(profile.lastSessionDate, freezeSettledDate))
    : 0;
  const unpaid = missedDays - paidDays;
  if (unpaid <= 0) return unchanged;

  // Les gels se consomment jour après jour jusqu'à épuisement, puis la série
  // casse. On débite donc AUSSI quand la couverture est insuffisante : sans
  // ça, le solde final dépendrait du fait d'avoir ouvert l'app pendant
  // l'absence (règlement au fil de l'eau = réserve vidée) ou non (règlement en
  // un bloc = réserve intacte).
  const spent = Math.min(unpaid, streakFreezes);
  return {
    currentStreak: streakFreezes < unpaid ? 0 : currentStreak,
    streakFreezes: streakFreezes - spent,
    freezeSettledDate: addDays(today, -1),
    missedDays,
    changed: true,
  };
}

// Renvoie la série affichable à `today`. La valeur stockée
// (`profile.currentStreak`) est figée à la dernière séance complétée et ne
// décroît pas toute seule — sans cette dérivation, un utilisateur qui rate
// plusieurs jours voit toujours sa vieille série affichée jusqu'à ce que le
// règlement passe. La série est « active » si la dernière séance date
// d'aujourd'hui/hier, OU si les jours manqués depuis ont été couverts par
// autant de gels (la série est alors « protégée » : elle repart dès la
// prochaine séance).
export function getActiveStreak(profile: UserProfile, today: string): number {
  return settleStreak(profile, today).currentStreak;
}

// Vrai si la série est encore là uniquement parce que des gels l'ont protégée
// (= l'enfant a manqué au moins 1 jour, et les gels ont couvert). Utile pour
// signaler visuellement « un gel a sauvé ta série, joue aujourd'hui ».
// Ne regarde plus la réserve : après règlement les gels sont déjà partis, et
// « série vivante malgré un trou » implique qu'ils ont fait leur travail.
export function isStreakProtectedByFreeze(profile: UserProfile, today: string): boolean {
  const settled = settleStreak(profile, today);
  return settled.missedDays >= 1 && settled.currentStreak > 0;
}

export interface StreakUpdate extends Omit<StreakSettlement, 'missedDays' | 'changed'> {
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
//   - jours manqués couverts par autant de gels : série++ (comme si pas de trou).
//     Les gels ont déjà été débités par `settleStreak` au jour manqué — le
//     règlement est refait ici pour couvrir l'app laissée ouverte à travers
//     minuit, où aucun chargement n'a eu lieu entre-temps.
//   - jours manqués > gels disponibles : série repart à 1, réserve épuisée
//   - jamais joué : série = 1
export function applyStreakUpdate(profile: UserProfile, today: string): StreakUpdate {
  const settled = settleStreak(profile, today);
  let currentStreak = settled.currentStreak;
  let streakFreezes = settled.streakFreezes;
  let freezeJustEarned = false;

  // Séance multiple le même jour : on ne touche à rien.
  if (profile.lastSessionDate === today) {
    return {
      currentStreak,
      streakFreezes,
      freezeSettledDate: settled.freezeSettledDate,
      freezeJustUsed: false,
      freezeJustEarned: false,
    };
  }

  // Des gels ont couvert le trou (peu importe QUAND ils ont été débités) :
  // il y a eu au moins un jour manqué et la série a survécu.
  const freezeJustUsed = settled.missedDays >= 1 && currentStreak > 0;

  // `currentStreak === 0` = série cassée (jamais jouée, ou règlement à sec).
  currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;

  if (currentStreak % STREAK_FREEZE_INTERVAL === 0 && streakFreezes < STREAK_FREEZE_MAX) {
    streakFreezes += 1;
    freezeJustEarned = true;
  }

  // La séance d'aujourd'hui solde l'ardoise : plus aucun jour manqué en attente.
  return {
    currentStreak,
    streakFreezes,
    freezeSettledDate: null,
    freezeJustUsed,
    freezeJustEarned,
  };
}
