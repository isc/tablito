import type { BoxLevel, IrrFact, IrrSessionQuestion, UserProfile } from '../types';
import { isDue, shouldIntroduceNew, prioritizeByBoxLevel, pickBonusReviewFacts, MASTERY_BOX } from './leitner';
import {
  IRR_FAMILIES,
  allIrrForms,
  irrIntroRank,
  irrVerbDef,
  irrVerbsOfFamily,
  normalizeIrrWord,
  type IrrFamily,
  type IrrVerbDef,
} from './irregularVerbs';
import { daysBetween, interleaveOrder } from './utils';

// === Séance de verbes irréguliers (specs §16.7) ===
//
// Même anatomie que la conjugaison : [Intro : 2 verbes nouveaux au plus] →
// [Pratique : 12-15 questions] → [Récap], plafond dur de 20 questions reprises
// comprises. Une matière : jamais mêlée aux questions des autres.

export const IRR_MIN_QUESTIONS = 12;
export const IRR_MAX_QUESTIONS = 15;
export const IRR_MAX_NEW_FACTS = 2;

/** Écarts de re-pose après une erreur ou une intro (cf. CONJ_RETRY_GAPS). */
export const IRR_RETRY_GAPS = [2, 3] as const;

// --- Interférences (specs §16.4) ---------------------------------------------
//
// Deux sortes de ressemblance. Même famille, même schéma (sing / ring) : la
// ressemblance AIDE, pas d'interférence. Infinitifs qui se ressemblent mais
// schémas différents : la ressemblance TROMPE — ce sont les paires à espacer.

/** Boîte à partir de laquelle un verbe est considéré consolidé. */
export const IRR_CONSOLIDATED_BOX: BoxLevel = 3;

/** Espacement minimal entre deux introductions de verbes en interférence. */
export const IRR_INTRO_SPACING_DAYS = 2;

/**
 * Groupes de confusion énumérés. Tous les membres d'un groupe sont en
 * interférence deux à deux.
 *
 * - les faux-amis de famille : bring / sing, ring (« brang »), think / drink
 *   (« thank »), win / swim (won contre swam), fall / feel (fell contre felt),
 *   buy / bring (bought contre brought) ;
 * - la famille -ought / -aught, à part : ses six passés riment tous à l'oral,
 *   rien dans le son ne relie l'infinitif au passé. Traitée comme les quatre
 *   monosyllabes en -ont de la conjugaison : introductions espacées, l'air de
 *   famille présenté une fois chaque verbe su séparément.
 */
export const IRR_INTERFERENCE_GROUPS: readonly (readonly string[])[] = [
  // Deux paires, pas un trio : sing et ring sont de la même famille, leur
  // ressemblance aide.
  ['bring', 'sing'],
  ['bring', 'ring'],
  ['think', 'drink'],
  ['win', 'swim'],
  ['fall', 'feel'],
  ['buy', 'bring'],
  ['think', 'bring', 'buy', 'fight', 'teach', 'catch'],
];

const PARTNERS = new Map<string, Set<string>>();
for (const group of IRR_INTERFERENCE_GROUPS) {
  for (const a of group) {
    const set = PARTNERS.get(a) ?? new Set<string>();
    for (const b of group) if (b !== a) set.add(b);
    PARTNERS.set(a, set);
  }
}

/** Les deux verbes sont-ils en interférence ? Symétrique, faux sur soi-même. */
export function irrKeysInterfere(a: string, b: string): boolean {
  return a !== b && (PARTNERS.get(a)?.has(b) ?? false);
}

/**
 * Deux verbes peuvent-ils cohabiter dans une même séance ? Non tant qu'ils
 * sont en interférence et que l'un des deux n'est pas consolidé. Consolidés,
 * ils sont au contraire entrelacés délibérément : c'est ce qui construit la
 * discrimination entre « fell » et « felt » (specs §16.4).
 */
export function canIrrCoexist(
  a: { key: string; box: BoxLevel },
  b: { key: string; box: BoxLevel },
): boolean {
  if (!irrKeysInterfere(a.key, b.key)) return true;
  return a.box >= IRR_CONSOLIDATED_BOX && b.box >= IRR_CONSOLIDATED_BOX;
}

function familyOf(key: string): IrrFamily | null {
  return irrVerbDef(key)?.family ?? null;
}

/**
 * Deux questions ne se suivent pas (specs §16.7) si elles portent sur le même
 * verbe ou sur la même famille, ou sur deux verbes en interférence non
 * consolidés.
 */
export function irrQuestionConflict(a: IrrSessionQuestion, b: IrrSessionQuestion): boolean {
  if (a.fact.key === b.fact.key) return true;
  const fa = familyOf(a.fact.key);
  if (fa !== null && fa === familyOf(b.fact.key)) return true;
  return !canIrrCoexist(a.fact, b.fact);
}

function coexistsWithAll(fact: IrrFact, ...groups: IrrFact[][]): boolean {
  return groups.every((group) => group.every((other) => canIrrCoexist(other, fact)));
}

