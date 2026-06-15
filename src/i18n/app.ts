import { useStrings } from './lang';

// Strings pilotées depuis App.tsx (en dehors d'un écran dédié) : pour l'instant
// la confirmation de suppression de profil.

interface Strings {
  confirmDeleteProfile: (name: string) => string;
}

const fr: Strings = {
  confirmDeleteProfile: (name) =>
    `Supprimer le profil de ${name} ?\n\nLe prénom, les séances, les badges et la série seront effacés de cet appareil. Cette action est irréversible.`,
};

const en: Strings = {
  confirmDeleteProfile: (name) =>
    `Delete ${name}'s profile?\n\nThe name, sessions, badges and streak will be erased from this device. This action cannot be undone.`,
};

export const appStrings = { fr, en };

export function useAppStrings(): Strings {
  return useStrings(appStrings);
}
