import { useStrings } from './lang';

// Strings de l'onboarding : WelcomeScreen, RulesIntroScreen, ProfileSelectScreen.
// Suit le pattern des modules i18n (cf. voice.ts) : un dico `fr` source, un `en`
// contraint à la même forme via une interface explicite (pour typer les
// fonctions d'interpolation), et un hook `useXStrings()` par écran.

// === WelcomeScreen ===

interface WelcomeStrings {
  dontKnow: string;
  testHint: string;
  helloTitle: string;
  helloSubtitlePart1: string;
  helloSubtitlePart2: string;
  next: string;
  alreadyHaveProgress: string;
  cancel: string;
  importTitle: string;
  importSubtitle: string;
  pasteFromClipboard: string;
  pasteManually: string;
  importPlaceholder: string;
  importNotRecognized: string;
  importConfirm: string;
  nameTitle: string;
  namePlaceholder: string;
  itsMe: string;
  greeting: (name: string) => string;
  testIntroPart1: string;
  testIntroPart2: string;
  letsGo: string;
  skipTest: string;
}

const welcomeFr: WelcomeStrings = {
  dontKnow: 'Je ne sais pas',
  testHint: 'Réponds du mieux que tu peux\u00a0!',
  helloTitle: 'Bonjour\u00a0!',
  helloSubtitlePart1: "Je suis Piou, ton petit copain d'apprentissage.",
  helloSubtitlePart2: 'On va apprendre les tables de multiplication ensemble\u00a0!',
  next: 'Suivant →',
  alreadyHaveProgress: "Déjà une progression\u00a0? L'importer",
  cancel: 'Annuler',
  importTitle: 'Ta progression',
  importSubtitle:
    "Le plus simple : sur l'ancien appareil, ouvre Espace parent → « Transférer » et scanne le QR code avec celui-ci. Ou colle ici une sauvegarde exportée.",
  pasteFromClipboard: 'Coller depuis le presse-papiers',
  pasteManually: 'Coller à la main',
  importPlaceholder: 'Colle ta progression ici (appui long → Coller)',
  importNotRecognized: 'Progression non reconnue. Vérifie le copier-coller.',
  importConfirm: 'Importer ma progression',
  nameTitle: "Comment tu t'appelles\u00a0?",
  namePlaceholder: 'Ton prénom',
  itsMe: "C'est moi\u00a0! →",
  greeting: (name: string) => `Salut ${name}\u00a0!`,
  testIntroPart1:
    'Avant de commencer, je vais te poser quelques questions pour voir ce que tu connais déjà.',
  testIntroPart2:
    'Pas de stress : si tu ne sais pas, tape sur «\u00a0Je ne sais pas\u00a0».',
  letsGo: "C'est parti\u00a0! →",
  skipTest: 'Passer le test',
};

const welcomeEn: WelcomeStrings = {
  dontKnow: "I don't know",
  testHint: 'Do your best!',
  helloTitle: 'Hi there!',
  helloSubtitlePart1: "I'm Piou, your little learning buddy.",
  helloSubtitlePart2: "We're going to learn the times tables together!",
  next: 'Next →',
  alreadyHaveProgress: 'Already have progress? Import it',
  cancel: 'Cancel',
  importTitle: 'Your progress',
  importSubtitle:
    'Easiest: on the old device, open Parent area → "Transfer" and scan the QR code with this one. Or paste an exported backup here.',
  pasteFromClipboard: 'Paste from clipboard',
  pasteManually: 'Paste by hand',
  importPlaceholder: 'Paste your progress here (long press → Paste)',
  importNotRecognized: 'Progress not recognized. Check your copy-paste.',
  importConfirm: 'Import my progress',
  nameTitle: "What's your name?",
  namePlaceholder: 'Your name',
  itsMe: "That's me! →",
  greeting: (name: string) => `Hi ${name}!`,
  testIntroPart1:
    "Before we start, I'll ask you a few questions to see what you already know.",
  testIntroPart2:
    "No worries: if you don't know, just tap “I don't know”.",
  letsGo: "Let's go! →",
  skipTest: 'Skip the test',
};

