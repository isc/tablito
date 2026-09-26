import { formatList, localeFor, useStrings, type Lang } from './lang';
import { remainderZoneTitleStrings } from './progress';

// Strings de l'espace parent : ParentDashboard et ses pages, lignes de
// notification et FeedbackModal (le portail d'entrée a les siennes, chargées au
// démarrage : cf. parentGate.ts). Même pattern que voice.ts — un dico `fr` source, un `en`
// contraint à la même forme via une interface explicite (pour typer les
// fonctions d'interpolation), et un hook `useXStrings()` par composant.

// Fraîcheur du dernier instantané d'un suivi à distance, en relatif (« il y a
// 2 heures »). Renvoie null sous la minute : l'appelant affiche alors son propre
// « à l'instant », Intl.RelativeTimeFormat ne sachant pas le dire joliment.
function timeAgo(iso: string, lang: Lang): string | null {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return null;
  const rtf = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: 'always' });
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  return hours < 24 ? rtf.format(-hours, 'hour') : rtf.format(-Math.round(hours / 24), 'day');
}

// « hier » / « il y a 3 jours » — `numeric: 'auto'` donne le mot du jour d'hier
// dans chaque langue, ce qu'une interpolation à la main devrait coder par
// langue en même temps que la règle du pluriel.
function daysAgoLabel(daysAgo: number, lang: Lang): string {
  return new Intl.RelativeTimeFormat(localeFor(lang), { numeric: 'auto' }).format(-daysAgo, 'day');
}

// === ParentDashboard ===

