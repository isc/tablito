import type { UserProfile, BoxLevel, Attempt, SessionResult, ConjWrittenAnswer } from '../types';
import { getFactKey } from './facts';
import { getDivisionFactKey } from './divisionFacts';
import { getRemainderFactKey } from './remainderFacts';
import { conjFactDef, requireConjFactDef, resolveConjQuestion } from './conjugationFacts';
import { irrRecitation, irrVerbDef, requireIrrVerbDef } from './irregularVerbs';

// Fait « difficile » unifié × / ÷ / reste, pour l'espace parent. Le discriminant
// `kind` porte les champs propres à l'opération. En 'rem', la « difficulté »
// porte sur la zone (diviseur, quotient), le reste variant à chaque question.
export type HardFact =
  | { kind: 'mult'; key: string; box: BoxLevel; errorCount: number; a: number; b: number; product: number }
  | { kind: 'div'; key: string; box: BoxLevel; errorCount: number; dividend: number; divisor: number; quotient: number }
  | { kind: 'rem'; key: string; box: BoxLevel; errorCount: number; divisor: number; quotient: number }
  // Matière conjugaison : rien de numérique à afficher — le fait EST une forme
  // (« vous faites »), résolue ici une fois pour toutes plutôt que par l'UI.
  // `recentMistakes` : les dernières réponses fausses, la plus récente
  // d'abord — c'est l'erreur récurrente (« chanterais » pour « chanterai »)
  // qu'un parent peut reprendre, pas le seul compte. Vide pour les réponses
  // antérieures à leur enregistrement.
  | { kind: 'conj'; key: string; box: BoxLevel; errorCount: number; label: string; recentMistakes: ConjWrittenAnswer[] }
  // Verbes irréguliers : même forme que la conjugaison — la récitation
  // (« go – went – gone ») et les dernières réponses fausses (« goed, goed »).
  | { kind: 'irr'; key: string; box: BoxLevel; errorCount: number; label: string; recentMistakes: ConjWrittenAnswer[] };

/** Nombre de réponses fausses montrées par forme dans l'espace parent. */
const CONJ_MISTAKES_SHOWN = 3;

// Erreurs par fait (clé préfixée `mult:`/`div:`) depuis les logs par-question
// des séances. C'est la MÊME source que le taux de bonnes réponses de l'espace
// parent (correctCount/questionsCount) : les révisions bonus y figurent, alors
// qu'elles sont absentes de `fact.history` (pas de changement Leitner). Compter
// depuis `fact.history` faisait « disparaître » des erreurs pourtant visibles
// dans le graphe de taux de réussite — précisément celles des révisions bonus,
// qui ciblent les faits les plus fragiles.
function countErrorsFromLogs(sessions: SessionResult[]): Map<string, number> {
  const errors = new Map<string, number>();
  for (const s of sessions) {
    for (const q of s.questions ?? []) {
      if (q.correct) continue;
      // Conjugaison : le fait est identifié par `factKey`, pas par un couple de
      // nombres — `a`/`b` sont absents. Test explicite AVANT le repli 'mult',
      // qui les suppose présents.
      if (q.kind === 'conj' || q.kind === 'irr') {
        const key = `${q.kind}:${q.factKey}`;
        if (q.factKey) errors.set(key, (errors.get(key) ?? 0) + 1);
        continue;
      }
      if (q.a === undefined || q.b === undefined) continue;
      // Logs 'div'/'rem' : a = diviseur, b = quotient (dividende div = a × b).
      const key =
        q.kind === 'rem'
          ? `rem:${getRemainderFactKey(q.a, q.b)}`
          : q.kind === 'div'
            ? `div:${getDivisionFactKey(q.a * q.b, q.a)}`
            : `mult:${getFactKey(q.a, q.b)}`;
      errors.set(key, (errors.get(key) ?? 0) + 1);
    }
  }
  return errors;
}