export const welcomeStrings = { fr: welcomeFr, en: welcomeEn };

export function useWelcomeStrings(): WelcomeStrings {
  return useStrings(welcomeStrings);
}

// === RulesIntroScreen ===

interface RulesIntroStrings {
  introTitle: (name: string) => string;
  introSubtitlePart1: string;
  introSubtitlePart2Prefix: string;
  introSubtitlePart2Middle: string;
  introSubtitlePart2Suffix: string;
  introSubtitlePart3: string;
  letsGo: string;
  x1Title: string;
  x1Message: string;
  x1Tip: string;
  next: string;
  x10Title: string;
  x10MessagePart1: string;
  x10MessagePart2Prefix: string;
  x10MessagePart2Suffix: string;
  x10Tip: string;
  gotIt: string;
}

const rulesIntroFr: RulesIntroStrings = {
  introTitle: (name: string) => `Avant de commencer, ${name}\u00a0!`,
  introSubtitlePart1: 'Je vais te montrer deux règles toutes simples',
  introSubtitlePart2Prefix: 'pour multiplier par ',
  introSubtitlePart2Middle: ' et par ',
  introSubtitlePart2Suffix: '.',
  introSubtitlePart3:
    'Pas besoin de les apprendre par cœur : tu vas comprendre comment elles marchent\u00a0!',
  letsGo: "C'est parti\u00a0!",
  x1Title: 'Multiplier par 1',
  x1Message: 'Tout nombre multiplié par 1 reste le même\u00a0!',
  x1Tip: 'Facile, non\u00a0?',
  next: 'Suivant',
  x10Title: 'Multiplier par 10',
  x10MessagePart1: "Les chiffres glissent d'une place vers la gauche\u00a0!",
  x10MessagePart2Prefix: 'Un ',
  x10MessagePart2Suffix: ' vient prendre la place des unités.',
  x10Tip: 'Astuce : tous les résultats de la table de 10 se terminent par 0\u00a0!',
  gotIt: "J'ai compris\u00a0!",
};

const rulesIntroEn: RulesIntroStrings = {
  introTitle: (name: string) => `Before we start, ${name}!`,
  introSubtitlePart1: "I'll show you two really simple rules",
  introSubtitlePart2Prefix: 'to multiply by ',
  introSubtitlePart2Middle: ' and by ',
  introSubtitlePart2Suffix: '.',
  introSubtitlePart3:
    "No need to learn them by heart: you're going to understand how they work!",
  letsGo: "Let's go!",
  x1Title: 'Multiplying by 1',
  x1Message: 'Any number times 1 stays the same!',
  x1Tip: 'Easy, right?',
  next: 'Next',
  x10Title: 'Multiplying by 10',
  x10MessagePart1: 'The digits slide one spot to the left!',
  x10MessagePart2Prefix: 'A ',
  x10MessagePart2Suffix: ' takes the place of the ones.',
  x10Tip: 'Tip: every answer in the 10 times table ends in 0!',
  gotIt: 'Got it!',
};

export const rulesIntroStrings = { fr: rulesIntroFr, en: rulesIntroEn };

export function useRulesIntroStrings(): RulesIntroStrings {
  return useStrings(rulesIntroStrings);
}

// === ProfileSelectScreen ===

interface ProfileSelectStrings {
  title: string;
  addChild: string;
}

const profileSelectFr: ProfileSelectStrings = {
  title: 'Qui joue\u00a0?',
  addChild: '+ Ajouter un enfant',
};

const profileSelectEn: ProfileSelectStrings = {
  title: "Who's playing?",
  addChild: '+ Add a child',
};

export const profileSelectStrings = { fr: profileSelectFr, en: profileSelectEn };

export function useProfileSelectStrings(): ProfileSelectStrings {
  return useStrings(profileSelectStrings);
}
