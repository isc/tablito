// Fusion de deux copies d'un même profil : un enfant qui pratique sur deux
// appareils (le téléphone de chaque parent), synchronisés par le canal chiffré
// du suivi à distance (specs §14.4, lib/sync). Fonction pure : le réseau, la
// base mémorisée et le moment où la fusion s'applique vivent dans lib/sync et
// dans App.
//
// Le principe : ce qui n'a bougé que d'un côté est pris de ce côté ; ce qui a
// bougé des deux côtés (séances faites hors ligne sur les deux appareils) suit
// une règle propre à chaque champ, qui ne perd jamais une réponse :
//  - un fait Leitner garde l'union des tentatives, et l'état de la boîte la
//    plus basse — une erreur n'est jamais effacée, au pire le fait revient une
//    fois de plus. Rejouer les tentatives est impossible : elles ne portent que
//    la date (ni l'heure, ni le mode de saisie qui fixe le seuil de rapidité) ;
//  - les séances sont réunies, et le compteur suit ;
//  - la série se rejoue jour par jour depuis la base (le dernier dépôt
//    fusionné), avec les fonctions mêmes qui la tiennent d'habitude ;
//  - badges réunis, drapeaux « déjà vu » : vrai d'un côté suffit.
//
// Savoir « qui a du neuf » ne demande pas de base pour les faits ni pour les
// séances : leurs historiques ne font que s'allonger, donc ce qu'un côté a et
// que l'autre n'a pas est du neuf — au rognage près des historiques bornés
// (cf. unseen). La base ne sert qu'à la série et aux réglages (prénom, verbes
// vus en classe), d'où sa forme réduite (SyncBase).

import type { Attempt, Badge, BoxLevel, PlayerEntry, SessionResult, UserProfile } from '../types';
import { getDivisionFactKey } from './divisionFacts';
import { getFactKey } from './facts';
import { LAST_SESSION_DATE_FIELD } from './hardestFacts';
import { ATTEMPT_HISTORY_CAP } from './leitner';
import { getRemainderFactKey } from './remainderFacts';
import { SESSION_HISTORY_CAP } from './storage';
import { applyStreakUpdate } from './streak';
import { isActivePlayer } from './watchStore';

type StreakFields = Pick<
  UserProfile,
  'lastSessionDate' | 'currentStreak' | 'longestStreak' | 'streakFreezes' | 'freezeSettledDate' | 'freezeProgress'
>;

/** Ce que l'appareil retient du dernier dépôt fusionné : l'ancêtre commun des
 *  deux copies, pour rejouer la série et arbitrer un réglage changé des deux
 *  côtés. */
export type SyncBase = StreakFields & Pick<UserProfile, 'name' | 'irrClassVerbs'>;

function streakOf(p: StreakFields): StreakFields {
  return {
    lastSessionDate: p.lastSessionDate,
    currentStreak: p.currentStreak,
    longestStreak: p.longestStreak,
    streakFreezes: p.streakFreezes,
    freezeSettledDate: p.freezeSettledDate,
    freezeProgress: p.freezeProgress,
  };
}

export function syncBaseOf(profile: UserProfile): SyncBase {
  return { name: profile.name, irrClassVerbs: profile.irrClassVerbs, ...streakOf(profile) };
}

