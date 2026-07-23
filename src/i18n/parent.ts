import { localeFor, useStrings } from './lang';

// Strings de l'espace parent : ParentDashboard, ParentGate, NotificationSettings
// et FeedbackModal. Même pattern que voice.ts — un dico `fr` source, un `en`
// contraint à la même forme via une interface explicite (pour typer les
// fonctions d'interpolation), et un hook `useXStrings()` par composant.

// === ParentDashboard ===

interface ParentDashboardStrings {
  back: string;
  parentArea: string;
  profileSuffix: (name: string) => string;
  overview: string;
  sessions: string;
  currentStreak: string;
  bestStreak: string;
  masteredFacts: string;
  operation: string;
  multiplications: string;
  divisions: string;
  remainders: string;
  divisionsMastered: string;
  multiplicationsMastered: string;
  remaindersMastered: string;
  boxDistribution: string;
  learnMoreLeitner: string;
  boxDistributionSubtitle: (op: string) => string;
  leitnerGrid: string;
  leitnerGridSubtitle: (op: string) => string;
  opDivision: string;
  opMultiplication: string;
  opRemainder: string;
  opDivisionsPlural: string;
  opMultiplicationsPlural: string;
  opRemaindersPlural: string;
  factDivision: string;
  factMultiplication: string;
  factRemainder: string;
  correctAnswerRate: string;
  averageResponseTime: string;
  hardestFacts: string;
  hardestFactsSubtitle: (window: number) => string;
  errors: (count: number) => string;
  boxLabel: (box: number) => string;
  sessionHistory: string;
  backup: string;
  export: string;
  import: string;
  transfer: string;
  transferPreparing: string;
  transferError: string;
  transferHint: (minutes: number) => string;
  transferCopyLink: string;
  transferQrAlt: string;
  helpAndFeedback: string;
  userGuide: string;
  sendFeedback: string;
  shareTablito: string;
  shareSubtitle: string;
  linkCopied: string;
  shareApp: string;
  about: string;
  whatsNew: string;
  privacy: string;
  profiles: string;
  profilesSubtitle: (name: string) => string;
  addChild: string;
  deleteThisProfile: string;
  pasteJsonHere: string;
  confirmImport: string;
  appVersionLabel: string;
  shareText: string;
  // formats de date / opérande
  formatShortDate: (date: Date) => string;
  formatLongDate: (date: Date) => string;
  divSymbol: string;
  multSymbol: string;
  remSymbol: string;
  formatDivFact: (dividend: number, divisor: number, quotient: number) => string;
  formatMultFact: (a: number, b: number, product: number) => string;
  // Niveau 3 : une « zone » de dividendes (specs §12.6) — « 42-48 ÷ 7 ».
  formatRemFact: (lo: number, hi: number, divisor: number) => string;
}

