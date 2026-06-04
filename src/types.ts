// === Multiplix — Types partagés ===

export interface Attempt {
  date: string;
  correct: boolean;
  responseTimeMs: number;
  answeredWith: number | null;
}

export interface MultiFact {
  a: number;           // premier opérande (2-9)
  b: number;           // second opérande (a ≤ b), (2-9)
  product: number;
  box: 1 | 2 | 3 | 4 | 5;
  lastSeen: string;    // ISO date
  nextDue: string;     // ISO date
  history: Attempt[];
  introduced: boolean; // le fait a-t-il été présenté conceptuellement ?
}

// === Niveau 2 — division (cf. specs §11) ===
// La division n'est PAS commutative : 56÷7 et 56÷8 sont deux faits distincts.
// On stocke (dividend, divisor, quotient) sans normalisation. 64 faits au
// total (un par couple (a,b) ∈ [2..9]², via (a×b) ÷ a = b).
export interface DivisionFact {
  dividend: number;   // le nombre à diviser (P = divisor × quotient) : 24, 56…
  divisor: number;    // diviseur affiché (2-9)
  quotient: number;   // réponse attendue (2-9)
  box: 1 | 2 | 3 | 4 | 5;
  lastSeen: string;    // ISO date
  nextDue: string;     // ISO date
  history: Attempt[];
  introduced: boolean;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  earnedDate: string;
  icon: string;
}

// `village` est réservé au guide utilisateur (pour ne pas spoiler) ;
// les profils réels tirent aléatoirement dans MYSTERY_POOL à la création.
export const MYSTERY_POOL = ['market', 'ocean', 'garden', 'savanna', 'city', 'space'] as const;

export type MysteryTheme = (typeof MYSTERY_POOL)[number] | 'village';

export interface UserProfile {
  name: string;
  startDate: string;
  facts: MultiFact[];
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  lastSessionDate: string | null;
  // Gels de série en réserve, consommés automatiquement quand l'enfant manque
  // 1 jour. Cf. STREAK_FREEZE_* et applyStreakUpdate dans lib/streak.ts.
  streakFreezes: number;
  badges: Badge[];
  sessionHistory: SessionResult[];
  hasSeenRulesIntro: boolean;
  // Vrai dès que l'enfant a ouvert l'écran Règles APRÈS le déblocage de la
  // règle bonus ×11 (cf. lib/badges.ts:isRule11Unlocked). Sert uniquement
  // à éteindre la pastille « Nouveau » sur le bouton Règles — la carte
  // elle-même reste visible dès le déblocage.
  hasSeenRule11: boolean;
  mysteryTheme: MysteryTheme;
  // === Niveau 2 — division (cf. specs §11). Champs optionnels : absents des
  // profils v1, backfillés par migrateProfile au chargement. ===
  // Les 64 faits de division. Toujours présents après migration (même tant
  // que le niveau n'est pas débloqué — ils restent box 1 / non introduits).
  divisionFacts?: DivisionFact[];
  // Image mystère dédiée à la division (specs §11.5), tirée distincte de
  // `mysteryTheme` pour ne jamais re-flouter l'image multiplication conquise.
  divisionMysteryTheme?: MysteryTheme;
  hasSeenDivisionIntro?: boolean;
}

export type BoxLevel = 1 | 2 | 3 | 4 | 5;

export const BOX_INTERVALS: Record<BoxLevel, number> = {
  1: 0,
  2: 1,
  3: 3,
  4: 7,
  5: 21,
};

// Seuils de temps de réponse (ms) — utilisés par le test de placement (qui
// est clavier-only et a sa propre logique de notation).
export const RESPONSE_TIME = {
  FAST: 3000,
  SLOW: 5000,
} as const;

// Seuil unique par mode pour les séances : décrocher l'étoile rayonnante ET
// faire monter la boîte (cf. spec §3.3 + §3.7). En voix le seuil est plus bas
// car la prononciation et le STT introduisent peu de latence d'output ; au
// clavier on tolère ~2 s de plus pour absorber le surcoût moteur du pavé
// numérique chez un enfant de 7-9 ans.
export const FAST_THRESHOLD_MS: Record<'keypad' | 'voice', number> = {
  keypad: 5000,
  voice: 3000,
};