/** JSON aux clés triées : deux objets égaux s'écrivent pareil, quel que soit
 *  l'ordre dans lequel leurs champs ont été posés. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, (v as Record<string, unknown>)[k]]),
        )
      : v,
  );
}

function same(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

// Un historique borné (les plus anciens tombent), et de quoi en reconnaître
// les éléments.
interface History<T> {
  key: (x: T) => string;
  date: (x: T) => string;
  cap: number;
}

const attemptKey = (a: Attempt) =>
  `${a.date}|${a.correct}|${a.responseTimeMs}|${a.answeredWith ?? ''}|${a.expectedForm ?? ''}`;
const ATTEMPTS: History<Attempt> = { key: attemptKey, date: (a) => a.date, cap: ATTEMPT_HISTORY_CAP };

// Une séance antérieure aux identifiants se reconnaît à son contenu : sa clé,
// coûteuse, n'est calculée qu'une fois par objet.
const legacySessionKeys = new WeakMap<SessionResult, string>();
function sessionKey(s: SessionResult): string {
  if (s.id) return s.id;
  let key = legacySessionKeys.get(s);
  if (key === undefined) {
    key = stableStringify(s);
    legacySessionKeys.set(s, key);
  }
  return key;
}
const SESSIONS: History<SessionResult> = { key: sessionKey, date: (s) => s.date, cap: SESSION_HISTORY_CAP };

/**
 * Éléments de `a` absents de `b` : ce que `a` a fait de neuf. Quand `b` est
 * plein, ce qui est plus ancien que son plus ancien élément a pu y être
 * simplement rogné, ce n'est pas du neuf.
 */
function unseen<T>(a: T[], b: T[], { key, date, cap }: History<T>): T[] {
  const known = new Set(b.map(key));
  let floor = '';
  if (b.length >= cap) for (const x of b) if (!floor || date(x) < floor) floor = date(x);
  return a.filter((x) => !known.has(key(x)) && !(floor && date(x) <= floor));
}

/** Union sans doublon, dans l'ordre chronologique, aux `cap` plus récents. */
function union<T>(a: T[], b: T[], { key, date, cap }: History<T>): T[] {
  const known = new Set(a.map(key));
  // Tri stable : à date égale, l'ordre de chaque côté est conservé.
  return [...a, ...b.filter((x) => !known.has(key(x)))]
    .sort((x, y) => (date(x) < date(y) ? -1 : date(x) > date(y) ? 1 : 0))
    .slice(-cap);
}

interface FactState {
  box: BoxLevel;
  lastSeen: string;
  nextDue: string;
  history: Attempt[];
  introduced: boolean;
  introducedAt?: string;
  seen?: number;
}

// Même état Leitner : les champs qui bougent, et la dernière tentative (un
// historique ne fait que s'allonger). Évite de sérialiser chacun des ~300 faits
// à chaque synchro.
function sameState(l: FactState, r: FactState): boolean {
  const lastL = l.history.at(-1);
  const lastR = r.history.at(-1);
  return (
    l.box === r.box &&
    l.lastSeen === r.lastSeen &&
    l.nextDue === r.nextDue &&
    l.introduced === r.introduced &&
    l.introducedAt === r.introducedAt &&
    l.seen === r.seen &&
    l.history.length === r.history.length &&
    (lastL && lastR ? attemptKey(lastL) === attemptKey(lastR) : lastL === lastR)
  );
}

// Deux états d'un fait travaillé des deux côtés : la boîte la plus basse, puis
// l'échéance la plus proche. Le dernier critère ne sert qu'à rendre le choix
// indépendant du côté d'où l'on fusionne.
function lowerOf<F extends FactState>(l: F, r: F): F {
  if (l.box !== r.box) return l.box < r.box ? l : r;
  if (l.nextDue !== r.nextDue) return l.nextDue < r.nextDue ? l : r;
  return stableStringify(l) <= stableStringify(r) ? l : r;
}

function mergeFact<F extends FactState>(l: F, r: F): F {
  if (sameState(l, r)) return l;
  const lNew = unseen(l.history, r.history, ATTEMPTS).length > 0;
  const rNew = unseen(r.history, l.history, ATTEMPTS).length > 0;
  // Un seul côté a répondu depuis que les copies se sont séparées : son état
  // est la suite de l'autre. Sinon (les deux, ou aucun — un placement fait des
  // deux côtés), la règle prudente.
  const winner = lNew && !rNew ? l : rNew && !lNew ? r : lowerOf(l, r);
  const merged: F = {
    ...winner,
    history: union(l.history, r.history, ATTEMPTS),
    introduced: l.introduced || r.introduced,
  };
  const introducedAt = [l.introducedAt, r.introducedAt].filter((d): d is string => !!d).sort()[0];
  if (introducedAt) merged.introducedAt = introducedAt;
  if (l.seen !== undefined || r.seen !== undefined) merged.seen = Math.max(l.seen ?? 0, r.seen ?? 0);
  return merged;
}

