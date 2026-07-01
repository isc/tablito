import { useStrings } from './lang';

// Strings pilotées depuis App.tsx (en dehors d'un écran dédié) : pour l'instant
// la confirmation de suppression de profil.

interface Strings {
  confirmDeleteProfile: (name: string) => string;
  transferFailed: string;
  transferImported: string;
  dismiss: string;
}

const fr: Strings = {
  confirmDeleteProfile: (name) =>
    `Supprimer le profil de ${name} ?\n\nLe prénom, les séances, les badges et la série seront effacés de cet appareil. Cette action est irréversible.`,
  transferFailed:
    "Le transfert n'a pas abouti : le lien a peut-être expiré ou déjà servi. Relancez-en un depuis l'ancien appareil (Espace parent → Transférer).",
  transferImported: 'La progression est bien arrivée sur cet appareil ✓',
  dismiss: 'Fermer',
};

const en: Strings = {
  confirmDeleteProfile: (name) =>
    `Delete ${name}'s profile?\n\nThe name, sessions, badges and streak will be erased from this device. This action cannot be undone.`,
  transferFailed:
    "The transfer didn't go through: the link may have expired or already been used. Start a new one from the old device (Parent area → Transfer).",
  transferImported: 'The progress has arrived on this device ✓',
  dismiss: 'Close',
};

export const appStrings = { fr, en };

export function useAppStrings(): Strings {
  return useStrings(appStrings);
}