// Dernières réponses fausses d'une matière à formes écrites (conjugaison,
// verbes irréguliers) par fait, depuis les mêmes logs que le compte d'erreurs
// (fait POSÉ), la plus récente d'abord. Les entrées sans forme écrite
// (antérieures à son enregistrement) sont ignorées.
function mistakesFromLogs(
  sessions: SessionResult[],
  kind: 'conj' | 'irr',
): Map<string, ConjWrittenAnswer[]> {
  const mistakes = new Map<string, ConjWrittenAnswer[]>();
  for (const q of sessions.flatMap((s) => s.questions ?? []).reverse()) {
    if (q.kind !== kind || q.correct || !q.factKey) continue;
    if (typeof q.answeredWith !== 'string' || !q.expectedForm) continue;
    let list = mistakes.get(q.factKey);
    if (!list) mistakes.set(q.factKey, (list = []));
    if (list.length < CONJ_MISTAKES_SHOWN) {
      list.push({ answeredWith: q.answeredWith, expectedForm: q.expectedForm });
    }
  }
  return mistakes;
}

// Repli pour les profils dont aucune séance de la fenêtre n'a de log
// par-question (séances antérieures à la feature) : ancien comptage depuis
// `fact.history`, borné par la date de la plus vieille séance de la fenêtre.
// Sous-compte les révisions bonus, mais évite une section vide sur ces profils.
function countErrorsFromHistory(history: Attempt[], cutoff: string | null): number {
  return history.filter((h) => !h.correct && (cutoff === null || h.date >= cutoff)).length;
}

export type Subject = 'math' | 'conj' | 'irr';

/**
 * Date de la dernière séance de chaque matière : c'est elle qui dit si la
 * séance du jour est faite (la flamme, elle, suit `lastSessionDate`, toutes
 * matières confondues).
 */
export const LAST_SESSION_DATE_FIELD = {
  math: 'lastMathSessionDate',
  conj: 'lastConjSessionDate',
  irr: 'lastIrrSessionDate',
} as const satisfies Record<Subject, keyof UserProfile>;

/** Matière d'une séance : ses trois niveaux de maths en sont une seule. */
export function subjectOf(session: Pick<SessionResult, 'kind'>): Subject {
  return session.kind === 'conj' || session.kind === 'irr' ? session.kind : 'math';
}

// Séances d'une matière. Seule définition du partage : l'espace parent s'en
// sert pour ses graphes et son historique, cette liste pour sa fenêtre.
export function sessionsOfSubject(history: SessionResult[], subject: Subject): SessionResult[] {
  return history.filter((s) => subjectOf(s) === subject);
}

/** Fenêtre de « difficile en ce moment » de l'espace parent, en séances de la
 *  matière — et non « difficile un jour » (cf. getHardestFacts). */
export const HARD_FACTS_WINDOW = 10;

// Erreurs décroissantes, puis la boîte la plus basse : à erreurs égales, le fait
// le plus fragile d'abord.
function byDifficulty(a: HardFact, b: HardFact): number {
  return b.errorCount - a.errorCount || a.box - b.box;
}

/**
 * Faits sur lesquels l'enfant a le plus buté récemment, pour UNE matière :
 * les maths (×, ÷ et reste mélangés — une séance de maths l'est par
 * construction) ou la conjugaison. Fenêtre = les `windowSize` dernières
 * séances de cette matière : sinon un fait galéré il y a longtemps mais
 * désormais maîtrisé resterait en tête (la boîte reflète l'état courant, pas
 * le cumul d'erreurs). Trié par erreurs décroissantes puis boîte croissante,
 * tronqué à `limit`, sans les faits à 0 erreur.
 *
 * Par matière et non toutes confondues, comme les graphes de l'espace parent
 * qu'elle suit : une liste commune laissait les verbes évincer les tables (ou
 * l'inverse) selon la matière pratiquée récemment. C'est à l'appelant de ne
 * demander la conjugaison que si elle est visible (cf. isConjVisible).
 */
