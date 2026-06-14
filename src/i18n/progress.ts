import { useStrings } from './lang';

// Strings des écrans/composants « Progression & Badges » (ProgressScreen,
// BadgesScreen, Badge, BadgeDetailModal, LeitnerGrid, StreakDetailModal,
// Mascot, grilles de progression/mystère). Même pattern que voice.ts : un
// dico `fr` source, un `en` contraint à la même forme via une interface
// explicite (pour typer les fonctions d'interpolation), et un hook
// `useXStrings()` par composant.
//
// ⚠️ Les NOMS / DESCRIPTIONS / textes de condition des badges viennent déjà
// localisés de ../lib/badges — on ne les retraduit pas ici, on ne localise
// que l'UI qui les entoure.

// === ProgressScreen ===

interface ProgressScreenStrings {
  back: string;
  myPictures: string;
  myMysteryPicture: string;
  multiplications: string;
  divisions: string;
  discoveredMult: string;
  discoveredDiv: string;
  masteredMult: string;
  masteredDiv: string;
  total: string;
  legendMult: string;
  legendDiv: string;
}

const progressScreenFr: ProgressScreenStrings = {
  back: 'Retour',
  myPictures: 'Mes images',
  myMysteryPicture: 'Mon image mystère',
  multiplications: 'Multiplications',
  divisions: 'Divisions',
  discoveredMult: 'découverts',
  discoveredDiv: 'découvertes',
  masteredMult: 'maîtrisés',
  masteredDiv: 'maîtrisées',
  total: 'au total',
  legendMult:
    "Chaque multiplication que tu connais mieux dévoile un peu plus de l'image. Quand tu les maîtrises toutes, l'image est complète !",
  legendDiv:
    "Chaque division que tu connais mieux dévoile un peu plus de cette image. Quand tu les maîtrises toutes, elle est complète !",
};

const progressScreenEn: ProgressScreenStrings = {
  back: 'Back',
  myPictures: 'My pictures',
  myMysteryPicture: 'My mystery picture',
  multiplications: 'Multiplications',
  divisions: 'Divisions',
  discoveredMult: 'discovered',
  discoveredDiv: 'discovered',
  masteredMult: 'mastered',
  masteredDiv: 'mastered',
  total: 'in total',
  legendMult:
    'Every multiplication you know better reveals a bit more of the picture. When you master them all, the picture is complete!',
  legendDiv:
    'Every division you know better reveals a bit more of this picture. When you master them all, it is complete!',
};

export const progressScreenStrings = { fr: progressScreenFr, en: progressScreenEn };

export function useProgressScreenStrings(): ProgressScreenStrings {
  return useStrings(progressScreenStrings);
}

// === BadgesScreen ===

interface BadgesScreenStrings {
  back: string;
  myBadges: string;
  collection: string;
  badges: string;
}

const badgesScreenFr: BadgesScreenStrings = {
  back: 'Retour',
  myBadges: 'Mes badges',
  collection: 'Collection',
  badges: 'badges',
};

const badgesScreenEn: BadgesScreenStrings = {
  back: 'Back',
  myBadges: 'My badges',
  collection: 'Collection',
  badges: 'badges',
};

export const badgesScreenStrings = { fr: badgesScreenFr, en: badgesScreenEn };

export function useBadgesScreenStrings(): BadgesScreenStrings {
  return useStrings(badgesScreenStrings);
}

// === Badge (médaillon) ===
// Les fonctions reçoivent le nom du badge (déjà localisé par lib/badges).

interface BadgeStrings {
  earnedLabel: (name: string) => string;
  lockedWithProgressLabel: (name: string, percent: number) => string;
  lockedLabel: (name: string) => string;
  dateLocale: string;
}

const badgeFr: BadgeStrings = {
  earnedLabel: (name) => `${name}, débloqué — voir les détails`,
  lockedWithProgressLabel: (name, percent) =>
    `${name}, verrouillé, progression ${percent}% — voir comment le débloquer`,
  lockedLabel: (name) => `${name}, verrouillé — voir comment le débloquer`,
  dateLocale: 'fr-FR',
};