function mergeFacts<F extends FactState>(
  l: F[] | undefined,
  r: F[] | undefined,
  key: (f: F) => string,
): F[] | undefined {
  // Matière jamais ouverte d'un côté (conjugaison, verbes) : l'autre fait foi.
  if (!l) return r;
  if (!r) return l;
  const theirs = new Map(r.map((f) => [key(f), f]));
  const mine = new Set(l.map(key));
  return [
    ...l.map((f) => {
      const other = theirs.get(key(f));
      return other ? mergeFact(f, other) : f;
    }),
    ...r.filter((f) => !mine.has(key(f))),
  ];
}

// La série quand les deux côtés ont joué : on repart de la base et on rejoue,
// dans l'ordre, chaque jour joué depuis — c'est ce qui rend le gel qu'un
// appareil a cru devoir dépenser pour un jour joué sur l'autre.
function replayStreak(base: SyncBase, sessions: SessionResult[], seed: UserProfile): StreakFields {
  let state = streakOf(base);
  const days = [...new Set(sessions.map((s) => s.date))]
    .filter((day) => !base.lastSessionDate || day > base.lastSessionDate)
    .sort();
  for (const day of days) {
    const update = applyStreakUpdate({ ...seed, ...state }, day);
    state = {
      lastSessionDate: day,
      currentStreak: update.currentStreak,
      longestStreak: Math.max(state.longestStreak, update.currentStreak),
      streakFreezes: update.streakFreezes,
      freezeSettledDate: update.freezeSettledDate,
      freezeProgress: update.freezeProgress,
    };
  }
  return state;
}

function mergeBadges(l: Badge[], r: Badge[]): Badge[] {
  const byId = new Map<string, Badge>();
  for (const badge of [...l, ...r]) {
    const known = byId.get(badge.id);
    if (!known || badge.earnedDate < known.earnedDate) byId.set(badge.id, badge);
  }
  return [...byId.values()];
}

function mergePlayers(
  l: Record<string, PlayerEntry> | undefined,
  r: Record<string, PlayerEntry> | undefined,
): Record<string, PlayerEntry> | undefined {
  if (!l || !r) return l ?? r;
  const out: Record<string, PlayerEntry> = { ...r };
  for (const [id, mine] of Object.entries(l)) {
    const theirs = out[id];
    if (!theirs) {
      out[id] = mine;
      continue;
    }
    const left = [mine.left, theirs.left].filter((d): d is string => !!d).sort().pop();
    out[id] = { joined: mine.joined > theirs.joined ? mine.joined : theirs.joined, ...(left ? { left } : {}) };
  }
  return out;
}