const parentDashboardFr: ParentDashboardStrings = {
  back: 'Retour',
  parentArea: 'Espace parent',
  profileSuffix: (name) => `${name}\u00a0· profil`,
  overview: "Vue d'ensemble",
  sessions: 'Séances',
  currentStreak: 'Série actuelle',
  bestStreak: 'Meilleure série',
  masteredFacts: 'Faits maîtrisés',
  operation: 'Opération',
  multiplications: 'Multiplications',
  divisions: 'Divisions',
  remainders: 'Avec reste',
  divisionsMastered: 'Divisions maîtrisées',
  multiplicationsMastered: 'Multiplications maîtrisées',
  remaindersMastered: 'Divisions avec reste maîtrisées',
  boxDistribution: 'Répartition par boîte',
  learnMoreLeitner: 'En savoir plus sur le système de Leitner',
  boxDistributionSubtitle: (op) =>
    `Combien de ${op} dans chaque boîte de révision (B1 = à réviser souvent, B5 = bien ancrées).`,
  leitnerGrid: 'Grille Leitner',
  leitnerGridSubtitle: (op) =>
    `Une case par ${op}, colorée selon sa boîte. Le rouge signale les faits récents ou en difficulté, le vert ceux bien ancrés.`,
  opDivision: 'division',
  opMultiplication: 'multiplication',
  opRemainder: 'division avec reste',
  opDivisionsPlural: 'divisions',
  opMultiplicationsPlural: 'multiplications',
  opRemaindersPlural: 'divisions avec reste',
  factDivision: 'Division',
  factMultiplication: 'Multiplication',
  factRemainder: 'Division avec reste',
  correctAnswerRate: 'Taux de bonnes réponses',
  averageResponseTime: 'Temps de réponse moyen',
  hardestFacts: 'Faits les plus difficiles',
  hardestFactsSubtitle: (window) => `Sur les ${window} dernières séances.`,
  errors: (count) => `${count} erreur${count > 1 ? 's' : ''}`,
  boxLabel: (box) => `Boîte ${box}`,
  sessionHistory: 'Historique des séances',
  backup: 'Sauvegarde',
  export: 'Exporter',
  import: 'Importer',
  transfer: 'Transférer',
  transferPreparing: 'Préparation du transfert…',
  transferError:
    "Transfert impossible pour le moment. Vérifiez la connexion internet, ou passez par Exporter / Importer.",
  transferHint: (minutes) =>
    `Scannez ce QR code avec l'appareil photo du nouvel appareil : Tablito s'y ouvrira avec la progression. Valable ${minutes} minutes, une seule fois.`,
  transferCopyLink: 'Ou copier le lien',
  transferQrAlt: 'QR code de transfert vers un autre appareil',
  helpAndFeedback: 'Aide & retours',
  userGuide: 'Guide utilisateur',
  sendFeedback: 'Envoyer un avis',
  shareTablito: 'Partager Tablito',
  shareSubtitle: "Envoyez le lien de l'app à un autre parent.",
  linkCopied: 'Lien copié ✓',
  shareApp: 'Partager l’app',
  about: 'À propos',
  whatsNew: 'Nouveautés',
  privacy: 'Confidentialité',
  profiles: 'Profils',
  profilesSubtitle: (name) =>
    `Plusieurs enfants sur le même appareil\u00a0? Chacun a son profil\u00a0: progression, badges et images séparés. La suppression efface le profil de ${name} de cet appareil — pour recommencer à zéro, supprimez puis recréez le profil.`,
  addChild: 'Ajouter un enfant',
  deleteThisProfile: 'Supprimer ce profil',
  pasteJsonHere: 'Collez le JSON ici...',
  confirmImport: "Confirmer l'import",
  appVersionLabel: "Version de l'app",
  shareText: 'Tablito — pour apprendre les tables de multiplication.',
  formatShortDate: (date) =>
    date.toLocaleDateString(localeFor('fr'), { day: 'numeric', month: 'short' }),
  formatLongDate: (date) =>
    date.toLocaleDateString(localeFor('fr'), { weekday: 'short', day: 'numeric', month: 'long' }),
  divSymbol: '÷',
  multSymbol: '×',
  remSymbol: '÷ʳ',
  formatDivFact: (dividend, divisor, quotient) =>
    `${dividend} ÷ ${divisor} = ${quotient}`,
  formatMultFact: (a, b, product) => `${a} × ${b} = ${product}`,
  formatRemFact: (lo, hi, divisor) => `${lo}-${hi} ÷ ${divisor}`,
};

