import type { Lang } from '../i18n/lang';
import { parseFrenchAnswer } from './parseFrenchNumber';
import { parseEnglishAnswer } from './parseEnglishNumber';

// Dispatcher de parsing de réponse parlée selon la langue d'interface. La
// reconnaissance vocale et le parsing doivent partager la même langue : un
// transcript anglais ("twenty four") n'est interprétable que par le parseur
// anglais.
export function parseSpokenAnswer(input: string, lang: Lang): number | null {
  return lang === 'en' ? parseEnglishAnswer(input) : parseFrenchAnswer(input);
}

// Tag BCP-47 passé à la Web Speech API selon la langue d'interface.
export function speechRecognitionLang(lang: Lang): string {
  return lang === 'en' ? 'en-US' : 'fr-FR';
}