interface ParentDashboardStrings {
  back: string;
  backToOverview: string;
  parentArea: string;
  // Bandeau d'activité : une phrase qui dit l'état du jour, puis 14 colonnes.
  // Le titre est composé (« Aujourd'hui : … ») pour que la partie variable
  // reste une phrase entière traduisible, pas un assemblage de mots.
  activityHeading: (state: string) => string;
  activityNothingYet: string;
  activitySessionDone: string;
  activityMathDone: string;
  activityConjDone: string;
  activityBothDone: string;
  activityMathPending: string;
  activityConjPending: string;
  activityLastSession: (daysAgo: number) => string;
  activityNoSessionEver: string;
  activityAlt: (days: number) => string;
  sessions: string;
  currentStreak: string;
  bestStreak: string;
  // Accueil : une carte par matière, qui ouvre sa page.
  subjects: string;
  math: string;
  // Matière conjugaison (spec Verbito §8) : carte et page miroir des maths.
  // Entrées `en` présentes pour que la table reste totale, jamais rendues — la
  // matière est masquée quand la langue d'interface est l'anglais.
  conjugations: string;
  verbForms: string;
  // Niveau actif de la carte Maths (les niveaux passés y sont des pastilles).
  currentMult: string;
  currentDiv: string;
  currentRem: string;
  // Page Maths : sélecteur des niveaux débloqués (jamais un niveau verrouillé,
  // specs §11.3).
  level: string;
  multiplications: string;
  divisions: string;
  remainders: string;
  // Nom complet du niveau 3, là où « Avec reste » seul ne se comprendrait pas
  // (ligne du niveau en cours sur la carte Maths de l'accueil).
  remaindersLong: string;
  divisionsMastered: string;
  multiplicationsMastered: string;
  remaindersMastered: string;
  conjugationsMastered: string;
  // Quatre paliers lisibles à la place des boîtes B1 à B5 (cf. masteryBuckets).
  bucketMastered: string;
  bucketOnTrack: string;
  bucketFragile: string;
  bucketUnseen: string;
  masteryBarLabel: (mastered: number, total: number) => string;
  learnMoreLeitner: string;
  leitnerGrid: string;
  leitnerGridSubtitle: (op: string) => string;
  opDivision: string;
  opMultiplication: string;
  opRemainder: string;
  opConjugation: string;
  factDivision: string;
  factMultiplication: string;
  factRemainder: string;
  factConjugation: string;
  // Tout ce qui se lit par séance vit sous un seul titre de matière, au lieu
  // d'un « Séances de maths uniquement » répété sous chaque section.
  mathSessions: string;
  conjSessions: string;
  mathSessionsMixed: string;
  evolution: string;
  accuracy: string;
  speed: string;
  evolutionCaption: (count: number, average: string) => string;
  toPractise: string;
  hardestFactsSubtitle: (window: number) => string;
  errors: (count: number) => string;
  boxLabel: (box: number) => string;
  sessionHistory: string;
  showAllSessions: (count: number) => string;
  // Réglages : une liste au bas de l'accueil, dont chaque ligne ouvre sa page
  // (ou bascule sur place : rappels, langue).
  settings: string;
  settingsEyebrow: string;
  emptyProgress: string;
  transferPreparing: string;
  transferError: string;
  transferHint: (minutes: number) => string;
  transferCopyLink: string;
  transferQrAlt: string;
  // Sélecteur d'enfant : ceux de l'appareil et ceux suivis à distance.
  sourceLabel: string;
  remoteTag: string;
  remoteLoading: string;
  remoteError: string;
  remoteRevoked: (name: string) => string;
  remoteSyncedAgo: (iso: string) => string;
  remoteRefresh: string;
  remoteNoData: string;
  // Suivi à distance : partager la progression d'ici (un bloc par enfant de
  // l'appareil), suivre celle d'ailleurs.
  watchTitle: string;
  watchRowSummary: (shared: string[], following: string[]) => string;
  watchIntro: string;
  watchShareHeading: string;
  watchShareSubtitle: string;
  watchShared: string;
  watchNotShared: string;
  watchShare: (name: string) => string;
  watchShowQr: (name: string) => string;
  watchStopSharing: string;
  watchPreparing: string;
  watchShareError: string;
  watchShareHint: string;
  watchQrAlt: string;
  watchFollow: string;
  watchFollowSubtitle: string;
  watchScan: string;
  watchScanPrompt: string;
  watchCameraError: string;
  watchLinkError: string;
  watchPasteLink: string;
  watchPastePlaceholder: string;
  watchPasteConfirm: string;
  watchStopFollowing: string;
  cancel: string;
  // Profils et sauvegarde
  profilesTitle: string;
  profilesRowSubtitle: (names: string[]) => string;
  profilesHeading: string;
  profileActive: string;
  sessionsCount: (count: number) => string;
  addChild: string;
  createLocalProfile: string;
  profilesSubtitleWatcher: string;
  backupHeading: (name: string) => string;
  transferRowTitle: string;
  transferRowSubtitle: (minutes: number) => string;
  exportRowTitle: string;
  exportRowSubtitle: string;
  importRowTitle: string;
  importRowSubtitle: (name: string) => string;
  importInvalid: string;
  importConfirm: (current: string, backup: string, sessions: string) => string;
  importDone: (name: string) => string;
  deleteProfile: (name: string) => string;
  deleteProfileHint: string;
  // Aide et infos
  helpTitle: string;
  helpRowSubtitle: string;
  userGuide: string;
  guideSubtitle: string;
  sendFeedback: string;
  feedbackSubtitle: string;
  shareTablito: string;
  shareSubtitle: string;
  linkCopied: string;
  whatsNew: string;
  privacy: string;
  appVersionLabel: string;
  shareText: string;
  // formats de date / durée / pourcentage / opérande
  formatSeconds: (seconds: number) => string;
  formatPercent: (percent: number) => string;
  formatShortDate: (date: Date) => string;
  // Initiale du jour de la semaine sous les colonnes du bandeau d'activité.
  formatWeekdayNarrow: (date: Date) => string;
  formatLongDate: (date: Date) => string;
  divSymbol: string;
  multSymbol: string;
  remSymbol: string;
  conjSymbol: string;
  formatDivFact: (dividend: number, divisor: number, quotient: number) => string;
  formatMultFact: (a: number, b: number, product: number) => string;
  // Niveau 3 : une « zone » de dividendes (specs §12.6) — « 42 à 48 ÷ 7 ».
  formatRemFact: (lo: number, hi: number, divisor: number) => string;
}