const parentDashboardEn: ParentDashboardStrings = {
  back: 'Back',
  parentArea: 'Parent area',
  profileSuffix: (name) => `${name}\u00a0· profile`,
  overview: 'Overview',
  sessions: 'Sessions',
  currentStreak: 'Current streak',
  bestStreak: 'Best streak',
  masteredFacts: 'Mastered facts',
  operation: 'Operation',
  multiplications: 'Multiplication',
  divisions: 'Division',
  remainders: 'Remainders',
  divisionsMastered: 'Division facts mastered',
  multiplicationsMastered: 'Multiplication facts mastered',
  remaindersMastered: 'Remainder facts mastered',
  boxDistribution: 'Distribution by box',
  learnMoreLeitner: 'Learn more about the Leitner system',
  boxDistributionSubtitle: (op) =>
    `How many ${op} facts are in each review box (B1 = review often, B5 = well learned).`,
  leitnerGrid: 'Leitner grid',
  leitnerGridSubtitle: (op) =>
    `One cell per ${op} fact, colored by its box. Red flags recent or tricky facts, green the well-learned ones.`,
  opDivision: 'division',
  opMultiplication: 'multiplication',
  opRemainder: 'division-with-remainder',
  // En anglais « X facts » prend le singulier ; même mot que la grille Leitner.
  opDivisionsPlural: 'division',
  opMultiplicationsPlural: 'multiplication',
  opRemaindersPlural: 'division-with-remainder',
  factDivision: 'Division',
  factMultiplication: 'Multiplication',
  factRemainder: 'Division with remainder',
  correctAnswerRate: 'Correct answer rate',
  averageResponseTime: 'Average response time',
  hardestFacts: 'Hardest facts',
  hardestFactsSubtitle: (window) => `Over the last ${window} sessions.`,
  errors: (count) => `${count} error${count > 1 ? 's' : ''}`,
  boxLabel: (box) => `Box ${box}`,
  sessionHistory: 'Session history',
  backup: 'Backup',
  export: 'Export',
  import: 'Import',
  transfer: 'Transfer',
  transferPreparing: 'Preparing the transfer…',
  transferError:
    "Can't transfer right now. Check the internet connection, or use Export / Import instead.",
  transferHint: (minutes) =>
    `Scan this QR code with the new device's camera: Tablito will open there with the progress. Valid for ${minutes} minutes, one use only.`,
  transferCopyLink: 'Or copy the link',
  transferQrAlt: 'QR code to transfer to another device',
  helpAndFeedback: 'Help & feedback',
  userGuide: 'User guide',
  sendFeedback: 'Send feedback',
  shareTablito: 'Share Tablito',
  shareSubtitle: 'Send the app link to another parent.',
  linkCopied: 'Link copied ✓',
  shareApp: 'Share the app',
  about: 'About',
  whatsNew: "What's new",
  privacy: 'Privacy',
  profiles: 'Profiles',
  profilesSubtitle: (name) =>
    `Several children on the same device?\u00a0Each has their own profile: progress, badges and pictures kept separate. Deleting removes ${name}'s profile from this device — to start over, delete then recreate the profile.`,
  addChild: 'Add a child',
  deleteThisProfile: 'Delete this profile',
  pasteJsonHere: 'Paste the JSON here...',
  confirmImport: 'Confirm import',
  appVersionLabel: 'App version',
  shareText: 'Tablito — to learn the multiplication tables.',
  formatShortDate: (date) =>
    date.toLocaleDateString(localeFor('en'), { day: 'numeric', month: 'short' }),
  formatLongDate: (date) =>
    date.toLocaleDateString(localeFor('en'), { weekday: 'short', day: 'numeric', month: 'long' }),
  divSymbol: '÷',
  multSymbol: '×',
  remSymbol: '÷ʳ',
  formatDivFact: (dividend, divisor, quotient) =>
    `${dividend} ÷ ${divisor} = ${quotient}`,
  formatMultFact: (a, b, product) => `${a} × ${b} = ${product}`,
  formatRemFact: (lo, hi, divisor) => `${lo}-${hi} ÷ ${divisor}`,
};

export const parentDashboardStrings = {
  fr: parentDashboardFr,
  en: parentDashboardEn,
};

export function useParentDashboardStrings(): ParentDashboardStrings {
  return useStrings(parentDashboardStrings);
}

// === ParentGate ===

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

// === NotificationSettings ===

interface NotificationSettingsStrings {
  dailyReminder: string;
  iosInstallSubtitle: string;
  reminderSubtitle: string;
  enabled: string;
  enableReminder: string;
  blocked: string;
  unavailable: string;
}

