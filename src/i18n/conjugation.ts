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

  // --- Image mystère de la matière (spec §7.1) ---
  /**
   * 64ᵉ case : l'inventaire n'en compte que 63. Elle ne s'allume qu'une fois
   * tous les faits découverts — le clin d'œil de complétion de la spec.
   */
  mysteryBonusLabel: 'Case bonus',
  mysteryBonusHeading: 'La case bonus',
  mysteryBonusText: 'Elle se dévoile quand tous les autres faits sont découverts !',

  // --- Test de placement (spec §6.1) ---
  // Ce n'est pas un examen : c'est le premier geste de réassurance du jeu.
  placementTitle: 'On regarde ce que tu sais déjà',
  placementSubtitle:
    "Quelques phrases à compléter. Si tu ne sais pas, tu dis « je ne sais pas » — c'est permis !",
  placementStart: 'On y va !',
  placementDontKnow: 'Je ne sais pas',
  placementDoneTitle: 'Regarde tout ce que tu sais déjà !',
  placementDoneSubtitle: 'Ton image a déjà commencé à apparaître.',
  /**
   * Variante quand AUCUNE sonde n'a été réussie : rien n'a été ensemencé, donc
   * ni « regarde tout ce que tu sais » ni « ton image a commencé » ne seraient
   * vrais — et un enfant repère un compliment creux. On promet ce qui va se
   * passer, sans jamais nommer l'échec.
   */
  placementEmptyTitle: 'On va tout découvrir ensemble',
  placementEmptySubtitle: 'Piou va te montrer chaque forme, une par une. Prête ?',
  placementDoneCta: 'Commencer ma séance',
} as const;

export type ConjStrings = typeof conjStrings;