function makeQuestion(fact: IrrFact, flags: Partial<IrrSessionQuestion> = {}): IrrSessionQuestion {
  return { fact, isIntroduction: false, isRetry: false, isBonusReview: false, ...flags };
}

/** Tout ce que la composition lit d'un profil. */
export type IrrProfile = Pick<UserProfile, 'irrFacts'>;

/**
 * Compose la séance du jour (12-15 questions quand l'inventaire le permet).
 *
 * - intro : au plus 2 verbes nouveaux, dans l'ordre de fréquence, jamais en
 *   interférence avec un verbe introduit il y a moins de 48 h ni entre eux ;
 * - révisions : verbes dus, priorisés par boîte ;
 * - anti-interférence : deux verbes confusibles non consolidés ne sont jamais
 *   dans la même séance ;
 * - padding par révisions bonus, qui ne touchent pas au calendrier Leitner.
 */
export function composeIrrSession(profile: IrrProfile, now: string): IrrSessionQuestion[] {
  const facts = (profile.irrFacts ?? []).filter((f) => irrVerbDef(f.key));
  if (facts.length === 0) return [];
  const today = now.slice(0, 10);

  const recentlyIntroduced = facts.filter(
    (f) => f.introducedAt && daysBetween(f.introducedAt, today) < IRR_INTRO_SPACING_DAYS,
  );

  const newFacts: IrrFact[] = [];
  if (shouldIntroduceNew(facts)) {
    const candidates = facts
      .filter((f) => !f.introduced)
      .sort((a, b) => irrIntroRank(a.key) - irrIntroRank(b.key));
    for (const fact of candidates) {
      if (newFacts.length >= IRR_MAX_NEW_FACTS) break;
      if (recentlyIntroduced.some((r) => irrKeysInterfere(r.key, fact.key))) continue;
      if (newFacts.some((n) => irrKeysInterfere(n.key, fact.key))) continue;
      newFacts.push(fact);
    }
  }

  const reviewBudget = IRR_MAX_QUESTIONS - newFacts.length;
  const due = prioritizeByBoxLevel(facts.filter((f) => f.introduced && isDue(f, today)));
  const selected: IrrFact[] = [];
  for (const fact of due) {
    if (selected.length >= reviewBudget) break;
    if (!coexistsWithAll(fact, newFacts, selected)) continue;
    selected.push(fact);
  }

  // Padding par révisions bonus, passées par le même filtre d'interférence que
  // les révisions dues (cf. composeConjSession) : les plus fragiles d'abord,
  // donc exactement ceux que l'anti-interférence protège.
  const bonusFacts: IrrFact[] = [];
  const planned = selected.length + newFacts.length;
  if (planned < IRR_MIN_QUESTIONS) {
    const need = IRR_MIN_QUESTIONS - planned;
    const used = new Set([...newFacts, ...selected].map((f) => f.key));
    const ranked = pickBonusReviewFacts(facts, (f) => used.has(f.key), facts.length);
    for (const fact of ranked) {
      if (bonusFacts.length >= need) break;
      if (!coexistsWithAll(fact, newFacts, selected, bonusFacts)) continue;
      bonusFacts.push(fact);
    }
  }

  const intros = newFacts.map((fact) => makeQuestion(fact, { isIntroduction: true }));
  const reviews = [
    ...selected.map((fact) => makeQuestion(fact)),
    ...bonusFacts.map((fact) => makeQuestion(fact, { isBonusReview: true })),
  ];
  return [...intros, ...interleaveOrder(reviews, irrQuestionConflict, intros.at(-1))];
}

// --- Badges (specs §16.9) ---------------------------------------------------

export const IRR_FAMILY_BADGE_PREFIX = 'irr-famille-';

export function irrFamilyBadgeId(family: IrrFamily): string {
  return `${IRR_FAMILY_BADGE_PREFIX}${family}`;
}

/** Faits d'une famille. */
export function irrFactsOfFamily<T extends { key: string }>(facts: T[], family: IrrFamily): T[] {
  const keys = new Set(irrVerbsOfFamily(family).map((def) => def.key));
  return facts.filter((f) => keys.has(f.key));
}

/** Famille consolidée : non vide, tous ses verbes en boîte ≥ 4. */
export function allIrrMastered(facts: { box: BoxLevel }[]): boolean {
  return facts.length > 0 && facts.every((f) => f.box >= MASTERY_BOX);
}

// --- Jugement (specs §16.6) ---------------------------------------------------

/**
 * Verdict d'une réponse.
 *
 * - `correct`     : les formes attendues, au caractère près ;
 * - `almost`      : au clavier, une forme mal écrite d'une lettre (coquille,
 *                   lettre inversée) sur un mot assez long pour qu'elle ne
 *                   change pas le mot — accepté, jamais promu ;
 * - `regularized` : la règle du -ed plaquée sur l'irrégulier (« goed ») ;
 * - `swapped`     : prétérit et participe inversés (« sung, sang ») ;
 * - `wrong`       : tout le reste — dont la mauvaise famille (« brang »).
 */