const badgeEn: BadgeStrings = {
  earnedLabel: (name) => `${name}, unlocked — see details`,
  lockedWithProgressLabel: (name, percent) =>
    `${name}, locked, progress ${percent}% — see how to unlock it`,
  lockedLabel: (name) => `${name}, locked — see how to unlock it`,
  dateLocale: 'en-US',
};

export const badgeStrings = { fr: badgeFr, en: badgeEn };

export function useBadgeStrings(): BadgeStrings {
  return useStrings(badgeStrings);
}

// === BadgeDetailModal ===

interface BadgeDetailStrings {
  hintNotStarted: string;
  hintOneLeft: string;
  hintFewLeft: (remaining: number) => string;
  hintMoreLeft: (remaining: number) => string;
  callToAction: string;
  unlockedOn: (date: string) => string;
  close: string;
  dateLocale: string;
}

const badgeDetailFr: BadgeDetailStrings = {
  hintNotStarted: 'Tu n’as pas encore commencé celui-ci. À toi de jouer !',
  hintOneLeft: 'Plus qu’un seul ! Tu y es presque.',
  hintFewLeft: (remaining) => `Plus que ${remaining} ! Tu y es presque.`,
  hintMoreLeft: (remaining) => `Encore ${remaining} pour le débloquer.`,
  callToAction: 'À toi de jouer !',
  unlockedOn: (date) => `Débloqué le ${date}`,
  close: 'Fermer',
  dateLocale: 'fr-FR',
};

const badgeDetailEn: BadgeDetailStrings = {
  hintNotStarted: "You haven't started this one yet. Give it a go!",
  hintOneLeft: "Just one more! You're almost there.",
  hintFewLeft: (remaining) => `Just ${remaining} more! You're almost there.`,
  hintMoreLeft: (remaining) => `${remaining} more to unlock it.`,
  callToAction: 'Give it a go!',
  unlockedOn: (date) => `Unlocked on ${date}`,
  close: 'Close',
  dateLocale: 'en-US',
};

export const badgeDetailStrings = { fr: badgeDetailFr, en: badgeDetailEn };

export function useBadgeDetailStrings(): BadgeDetailStrings {
  return useStrings(badgeDetailStrings);
}

// === LeitnerGrid (modale détail d'un fait) ===
// Le libellé du niveau (boxLevelLabel) vient déjà localisé de lib/leitner.

interface LeitnerGridStrings {
  level: (label: string) => string;
  correctAnswers: (correct: number, total: number) => string;
  notPracticedYet: string;
  close: string;
}

const leitnerGridFr: LeitnerGridStrings = {
  level: (label) => `Niveau : ${label}`,
  correctAnswers: (correct, total) => `${correct}/${total} bonnes réponses`,
  notPracticedYet: 'Pas encore pratiqué',
  close: 'Fermer',
};

const leitnerGridEn: LeitnerGridStrings = {
  level: (label) => `Level: ${label}`,
  correctAnswers: (correct, total) => `${correct}/${total} correct answers`,
  notPracticedYet: 'Not practiced yet',
  close: 'Close',
};

export const leitnerGridStrings = { fr: leitnerGridFr, en: leitnerGridEn };

export function useLeitnerGridStrings(): LeitnerGridStrings {
  return useStrings(leitnerGridStrings);
}

// === StreakDetailModal ===

interface StreakDetailStrings {
  titleActive: (streak: number) => string;
  titleInactive: string;
  explanationInactive: string;
  explanationFreeze: string;
  explanationDoneToday: string;
  explanationActive: string;
  recordLabel: string;
  recordValue: (record: number) => string;
  noFreezes: string;
  freezesCount: (freezes: number) => string;
  freezeExplanation: (interval: number) => string;
  close: string;
}

