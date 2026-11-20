import type { UserProfile } from '../types';
import { LAST_SESSION_DATE_FIELD, type Subject } from './hardestFacts';
import { daysBetween } from './utils';

/** En deçà, la matière n'est pas délaissée : l'avoir faite hier, c'est l'avoir faite. */
const SUGGEST_MIN_DAYS = 2;

interface SubjectSuggestion {
  subject: Subject;
  /** Jours depuis sa dernière séance. */
  days: number;
}

/**
 * Matière que l'accueil met en avant (specs §15.1) : parmi les matières
 * proposées dont la séance du jour reste à faire (`available`), la plus
 * délaissée.
 *
 * Rien à suggérer quand l'enfant n'a commencé qu'une des matières proposées,
 * à égalité, ni quand la plus délaissée a été faite hier. Une matière jamais
 * commencée n'est pas candidate : elle gagnerait chaque jour.
 */
export function suggestSubject(
  profile: UserProfile,
  offered: readonly { subject: Subject; available: boolean }[],
  today: string,
): SubjectSuggestion | null {
  const started = offered.flatMap(({ subject, available }) => {
    const last = profile[LAST_SESSION_DATE_FIELD[subject]];
    return last ? [{ subject, available, days: daysBetween(last, today) }] : [];
  });
  if (started.length < 2) return null;
  const [first, second] = started.filter((s) => s.available).sort((a, b) => b.days - a.days);
  if (!first || first.days < SUGGEST_MIN_DAYS || second?.days === first.days) return null;
  return { subject: first.subject, days: first.days };
}
