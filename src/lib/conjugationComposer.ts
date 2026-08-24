import type {
  Badge,
  ConjFact,
  ConjPerson,
  ConjSessionQuestion,
  ConjTense,
  UserProfile,
} from '../types';
import {
  isDue,
  shouldIntroduceNew,
  prioritizeByBoxLevel,
  pickBonusReviewFacts,
  MASTERY_BOX,
} from './leitner';
import {
  CONJ_IRREGULAR_VERBS,
  CONJ_PERSONS,
  CONJ_TENSES,
  conjFactDef,
  isPhoneticallyClose,
  normalizeConjAnswer,
  stripAccents,
  type ConjCarrier,
  type ConjFactDef,
  type ConjQuestionView,
} from './conjugationFacts';
import {
  CONJ_INTRO_SPACING_DAYS,
  canConjBeAdjacent,
  canConjCoexist,
  conjFactsInterfere,
} from './conjugationInterference';
import { daysBetween, interleaveGreedy } from './utils';

// === Séance de conjugaison (spec Verbito §5, §6.2) ===
//
// Mêmes bornes que les niveaux de maths (12-15 questions, 2 intros max), même
// anatomie : [Intro] → [Pratique] → [Récap]. La conjugaison étant une MATIÈRE
// et non un niveau, cette séance ne se mélange jamais aux questions de maths ;
// seule la flamme de série est partagée entre matières (§7.2).

export const CONJ_MIN_QUESTIONS = 12;
export const CONJ_MAX_QUESTIONS = 15;
export const CONJ_MAX_NEW_FACTS = 2;

// Plafond dur de la séance, REPRISES COMPRISES (§5.1) : une question ratée est
// re-posée, mais la séance ne s'allonge jamais au-delà de 20 questions — 4 à
// 6 minutes, budget temps saturé par ailleurs (§1). C'est exactement la borne
// des séances de maths : cf. MAX_SESSION_QUESTIONS (lib/utils).

/** Écart de re-pose après une erreur ou une intro : 2 à 3 questions (§5.2). */
export const CONJ_RETRY_MIN_GAP = 2;
export const CONJ_RETRY_MAX_GAP = 3;

/**
 * Entretien des temps déjà travaillés, plafonné (§6.2) : la séance du jour est
 * celle du temps ACTIF, avec au plus ~6 faits des temps précédents entrelacés.
 * Il n'y a jamais deux séances de conjugaison à faire.
 */
export const CONJ_MAINTENANCE_CAP = 6;

// --- Déblocages par badges (§6.2) -------------------------------------------
//
// Les déblocages reposent sur des badges PERMANENTS, jamais sur l'état Leitner
// en direct : une mauvaise journée ne referme pas un temps. Même mécanique que
// isDivisionUnlocked / isRemainderUnlocked côté maths.
//
// Ces constantes et prédicats sont le contrat que `lib/badges.ts` consommera :
// c'est lui qui décernera les badges, ici on ne fait que définir le critère et
// le lire.

/** Badge « temps maîtrisé », un par temps — la clé du déblocage du suivant. */
export const CONJ_TENSE_BADGE_ID: Record<ConjTense, string> = {
  present: 'conj-temps-present',
  imparfait: 'conj-temps-imparfait',
  futur: 'conj-temps-futur',
};

/** Badge par verbe irrégulier (7 badges, §7.2) : `conj-verbe-etre`, … */
export const CONJ_VERB_BADGE_PREFIX = 'conj-verbe-';

export function conjVerbBadgeId(verb: string): string {
  return `${CONJ_VERB_BADGE_PREFIX}${stripAccents(verb)}`;
}

/**
 * Critère de maîtrise d'un GROUPE de faits (un temps, un verbe) : le groupe est
 * non vide et tous ses faits sont en boîte ≥ 4 (MASTERY_BOX, le même seuil que
 * les badges « Table de N »). Une seule définition pour les deux familles de
 * badges de la matière — temps et verbe irrégulier.
 */
export function allConjMastered(facts: ConjFact[]): boolean {
  return facts.length > 0 && facts.every((f) => f.box >= MASTERY_BOX);
}