const streakDetailFr: StreakDetailStrings = {
  titleActive: (streak) => `${streak} ${streak === 1 ? 'jour' : 'jours'} d’affilée`,
  titleInactive: 'Lance une nouvelle série !',
  explanationInactive:
    'Ta série de jours d’affilée est à zéro. Tes progrès sur les multiplications sont conservés : joue aujourd’hui pour repartir.',
  explanationFreeze:
    'Tu n’as pas joué hier, mais un de tes gels protège ta série. Joue aujourd’hui pour le consommer et la prolonger.',
  explanationDoneToday:
    'Bravo, ta séance d’aujourd’hui est faite ! Reviens demain pour faire +1.',
  explanationActive:
    'Ta série est encore active. N’oublie pas de faire ta séance aujourd’hui pour la prolonger — sinon elle repartira à zéro demain.',
  recordLabel: 'Ton record',
  recordValue: (record) => `${record} ${record === 1 ? 'jour' : 'jours'}`,
  noFreezes: 'Aucun gel pour le moment',
  freezesCount: (freezes) => `${freezes} ${freezes === 1 ? 'gel' : 'gels'} de série`,
  freezeExplanation: (interval) =>
    `Un gel sauve ta série si tu manques un jour. Tu en gagnes un tous les ${interval} jours d’affilée.`,
  close: 'Fermer',
};

const streakDetailEn: StreakDetailStrings = {
  titleActive: (streak) => `${streak} ${streak === 1 ? 'day' : 'days'} in a row`,
  titleInactive: 'Start a new streak!',
  explanationInactive:
    'Your streak of days in a row is at zero. Your progress on the multiplication tables is kept: play today to get going again.',
  explanationFreeze:
    "You didn't play yesterday, but one of your freezes is protecting your streak. Play today to use it and extend your streak.",
  explanationDoneToday:
    'Well done, your session for today is done! Come back tomorrow to add +1.',
  explanationActive:
    "Your streak is still active. Don't forget to do your session today to extend it — otherwise it will reset to zero tomorrow.",
  recordLabel: 'Your record',
  recordValue: (record) => `${record} ${record === 1 ? 'day' : 'days'}`,
  noFreezes: 'No freezes yet',
  freezesCount: (freezes) => `${freezes} streak ${freezes === 1 ? 'freeze' : 'freezes'}`,
  freezeExplanation: (interval) =>
    `A freeze saves your streak if you miss a day. You earn one every ${interval} days in a row.`,
  close: 'Close',
};

export const streakDetailStrings = { fr: streakDetailFr, en: streakDetailEn };

export function useStreakDetailStrings(): StreakDetailStrings {
  return useStrings(streakDetailStrings);
}

// === Mascot ===

interface MascotStrings {
  ariaLabel: (name: string, mood: string) => string;
}

const mascotFr: MascotStrings = {
  ariaLabel: (name, mood) => `Mascotte ${name}, humeur: ${mood}`,
};

const mascotEn: MascotStrings = {
  ariaLabel: (name, mood) => `Mascot ${name}, mood: ${mood}`,
};

export const mascotStrings = { fr: mascotFr, en: mascotEn };

export function useMascotStrings(): MascotStrings {
  return useStrings(mascotStrings);
}

// === Grilles (Leitner & mystère) : libellés ARIA des cases ===
// Partagé par ProgressGrid / DivisionProgressGrid / MysteryImage /
// DivisionMysteryImage : « N fois M = P » et « D divisé par n ».

interface FactCellStrings {
  multLabel: (row: number, col: number, product: number) => string;
  divLabel: (dividend: number, divisor: number) => string;
}

const factCellFr: FactCellStrings = {
  multLabel: (row, col, product) => `${row} fois ${col} = ${product}`,
  divLabel: (dividend, divisor) => `${dividend} divisé par ${divisor}`,
};

const factCellEn: FactCellStrings = {
  multLabel: (row, col, product) => `${row} times ${col} = ${product}`,
  divLabel: (dividend, divisor) => `${dividend} divided by ${divisor}`,
};

export const factCellStrings = { fr: factCellFr, en: factCellEn };

export function useFactCellStrings(): FactCellStrings {
  return useStrings(factCellStrings);
}

// === MysteryGrid (modale détail d'une case) ===
// Le libellé du niveau (boxLevelLabel) vient déjà localisé de lib/leitner.

interface MysteryGridStrings {
  close: string;
}

const mysteryGridFr: MysteryGridStrings = {
  close: 'Fermer',
};

const mysteryGridEn: MysteryGridStrings = {
  close: 'Close',
};

export const mysteryGridStrings = { fr: mysteryGridFr, en: mysteryGridEn };

export function useMysteryGridStrings(): MysteryGridStrings {
  return useStrings(mysteryGridStrings);
}