const notificationSettingsFr: NotificationSettingsStrings = {
  dailyReminder: 'Rappel quotidien',
  iosInstallSubtitle:
    "Pour recevoir un petit rappel chaque jour à 18h, installe d'abord Tablito sur l'écran d'accueil (menu Partager de Safari → « Sur l'écran d'accueil »).",
  reminderSubtitle:
    'Une notification chaque jour à 18h pour penser à réviser les tables (jamais les jours où la séance est déjà faite).',
  enabled: 'Activé',
  enableReminder: 'Activer le rappel',
  blocked:
    'Notifications bloquées. Autorise-les dans les réglages de ton navigateur, puis réessaie.',
  unavailable: "Impossible d'activer le rappel pour le moment. Réessaie plus tard.",
};

const notificationSettingsEn: NotificationSettingsStrings = {
  dailyReminder: 'Daily reminder',
  iosInstallSubtitle:
    'To get a little reminder every day at 6pm, first add Tablito to your home screen (Safari Share menu → "Add to Home Screen").',
  reminderSubtitle:
    'A notification every day at 6pm to remember to review the tables (never on days the session is already done).',
  enabled: 'On',
  enableReminder: 'Turn on reminder',
  blocked:
    'Notifications are blocked. Allow them in your browser settings, then try again.',
  unavailable: "Can't turn on the reminder right now. Please try again later.",
};

export const notificationSettingsStrings = {
  fr: notificationSettingsFr,
  en: notificationSettingsEn,
};

export function useNotificationSettingsStrings(): NotificationSettingsStrings {
  return useStrings(notificationSettingsStrings);
}

// === FeedbackModal ===

interface FeedbackModalStrings {
  notConfigured: string;
  close: string;
  title: string;
  thanks: string;
  messageLabel: string;
  messagePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  attachHistory: string;
  attachHistoryHint: string;
  errorPrefix: (msg: string) => string;
  sendFailed: string;
  cancel: string;
  sending: string;
  send: string;
}

const feedbackModalFr: FeedbackModalStrings = {
  notConfigured: "Le formulaire n'est pas configuré.",
  close: 'Fermer',
  title: 'Votre avis',
  thanks: "Merci, c'est bien reçu\u00a0!",
  messageLabel:
    'Dites-nous ce qui va, ce qui ne va pas, ou ce que vous aimeriez voir',
  messagePlaceholder: 'Votre message…',
  emailLabel: 'Email (optionnel, si vous souhaitez une réponse)',
  emailPlaceholder: 'vous@exemple.com',
  attachHistory: "Joindre l'historique détaillé du profil",
  attachHistoryHint:
    'Si vous signalez un bug précis, ça aide à reproduire. Inclut les multiplications posées et les réponses données — pas le prénom.',
  errorPrefix: (msg) => `Erreur : ${msg}`,
  sendFailed: 'Envoi impossible',
  cancel: 'Annuler',
  sending: 'Envoi…',
  send: 'Envoyer',
};

const feedbackModalEn: FeedbackModalStrings = {
  notConfigured: 'The form is not configured.',
  close: 'Close',
  title: 'Your feedback',
  thanks: 'Thanks, we got it!',
  messageLabel: "Tell us what works, what doesn't, or what you'd like to see",
  messagePlaceholder: 'Your message…',
  emailLabel: "Email (optional, if you'd like a reply)",
  emailPlaceholder: 'you@example.com',
  attachHistory: 'Attach the detailed profile history',
  attachHistoryHint:
    "If you're reporting a specific bug, this helps reproduce it. Includes the multiplications asked and the answers given — not the first name.",
  errorPrefix: (msg) => `Error: ${msg}`,
  sendFailed: "Couldn't send",
  cancel: 'Cancel',
  sending: 'Sending…',
  send: 'Send',
};

export const feedbackModalStrings = {
  fr: feedbackModalFr,
  en: feedbackModalEn,
};

export function useFeedbackModalStrings(): FeedbackModalStrings {
  return useStrings(feedbackModalStrings);
}