/**
 * Temps ouverts à l'INTRODUCTION de faits nouveaux. Le présent est toujours
 * ouvert ; chaque temps suivant s'ouvre sur le badge du précédent.
 */
export function unlockedConjTenses(badges: Badge[]): ConjTense[] {
  const owned = new Set(badges.map((b) => b.id));
  const unlocked: ConjTense[] = [];
  // Ordre d'introduction des temps : présent → imparfait → futur (§6.2).
  for (const tense of CONJ_TENSES) {
    unlocked.push(tense);
    if (!owned.has(CONJ_TENSE_BADGE_ID[tense])) break;
  }
  return unlocked;
}

/**
 * Tout ce que la composition lit d'un profil. Restreint EXPRÈS à ces deux
 * champs : c'est le contrat que l'appelant peut mémoïser, sans recomposer la
 * séance de conjugaison à chaque réponse d'une séance de maths.
 */
export type ConjProfile = Pick<UserProfile, 'conjFacts' | 'badges'>;

// --- Ordre d'introduction à l'intérieur d'un temps --------------------------

const TENSE_RANK: Record<ConjTense, number> = { present: 0, imparfait: 1, futur: 2 };
const KIND_RANK = { ending: 0, stem: 1, irregular: 2 } as const;

function personRank(person: ConjPerson): number {
  return CONJ_PERSONS.indexOf(person);
}

function verbRank(verb: string | null): number {
  const i = verb ? CONJ_IRREGULAR_VERBS.indexOf(verb) : -1;
  return i === -1 ? 0 : i;
}

/**
 * Rang canonique d'introduction (§6.2) : temps dans l'ordre du CE2, puis les
 * RÈGLES avant les formes stockées (on enseigne la régularité d'abord, les
 * exceptions ensuite), puis les verbes par fréquence, puis les personnes dans
 * l'ordre de la conjugaison. Équivalent de `vanDeWalleStage` côté maths.
 */
export function conjIntroRank(def: ConjFactDef): number {
  return (
    TENSE_RANK[def.tense] * 1000 +
    KIND_RANK[def.kind] * 100 +
    verbRank(def.verb) * 10 +
    personRank(def.persons[0])
  );
}

// --- Composition ------------------------------------------------------------

/**
 * Rang de la phrase porteuse à utiliser : rotation sur le nombre de fois où le
 * fait a été POSÉ, pour que les 2-3 phrases tournent (§10, mitigation de
 * l'apprentissage contextuel) sans jamais dépendre du hasard — le MP3
 * pré-généré doit coller à la phrase affichée, et un test doit pouvoir prédire
 * laquelle.
 *
 * `seen` plutôt que `history.length` : `processAnswer` tronque l'historique à
 * 30 tentatives, et 30 % 2 = 30 % 3 = 0 — un fait fragile entretenu longtemps
 * serait resté collé à sa première porteuse, exactement ce que la rotation
 * doit éviter. Repli sur l'historique pour les profils antérieurs au compteur.
 */
export function conjCarrierIndex(fact: ConjFact): number {
  const def = conjFactDef(fact.key);
  if (!def) return 0;
  return (fact.seen ?? fact.history.length) % def.carriers.length;
}

function makeQuestion(
  fact: ConjFact,
  carrierIndex: number,
  flags: Partial<ConjSessionQuestion> = {},
): ConjSessionQuestion {
  return {
    fact,
    carrierIndex,
    isIntroduction: false,
    isRetry: false,
    isBonusReview: false,
    ...flags,
  };
}

/**
 * Le couple (verbe, personne) que la question fera lire à l'écran. C'est la
 * PORTEUSE qui les porte : inutile de dériver la question entière (forme
 * attendue, segmentation, phrases, clés TTS) pour comparer deux questions —
 * l'entrelacement en compare des centaines de paires par séance.
 */
function carrierOf(question: ConjSessionQuestion): ConjCarrier | null {
  const def = conjFactDef(question.fact.key);
  if (!def) return null;
  const carriers = def.carriers;
  const i = ((question.carrierIndex % carriers.length) + carriers.length) % carriers.length;
  return carriers[i];
}

