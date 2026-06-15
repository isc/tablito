import { useStrings } from './lang';

// Strings de l'écran d'accueil (HomeScreen) et de l'écran des règles
// (RulesScreen). Même pattern que voice.ts : un dico `fr` source, un `en`
// contraint par une interface explicite, et un hook `useXStrings()` par
// domaine qui sélectionne selon la langue du contexte. Les libellés qui
// dépendent du prénom ou d'un compteur sont des fonctions typées. Les
// espaces insécables (\u00a0) du français sont conservées avant « ! » / « ? ».

// === HomeScreen ===

interface HomeStrings {
  streakBroken: string;
  streakProtected: (days: string) => string;
  streakNormal: (days: string, reserve: string) => string;
  streakReserve: (freezes: number) => string;
  days: (count: number) => string;
  backToIt: string;
  switchPlayer: string;
  parentAccess: string;
  tickleMascot: string;
  greeting: (name: string) => string;
  letsGo: string;
  doneForToday: string;
  myPictures: string;
  myPicture: string;
  badges: string;
  rulesWithNew: string;
  rules: string;
}

const homeFr: HomeStrings = {
  streakBroken: 'Série interrompue — voir les détails',
  streakProtected: (days) => `Série de ${days} protégée par un gel — voir les détails`,
  streakNormal: (days, reserve) => `Série de ${days}${reserve} — voir les détails`,
  streakReserve: (freezes) =>
    `, ${freezes} ${freezes === 1 ? 'gel' : 'gels'} en réserve`,
  days: (count) => `${count} ${count === 1 ? 'jour' : 'jours'}`,
  backToIt: "On s'y remet\u00a0?",
  switchPlayer: 'Changer de joueur',
  parentAccess: 'Accès parent',
  tickleMascot: 'Chatouiller la mascotte',
  greeting: (name) => `Salut ${name}\u00a0!`,
  letsGo: "C'est parti\u00a0!",
  doneForToday: "Bravo, c'est fait pour aujourd'hui\u00a0!",
  myPictures: 'Mes images',
  myPicture: 'Mon image',
  badges: 'Badges',
  rulesWithNew: 'Règles — nouvelle règle débloquée',
  rules: 'Règles',
};

const homeEn: HomeStrings = {
  streakBroken: 'Streak broken — see details',
  streakProtected: (days) => `Streak of ${days} protected by a freeze — see details`,
  streakNormal: (days, reserve) => `Streak of ${days}${reserve} — see details`,
  streakReserve: (freezes) =>
    `, ${freezes} ${freezes === 1 ? 'freeze' : 'freezes'} in reserve`,
  days: (count) => `${count} ${count === 1 ? 'day' : 'days'}`,
  backToIt: 'Back to it?',
  switchPlayer: 'Switch player',
  parentAccess: 'Parent area',
  tickleMascot: 'Tickle the mascot',
  greeting: (name) => `Hi ${name}!`,
  letsGo: "Let's go!",
  doneForToday: "Nice work, you're done for today!",
  myPictures: 'My pictures',
  myPicture: 'My picture',
  badges: 'Badges',
  rulesWithNew: 'Rules — new rule unlocked',
  rules: 'Rules',
};

export const homeStrings = { fr: homeFr, en: homeEn };

export function useHomeStrings(): HomeStrings {
  return useStrings(homeStrings);
}

// === RulesScreen ===
// Les messages des règles mélangent texte normal et un fragment en gras
// (<b>). On les découpe en before / bold / after pour garder le <b> dans le
// JSX tout en traduisant la prose. L'espace insécable précède « ! » en
// français.

interface RuleMessage {
  before: string;
  bold: string;
  after: string;
}

interface RulesStrings {
  back: string;
  title: string;
  intro: string;
  ruleNumber: (n: number) => string;
  bonusRule: string;
  multiplyBy: (n: number) => string;
  rule1Message: RuleMessage;
  rule1Tip: string;
  rule10Message: RuleMessage;
  rule10Tip: string;
  rule11Message: RuleMessage;
  rule11Tip: string;
}

const rulesFr: RulesStrings = {
  back: 'Retour',
  title: 'Mes règles',
  intro: 'Tes raccourcis à connaître par cœur. Après, ce sera facile\u00a0!',
  ruleNumber: (n) => `Règle n°${n}`,
  bonusRule: 'Règle bonus',
  multiplyBy: (n) => `Multiplier par ${n}`,
  rule1Message: {
    before: 'Tout nombre multiplié par 1 ',
    bold: 'reste le même',
    after: '\u00a0!',
  },
  rule1Tip: 'Ça marche avec tous les nombres, même les très grands\u00a0!',
  rule10Message: {
    before: "Les chiffres glissent d'une place vers la gauche : un ",
    bold: '0',
    after: ' vient prendre la place des unités\u00a0!',
  },
  rule10Tip: 'Astuce : tous les résultats de la table de 10 se terminent par 0\u00a0!',
  rule11Message: {
    before: 'De 1 à 9, il suffit de ',
    bold: 'répéter le chiffre',
    after: '\u00a0!',
  },
  rule11Tip: "Tu l'as débloquée en maîtrisant toutes tes tables. Joli\u00a0!",
};

const rulesEn: RulesStrings = {
  back: 'Back',
  title: 'My rules',
  intro: 'Your shortcuts to know by heart. After that, it will be easy!',
  ruleNumber: (n) => `Rule #${n}`,
  bonusRule: 'Bonus rule',
  multiplyBy: (n) => `Multiply by ${n}`,
  rule1Message: {
    before: 'Any number multiplied by 1 ',
    bold: 'stays the same',
    after: '!',
  },
  rule1Tip: 'It works with every number, even the really big ones!',
  rule10Message: {
    before: 'The digits slide one place to the left: a ',
    bold: '0',
    after: ' takes the place of the ones!',
  },
  rule10Tip: 'Tip: every answer in the 10 times table ends with a 0!',
  rule11Message: {
    before: 'From 1 to 9, you just have to ',
    bold: 'repeat the digit',
    after: '!',
  },
  rule11Tip: 'You unlocked it by mastering all your times tables. Nice!',
};

export const rulesStrings = { fr: rulesFr, en: rulesEn };

export function useRulesStrings(): RulesStrings {
  return useStrings(rulesStrings);
}
