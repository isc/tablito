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
  introducedAt?: string; // ISO date de l'écran d'intro réel (≠ 1ʳᵉ révision).
                         // Absent pour les faits dominés au placement (jamais
                         // introduits par un écran) → ils ne déclenchent pas
                         // l'espacement 48h des intros similaires (§1.2).
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

// === Niveau 3 — division avec reste (cf. specs §12) ===
// L'unité de maîtrise n'est pas un énoncé figé mais une ZONE : la case
// (divisor, quotient) couvre les dividendes de divisor×quotient inclus à
// divisor×(quotient+1) exclu. Le reste est tiré au sort à chaque présentation
// (specs §12.2) — il vit sur la question (RemainderSessionQuestion), jamais
// ici : l'état Leitner est porté par la zone, quel que soit le reste tiré.
// 64 zones, non commutatives comme la division ((7,6) ≠ (6,7)).
export interface RemainderFact {
  divisor: number;    // diviseur (2-9)
  quotient: number;   // quotient attendu (2-9) ; dividende de base = divisor × quotient
  box: 1 | 2 | 3 | 4 | 5;
  lastSeen: string;    // ISO date
  nextDue: string;     // ISO date
  history: Attempt[];
  introduced: boolean;
}

// === Matière conjugaison (cf. spec Verbito) ===
// La conjugaison n'est PAS un niveau empilé sur les maths : c'est une MATIÈRE
// séparée (séance propre, image mystère propre, badges propres ; seule la
// flamme de série est partagée). Elle est fr-only — masquée quand la langue
// d'interface est l'anglais.
export type ConjTense = 'present' | 'imparfait' | 'futur';

export type ConjPerson = 'je' | 'tu' | 'il' | 'nous' | 'vous' | 'ils';

/**
 * Nature d'un fait de conjugaison (spec §2.1, §3.3) :
 * - `ending`   : une TERMINAISON régulière (le radical est affiché, l'enfant ne
 *                tape que la terminaison) — « présent 1er groupe -ons » ;
 * - `irregular`: une FORME irrégulière entière, stockée telle quelle en mémoire
 *                (« vous faites ») — l'enfant tape la forme complète ;
 * - `stem`     : un RADICAL irrégulier (« ser- », « ét- ») porté par des
 *                terminaisons régulières — l'enfant tape la forme complète, et
 *                la segmentation radical|terminaison permet l'attribution
 *                d'erreur diagnostique (§4.5).
 */
export type ConjFactKind = 'ending' | 'irregular' | 'stem';

/**
 * État Leitner d'un fait de conjugaison.
 *
 * Contrairement à MultiFact/DivisionFact, le fait persisté ne porte QUE sa clé :
 * la définition (temps, personne, verbe, phrases porteuses…) vit dans
 * l'inventaire statique de `lib/conjugationFacts.ts`, résolue par
 * `conjFactDef(key)`. Un inventaire de 63 entrées avec 2-3 phrases porteuses
 * chacune n'a rien à faire dans le localStorage de chaque profil, et cette
 * indirection rend les corrections de l'inventaire (typo dans une phrase,
 * ajout d'une porteuse) rétro-actives sans migration.
 */
export interface ConjFact {
  key: string;         // clé stable du fait (cf. lib/conjugationFacts.ts)
  box: BoxLevel;
  lastSeen: string;    // ISO date
  nextDue: string;     // ISO date
  history: Attempt[];
  introduced: boolean;
  // Date de l'écran d'introduction réel (≠ 1ʳᵉ révision), comme MultiFact :
  // sert l'espacement 48 h des introductions de faits en interférence (§3.4).
  // Absent pour les faits ensemencés par dominance au placement.
  introducedAt?: string;
}

