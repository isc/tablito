// Strings de la matière conjugaison (LetterKeyboard, ConjForm, écran de séance,
// feedback). Volontairement FR SEULEMENT, sans table `{ fr, en }` : la matière
// est fr-only (masquée quand la langue d'interface est l'anglais), exactement
// comme `lib/conjugationStrategies.ts`. Une traduction anglaise serait du texte
// mort — et un `useStrings` ici laisserait croire que l'écran est bilingue.

export const conjStrings = {
  // --- Écran de séance ---
  new: 'Nouveau !',
  next: 'Suivant →',
  gotIt: "J'ai compris !",
  replay: 'Réécouter',
  /** Rappel de l'infinitif à côté de la phrase porteuse : « (chanter) ». */
  infinitive: (verb: string) => `(${verb})`,

  // --- Introduction d'un fait nouveau (spec §5.2) ---
  /** Étape 2 : ancrage à la règle. */
  mechanicsTitle: 'Regarde comment ça marche',
  /** Étape 3 : copie différée (le geste « je lis, je cache, j'écris »). */
  copyLook: 'Regarde bien…',
  copyWrite: 'À toi ! Écris la forme.',
  copyAgain: 'Regarde encore une fois…',

  // --- Saisie ---
  backspace: 'Effacer',
  submit: 'Valider',

  // --- Feedback (spec §5.3) ---
  correctMessages: ['Super !', 'Bravo !', 'Génial !', 'Bien joué !', 'Parfait !'],
  /**
   * Message du cas « correct mais lent » ET du cas « presque » : un « Bravo ! »
   * franc et invariable. La lenteur n'est JAMAIS verbalisée, la coquille non
   * plus — dans les deux cas, la réponse est acceptée.
   */
  wellDone: 'Bravo !',
  /** Cas erreur : jamais de reproche, jamais de son négatif. */
  incorrectMessage: 'On regarde ensemble',
  youWrote: 'Tu as écrit',
  hintEyebrow: "L'astuce",
} as const;

export type ConjStrings = typeof conjStrings;