// Niveau 2 — division : seuil plus généreux que la multiplication (specs §11.6).
// La division reste plus lente même maîtrisée (effet de taille du problème plus
// marqué, Curtis et al. 2016) : on tolère ~1 s de plus avant de retirer l'étoile
// rayonnante / bloquer la montée de boîte. La magnitude (+1 s) est un choix
// d'implémentation, la spec ne fixant que « plus généreux ».
export const DIVISION_FAST_THRESHOLD_MS: Record<'keypad' | 'voice', number> = {
  keypad: 6000,
  voice: 4000,
};

export interface SessionQuestion {
  fact: MultiFact;
  displayA: number;  // peut être inversé pour varier a×b / b×a
  displayB: number;
  isIntroduction: boolean;
  isRetry: boolean;   // re-posée après erreur dans la même séance
  isBonusReview: boolean; // révision bonus (pas de changement de boîte)
}

// Question de division. Pas de displayA/displayB inversables : la division
// n'étant pas commutative (specs §11.2), la question est toujours posée
// « dividend ÷ divisor = ? ».
export interface DivisionSessionQuestion {
  fact: DivisionFact;
  isIntroduction: boolean;
  isRetry: boolean;
  isBonusReview: boolean;
}

// Élément d'une séance mixte (specs §11.6) : après déblocage, la séance du
// jour est principalement de la division mais peut intégrer des révisions
// d'entretien des tables (× et ÷ entrelacés). Le discriminant `kind` permet à
// l'écran de séance de rendre chaque question selon son type.
export type SessionItem =
  | ({ kind: 'mult' } & SessionQuestion)
  | ({ kind: 'div' } & DivisionSessionQuestion);

// Log par question pour les séances enregistrées depuis l'ajout du champ.
// Permet de diagnostiquer vitesse et mode après coup, y compris pour les
// révisions bonus qui ne créent pas d'entrée dans `fact.history` (cf. App.tsx
// handleAnswer). Champ optionnel sur SessionResult pour rétrocompat avec les
// profils antérieurs.
export interface SessionQuestionLog {
  a: number;
  b: number;
  correct: boolean;
  responseTimeMs: number;
  answeredWith: number | null;
  isBonusReview: boolean;
  inputMode: 'keypad' | 'voice';
  // « Étoile dorée » : correct ET sous le seuil de rapidité du type de question
  // (mult ou division). Enregistré au moment de la réponse pour que le badge
  // Véloce s'appuie sur le bon seuil dans une séance mixte. Optionnel (absent
  // des logs antérieurs).
  fast?: boolean;
}

export interface SessionResult {
  date: string;
  questionsCount: number;
  correctCount: number;
  averageTimeMs: number;
  newFactsIntroduced: number;
  factsPromoted: number;   // faits dont la boîte finale > boîte initiale dans la séance
}

// Badges IDs
export const BADGE_IDS = {
  PREMIER_PAS: 'premier-pas',
  PREMIERE_CASE: 'premiere-case',
  PREMIERE_MAITRISE: 'premiere-maitrise',
  REGULIER: 'regulier',
  MACHINE: 'machine',
  EXPLORATION: 'exploration',
  TABLE_PREFIX: 'table-',
  GENIE_MATHS: 'genie-maths',
  VELOCE: 'veloce',
  PERSEVERANCE: 'perseverance',
  FLAMME_ETERNELLE: 'flamme-eternelle',
  // Niveau 2 — division (cf. specs §11). Masqués tant que le niveau n'est pas
  // débloqué (cf. isDivisionUnlocked / visibleBadgeDefinitions).
  DIV_PREMIERE_MAITRISE: 'div-premiere-maitrise',
  DIV_TABLE_PREFIX: 'div-table-',
  DIV_GENIE: 'div-genie',
} as const;