export interface Badge {
  // Un badge persisté ne porte que sa clé de progression (`id`), sa date et son
  // `icon` (affiché tel quel au recap). Le libellé est toujours re-résolu par
  // `id` selon la langue courante (cf. badgeName / visibleBadgeDefinitions) :
  // pas de `name`/`description` figés. Les anciens profils peuvent en contenir,
  // c'est sans effet — l'import ne valide pas la forme des badges et rien ne les
  // lit.
  id: string;
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
  // === Niveau 3 — division avec reste (cf. specs §12). Optionnels : absents
  // des profils antérieurs, backfillés par migrateProfile au chargement. ===
  remainderFacts?: RemainderFact[];
  // Image mystère dédiée au niveau 3 (specs §12.6), distincte des deux autres.
  remainderMysteryTheme?: MysteryTheme;
  // === Matière conjugaison (cf. spec Verbito). Optionnels : absents des
  // profils antérieurs, backfillés par migrateProfile au chargement. ===
  // Les 63 faits de conjugaison (cf. createInitialConjFacts).
  conjFacts?: ConjFact[];
  // Image mystère dédiée à la conjugaison (spec §7.1) : matière séparée ⇒ pool
  // propre, tiré distinct des thèmes des niveaux de maths.
  conjMysteryTheme?: MysteryTheme;
  hasSeenConjIntro?: boolean;
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

// Niveau 3 — division avec reste : deux saisies (quotient puis reste) et un
// geste en deux temps (encadrement puis écart), mesurés de l'affichage de la
// question à la validation du reste (specs §12.7). +2 s sur le seuil division.
export const REMAINDER_FAST_THRESHOLD_MS: Record<'keypad' | 'voice', number> = {
  keypad: 8000,
  voice: 6000,
};

// Matière conjugaison — seuil de rapidité (spec §4.5). Contrairement aux maths,
// le seuil n'est pas une constante : la réponse n'est pas un nombre de 1-2
// chiffres tapé sur un pavé numérique mais une chaîne de 1 à 8 caractères
// tapée sur un clavier alphabétique. Le coût moteur est donc proportionnel à
// la longueur — d'où « base + coût par caractère », proposition initiale de la
// spec, explicitement donnée comme à calibrer en conditions réelles.
export const CONJ_FAST_BASE_MS = 5000;
export const CONJ_FAST_PER_CHAR_MS = 1000;

/**
 * Seuil « rapide » (étoile rayonnante + montée de boîte) d'une question de
 * conjugaison, fonction de la réponse attendue (spec §4.5).
 *
 * En mode vocal épelé, le coût moteur disparaît : le chrono s'arrête au DÉBUT
 * de l'épellation (latence de rappel pur), donc pas de terme par caractère —
 * seule la base subsiste.
 */
export function conjFastThresholdMs(
  expected: string,
  inputMode: 'keypad' | 'voice' = 'keypad',
): number {
  if (inputMode === 'voice') return CONJ_FAST_BASE_MS;
  return CONJ_FAST_BASE_MS + CONJ_FAST_PER_CHAR_MS * expected.length;
}

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

// Question de division avec reste (niveau 3, specs §12). Le reste est tiré au
// sort à la composition de la séance : le dividende affiché vaut
// divisor × quotient + remainder. Deux réponses attendues (quotient puis reste).
export interface RemainderSessionQuestion {
  fact: RemainderFact;
  remainder: number;  // 0..divisor-1 ; 0 garde vivante la discrimination « ça tombe juste »
  isIntroduction: boolean;
  isRetry: boolean;
  isBonusReview: boolean;
}

/** Dividende affiché d'une question de division avec reste. */
export function remainderDividend(q: Pick<RemainderSessionQuestion, 'fact' | 'remainder'>): number {
  return q.fact.divisor * q.fact.quotient + q.remainder;
}

// Élément d'une séance mixte (specs §11.6, §12.3) : après déblocage, la séance
// du jour est le niveau actif (division, puis division avec reste) mais peut
// intégrer des révisions d'entretien des niveaux précédents, entrelacées. Le
// discriminant `kind` permet à l'écran de séance de rendre chaque question
// selon son type.
// Question de conjugaison (spec §4.1). La question = un fait + UNE de ses 2-3
// phrases porteuses (le choix de la phrase est fait à la composition, pas au
// rendu : le MP3 pré-généré doit coller à la phrase affichée). Tout le reste
// (pronom, radical affiché, réponse attendue, segmentation) se dérive du couple
// (fait, porteuse) via `resolveConjQuestion`.
export interface ConjSessionQuestion {
  fact: ConjFact;
  carrierIndex: number;
  isIntroduction: boolean;
  isRetry: boolean;
  isBonusReview: boolean;
}

export type SessionItem =
  | ({ kind: 'mult' } & SessionQuestion)
  | ({ kind: 'div' } & DivisionSessionQuestion)
  | ({ kind: 'rem' } & RemainderSessionQuestion);

// Variante conjugaison de la même famille de discriminants `kind` — c'est elle
// que l'écran de séance unifié rendra pour une séance de conjugaison.
//
// Pourquoi PAS dans `SessionItem` : la conjugaison est une MATIÈRE, pas un
// niveau. Une séance ne mélange jamais 'conj' avec les kinds mathématiques
// (§7.2 : matières séparées, seule la flamme de série est partagée), et
// `SessionItem` est précisément le type « une question de la séance de maths »
// que lisent dailyComposer, itemDisplay, itemTable/itemConflict — tous
// mathématiques par nature. Élargir ce type-là forcerait chacun de ces
// consommateurs à écarter un cas qui ne peut pas se produire.
// L'écran de séance, lui, prend `AnySessionItem` et dispatche par `kind`.
export type ConjSessionItem = { kind: 'conj' } & ConjSessionQuestion;

/** Une question de séance, toutes matières confondues. */
export type AnySessionItem = SessionItem | ConjSessionItem;

// Log par question pour les séances enregistrées depuis l'ajout du champ.
// Permet de diagnostiquer vitesse et mode après coup, y compris pour les
// révisions bonus qui ne créent pas d'entrée dans `fact.history` (cf. App.tsx
// handleAnswer). Champ optionnel sur SessionResult pour rétrocompat avec les
// profils antérieurs.
export interface SessionQuestionLog {
  // Type de question. Absent des logs antérieurs au niveau 2 → traiter comme
  // 'mult'. Indispensable pour ne pas confondre une division avec une
  // multiplication dans le feedback : pour 'div', `a`/`b` portent diviseur et
  // quotient (le dividende = a × b), sinon `56 ÷ 7` serait illisible comme
  // `{a:7, b:8}`, identique à `7 × 8`. Pour 'rem', a = diviseur, b = quotient
  // (la zone), et `remainder` porte le reste tiré pour cette présentation.
  kind?: 'mult' | 'div' | 'rem';
  // 'mult' : opérandes (canoniques). 'div'/'rem' : a = diviseur, b = quotient.
  a: number;
  b: number;
  correct: boolean;
  responseTimeMs: number;
  answeredWith: number | null;
  // Niveau 3 uniquement : reste tiré pour la question, et reste répondu (null
  // si la question s'est arrêtée à un quotient faux). `answeredWith` porte le
  // quotient répondu.
  remainder?: number;
  answeredRemainder?: number | null;
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
  // Log par-question de la séance. ⚠️ NE PAS supprimer comme « champ mort » :
  // aucun code ne le lit par accès direct `.questions`, mais il est embarqué
  // (via tout `sessionHistory`) dans le `profile_snapshot` du feedback opt-in
  // — voir lib/feedback.ts `buildContext(profile, includeFullProfile)`, case à
  // cocher de FeedbackModal. C'est ce qui permet de rejouer « quelles questions
  // ont été programmées dans la séance » lors de l'analyse d'un feedback (les
  // bonus reviews sont absentes de fact.history, et le mode de saisie n'est
  // tracé que là). Optionnel pour rétrocompat (séances pré-feature 32c74e5).
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
  // Niveau 2 — division (cf. specs §11). Masqués tant que le niveau n'est pas
  // débloqué (cf. isDivisionUnlocked / visibleBadgeDefinitions).
  DIV_PREMIERE_MAITRISE: 'div-premiere-maitrise',
  DIV_TABLE_PREFIX: 'div-table-',
  DIV_GENIE: 'div-genie',
  // Niveau 3 — division avec reste (cf. specs §12). Masqués tant que le niveau
  // n'est pas débloqué (cf. isRemainderUnlocked / visibleBadgeDefinitions).
  REM_PREMIERE_MAITRISE: 'rem-premiere-maitrise',
  REM_TABLE_PREFIX: 'rem-table-',
  REM_GENIE: 'rem-genie',
} as const;
