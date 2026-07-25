import { useStrings } from './lang';

// Strings des écrans de séance : SessionScreen, FeedbackOverlay et NumPad.
// Même pattern que voice.ts : un dico `fr` source, un `en` contraint à la
// même forme, et un hook `useXStrings()` par domaine.

// === SessionScreen ===

interface SessionStrings {
  new: string;
  next: string;
  gotIt: string;
  // « <a> × <b>, c'est <b> + <b> + … = <product> » (texte autour des opérandes).
  isShort: string;
  // Commutativité : « <b> × <a>, c'est pareil ! »
  sameThing: string;
  // « C'est aussi <product> »
  alsoEquals: string;
  littleTrick: string;
  // « On partage <dividend> en <divisor> lots égaux — combien dans chaque ? »
  shareInto: (dividend: number, divisor: number) => string;
  // Niveau 3 : « Dans <dividend>, combien de fois <divisor> ? … »
  remIntro: (dividend: number, divisor: number) => string;
  // Libellés des deux étapes de saisie (specs §12.5).
  howManyTimes: string;
  whatRemains: string;
  // « reste » dans la formule affichée (« = 6, reste ? »).
  remainderWord: string;
  useMic: string;
}

const sessionFr: SessionStrings = {
  new: 'Nouveau\u00a0!',
  next: 'Suivant →',
  gotIt: "J'ai compris\u00a0!",
  isShort: "c'est",
  sameThing: ", c'est pareil\u00a0!",
  alsoEquals: "C'est aussi",
  littleTrick: "Une petite astuce pour s'en souvenir\u00a0!",
  shareInto: (dividend, divisor) =>
    `On partage ${dividend} en ${divisor} lots égaux — combien dans chaque\u00a0?`,
  remIntro: (dividend, divisor) =>
    `Dans ${dividend}, combien de fois ${divisor} ? Les points qui ne remplissent pas une rangée, c'est le reste.`,
  howManyTimes: 'Combien de fois ?',
  whatRemains: 'Il reste combien ?',
  remainderWord: 'reste',
  useMic: 'Utiliser le micro',
};

const sessionEn: SessionStrings = {
  new: 'New!',
  next: 'Next →',
  gotIt: 'Got it!',
  isShort: 'is',
  sameThing: ', it’s the same!',
  alsoEquals: "It's also",
  littleTrick: 'A little trick to remember it!',
  shareInto: (dividend, divisor) =>
    `We share ${dividend} into ${divisor} equal groups — how many in each?`,
  remIntro: (dividend, divisor) =>
    `How many times does ${divisor} fit into ${dividend}? The dots that don't fill a row are the remainder.`,
  howManyTimes: 'How many times?',
  whatRemains: "What's left over?",
  remainderWord: 'r',
  useMic: 'Use the mic',
};

export const sessionStrings = { fr: sessionFr, en: sessionEn };

export function useSessionStrings(): SessionStrings {
  return useStrings(sessionStrings);
}

// === FeedbackOverlay ===

interface FeedbackOverlayStrings {
  correctMessages: string[];
  incorrectMessages: string[];
  // « Tu as répondu <valeur> » (le nombre est rendu à part, en gras).
  youAnswered: string;
  gotIt: string;
  // Eyebrow de la grille (multiplication) : « <a> rangées de <b> ».
  rowsOf: (a: number, b: number) => string;
  // Niveau 3 : « 6, reste 3 » — réponse composée affichée (bonne ou saisie).
  remAnswer: (quotient: number, remainder: number) => string;
  // Eyebrow de la grille (niveau 3) : « 7 × 6 + 3 » (ou « 7 × 6 » si reste 0).
  remEyebrow: (divisor: number, quotient: number, remainder: number) => string;
}

const feedbackFr: FeedbackOverlayStrings = {
  correctMessages: [
    'Super !',
    'Bravo !',
    'Génial !',
    'Bien joué !',
    'Excellent !',
    'Parfait !',
    'Trop fort !',
  ],
  incorrectMessages: ['Presque !', 'Pas tout à fait…'],
  youAnswered: 'Tu as répondu',
  gotIt: "J'ai compris",
  rowsOf: (a, b) => `${a} rangée${a > 1 ? 's' : ''} de ${b}`,
  remAnswer: (quotient, remainder) =>
    remainder === 0 ? `${quotient}, reste 0` : `${quotient}, reste ${remainder}`,
  remEyebrow: (divisor, quotient, remainder) =>
    remainder === 0 ? `${divisor} × ${quotient}` : `${divisor} × ${quotient} + ${remainder}`,
};

const feedbackEn: FeedbackOverlayStrings = {
  correctMessages: [
    'Great!',
    'Well done!',
    'Awesome!',
    'Nice!',
    'Excellent!',
    'Perfect!',
    'Super strong!',
  ],
  incorrectMessages: ['Almost!', 'Not quite…'],
  youAnswered: 'You answered',
  gotIt: 'Got it',
  rowsOf: (a, b) => `${a} row${a > 1 ? 's' : ''} of ${b}`,
  remAnswer: (quotient, remainder) => `${quotient} r ${remainder}`,
  remEyebrow: (divisor, quotient, remainder) =>
    remainder === 0 ? `${divisor} × ${quotient}` : `${divisor} × ${quotient} + ${remainder}`,
};

export const feedbackOverlayStrings = { fr: feedbackFr, en: feedbackEn };

export function useFeedbackOverlayStrings(): FeedbackOverlayStrings {
  return useStrings(feedbackOverlayStrings);
}

// === NumPad ===

interface NumPadStrings {
  backspace: string;
  submit: string;
}

const numPadFr: NumPadStrings = {
  backspace: 'Effacer',
  submit: 'Valider',
};

const numPadEn: NumPadStrings = {
  backspace: 'Delete',
  submit: 'Submit',
};

export const numPadStrings = { fr: numPadFr, en: numPadEn };

export function useNumPadStrings(): NumPadStrings {
  return useStrings(numPadStrings);
}