export type IrrVerdict = 'correct' | 'almost' | 'regularized' | 'swapped' | 'wrong';

export function isIrrAccepted(verdict: IrrVerdict): boolean {
  return verdict === 'correct' || verdict === 'almost';
}

/**
 * Longueur minimale d'une forme pour tolérer une coquille : sous 5 lettres,
 * une lettre de différence change le mot (sat / set, ran / run), ou le rend
 * méconnaissable.
 */
const ALMOST_MIN_LENGTH = 5;

/** Distance d'édition avec transposition (Damerau, version restreinte). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

let knownForms: Set<string> | null = null;

/**
 * Coquille tolérable : une lettre d'écart sur une forme d'au moins 5 lettres,
 * et JAMAIS une autre forme de l'inventaire — « bought » pour « brought » est
 * à une lettre, mais c'est un autre verbe, donc une vraie erreur.
 */
function isTypo(given: string, expected: string): boolean {
  if (expected.length < ALMOST_MIN_LENGTH) return false;
  knownForms ??= allIrrForms();
  if (knownForms.has(given)) return false;
  return editDistance(given, expected) <= 1;
}

/** Les prétérits donnés couvrent-ils exactement les prétérits attendus ? */
function sameSet(given: string[], expected: readonly string[]): boolean {
  if (given.length !== expected.length) return false;
  return [...given].sort().join(',') === [...expected].sort().join(',');
}

/**
 * Juge une réponse : les formes dans l'ordre des cases (prétérit(s), puis
 * participe). `source` dit qui l'a produite : la tolérance aux coquilles ne
 * vaut qu'au clavier — à la voix, la reconnaissance orthographie elle-même.
 */
export function judgeIrrAnswer(
  def: IrrVerbDef,
  rawAnswers: readonly string[],
  source: 'keypad' | 'voice' = 'keypad',
): IrrVerdict {
  const answers = rawAnswers.map(normalizeIrrWord);
  const n = def.preterite.length;
  const preterite = answers.slice(0, n);
  const participle = answers[n] ?? '';

  const pretOk = sameSet(preterite, def.preterite);
  const partOk = def.participle.includes(participle);
  if (pretOk && partOk && answers.length === n + 1) return 'correct';

  if (source === 'keypad' && answers.length === n + 1) {
    // Chaque case ramenée à la forme attendue dont elle n'est qu'une coquille.
    const fixed = preterite.map((p) =>
      def.preterite.includes(p) ? p : def.preterite.find((e) => isTypo(p, e)) ?? null,
    );
    const fixedPart = partOk ? participle : def.participle.find((f) => isTypo(participle, f));
    if (fixed.every((p) => p !== null) && fixedPart && sameSet(fixed as string[], def.preterite)) {
      return 'almost';
    }
  }

  // Inversion : le participe à la place du prétérit et inversement.
  if (
    n === 1 &&
    def.preterite[0] !== def.participle[0] &&
    def.participle.includes(preterite[0]) &&
    participle === def.preterite[0]
  ) {
    return 'swapped';
  }

  const wrongOnes = answers.filter(
    (a, i) => (i < n ? !def.preterite.includes(a) : !def.participle.includes(a)),
  );
  if (wrongOnes.some((a) => a.endsWith('ed'))) {
    return 'regularized';
  }
  return 'wrong';
}

/** Réponse telle qu'enregistrée et montrée au parent : « went, gone ». */
export function irrWrittenAnswer(answers: readonly string[]): string {
  return answers.map(normalizeIrrWord).join(', ');
}

// --- Analogie de famille (specs §16.3) ---------------------------------------

/**
 * Le verbe de la même famille qui sert d'appui (« comme sing → sang → sung ») :
 * le premier déjà introduit, dans l'ordre de l'inventaire. `null` pour un
 * verbe unique ou dont la famille n'a encore rien de su — l'analogie ne vaut
 * qu'avec un verbe que l'enfant connaît.
 */
export function irrKnownAnalogy(
  def: IrrVerbDef,
  facts: readonly { key: string; introduced: boolean }[],
): IrrVerbDef | null {
  if (def.family === 'unique') return null;
  const known = new Set(facts.filter((f) => f.introduced).map((f) => f.key));
  return irrVerbsOfFamily(def.family).find((other) => other.key !== def.key && known.has(other.key)) ?? null;
}

/**
 * Familles déjà rencontrées, pour l'écran Règles (specs §16.3) : chacune avec
 * le premier verbe introduit qui la représente, et jamais avant. Les
 * « inclassables » n'ont pas d'astuce à montrer.
 */
export function metIrrFamilies(
  facts: readonly { key: string; introduced: boolean }[],
): { family: IrrFamily; example: IrrVerbDef }[] {
  const known = new Set(facts.filter((f) => f.introduced).map((f) => f.key));
  const met: { family: IrrFamily; example: IrrVerbDef }[] = [];
  for (const family of IRR_FAMILIES) {
    if (family === 'unique') continue;
    const example = irrVerbsOfFamily(family).find((def) => known.has(def.key));
    if (example) met.push({ family, example });
  }
  return met;
}