export function getHardestFacts(
  profile: UserProfile,
  windowSize: number,
  limit: number,
  subject: Subject = 'math',
): HardFact[] {
  const sessions = sessionsOfSubject(profile.sessionHistory, subject);
  const recent = sessions.slice(-windowSize);
  const hasLogs = recent.some((s) => s.questions);
  const logErrors = hasLogs ? countErrorsFromLogs(recent) : null;
  const cutoff =
    sessions.length > windowSize ? sessions[sessions.length - windowSize].date : null;

  const errorCount = (key: string, history: Attempt[]): number =>
    logErrors ? (logErrors.get(key) ?? 0) : countErrorsFromHistory(history, cutoff);
  const mistakes = subject === 'math' ? null : mistakesFromLogs(recent, subject);

  // Seule la matière demandée est construite (les autres faits seraient jetés).
  const facts: HardFact[] = [];
  if (subject === 'conj') {
    for (const f of profile.conjFacts ?? []) {
      // Un fait dont la clé a disparu de l'inventaire (profil d'une version
      // antérieure) n'est pas affichable : on l'ignore, sans casser la liste.
      if (!f.introduced || !conjFactDef(f.key)) continue;
      facts.push({
        kind: 'conj',
        key: f.key,
        box: f.box,
        errorCount: errorCount(`conj:${f.key}`, f.history),
        // Résolu plus bas : nommer un fait demande de dériver sa question, et
        // la liste n'en affiche qu'une poignée sur les 63 de la matière.
        label: '',
        recentMistakes: mistakes?.get(f.key) ?? [],
      });
    }
  } else if (subject === 'irr') {
    for (const f of profile.irrFacts ?? []) {
      if (!f.introduced || !irrVerbDef(f.key)) continue;
      facts.push({
        kind: 'irr',
        key: f.key,
        box: f.box,
        errorCount: errorCount(`irr:${f.key}`, f.history),
        label: irrRecitation(requireIrrVerbDef(f.key)),
        recentMistakes: mistakes?.get(f.key) ?? [],
      });
    }
  } else {
    for (const f of profile.facts) {
      if (!f.introduced) continue;
      const key = getFactKey(f.a, f.b);
      facts.push({
        kind: 'mult',
        key,
        box: f.box,
        errorCount: errorCount(`mult:${key}`, f.history),
        a: f.a,
        b: f.b,
        product: f.product,
      });
    }
    for (const f of profile.divisionFacts ?? []) {
      if (!f.introduced) continue;
      const key = getDivisionFactKey(f.dividend, f.divisor);
      facts.push({
        kind: 'div',
        key,
        box: f.box,
        errorCount: errorCount(`div:${key}`, f.history),
        dividend: f.dividend,
        divisor: f.divisor,
        quotient: f.quotient,
      });
    }
    for (const f of profile.remainderFacts ?? []) {
      if (!f.introduced) continue;
      const key = getRemainderFactKey(f.divisor, f.quotient);
      facts.push({
        kind: 'rem',
        key,
        box: f.box,
        errorCount: errorCount(`rem:${key}`, f.history),
        divisor: f.divisor,
        quotient: f.quotient,
      });
    }
  }

  return facts
    .filter((f) => f.errorCount > 0)
    .sort(byDifficulty)
    .slice(0, limit)
    .map((f) =>
      f.kind === 'conj'
        ? { ...f, label: resolveConjQuestion(requireConjFactDef(f.key), 0).label }
        : f,
    );
}

/**
 * Les faits les plus ratés de plusieurs matières à la fois (accueil de l'espace
 * parent), triés comme ceux d'une seule. Chaque matière est lue sur SA fenêtre
 * de séances : une journée de conjugaison ne chasse pas les erreurs de maths de
 * la veille.
 */
export function getHardestFactsAcross(
  profile: UserProfile,
  subjects: Subject[],
  windowSize: number,
  limit: number,
): HardFact[] {
  return subjects
    .flatMap((subject) => getHardestFacts(profile, windowSize, limit, subject))
    .sort(byDifficulty)
    .slice(0, limit);
}
