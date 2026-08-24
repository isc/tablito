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
/**
 * Décale une date nue « YYYY-MM-DD » de `days` jours.
 * Arithmétique en UTC : avec les accesseurs locaux, la veille du lendemain
 * d'une bascule d'heure d'été retombe un jour trop tôt (Europe/Paris,
 * 2026-10-26 → 2026-10-24).
 */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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
 *
 * `after` est l'élément qui PRÉCÉDERA la liste réordonnée sans en faire partie
 * (la dernière introduction du jour, par exemple) : il contraint alors le
 * premier tirage, sans quoi la jonction entre deux blocs échapperait à
 * l'entrelacement.
 */
export function interleaveGreedy<T>(
  items: T[],
  conflicts: (a: T, b: T) => boolean,
  after?: T,
): T[] {
  if (items.length === 0) return items;
  if (items.length === 1 && after === undefined) return items;

  const remaining = [...items];
  const result: T[] = [];

  const firstIdx =
    after === undefined
      ? Math.floor(Math.random() * remaining.length)
      : Math.max(
          0,
          remaining.findIndex((item) => !conflicts(after, item)),
        );
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

/**
 * Longueur maximale d'une séance, REPRISES COMPRISES — toutes matières. La
 * composition vise 12-15 questions ; chaque erreur en insère une de plus, et
 * sans plafond une mauvaise passe (surtout en vocal) rend la séance
 * interminable. Une seule source pour les maths et la conjugaison : les deux
 * partagent l'écran de séance, donc la même file et les mêmes pastilles.
 */
export const MAX_SESSION_QUESTIONS = 20;

/**
 * Re-pose une question quelques questions plus tard : après une erreur, et
 * après l'introduction d'un fait nouveau. Renvoie la file INCHANGÉE si le
 * plafond est atteint — on préfère une séance qui se termine proprement à une
 * séance qui s'étire.
 *
 * `gaps` liste les écarts autorisés par la spec (« 2 à 3 questions plus tard »,
 * §3.3 et §15.6), par ordre de préférence. On retient le premier créneau qui
 * n'accole pas la reprise à une AUTRE reprise ; à défaut le premier écart de la
 * liste (best-effort, comme `interleaveGreedy`).
 *
 * Sans ce choix, deux re-poses déclenchées coup sur coup — les deux intros du
 * jour en conjugaison — se replaçaient au même écart et revenaient collées
 * l'une à l'autre : la séance « mal organisée, plusieurs fois les mêmes
 * questions » remontée par un parent le 23/08/2026. Deux reprises dos à dos,
 * c'est la séance qui radote, et c'est ce que l'enfant entend en premier.
 *
 * C'est bien l'ADJACENCE qui est traitée, pas la répétition du motif : deux
 * questions re-posées peuvent encore se rejouer dans le même ordre plus loin
 * dans la séance, séparées par au moins une autre question.
 *
 * Générique sur l'élément de file : l'écran de séance manipule des
 * `AnySessionItem` (multiplication, division, reste, conjugaison), et seuls les
 * deux drapeaux réécrits ici comptent.
 */
export function scheduleRetry<T extends { isIntroduction: boolean; isRetry: boolean }>(
  queue: T[],
  currentIndex: number,
  question: T,
  gaps: readonly number[],
): T[] {
  if (queue.length >= MAX_SESSION_QUESTIONS) return queue;
  const retry = { ...question, isIntroduction: false, isRetry: true };
  const slots = gaps.map((gap) => Math.min(currentIndex + gap, queue.length));
  const spaced = (at: number) => ![queue[at - 1], queue[at]].some((item) => item?.isRetry);
  const at = slots.find(spaced) ?? slots[0];
  return [...queue.slice(0, at), retry, ...queue.slice(at)];
}