/** Plus récente de deux dates « AAAA-MM-JJ », null comprise. */
function laterDate(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

const SEEN_FLAGS = [
  'hasSeenRulesIntro',
  'hasSeenRule11',
  'hasSeenDivisionIntro',
  'hasSeenConjIntro',
  'hasDoneConjPlacement',
  'hasSeenIrrIntro',
  'hasDoneIrrPlacement',
] as const;

const THEMES = [
  'mysteryTheme',
  'divisionMysteryTheme',
  'remainderMysteryTheme',
  'conjMysteryTheme',
  'irrMysteryTheme',
] as const;

/**
 * Fusionne la copie locale d'un profil avec la copie distante. `base` est le
 * dernier dépôt fusionné par cet appareil (null au premier appairage, ou pour
 * deux copies qui ont divergé avant toute synchro : la série prend alors le
 * côté qui a joué le plus récemment).
 */
export function mergeProfiles(local: UserProfile, remote: UserProfile, base: SyncBase | null): UserProfile {
  const lNewSessions = unseen(local.sessionHistory, remote.sessionHistory, SESSIONS);
  const rNewSessions = unseen(remote.sessionHistory, local.sessionHistory, SESSIONS);
  const sessionHistory = union(local.sessionHistory, remote.sessionHistory, SESSIONS);

  let streak: StreakFields;
  if (rNewSessions.length === 0) streak = streakOf(local);
  else if (lNewSessions.length === 0) streak = streakOf(remote);
  else if (base) streak = replayStreak(base, sessionHistory, local);
  else streak = streakOf((remote.lastSessionDate ?? '') > (local.lastSessionDate ?? '') ? remote : local);
  streak.longestStreak = Math.max(local.longestStreak, remote.longestStreak, streak.longestStreak);

  // Réglage changé d'un seul côté depuis la base : ce côté-là. Des deux côtés,
  // ou sans base : le local.
  const setting = <K extends 'name' | 'irrClassVerbs'>(key: K): UserProfile[K] =>
    !same(local[key], remote[key]) && base && same(local[key], base[key]) ? remote[key] : local[key];

  const merged: UserProfile = {
    // Champs qu'une version plus ancienne ne connaît pas : recopiés tels quels.
    ...remote,
    ...local,
    name: setting('name'),
    irrClassVerbs: setting('irrClassVerbs'),
    childId: remote.childId ?? local.childId,
    startDate: local.startDate < remote.startDate ? local.startDate : remote.startDate,
    facts: mergeFacts(local.facts, remote.facts, (f) => getFactKey(f.a, f.b))!,
    divisionFacts: mergeFacts(local.divisionFacts, remote.divisionFacts, (f) =>
      getDivisionFactKey(f.dividend, f.divisor),
    ),
    remainderFacts: mergeFacts(local.remainderFacts, remote.remainderFacts, (f) =>
      getRemainderFactKey(f.divisor, f.quotient),
    ),
    conjFacts: mergeFacts(local.conjFacts, remote.conjFacts, (f) => f.key),
    irrFacts: mergeFacts(local.irrFacts, remote.irrFacts, (f) => f.key),
    sessionHistory,
    totalSessions: Math.max(
      local.totalSessions + rNewSessions.length,
      remote.totalSessions + lNewSessions.length,
    ),
    ...streak,
    badges: mergeBadges(local.badges, remote.badges),
    players: mergePlayers(local.players, remote.players),
  };
  for (const field of Object.values(LAST_SESSION_DATE_FIELD)) {
    merged[field] = laterDate(local[field], remote[field]);
  }
  for (const flag of SEEN_FLAGS) {
    if (local[flag] || remote[flag]) merged[flag] = true;
  }
  // Image mystère : celle déjà déposée. Les deux copies la partagent depuis
  // l'appairage ; elles ne diffèrent que si chacune a tiré la sienne pour un
  // champ ajouté après coup, et l'image ne doit pas changer d'un dépôt à l'autre.
  for (const theme of THEMES) {
    const deposited = remote[theme];
    if (deposited) merged[theme] = deposited;
  }
  delete merged.appVersion;
  delete merged.syncFormat;
  return merged;
}

/** Ajoute (ou remet) cet appareil parmi ceux qui font jouer le profil. */
export function withPlayer(profile: UserProfile, deviceId: string, now: string): UserProfile {
  const entry = profile.players?.[deviceId];
  if (entry && isActivePlayer(entry)) return profile;
  return { ...profile, players: { ...profile.players, [deviceId]: { joined: now } } };
}

/** Retire cet appareil de ceux qui font jouer le profil. */
export function withoutPlayer(profile: UserProfile, deviceId: string, now: string): UserProfile {
  const entry = profile.players?.[deviceId];
  if (!entry) return profile;
  return { ...profile, players: { ...profile.players, [deviceId]: { ...entry, left: now } } };
}
