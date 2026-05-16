/**
 * Returns today's date as an ISO string (YYYY-MM-DD).
 */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns the number of calendar days between two ISO date strings.
 * Positive if dateB is after dateA.
 */
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Fisher-Yates shuffle. Returns a new shuffled array.
 */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// `plural` est optionnel : par défaut on suffixe d'un `s` (jour/jours, gel/gels).
// On bascule à `=== 1` (et pas `<= 1`) pour rester cohérent avec l'usage
// existant — les cas count=0 sont en pratique gérés par un message dédié.
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
