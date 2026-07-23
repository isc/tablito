import { pickStrings, type Lang } from './lang';

// Traductions des badges. Les métadonnées non textuelles (id, icône, couleur,
// logique de progression) vivent dans lib/badges.ts ; ici, uniquement les
// chaînes affichées (nom, description, condition) et les libellés d'unité de
// progression. Les badges « Table de N » / « Divisions par N » sont générés,
// d'où les helpers paramétrés par n.

export interface BadgeText {
  name: string;
  description: string;
  conditionText: string;
}

export interface BadgeUnitLabels {
  session: string;
  box4: string;
  box5: string;
  days: string;
  discovered: string;
  box4plus: string;
}

export interface BadgeI18n {
  premierPas: BadgeText;
  premiereCase: BadgeText;
  premiereMaitrise: BadgeText;
  regulier: BadgeText;
  machine: BadgeText;
  exploration: BadgeText;
  table: (n: number) => BadgeText;
  genieMaths: BadgeText;
  veloce: BadgeText;
  perseverance: BadgeText;
  flammeEternelle: BadgeText;
  divPremiereMaitrise: BadgeText;
  divTable: (n: number) => BadgeText;
  divGenie: BadgeText;
  remPremiereMaitrise: BadgeText;
  remTable: (n: number) => BadgeText;
  remGenie: BadgeText;
  units: BadgeUnitLabels;
}

const fr: BadgeI18n = {
  premierPas: {
    name: 'Premier pas',
    description: 'Terminer la première séance',
    conditionText: 'Termine ta toute première séance.',
  },
  premiereCase: {
    name: 'Première case révélée',
    description: 'Une multiplication presque maîtrisée',
    conditionText:
      'Place ta toute première multiplication en boîte 4 — une case s’éclaircit sur ton image mystère !',
  },
  premiereMaitrise: {
    name: 'Première multiplication maîtrisée',
    description: 'Une multiplication au top niveau',
    conditionText:
      'Place ta toute première multiplication en boîte 5 — la case est complètement dévoilée !',
  },
  regulier: {
    name: 'Régularité',
    description: '7 jours consécutifs',
    conditionText: 'Joue 7 jours d’affilée sans en sauter un seul.',
  },
  machine: {
    name: 'Machine',
    description: '10 bonnes réponses de suite',
    conditionText:
      'Enchaîne 10 bonnes réponses de suite, sans aucune faute, dans une même séance.',
  },
  exploration: {
    name: 'Exploration',
    description: 'Avoir vu tous les faits',
    conditionText: 'Découvre toutes les multiplications du jeu.',
  },
  table: (n) => ({
    name: `Table de ${n}`,
    description: `Maîtriser la table de ${n}`,
    conditionText: `Place toutes les multiplications de la table de ${n} dans la boîte 4 ou 5.`,
  }),
  genieMaths: {
    name: 'Génie de la multiplication',
    description: 'Toutes les multiplications maîtrisées',
    conditionText: 'Place toutes les multiplications dans la boîte 5 (le top niveau !).',
  },
  veloce: {
    name: 'Véloce',
    description: '5 étoiles dorées de suite',
    conditionText:
      'Décroche 5 étoiles dorées d’affilée — une réponse rapide ET correcte à la suite, sans faute ni hésitation.',
  },
  perseverance: {
    name: 'Persévérance',
    description: 'Revenir après 3+ jours',
    conditionText: 'Reviens jouer après une pause de 3 jours ou plus. Le retour du champion !',
  },
  flammeEternelle: {
    name: 'Flamme éternelle',
    description: '30 jours consécutifs',
    conditionText: 'Joue 30 jours d’affilée. La grande flamme !',
  },
  divPremiereMaitrise: {
    name: 'Première division maîtrisée',
    description: 'Une division au top niveau',
    conditionText: 'Place ta toute première division en boîte 5.',
  },
  divTable: (n) => ({
    name: `Divisions par ${n}`,
    description: `Maîtriser les divisions par ${n}`,
    conditionText: `Place toutes les divisions par ${n} dans la boîte 4 ou 5.`,
  }),
  divGenie: {
    name: 'Maître de la division',
    description: 'Toutes les divisions en boîte 5',
    conditionText: 'Place toutes les divisions dans la boîte 5 (le top niveau !).',
  },
  remPremiereMaitrise: {
    name: 'Premier reste maîtrisé',
    description: 'Une division avec reste au top niveau',
    conditionText: 'Place ta toute première division avec reste en boîte 5.',
  },
  remTable: (n) => ({
    name: `Division avec reste par ${n}`,
    description: `Maîtriser les divisions avec reste par ${n}`,
    conditionText: `Place toutes les divisions avec reste par ${n} dans la boîte 4 ou 5.`,
  }),
  remGenie: {
    name: 'Grand maître de la division',
    description: 'Toutes les divisions avec reste en boîte 5',
    conditionText: 'Place toutes les divisions avec reste dans la boîte 5 (le top niveau !).',
  },
  units: {
    session: 'séance',
    box4: 'en boîte 4',
    box5: 'en boîte 5',
    days: 'jours',
    discovered: 'découvertes',
    box4plus: 'en boîte 4+',
  },
};