/**
 * Deux questions ne doivent pas se suivre (§5.1, §3.4) si elles partagent le
 * VERBE ou la PERSONNE (entrelacement), ou si leurs faits sont en interférence
 * non encore désamorcée par la consolidation.
 */
export function conjQuestionConflict(a: ConjSessionQuestion, b: ConjSessionQuestion): boolean {
  const carrierA = carrierOf(a);
  const carrierB = carrierOf(b);
  if (!carrierA || !carrierB) return false;
  if (carrierA.verb === carrierB.verb) return true;
  if (carrierA.person === carrierB.person) return true;
  return !canConjBeAdjacent(a.fact, b.fact);
}

/**
 * Le fait peut-il entrer dans la séance à côté de TOUT ce qui y est déjà ?
 * (§3.4 : deux faits confusibles non consolidés ne s'y croisent jamais.) Le
 * même filtre s'applique aux intros, aux révisions dues et aux bonus.
 */
function conjCoexistsWithAll(fact: ConjFact, ...groups: ConjFact[][]): boolean {
  return groups.every((group) => group.every((other) => canConjCoexist(other, fact)));
}

function interleave(
  questions: ConjSessionQuestion[],
  after?: ConjSessionQuestion,
): ConjSessionQuestion[] {
  return interleaveGreedy(questions, conjQuestionConflict, after);
}

/**
 * Compose la séance de conjugaison du jour (12-15 questions).
 *
 * - intro : au plus 2 faits nouveaux, pris dans les temps débloqués, dans
 *   l'ordre canonique, jamais en interférence avec un fait introduit il y a
 *   moins de 48 h (§3.4) ni entre eux ;
 * - révisions : faits dus, priorisés par boîte, avec l'entretien des temps
 *   précédents plafonné à `CONJ_MAINTENANCE_CAP` (§6.2) ;
 * - anti-interférence : deux faits confusibles non consolidés ne sont jamais
 *   dans la même séance, et jamais adjacents tant qu'ils ne le sont pas ;
 * - padding par révisions bonus, qui ne touchent pas au calendrier Leitner.
 *
 * Renvoie une liste vide si le profil n'a pas encore de faits de conjugaison.
 */
