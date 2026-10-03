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
 * Premier créneau de `list`, à partir de `from`, où `block` s'insère sans
 * heurter ses deux voisins : l'élément qui le précède (`before` devant le
 * créneau 0) et celui qui le suit. -1 s'il n'y en a aucun. La règle de jonction
 * des séances (§5.1), écrite une seule fois : l'entrelacement s'en sert dans
 * ses impasses, la conjugaison pour poser sa paire de contraste d'un bloc.
 */
export function firstFreeSlot<T>(
  list: readonly T[],
  block: readonly T[],
  conflicts: (a: T, b: T) => boolean,
  { from = 0, before }: { from?: number; before?: T } = {},
): number {
  const head = block[0];
  const tail = block[block.length - 1];
  for (let k = from; k <= list.length; k++) {
    const prev = k === 0 ? before : list[k - 1];
    const next = list[k];
    if ((prev === undefined || !conflicts(prev, head)) && (next === undefined || !conflicts(tail, next))) {
      return k;
    }
  }
  return -1;
}

/**
 * Budget de la recherche d'un ordre sans conflit (cf. interleaveOrder), en
 * éléments posés. Quand aucun ordre sans conflit n'existe, c'est lui qui arrête
 * la recherche : sans lui, prouver qu'il n'y en a pas peut demander d'en
 * essayer des millions. Calibré sur des séances simulées (60 enfants, 400
 * jours, toutes matières), ordonnées d'un seul tenant : à 5 000, un conflit
 * évitable ne reste que dans moins de 1 % des séances de multiplication et
 * ~0,1 % en conjugaison (aucun en séance quotidienne), pour ~1,5 ms au pire
 * et ~15 µs en moyenne par séance. Le quadrupler n'en retire qu'un sur deux.
 */
const INTERLEAVE_SEARCH_BUDGET = 5000;

/**
 * Réordonne `items` pour éviter, autant que possible, deux éléments adjacents
 * en conflit. Partagé par l'entrelacement des séances de toutes les matières.
 *
 * L'ordre de `items` est un ordre de PRÉFÉRENCE : un élément ne passe devant un
 * autre que pour éviter un conflit. Les séances y mettent leurs révisions dues,
 * les plus fragiles d'abord, puis leurs révisions bonus, et ordonnent tout d'un
 * seul appel : un bonus ne passe devant une révision due que pour séparer deux
 * questions en conflit.
 *
 * Recherche en profondeur, l'ordre glouton d'abord : à chaque place, le premier
 * candidat qui ne heurte pas le précédent — la première branche explorée EST
 * l'ordre glouton, et c'est lui qu'on obtient quand il n'a pas d'impasse. En
 * cas d'impasse (tout ce qui reste heurte le dernier posé), on revient sur les
 * choix précédents au lieu d'accoler deux voisins en conflit. Au-delà de
 * `INTERLEAVE_SEARCH_BUDGET` éléments posés, ou quand aucun ordre sans conflit
 * n'existe, on garde l'ordre glouton réparé (cf. greedyWithRepair) : best
 * effort.
 *
 * Aucun tirage au sort ici, il ouvrirait souvent la séance sur un bonus : la
 * variété vient des composeurs, qui mélangent les faits de même priorité
 * (prioritizeByBoxLevel, pickBonusReviewFacts).
 *
 * `after` est l'élément qui PRÉCÉDERA la liste réordonnée sans en faire partie
 * (la dernière introduction du jour) : il contraint alors le premier élément,
 * sans quoi la jonction avec les introductions échapperait à l'entrelacement.
 */
export function interleaveOrder<T>(
  items: T[],
  conflicts: (a: T, b: T) => boolean,
  after?: T,
): T[] {
  if (items.length <= 1) return items;

  const n = items.length;
  // `after`, quand il y en a un, est le nœud `n` : la recherche le traite comme
  // un élément déjà posé, devant la liste.
  const head = after === undefined ? undefined : n;
  const nodes = after === undefined ? items : [...items, after];

  // Conflits mémoïsés par paire d'indices : la recherche revisite les mêmes
  // paires, et un conflit peut coûter cher à évaluer.
  const known = new Int8Array((n + 1) * n).fill(-1);
  const clash = (prev: number, next: number): boolean => {
    const k = prev * n + next;
    if (known[k] === -1) known[k] = conflicts(nodes[prev], items[next]) ? 1 : 0;
    return known[k] === 1;
  };

  const used = new Array<boolean>(n).fill(false);
  const order: number[] = [];
  let budget = INTERLEAVE_SEARCH_BUDGET;
  const search = (prev: number | undefined): boolean => {
    if (order.length === n) return true;
    for (let i = 0; i < n; i++) {
      if (used[i] || (prev !== undefined && clash(prev, i))) continue;
      if (--budget < 0) return false;
      used[i] = true;
      order.push(i);
      if (search(i)) return true;
      used[i] = false;
      order.pop();
      if (budget < 0) return false;
    }
    return false;
  };

  // Sans ordre sans conflit : l'ordre glouton réparé, sur les indices pour
  // réutiliser les conflits déjà évalués.
  const picked = search(head) ? order : greedyWithRepair(n, clash, head);
  return picked.map((i) => items[i]);
}

/**
 * L'ordre glouton réparé, sur les indices `0..n-1` : à chaque place le premier
 * candidat qui ne heurte pas le précédent (`head` compris). En cas d'impasse,
 * le premier restant se glisse plus tôt, entre deux voisins déjà posés qu'il ne
 * heurte ni l'un ni l'autre ; à défaut seulement, il est posé en fin de liste.
 * Repli de interleaveOrder quand aucun ordre sans conflit n'a été trouvé.
 */
function greedyWithRepair(
  n: number,
  conflicts: (a: number, b: number) => boolean,
  head: number | undefined,
): number[] {
  const remaining = Array.from({ length: n }, (_, i) => i);
  const result: number[] = [];

  while (remaining.length > 0) {
    const prev = result.at(-1) ?? head;
    const next = remaining.findIndex((i) => prev === undefined || !conflicts(prev, i));
    if (next !== -1) {
      result.push(remaining.splice(next, 1)[0]);
      continue;
    }
    // Le glissement ne crée aucun conflit et ne change pas le dernier posé :
    // la fin de liste, elle, heurte forcément `prev`.
    const item = remaining.shift()!;
    const at = firstFreeSlot(result, [item], conflicts, { before: head });
    result.splice(at === -1 ? result.length : at, 0, item);
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
 * liste (best-effort, comme `interleaveOrder`).
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
