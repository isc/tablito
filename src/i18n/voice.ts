import { useStrings } from './lang';

// Strings de l'entrée vocale (VoiceInput). Pattern de référence des modules
// i18n : un dico `fr` source, un `en` contraint à la même forme, et un hook
// `useXStrings()` qui sélectionne selon la langue du contexte.

const fr = {
  hardToHear: "Je t'entends mal. Tape ta réponse !",
  retryWithVoice: 'Réessayer avec la voix',
  listening: 'Écoute en cours',
  speak: 'Parler',
  listeningHint: "Je t'écoute…",
  tapToSpeak: 'Appuie pour parler',
  micBlocked: 'Le micro est bloqué. Autorise-le dans les paramètres du navigateur.',
  needsInternet: "La reconnaissance vocale a besoin d'internet.",
  useKeyboard: 'Utiliser le clavier',
};

type Strings = typeof fr;

const en: Strings = {
  hardToHear: "I can't hear you well. Type your answer!",
  retryWithVoice: 'Try again with voice',
  listening: 'Listening',
  speak: 'Speak',
  listeningHint: "I'm listening…",
  tapToSpeak: 'Tap to speak',
  micBlocked: 'The microphone is blocked. Allow it in your browser settings.',
  needsInternet: 'Voice recognition needs an internet connection.',
  useKeyboard: 'Use the keyboard',
};

export const voiceStrings = { fr, en };

export function useVoiceStrings(): Strings {
  return useStrings(voiceStrings);
}
