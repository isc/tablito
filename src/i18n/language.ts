import { useStrings } from './lang';

// Strings du sélecteur de langue lui-même. Les noms de langue restent dans leur
// propre langue (Français / English), convention usuelle des sélecteurs.

interface Strings {
  label: string;
}

const fr: Strings = { label: 'Langue de l’application' };
const en: Strings = { label: 'App language' };

export const languageStrings = { fr, en };

export function useLanguageStrings(): Strings {
  return useStrings(languageStrings);
}