const parentDashboardFr: ParentDashboardStrings = {
  back: 'Retour',
  backToOverview: "Retour à l'accueil de l'espace parent",
  parentArea: 'Espace parent',
  activityHeading: (state) => `Aujourd'hui\u00a0: ${state}`,
  activityNothingYet: 'pas encore de séance',
  activitySessionDone: 'séance faite',
  activityMathDone: 'maths faites',
  activityConjDone: 'conjugaison faite',
  activityBothDone: 'maths et conjugaison faites',
  activityMathPending: 'Maths pas encore.',
  activityConjPending: 'Conjugaison pas encore.',
  activityLastSession: (daysAgo) => `Dernière séance ${daysAgoLabel(daysAgo, 'fr')}.`,
  activityNoSessionEver: 'Aucune séance pour le moment.',
  activityAlt: (days) => `Activité des ${days} derniers jours`,
  sessions: 'Séances',
  currentStreak: 'Série actuelle',
  bestStreak: 'Meilleure série',
  subjects: 'Matières',
  math: 'Maths',
  conjugations: 'Conjugaison',
  verbForms: 'Formes verbales',
  currentMult: 'En cours\u00a0: les multiplications',
  currentDiv: 'En cours\u00a0: les divisions',
  currentRem: 'En cours\u00a0: la division avec reste',
  level: 'Niveau',
  multiplications: 'Multiplications',
  divisions: 'Divisions',
  remainders: 'Avec reste',
  remaindersLong: 'Divisions avec reste',
  divisionsMastered: 'Divisions maîtrisées',
  multiplicationsMastered: 'Multiplications maîtrisées',
  remaindersMastered: 'Divisions avec reste maîtrisées',
  conjugationsMastered: 'Formes verbales maîtrisées',
  bucketMastered: 'Maîtrisées',
  bucketOnTrack: 'En bonne voie',
  bucketFragile: 'À consolider',
  bucketUnseen: 'Pas encore vues',
  masteryBarLabel: (mastered, total) => `${mastered} maîtrisées sur ${total}`,
  learnMoreLeitner: 'En savoir plus sur le système de Leitner',
  leitnerGrid: 'Grille Leitner',
  leitnerGridSubtitle: (op) =>
    `Une case par ${op}, colorée selon sa boîte. Le rouge signale les faits récents ou en difficulté, le vert ceux bien ancrés.`,
  opDivision: 'division',
  opMultiplication: 'multiplication',
  opRemainder: 'division avec reste',
  opConjugation: 'forme verbale',
  factDivision: 'Division',
  factMultiplication: 'Multiplication',
  factRemainder: 'Division avec reste',
  factConjugation: 'Conjugaison',
  mathSessions: 'Séances de maths',
  conjSessions: 'Séances de conjugaison',
  mathSessionsMixed: 'Chaque séance mélange les niveaux débloqués.',
  evolution: 'Évolution',
  accuracy: 'Réussite',
  speed: 'Rapidité',
  evolutionCaption: (count, average) => `${count} dernières séances · moyenne ${average}`,
  toPractise: 'À retravailler',
  hardestFactsSubtitle: (window) => `Sur les ${window} dernières séances.`,
  errors: (count) => `${count} erreur${count > 1 ? 's' : ''}`,
  boxLabel: (box) => `Boîte ${box}`,
  sessionHistory: 'Historique des séances',
  showAllSessions: (count) => `Tout afficher (${count})`,
  settings: 'Réglages et infos',
  settingsEyebrow: 'Réglages',
  emptyProgress: 'Aucune progression à afficher sur cet appareil pour le moment.',
  transferPreparing: 'Préparation du transfert…',
  transferError:
    'Transfert impossible pour le moment. Vérifiez la connexion internet, ou passez par une sauvegarde\u00a0: exportez-la ici, puis importez-la sur le nouvel appareil.',
  transferHint: (minutes) =>
    `Scannez ce QR code avec l'appareil photo du nouvel appareil : Tablito s'y ouvrira avec la progression. Valable ${minutes} minutes, une seule fois.`,
  transferCopyLink: 'Ou copier le lien',
  transferQrAlt: 'QR code de transfert vers un autre appareil',
  sourceLabel: 'Enfant affiché',
  remoteTag: 'à distance',
  remoteLoading: 'Récupération de la progression…',
  remoteError:
    'Impossible de récupérer la progression pour le moment. Vérifiez la connexion internet, ou réessayez plus tard.',
  remoteRevoked: (name) =>
    `Le partage a été arrêté sur l'appareil de ${name}. Pour reprendre le suivi, scannez un nouveau QR code depuis son espace parent.`,
  remoteSyncedAgo: (iso) => {
    const ago = timeAgo(iso, 'fr');
    return ago ? `Synchronisé ${ago}` : "Synchronisé à l'instant";
  },
  remoteRefresh: 'Actualiser',
  remoteNoData: 'Aucune progression à afficher pour le moment.',
  watchTitle: 'Suivi à distance',
  watchRowSummary: (shared, following) => {
    const parts: string[] = [];
    if (shared.length > 0) {
      parts.push(
        shared.length > 1
          ? `Progressions de ${formatList(shared, 'fr')} partagées`
          : `Progression de ${shared[0]} partagée`,
      );
    }
    if (following.length > 0) {
      parts.push(`${parts.length > 0 ? 'vous suivez' : 'Vous suivez'} ${formatList(following, 'fr')}`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'Partager ou suivre une progression';
  },
  watchIntro:
    "Suivez la progression d'un enfant depuis le téléphone d'un parent. Chaque séance met le suivi à jour, et tout est chiffré\u00a0: seuls vos appareils peuvent la lire.",
  watchShareHeading: 'Partager depuis cet appareil',
  watchShareSubtitle: 'Un QR code par enfant, à scanner avec le téléphone du parent.',
  watchShared: 'Progression partagée',
  watchNotShared: 'Progression non partagée',
  watchShare: (name) => `Partager la progression de ${name}`,
  watchShowQr: (name) => `Revoir le QR code de ${name}`,
  watchStopSharing: 'Ne plus partager',
  watchPreparing: 'Préparation du partage…',
  watchShareError:
    'Partage impossible pour le moment. Vérifiez la connexion internet, puis réessayez.',
  watchShareHint:
    "Scannez ce QR code depuis l'appareil du parent\u00a0: la progression y apparaîtra, et se mettra à jour après chaque séance. Le partage reste ouvert jusqu'à ce que vous l'arrêtiez.",
  watchQrAlt: 'QR code de suivi à distance',
  watchFollow: 'Suivre un enfant à distance',
  watchFollowSubtitle:
    "Votre enfant pratique sur un autre appareil\u00a0? Suivez sa progression d'ici, sans installer son profil.",
  watchScan: 'Scanner un QR code',
  watchScanPrompt: "Visez le QR code affiché sur l'appareil de l'enfant.",
  watchCameraError: 'Caméra indisponible. Vous pouvez coller le lien de suivi à la place.',
  watchLinkError:
    "Ce lien de suivi n'est pas lisible. Il a peut-être été arrêté\u00a0: affichez un nouveau QR code depuis l'appareil de l'enfant.",
  watchPasteLink: 'Coller un lien',
  watchPastePlaceholder: 'https://tablito.app/#watch=…',
  watchPasteConfirm: 'Suivre',
  watchStopFollowing: 'Ne plus suivre',
  cancel: 'Annuler',
  profilesTitle: 'Profils et sauvegarde',
  profilesRowSubtitle: (names) => `${formatList(names, 'fr')} · sauvegarde`,
  profilesHeading: 'Enfants sur cet appareil',
  profileActive: 'Profil actif',
  sessionsCount: (count) => `${count} séance${count > 1 ? 's' : ''}`,
  addChild: 'Ajouter un enfant',
  createLocalProfile: 'Créer un profil sur cet appareil',
  profilesSubtitleWatcher:
    "Cet appareil ne sert qu'à suivre la progression d'un enfant qui pratique ailleurs. Vous pouvez aussi créer un profil ici, par exemple pour vous entraîner vous-même\u00a0: les deux coexistent, et vous basculez de l'un à l'autre en haut de cette page.",
  backupHeading: (name) => `Sauvegarde de ${name}`,
  transferRowTitle: "Changer d'appareil",
  transferRowSubtitle: (minutes) => `Transfert par QR code, valable ${minutes} minutes`,
  exportRowTitle: 'Exporter une sauvegarde',
  exportRowSubtitle: 'Un fichier .json à garder',
  importRowTitle: 'Importer une sauvegarde',
  importRowSubtitle: (name) => `Remplace la progression de ${name}`,
  importInvalid: "Ce fichier n'est pas une sauvegarde Tablito.",
  importConfirm: (current, backup, sessions) =>
    `Remplacer la progression de ${current} par cette sauvegarde (${backup}, ${sessions})\u00a0?`,
  importDone: (name) => `Sauvegarde importée\u00a0: la progression de ${name} est restaurée.`,
  deleteProfile: (name) => `Supprimer le profil de ${name}`,
  deleteProfileHint:
    'Efface sa progression, ses badges et ses images de cet appareil. Pensez à exporter une sauvegarde avant. Pour repartir de zéro, supprimez puis recréez le profil.',
  helpTitle: 'Aide et infos',
  helpRowSubtitle: 'Guide, avis, nouveautés, confidentialité',
  userGuide: 'Guide utilisateur',
  guideSubtitle: 'Le fonctionnement de Tablito, écran par écran',
  sendFeedback: 'Envoyer un avis',
  feedbackSubtitle: 'Une question, une idée, un souci\u00a0?',
  shareTablito: 'Partager Tablito',
  shareSubtitle: "Envoyez le lien de l'app à un autre parent.",
  linkCopied: 'Lien copié ✓',
  whatsNew: 'Nouveautés',
  privacy: 'Confidentialité',
  appVersionLabel: "Version de l'app",
  shareText: 'Tablito — pour apprendre les tables de multiplication.',
  formatSeconds: (seconds) =>
    `${seconds.toLocaleString(localeFor('fr'), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\u00a0s`,
  formatPercent: (percent) => `${percent}\u00a0%`,
  formatShortDate: (date) =>
    date.toLocaleDateString(localeFor('fr'), { day: 'numeric', month: 'short' }),
  formatWeekdayNarrow: (date) =>
    date.toLocaleDateString(localeFor('fr'), { weekday: 'narrow' }),
  formatLongDate: (date) =>
    date.toLocaleDateString(localeFor('fr'), { weekday: 'short', day: 'numeric', month: 'long' }),
  divSymbol: '÷',
  multSymbol: '×',
  remSymbol: '÷ʳ',
  conjSymbol: 'Vb',
  formatDivFact: (dividend, divisor, quotient) =>
    `${dividend} ÷ ${divisor} = ${quotient}`,
  formatMultFact: (a, b, product) => `${a} × ${b} = ${product}`,
  formatRemFact: remainderZoneTitleStrings.fr,
};

const parentDashboardEn: ParentDashboardStrings = {
  back: 'Back',
  backToOverview: 'Back to the parent area overview',
  parentArea: 'Parent area',
  activityHeading: (state) => `Today: ${state}`,
  activityNothingYet: 'no session yet',
  activitySessionDone: 'session done',
  activityMathDone: 'math done',
  activityConjDone: 'conjugation done',
  activityBothDone: 'math and conjugation done',
  activityMathPending: 'Math not done yet.',
  activityConjPending: 'Conjugation not done yet.',
  activityLastSession: (daysAgo) => `Last session ${daysAgoLabel(daysAgo, 'en')}.`,
  activityNoSessionEver: 'No session yet.',
  activityAlt: (days) => `Activity over the last ${days} days`,
  sessions: 'Sessions',
  currentStreak: 'Current streak',
  bestStreak: 'Best streak',
  subjects: 'Subjects',
  math: 'Math',
  conjugations: 'Conjugation',
  verbForms: 'Verb forms',
  currentMult: 'Working on: multiplication',
  currentDiv: 'Working on: division',
  currentRem: 'Working on: division with remainders',
  level: 'Level',
  multiplications: 'Multiplication',
  divisions: 'Division',
  remainders: 'Remainders',
  remaindersLong: 'Division with remainders',
  divisionsMastered: 'Division facts mastered',
  multiplicationsMastered: 'Multiplication facts mastered',
  remaindersMastered: 'Remainder facts mastered',
  conjugationsMastered: 'Verb forms mastered',
  bucketMastered: 'Mastered',
  bucketOnTrack: 'On track',
  bucketFragile: 'Still shaky',
  bucketUnseen: 'Not seen yet',
  masteryBarLabel: (mastered, total) => `${mastered} of ${total} mastered`,
  learnMoreLeitner: 'Learn more about the Leitner system',
  leitnerGrid: 'Leitner grid',
  leitnerGridSubtitle: (op) =>
    `One cell per ${op} fact, colored by its box. Red flags recent or tricky facts, green the well-learned ones.`,
  opDivision: 'division',
  opMultiplication: 'multiplication',
  opRemainder: 'division-with-remainder',
  opConjugation: 'verb form',
  factDivision: 'Division',
  factMultiplication: 'Multiplication',
  factRemainder: 'Division with remainder',
  factConjugation: 'Conjugation',
  mathSessions: 'Math sessions',
  conjSessions: 'Conjugation sessions',
  mathSessionsMixed: 'Each session mixes the unlocked levels.',
  evolution: 'Trend',
  accuracy: 'Accuracy',
  speed: 'Speed',
  evolutionCaption: (count, average) => `Last ${count} sessions · average ${average}`,
  toPractise: 'Needs practice',
  hardestFactsSubtitle: (window) => `Over the last ${window} sessions.`,
  errors: (count) => `${count} error${count > 1 ? 's' : ''}`,
  boxLabel: (box) => `Box ${box}`,
  sessionHistory: 'Session history',
  showAllSessions: (count) => `Show all (${count})`,
  settings: 'Settings and info',
  settingsEyebrow: 'Settings',
  emptyProgress: 'No progress to show on this device yet.',
  transferPreparing: 'Preparing the transfer…',
  transferError:
    "Can't transfer right now. Check the internet connection, or use a backup instead: export it here, then import it on the new device.",
  transferHint: (minutes) =>
    `Scan this QR code with the new device's camera: Tablito will open there with the progress. Valid for ${minutes} minutes, one use only.`,
  transferCopyLink: 'Or copy the link',
  transferQrAlt: 'QR code to transfer to another device',
  sourceLabel: 'Child shown',
  remoteTag: 'remote',
  remoteLoading: 'Fetching progress…',
  remoteError:
    'Cannot fetch the progress right now. Check the internet connection, or try again later.',
  remoteRevoked: (name) =>
    `Sharing was turned off on ${name}'s device. To resume, scan a new QR code from their parent area.`,
  remoteSyncedAgo: (iso) => {
    const ago = timeAgo(iso, 'en');
    return ago ? `Synced ${ago}` : 'Synced just now';
  },
  remoteRefresh: 'Refresh',
  remoteNoData: 'No progress to show yet.',
  watchTitle: 'Remote follow',
  watchRowSummary: (shared, following) => {
    const parts: string[] = [];
    if (shared.length > 0) parts.push(`Sharing ${formatList(shared, 'en')}'s progress`);
    if (following.length > 0) {
      parts.push(`${parts.length > 0 ? 'following' : 'Following'} ${formatList(following, 'en')}`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'Share or follow progress';
  },
  watchIntro:
    "Follow a child's progress from a parent's phone. Every session updates it, and everything is encrypted: only your devices can read it.",
  watchShareHeading: 'Share from this device',
  watchShareSubtitle: "One QR code per child, to scan with the parent's phone.",
  watchShared: 'Progress shared',
  watchNotShared: 'Progress not shared',
  watchShare: (name) => `Share ${name}'s progress`,
  watchShowQr: (name) => `Show ${name}'s QR code again`,
  watchStopSharing: 'Stop sharing',
  watchPreparing: 'Setting up sharing…',
  watchShareError: 'Cannot set up sharing right now. Check the internet connection, then try again.',
  watchShareHint:
    "Scan this QR code from the parent's device: the progress will show up there, and refresh after every session. Sharing stays on until you stop it.",
  watchQrAlt: 'Remote follow QR code',
  watchFollow: 'Follow a child remotely',
  watchFollowSubtitle:
    'Is your child practising on another device? Follow their progress from here, without installing their profile.',
  watchScan: 'Scan a QR code',
  watchScanPrompt: "Point at the QR code shown on the child's device.",
  watchCameraError: 'Camera unavailable. You can paste the follow link instead.',
  watchLinkError:
    "This follow link cannot be read. It may have been turned off: show a new QR code from the child's device.",
  watchPasteLink: 'Paste a link',
  watchPastePlaceholder: 'https://tablito.app/#watch=…',
  watchPasteConfirm: 'Follow',
  watchStopFollowing: 'Stop following',
  cancel: 'Cancel',
  profilesTitle: 'Profiles and backup',
  profilesRowSubtitle: (names) => `${formatList(names, 'en')} · backup`,
  profilesHeading: 'Children on this device',
  profileActive: 'Active profile',
  sessionsCount: (count) => `${count} session${count === 1 ? '' : 's'}`,
  addChild: 'Add a child',
  createLocalProfile: 'Create a profile on this device',
  profilesSubtitleWatcher:
    'This device only follows the progress of a child practising elsewhere. You can also create a profile here — to practise yourself, for instance: the two coexist, and you switch between them at the top of this page.',
  backupHeading: (name) => `${name}'s backup`,
  transferRowTitle: 'Move to another device',
  transferRowSubtitle: (minutes) => `Transfer by QR code, valid for ${minutes} minutes`,
  exportRowTitle: 'Export a backup',
  exportRowSubtitle: 'A .json file to keep',
  importRowTitle: 'Import a backup',
  importRowSubtitle: (name) => `Replaces ${name}'s progress`,
  importInvalid: "This file isn't a Tablito backup.",
  importConfirm: (current, backup, sessions) =>
    `Replace ${current}'s progress with this backup (${backup}, ${sessions})?`,
  importDone: (name) => `Backup imported: ${name}'s progress has been restored.`,
  deleteProfile: (name) => `Delete ${name}'s profile`,
  deleteProfileHint:
    'Erases their progress, badges and pictures from this device. Remember to export a backup first. To start over, delete and recreate the profile.',
  helpTitle: 'Help and info',
  helpRowSubtitle: 'Guide, feedback, what’s new, privacy',
  userGuide: 'User guide',
  guideSubtitle: 'How Tablito works, screen by screen',
  sendFeedback: 'Send feedback',
  feedbackSubtitle: 'A question, an idea, a problem?',
  shareTablito: 'Share Tablito',
  shareSubtitle: 'Send the app link to another parent.',
  linkCopied: 'Link copied ✓',
  whatsNew: "What's new",
  privacy: 'Privacy',
  appVersionLabel: 'App version',
  shareText: 'Tablito — to learn the multiplication tables.',
  formatSeconds: (seconds) => `${seconds.toFixed(1)}s`,
  formatPercent: (percent) => `${percent}%`,
  formatShortDate: (date) =>
    date.toLocaleDateString(localeFor('en'), { day: 'numeric', month: 'short' }),
  formatWeekdayNarrow: (date) =>
    date.toLocaleDateString(localeFor('en'), { weekday: 'narrow' }),
  formatLongDate: (date) =>
    date.toLocaleDateString(localeFor('en'), { weekday: 'short', day: 'numeric', month: 'long' }),
  divSymbol: '÷',
  multSymbol: '×',
  remSymbol: '÷ʳ',
  conjSymbol: 'Vb',
  formatDivFact: (dividend, divisor, quotient) =>
    `${dividend} ÷ ${divisor} = ${quotient}`,
  formatMultFact: (a, b, product) => `${a} × ${b} = ${product}`,
  formatRemFact: remainderZoneTitleStrings.en,
};

export const parentDashboardStrings = {
  fr: parentDashboardFr,
  en: parentDashboardEn,
};

export function useParentDashboardStrings(): ParentDashboardStrings {
  return useStrings(parentDashboardStrings);
}

// === Lignes de notification (cf. PushPrefRow) ===

// Même forme pour les deux lignes, qui ne diffèrent que par leur préférence.
export interface PushPrefStrings {
  title: string;
  subtitle: string;
  iosInstallSubtitle: string;
  blocked: string;
  unavailable: string;
}

// Rappel quotidien : pour l'ENFANT, sur l'appareil où il pratique.
export const dailyReminderStrings: Record<Lang, PushPrefStrings> = {
  fr: {
    title: 'Rappel quotidien',
    subtitle: 'Chaque jour à 18 h, sauf si la séance est déjà faite',
    iosInstallSubtitle:
      "Pour recevoir un petit rappel chaque jour à 18h, installe d'abord Tablito sur l'écran d'accueil (menu Partager de Safari → « Sur l'écran d'accueil »).",
    blocked:
      'Notifications bloquées. Autorise-les dans les réglages de ton navigateur, puis réessaie.',
    unavailable: "Impossible d'activer le rappel pour le moment. Réessaie plus tard.",
  },
  en: {
    title: 'Daily reminder',
    subtitle: 'Every day at 6pm, unless the session is already done',
    iosInstallSubtitle:
      'To get a little reminder every day at 6pm, first add Tablito to your home screen (Safari Share menu → "Add to Home Screen").',
    blocked:
      'Notifications are blocked. Allow them in your browser settings, then try again.',
    unavailable: "Can't turn on the reminder right now. Please try again later.",
  },
};

// Recap du dimanche : pour le PARENT qui suit un enfant à distance.
export const weeklyRecapStrings: Record<Lang, PushPrefStrings> = {
  fr: {
    title: 'Recap du dimanche',
    subtitle: 'Le point de la semaine, chaque dimanche soir',
    iosInstallSubtitle:
      "Pour recevoir le recap hebdomadaire, installez d'abord Tablito sur l'écran d'accueil (menu Partager de Safari → «\u00a0Sur l'écran d'accueil\u00a0»).",
    blocked:
      'Notifications bloquées. Autorisez-les dans les réglages de votre navigateur, puis réessayez.',
    unavailable: "Impossible d'activer le recap pour le moment. Réessayez plus tard.",
  },
  en: {
    title: 'Sunday recap',
    subtitle: 'A look back at the week, every Sunday evening',
    iosInstallSubtitle:
      'To get the weekly recap, first add Tablito to your home screen (Safari Share menu → "Add to Home Screen").',
    blocked:
      'Notifications are blocked. Allow them in your browser settings, then try again.',
    unavailable: "Can't turn on the recap right now. Please try again later.",
  },
};

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
  // Nommé : le formulaire vit dans l'espace parent, qui peut afficher un profil
  // suivi À DISTANCE alors que la case jointe, elle, ne peut joindre que le
  // profil local en cours (cf. buildContext). Sans le prénom, un parent qui
  // consulte l'onglet de son enfant croit joindre CE profil-là.
  attachHistory: (name: string) => string;
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
  attachHistory: (name) => `Joindre l'historique détaillé du profil de ${name}`,
  attachHistoryHint:
    "Si vous signalez un bug précis, ça aide à reproduire. Inclut les questions posées et les réponses données — pas le prénom. Uniquement le profil affiché ci-dessus, celui que vous êtes en train de regarder : pas les autres profils de cet appareil, pas les autres enfants suivis.",
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
  attachHistory: (name) => `Attach the detailed profile history for ${name}`,
  attachHistoryHint:
    "If you're reporting a specific bug, this helps reproduce it. Includes the questions asked and the answers given — not the first name. Only the profile shown above, the one you are currently looking at: not the other profiles on this device, and not the other children you follow.",
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
