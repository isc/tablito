import type { UserProfile, BoxLevel, Attempt, SessionResult } from '../types';
import { getFactKey } from './facts';
import { getDivisionFactKey } from './divisionFacts';
import { getRemainderFactKey } from './remainderFacts';
import { conjFactDef, requireConjFactDef, resolveConjQuestion } from './conjugationFacts';

// Fait « difficile » unifié × / ÷ / reste, pour l'espace parent. Le discriminant
// `kind` porte les champs propres à l'opération. En 'rem', la « difficulté »
// porte sur la zone (diviseur, quotient), le reste variant à chaque question.
export type HardFact =
  | { kind: 'mult'; key: string; box: BoxLevel; errorCount: number; a: number; b: number; product: number }
  | { kind: 'div'; key: string; box: BoxLevel; errorCount: number; dividend: number; divisor: number; quotient: number }
  | { kind: 'rem'; key: string; box: BoxLevel; errorCount: number; divisor: number; quotient: number }
  // Matière conjugaison : rien de numérique à afficher — le fait EST une forme
  // (« vous faites »), résolue ici une fois pour toutes plutôt que par l'UI.
  | { kind: 'conj'; key: string; box: BoxLevel; errorCount: number; label: string };

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
      if (q.kind === 'conj') {
        if (q.factKey) errors.set(`conj:${q.factKey}`, (errors.get(`conj:${q.factKey}`) ?? 0) + 1);
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

// Repli pour les profils dont aucune séance de la fenêtre n'a de log
// par-question (séances antérieures à la feature) : ancien comptage depuis
// `fact.history`, borné par la date de la plus vieille séance de la fenêtre.
// Sous-compte les révisions bonus, mais évite une section vide sur ces profils.
function countErrorsFromHistory(history: Attempt[], cutoff: string | null): number {
  return history.filter((h) => !h.correct && (cutoff === null || h.date >= cutoff)).length;
}

export type Subject = 'math' | 'conj';

// Séances d'une matière. Seule définition du partage : l'espace parent s'en
// sert pour ses graphes et son historique, cette liste pour sa fenêtre.
export function sessionsOfSubject(history: SessionResult[], subject: Subject): SessionResult[] {
  return history.filter((s) => (s.kind === 'conj') === (subject === 'conj'));
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
    .sort((a, b) => b.errorCount - a.errorCount || a.box - b.box)
    .slice(0, limit)
    .map((f) =>
      f.kind === 'conj'
        ? { ...f, label: resolveConjQuestion(requireConjFactDef(f.key), 0).label }
        : f,
    );
}
