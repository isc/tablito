import type { UserProfile, BoxLevel, Attempt, SessionResult } from '../types';
import { getFactKey } from './facts';
import { getDivisionFactKey } from './divisionFacts';
import { getRemainderFactKey } from './remainderFacts';

// Fait « difficile » unifié × / ÷ / reste, pour l'espace parent. Le discriminant
// `kind` porte les champs propres à l'opération. En 'rem', la « difficulté »
// porte sur la zone (diviseur, quotient), le reste variant à chaque question.
export type HardFact =
  | { kind: 'mult'; key: string; box: BoxLevel; errorCount: number; a: number; b: number; product: number }
  | { kind: 'div'; key: string; box: BoxLevel; errorCount: number; dividend: number; divisor: number; quotient: number }
  | { kind: 'rem'; key: string; box: BoxLevel; errorCount: number; divisor: number; quotient: number };

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

/**
 * Liste UNIFIÉE des faits (× et ÷) sur lesquels l'enfant a le plus buté
 * récemment. Fenêtre = les `windowSize` dernières séances : sinon un fait
 * galéré il y a longtemps mais désormais maîtrisé resterait en tête (la boîte
 * reflète l'état courant, pas le cumul d'erreurs). Trié par erreurs
 * décroissantes puis boîte croissante, tronqué à `limit`, sans les faits à 0
 * erreur. Les deux opérations sont mélangées : le parent voit où l'enfant bute
 * en ce moment, toutes opérations confondues.
 */
export function getHardestFacts(
  profile: UserProfile,
  windowSize: number,
  limit: number,
): HardFact[] {
  const sessions = profile.sessionHistory;
  const recent = sessions.slice(-windowSize);
  const hasLogs = recent.some((s) => s.questions);
  const logErrors = hasLogs ? countErrorsFromLogs(recent) : null;
  const cutoff =
    sessions.length > windowSize ? sessions[sessions.length - windowSize].date : null;

  const mult: HardFact[] = profile.facts
    .filter((f) => f.introduced)
    .map((f) => {
      const key = getFactKey(f.a, f.b);
      return {
        kind: 'mult' as const,
        key,
        box: f.box,
        errorCount: logErrors
          ? (logErrors.get(`mult:${key}`) ?? 0)
          : countErrorsFromHistory(f.history, cutoff),
        a: f.a,
        b: f.b,
        product: f.product,
      };
    });

  const div: HardFact[] = (profile.divisionFacts ?? [])
    .filter((f) => f.introduced)
    .map((f) => {
      const key = getDivisionFactKey(f.dividend, f.divisor);
      return {
        kind: 'div' as const,
        key,
        box: f.box,
        errorCount: logErrors
          ? (logErrors.get(`div:${key}`) ?? 0)
          : countErrorsFromHistory(f.history, cutoff),
        dividend: f.dividend,
        divisor: f.divisor,
        quotient: f.quotient,
      };
    });

  const rem: HardFact[] = (profile.remainderFacts ?? [])
    .filter((f) => f.introduced)
    .map((f) => {
      const key = getRemainderFactKey(f.divisor, f.quotient);
      return {
        kind: 'rem' as const,
        key,
        box: f.box,
        errorCount: logErrors
          ? (logErrors.get(`rem:${key}`) ?? 0)
          : countErrorsFromHistory(f.history, cutoff),
        divisor: f.divisor,
        quotient: f.quotient,
      };
    });

  return [...mult, ...div, ...rem]
    .filter((f) => f.errorCount > 0)
    .sort((a, b) => b.errorCount - a.errorCount || a.box - b.box)
    .slice(0, limit);
}
