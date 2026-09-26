import { useStrings } from './lang';

// Strings du portail de l'espace parent (ParentGate). Module à part : le
// portail est chargé au démarrage avec l'accueil de l'enfant, alors que les
// strings de l'espace parent lui-même (parent.ts) ne servent qu'à des écrans
// chargés à la demande.

interface ParentGateStrings {
  title: string;
  subtitle: string;
  resultLabel: string;
  wrongAttempt: string;
  cancel: string;
  validate: string;
}

const parentGateFr: ParentGateStrings = {
  title: 'Espace parent',
  subtitle: 'Une petite multiplication pour confirmer que vous êtes un adulte.',
  resultLabel: 'Résultat',
  wrongAttempt: 'Pas tout à fait. Essayez avec cette nouvelle question.',
  cancel: 'Annuler',
  validate: 'Valider',
};

const parentGateEn: ParentGateStrings = {
  title: 'Parent area',
  subtitle: "A quick multiplication to confirm you're an adult.",
  resultLabel: 'Result',
  wrongAttempt: 'Not quite. Try this new question.',
  cancel: 'Cancel',
  validate: 'Confirm',
};

export const parentGateStrings = { fr: parentGateFr, en: parentGateEn };

export function useParentGateStrings(): ParentGateStrings {
  return useStrings(parentGateStrings);
}
