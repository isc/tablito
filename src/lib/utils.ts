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

/**
 * Réordonne `items` pour éviter, autant que possible, deux éléments adjacents
 * en conflit. Greedy : premier élément au hasard, puis on prend le premier
 * candidat non conflictuel ; à défaut, le premier restant (best effort).
 * Partagé par l'entrelacement des séances multiplication et division.
 */
export function interleaveGreedy<T>(items: T[], conflicts: (a: T, b: T) => boolean): T[] {
  if (items.length <= 1) return items;

  const remaining = [...items];
  const result: T[] = [];

  const firstIdx = Math.floor(Math.random() * remaining.length);
  result.push(remaining.splice(firstIdx, 1)[0]);

  while (remaining.length > 0) {
    const prev = result[result.length - 1];
    let placed = false;
    for (let i = 0; i < remaining.length; i++) {
      if (!conflicts(prev, remaining[i])) {
        result.push(remaining.splice(i, 1)[0]);
        placed = true;
        break;
      }
    }
    if (!placed) {
      result.push(remaining.shift()!);
    }
  }

  return result;
}