export function composeConjSession(profile: ConjProfile, now: string): ConjSessionQuestion[] {
  const facts = profile.conjFacts ?? [];
  if (facts.length === 0) return [];
  const today = now.slice(0, 10);

  const unlockedTenses = unlockedConjTenses(profile.badges);
  const unlocked = new Set(unlockedTenses);
  // Temps ACTIF du jour : le dernier temps débloqué (§6.2, « un seul bouton »).
  const active = unlockedTenses[unlockedTenses.length - 1];

  // Intros choisies AVANT les révisions (même raison que sessionComposer : les
  // révisions saturent sinon le budget et affament l'introduction).
  const recentlyIntroduced = facts.filter(
    (f) => f.introducedAt && daysBetween(f.introducedAt, today) < CONJ_INTRO_SPACING_DAYS,
  );

  const newFacts: ConjFact[] = [];
  if (shouldIntroduceNew(facts)) {
    const candidates = facts
      .filter((f) => !f.introduced)
      .map((f) => ({ fact: f, def: conjFactDef(f.key) }))
      .filter((c): c is { fact: ConjFact; def: ConjFactDef } => !!c.def)
      .filter((c) => unlocked.has(c.def.tense))
      .sort((a, b) => conjIntroRank(a.def) - conjIntroRank(b.def));

    for (const { fact, def } of candidates) {
      if (newFacts.length >= CONJ_MAX_NEW_FACTS) break;
      // 48 h d'écart entre deux introductions de faits en interférence (§3.4).
      const clashesWithRecent = recentlyIntroduced.some((recent) => {
        const recentDef = conjFactDef(recent.key);
        return recentDef ? conjFactsInterfere(recentDef, def) : false;
      });
      if (clashesWithRecent) continue;
      // …et a fortiori pas deux faits en interférence dans la même intro.
      const clashesWithNew = newFacts.some((nf) => {
        const nfDef = conjFactDef(nf.key);
        return nfDef ? conjFactsInterfere(nfDef, def) : false;
      });
      if (clashesWithNew) continue;
      newFacts.push(fact);
    }
  }

  const reviewBudget = CONJ_MAX_QUESTIONS - newFacts.length;
  const due = prioritizeByBoxLevel(facts.filter((f) => f.introduced && isDue(f, today)));

  const selected: ConjFact[] = [];
  let maintenance = 0;
  for (const fact of due) {
    if (selected.length >= reviewBudget) break;
    const def = conjFactDef(fact.key);
    if (!def) continue;
    const isMaintenance = def.tense !== active;
    if (isMaintenance && maintenance >= CONJ_MAINTENANCE_CAP) continue;
    if (!conjCoexistsWithAll(fact, newFacts, selected)) continue;
    selected.push(fact);
    if (isMaintenance) maintenance++;
  }

  // Padding par révisions bonus, qui ne touchent pas au calendrier Leitner.
  // Elles passent par le MÊME filtre d'interférence que les révisions dues :
  // `pickBonusReviewFacts` trie les plus faibles d'abord, donc exactement les
  // faits non consolidés que le §3.4 protège — sans ce filtre, une séance
  // courte (les premiers jours) repêchait en bonus le fait que la sélection
  // venait d'écarter, et « tu es » / « il est » se retrouvaient ensemble.
  const bonusFacts: ConjFact[] = [];
  if (selected.length + newFacts.length < CONJ_MIN_QUESTIONS) {
    const need = CONJ_MIN_QUESTIONS - selected.length - newFacts.length;
    const used = new Set([...newFacts, ...selected].map((f) => f.key));
    const ranked = pickBonusReviewFacts(
      facts,
      (f) => used.has(f.key) || !conjFactDef(f.key),
      facts.length,
    );
    for (const fact of ranked) {
      if (bonusFacts.length >= need) break;
      if (!conjCoexistsWithAll(fact, newFacts, selected, bonusFacts)) continue;
      bonusFacts.push(fact);
    }
  }

  // Intro : toujours la 1ʳᵉ porteuse (déterministe — l'écran d'introduction et
  // son MP3 sont pré-générés, comme `introRemainder` au niveau 3).
  const intros = newFacts.map((fact) => makeQuestion(fact, 0, { isIntroduction: true }));
  // Chaque bloc est entrelacé EN TENANT COMPTE de la question qui le précède :
  // entrelacer les blocs isolément laissait leurs jonctions hors contrôle, et
  // deux questions consécutives pouvaient y partager le verbe ou la personne
  // (§5.1), voire être en interférence.
  const reviews = interleave(
    selected.map((fact) => makeQuestion(fact, conjCarrierIndex(fact))),
    intros.at(-1),
  );
  const bonus = interleave(
    bonusFacts.map((fact) => makeQuestion(fact, conjCarrierIndex(fact), { isBonusReview: true })),
    reviews.at(-1) ?? intros.at(-1),
  );

  return [...intros, ...reviews, ...bonus];
}

/**
 * Écart de re-pose de la matière : 2 ou 3 questions plus tard (§5.2 étape 5,
 * §5.3). Tiré ici, la mécanique d'insertion elle-même étant générique
 * (`scheduleRetry`, partagée avec le chemin maths).
 */
export function conjRetryGap(): number {
  return (
    CONJ_RETRY_MIN_GAP + Math.floor(Math.random() * (CONJ_RETRY_MAX_GAP - CONJ_RETRY_MIN_GAP + 1))
  );
}

// --- Attribution d'erreur (spec §4.5) ---------------------------------------

/**
 * Verdict d'une réponse.
 *
 * - `correct` : la réponse attendue, au caractère près ;
 * - `almost`  : terminaison juste, coquille phonétiquement plausible dans le
 *               radical (« cerons » pour « serons ») → ACCEPTÉ pour le Leitner,
 *               forme correcte réaffichée en couleurs, sans commentaire. On ne
 *               pénalise jamais l'orthographe lexicale dans un jeu de
 *               conjugaison ;
 * - `ending`  : erreur de terminaison (« seron » pour « serons ») ;
 * - `stem`    : erreur de radical (« saurons » pour « serons ») — pour les
 *               formes irrégulières insécables (sommes, êtes…), toute erreur
 *               est une erreur de forme, donc de « radical » ;
 * - `both`    : ni le radical ni la terminaison ne tombent juste (« vais » pour
 *               « suis ») — le fait n'est tout simplement pas su.
 */
