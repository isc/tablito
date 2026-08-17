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

  // --- Mode vocal épelé (spec §15.10) ---
  // On révise la conjugaison à l'oral en épelant : « ils chantent — e, n, t ».
  // Les consignes disent la forme PUIS l'épellation, dans cet ordre : énoncer la
  // forme d'abord ajoute le lien phonie-graphie que le clavier n'a pas.
  /** Consigne quand seule la terminaison est demandée (radical affiché). */
  voiceSpellEnding: 'Dis la forme, puis épelle la fin',
  /** Consigne quand la forme entière est demandée (irrégulière). */
  voiceSpellWhole: 'Dis la forme, puis épelle-la en entier',
  /** Invite quand la forme a été dite mais que l'épellation n'est pas venue. */
  voiceSpellNow: 'Maintenant, épelle !',
  /**
   * Re-demande neutre après un raté de reconnaissance. Ce n'est JAMAIS une
   * erreur : on n'évalue pas le micro, et rien n'est dit de l'enfant.
   */
  voiceNotHeard: "Je n'ai pas bien entendu",
  /** Bascule automatique au clavier après deux ratés sur la même question. */
  voiceFallbackToKeyboard: 'On va plutôt écrire, c’est plus simple !',
  /** L'enfant a touché le clavier : c'est elle qui valide, plus le micro. */
  voiceTookOver: 'Corrige, puis valide',
  /**
   * Bascule clavier → épellation, propre à la matière : « micro » ne dirait pas
   * ce qu'il y a à faire. Les libellés communs au vocal des maths (parler,
   * écouter, réessayer avec la voix, utiliser le clavier, micro bloqué, besoin
   * d'internet) viennent de i18n/voice.ts — le geste est le même partout.
   */
  voiceUseMic: 'Épeler à voix haute',

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
