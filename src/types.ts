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

export interface Badge {
  id: string;
  name: string;
  description: string;
  earnedDate: string;
  icon: string;
}

// `village` est réservé au guide utilisateur (pour ne pas spoiler) ;
// les profils réels tirent aléatoirement dans MYSTERY_POOL à la création.
export const MYSTERY_POOL = ['market', 'ocean'] as const;

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
}

export type BoxLevel = 1 | 2 | 3 | 4 | 5;

export const BOX_INTERVALS: Record<BoxLevel, number> = {
  1: 0,
  2: 1,
  3: 3,
  4: 7,
  5: 21,
};

// Seuils de temps de réponse (ms)
export const RESPONSE_TIME = {
  FAST: 3000,
  SLOW: 5000,
} as const;

export interface SessionQuestion {
  fact: MultiFact;
  displayA: number;  // peut être inversé pour varier a×b / b×a
  displayB: number;
  isIntroduction: boolean;
  isRetry: boolean;   // re-posée après erreur dans la même séance
  isBonusReview: boolean; // révision bonus (pas de changement de boîte)
}

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
}

export interface SessionResult {
  date: string;
  questionsCount: number;
  correctCount: number;
  averageTimeMs: number;
  newFactsIntroduced: number;
  factsPromoted: number;   // faits dont la boîte finale > boîte initiale dans la séance
  questions?: SessionQuestionLog[];
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
} as const;