export type ConjVerdict = 'correct' | 'almost' | 'ending' | 'stem' | 'both';

/**
 * Le Leitner traite-t-il ce verdict comme une bonne réponse ? Les deux verdicts
 * acceptés sont `correct` et `almost` — on ne pénalise jamais l'orthographe
 * lexicale dans un jeu de conjugaison.
 */
export function isConjAccepted(verdict: ConjVerdict): boolean {
  return verdict === 'correct' || verdict === 'almost';
}

export interface ConjJudgement {
  verdict: ConjVerdict;
  /**
   * Faits à faire redescendre. PAS forcément celui posé : sur « seron » pour
   * « serons », c'est la terminaison -ons qui a lâché, pas le radical ser-
   * (§4.5) — donc le fait `fut-nous`, pas `fut-etre`.
   */
  blamedKeys: string[];
}

/**
 * Clé du fait « terminaison » correspondant au temps et à la personne d'une
 * question, quand la terminaison de la forme est EXACTEMENT celle enseignée par
 * ce fait. Renvoie null sinon (« fais » porte un -s qui n'est pas la
 * terminaison -es du présent 1er groupe : rien à blâmer d'autre que le fait).
 */
export function conjEndingFactKeyFor(view: ConjQuestionView): string | null {
  const prefix =
    view.def.tense === 'present' ? 'pres-g1' : view.def.tense === 'imparfait' ? 'imp' : 'fut';
  const def = conjFactDef(`${prefix}-${view.person}`);
  if (!def || def.kind !== 'ending') return null;
  return def.ending === view.segment[1] ? def.key : null;
}

/**
 * Attribue une réponse (§4.5). La segmentation radical|terminaison rend le
 * diagnostic possible dès que la forme entière est tapée ; quand seule la
 * terminaison est saisie (radical affiché), il n'y a rien à attribuer.
 */
export function judgeConjAnswer(view: ConjQuestionView, typed: string): ConjJudgement {
  const answer = normalizeConjAnswer(typed);
  const expected = normalizeConjAnswer(view.expected);
  const ownKey = view.def.key;

  if (answer === expected) return { verdict: 'correct', blamedKeys: [] };

  if (view.endingOnly) {
    // Tolérance : l'enfant qui tape la forme entière alors que le radical est
    // affiché sait ce qu'on lui demande — on ne pénalise pas un malentendu de
    // consigne.
    if (answer === normalizeConjAnswer(view.form)) {
      return { verdict: 'correct', blamedKeys: [] };
    }
    return { verdict: 'ending', blamedKeys: [ownKey] };
  }

  const [stem, ending] = view.segment.map(normalizeConjAnswer) as [string, string];

  // Forme insécable (sommes, êtes, faites, dites…) : la forme entière EST le
  // radical, il n'y a pas de terminaison à blâmer.
  if (ending === '') {
    return isPhoneticallyClose(answer, stem)
      ? { verdict: 'almost', blamedKeys: [] }
      : { verdict: 'stem', blamedKeys: [ownKey] };
  }

  const endingKey = conjEndingFactKeyFor(view);

  if (answer.startsWith(stem) && !answer.endsWith(ending)) {
    return { verdict: 'ending', blamedKeys: [endingKey ?? ownKey] };
  }

  if (answer.endsWith(ending)) {
    // Le radical tapé est tout ce qui précède la terminaison — y compris quand
    // il commence bien mais dérape ensuite (« serrons »).
    const typedStem = answer.slice(0, answer.length - ending.length);
    return isPhoneticallyClose(typedStem, stem)
      ? { verdict: 'almost', blamedKeys: [] }
      : { verdict: 'stem', blamedKeys: [ownKey] };
  }

  const blamed = endingKey && endingKey !== ownKey ? [ownKey, endingKey] : [ownKey];
  return { verdict: 'both', blamedKeys: blamed };
}