const en: BadgeI18n = {
  premierPas: {
    name: 'First step',
    description: 'Finish your first session',
    conditionText: 'Finish your very first session.',
  },
  premiereCase: {
    name: 'First tile revealed',
    description: 'A multiplication almost mastered',
    conditionText:
      'Move your very first multiplication to box 4 — a tile clears up on your mystery picture!',
  },
  premiereMaitrise: {
    name: 'First multiplication mastered',
    description: 'A multiplication at the top level',
    conditionText:
      'Move your very first multiplication to box 5 — the tile is fully revealed!',
  },
  regulier: {
    name: 'Consistency',
    description: '7 days in a row',
    conditionText: 'Play 7 days in a row without skipping a single one.',
  },
  machine: {
    name: 'Machine',
    description: '10 correct answers in a row',
    conditionText: 'Get 10 correct answers in a row, with no mistakes, in a single session.',
  },
  exploration: {
    name: 'Exploration',
    description: 'See every fact',
    conditionText: 'Discover every multiplication in the game.',
  },
  table: (n) => ({
    name: `${n} times table`,
    description: `Master the ${n} times table`,
    conditionText: `Move every multiplication in the ${n} times table to box 4 or 5.`,
  }),
  genieMaths: {
    name: 'Multiplication genius',
    description: 'Every multiplication mastered',
    conditionText: 'Move every multiplication to box 5 (the top level!).',
  },
  veloce: {
    name: 'Speedy',
    description: '5 golden stars in a row',
    conditionText:
      'Earn 5 golden stars in a row — a fast AND correct answer each time, with no mistakes or hesitation.',
  },
  perseverance: {
    name: 'Perseverance',
    description: 'Come back after 3+ days',
    conditionText: 'Come back to play after a break of 3 days or more. The champion returns!',
  },
  flammeEternelle: {
    name: 'Eternal flame',
    description: '30 days in a row',
    conditionText: 'Play 30 days in a row. The great flame!',
  },
  divPremiereMaitrise: {
    name: 'First division mastered',
    description: 'A division at the top level',
    conditionText: 'Move your very first division to box 5.',
  },
  divTable: (n) => ({
    name: `Dividing by ${n}`,
    description: `Master dividing by ${n}`,
    conditionText: `Move every division by ${n} to box 4 or 5.`,
  }),
  divGenie: {
    name: 'Division master',
    description: 'Every division in box 5',
    conditionText: 'Move every division to box 5 (the top level!).',
  },
  remPremiereMaitrise: {
    name: 'First remainder mastered',
    description: 'A division with remainder at the top level',
    conditionText: 'Move your very first division with remainder to box 5.',
  },
  remTable: (n) => ({
    name: `Remainders when dividing by ${n}`,
    description: `Master dividing by ${n} with remainders`,
    conditionText: `Move every division with remainder by ${n} to box 4 or 5.`,
  }),
  remGenie: {
    name: 'Grand master of division',
    description: 'Every division with remainder in box 5',
    conditionText: 'Move every division with remainder to box 5 (the top level!).',
  },
  units: {
    session: 'session',
    box4: 'in box 4',
    box5: 'in box 5',
    days: 'days',
    discovered: 'discovered',
    box4plus: 'in box 4+',
  },
};

export const badgeI18n: Record<Lang, BadgeI18n> = { fr, en };

/** Traductions des badges pour la langue courante (consommateur hors-React). */
export function getBadgeI18n(): BadgeI18n {
  return pickStrings(badgeI18n);
}
