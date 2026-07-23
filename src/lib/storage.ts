import type { UserProfile, MysteryTheme } from '../types';
import { MYSTERY_POOL } from '../types';
import { checkBadges } from './badges';
import { createInitialFacts } from './facts';
import { createInitialDivisionFacts } from './divisionFacts';
import { createInitialRemainderFacts } from './remainderFacts';
import { inferIntroductionsFromKnowns } from './placement';
import { STREAK_FREEZE_INTERVAL, STREAK_FREEZE_MAX } from './streak';
import { pickRandom, todayISO } from './utils';
import { gunzip, urlBase64ToUint8Array } from './codec';

// Tire un thème d'image mystère pour la division, distinct de celui de la
// multiplication quand le pool le permet — l'image multiplication conquise ne
// doit jamais être re-floutée par le niveau 2 (specs §11.5).
function pickDivisionTheme(multTheme: MysteryTheme): MysteryTheme {
  const others = MYSTERY_POOL.filter((t) => t !== multTheme);
  return pickRandom(others.length > 0 ? others : MYSTERY_POOL);
}

// Idem pour le niveau 3 : thème distinct des DEUX images précédentes quand le
// pool le permet (specs §12.6).
function pickRemainderTheme(multTheme: MysteryTheme, divTheme: MysteryTheme | undefined): MysteryTheme {
  const others = MYSTERY_POOL.filter((t) => t !== multTheme && t !== divTheme);
  return pickRandom(others.length > 0 ? others : MYSTERY_POOL);
}

// === Multi-profils ===
// Plusieurs enfants peuvent partager le même appareil (specs §12). Chaque
// profil vit sous sa propre clé (`multiplix-profile:<id>`), et un index
// léger (`multiplix-profiles`) liste les {id, name} + le profil actif.
// Invariant : l'index n'existe en localStorage que s'il reste au moins un
// profil — l'inline script de index.html teste sa présence (en dur, comme
// l'ancienne clé) pour décider si la landing statique doit s'afficher avant
// que main.js ne charge. Si tu renommes une clé, mets à jour les deux.
export const PROFILES_INDEX_KEY = 'multiplix-profiles';
const PROFILE_KEY_PREFIX = 'multiplix-profile:';
// Clé historique mono-profil — migrée vers l'index à la première lecture.
const LEGACY_STORAGE_KEY = 'multiplix-profile';

export interface ProfileSummary {
  id: string;
  name: string;
}

interface ProfilesIndex {
  activeId: string | null;
  profiles: ProfileSummary[];
}

function profileKey(id: string): string {
  return PROFILE_KEY_PREFIX + id;
}

function generateProfileId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
}

function readIndex(): ProfilesIndex {
  try {
    const raw = localStorage.getItem(PROFILES_INDEX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProfilesIndex;
      const profiles = Array.isArray(parsed.profiles)
        ? parsed.profiles.filter(
            (p): p is ProfileSummary =>
              !!p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string',
          )
        : [];
      // Défensif : un activeId orphelin (entrée supprimée, index altéré)
      // retombe sur le premier profil plutôt que de bloquer le boot.
      const activeId = profiles.some((p) => p.id === parsed.activeId)
        ? parsed.activeId
        : profiles[0]?.id ?? null;
      return { activeId, profiles };
    }
  } catch {
    // Index illisible → on retente la migration legacy ci-dessous.
  }
  return migrateLegacyProfile();
}

// Migration : avant le multi-profil, l'unique profil vivait sous la clé
// `multiplix-profile`. On le déplace tel quel vers le nouveau schéma
// (id généré + index) et on retire l'ancienne clé.
function migrateLegacyProfile(): ProfilesIndex {
  const empty: ProfilesIndex = { activeId: null, profiles: [] };
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (!isValidProfile(parsed)) return empty;
    const id = generateProfileId();
    localStorage.setItem(profileKey(id), raw);
    const index: ProfilesIndex = {
      activeId: id,
      profiles: [{ id, name: (parsed as UserProfile).name }],
    };
    writeIndex(index);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return index;
  } catch {
    return empty;
  }
}

// Best-effort : localStorage indisponible (mode privé strict) ne doit pas
// faire planter l'app — au pire l'état reste en mémoire pour la session.
function writeIndex(index: ProfilesIndex): void {
  try {
    if (index.profiles.length === 0) {
      // Invariant : pas de profil → pas d'index (cf. inline script index.html).
      localStorage.removeItem(PROFILES_INDEX_KEY);
    } else {
      localStorage.setItem(PROFILES_INDEX_KEY, JSON.stringify(index));
    }
  } catch {
    // ignore
  }
}

export function listProfiles(): ProfileSummary[] {
  return readIndex().profiles;
}

export function getActiveProfileId(): string | null {
  return readIndex().activeId;
}

export function setActiveProfile(id: string): void {
  const index = readIndex();
  if (index.activeId === id || !index.profiles.some((p) => p.id === id)) return;
  writeIndex({ ...index, activeId: id });
}

export function loadProfileById(id: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(profileKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidProfile(parsed)) return null;
    return migrateProfile(parsed as UserProfile);
  } catch {
    return null;
  }
}

/**
 * Loads the active user profile from localStorage.
 * Returns null if no profile exists or if parsing fails.
 */
export function loadProfile(): UserProfile | null {
  const id = getActiveProfileId();
  return id ? loadProfileById(id) : null;
}

/**
 * Saves the profile under the active id (created on the fly if the device
 * has no profile yet — ex. import cross-origin avant tout onboarding).
 */
export function saveProfile(profile: UserProfile): void {
  const index = readIndex();
  if (!index.activeId) {
    addProfile(profile);
    return;
  }
  try {
    localStorage.setItem(profileKey(index.activeId), JSON.stringify(profile));
  } catch {
    return;
  }
  // Garde le nom de l'index en phase : il peut changer via un import de
  // sauvegarde depuis l'espace parent (restauration d'un autre prénom).
  const entry = index.profiles.find((p) => p.id === index.activeId);
  if (entry && entry.name !== profile.name) {
    writeIndex({
      ...index,
      profiles: index.profiles.map((p) =>
        p.id === index.activeId ? { ...p, name: profile.name } : p,
      ),
    });
  }
}

/**
 * Persiste un profil sous un nouvel id, qui devient le profil actif.
 * C'est le chemin de création (onboarding) et d'ajout d'un enfant.
 */
export function addProfile(profile: UserProfile): string {
  const index = readIndex();
  const id = generateProfileId();
  try {
    localStorage.setItem(profileKey(id), JSON.stringify(profile));
  } catch {
    return id;
  }
  writeIndex({ activeId: id, profiles: [...index.profiles, { id, name: profile.name }] });
  return id;
}

/**
 * Supprime le profil actif ; s'il reste des profils, le premier devient actif.
 */
export function deleteActiveProfile(): void {
  const index = readIndex();
  if (!index.activeId) return;
  try {
    localStorage.removeItem(profileKey(index.activeId));
  } catch {
    // ignore
  }
  const profiles = index.profiles.filter((p) => p.id !== index.activeId);
  writeIndex({ activeId: profiles[0]?.id ?? null, profiles });
}

/**
 * JSON brut du profil actif, sans validation ni migration — utilisé par
 * ErrorBoundary pour proposer une sauvegarde même si le profil ne parse plus.
 */
export function getActiveProfileRaw(): string | null {
  try {
    const id = getActiveProfileId();
    return id ? localStorage.getItem(profileKey(id)) : null;
  } catch {
    return null;
  }
}

// === Migration cross-origin (ancien domaine isc.github.io → tablito.app) ===
// Le redirecteur de l'ancien chemin encode le profil dans le fragment d'URL
// (#import=<flag><base64url>) au moment de la bascule — une navigation
// top-level, seul moyen fiable de transporter le localStorage entre deux
// origines (le partitionnement de stockage casse l'astuce de l'iframe). Le
// flag distingue 'z' (gzip) de 'r' (brut). Côté encodage : repo `multiplix`.
const IMPORT_HASH_RE = /[#&]import=([^&]+)/;

async function decodeImportPayload(payload: string): Promise<string> {
  const flag = payload[0];
  const bytes = urlBase64ToUint8Array(payload.slice(1));
  if (flag === 'z' && 'DecompressionStream' in globalThis) {
    return new TextDecoder().decode(await gunzip(bytes));
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Retire le fragment de l'URL courante, pour qu'un refresh ne re-déclenche pas
 * un import par fragment (#import= ici, #transfer= dans lib/transfer).
 */
export function clearUrlHash(): void {
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    // ignore
  }
}

/**
 * Au tout premier chargement sur le nouveau domaine, importe le profil transmis
 * par le redirecteur de l'ancien domaine via `#import=` (migration cross-origin).
 * No-op si le fragment est absent ou si un profil local existe déjà (on ne
 * clobber jamais une progression en cours). À appeler avant de monter l'app.
 */
export async function importProfileFromUrl(): Promise<void> {
  const match = window.location.hash.match(IMPORT_HASH_RE);
  if (!match) return;
  try {
    if (listProfiles().length > 0) return; // jamais écraser un profil présent
    const profile = importProfile(await decodeImportPayload(match[1]));
    if (profile) saveProfile(profile);
  } catch {
    // Best-effort : en cas d'échec on laisse l'utilisateur repartir sur
    // l'accueil normal plutôt que de planter le boot.
  } finally {
    clearUrlHash();
  }
}

/**
 * Installe un profil reçu d'un autre appareil (transfert par QR) : si le même
 * enfant existe déjà ici — même prénom ET même date de début, cas du
 * re-transfert — son profil est mis à jour au lieu d'être dupliqué ; sinon le
 * profil est ajouté. Dans les deux cas il devient le profil actif. (L'import
 * par collage depuis le Welcome, lui, crée toujours un nouveau profil : on ne
 * devine pas l'identité sur une sauvegarde éditable à la main.)
 */
export function installProfile(profile: UserProfile): void {
  const existing = listProfiles().find(
    (p) => p.name === profile.name && loadProfileById(p.id)?.startDate === profile.startDate,
  );
  if (existing) {
    setActiveProfile(existing.id);
    saveProfile(profile);
  } else {
    addProfile(profile);
  }
}

/**
 * Exports a profile as a JSON string (for backup / transfer).
 */
export function exportProfile(profile: UserProfile): string {
  return JSON.stringify(profile, null, 2);
}

/**
 * Imports a profile from a JSON string.
 * Returns null if the JSON is invalid or doesn't match the expected shape.
 */
export function importProfile(json: string): UserProfile | null {
  try {
    const parsed = JSON.parse(json);
    if (!isValidProfile(parsed)) return null;
    return migrateProfile(parsed as UserProfile);
  } catch {
    return null;
  }
}

/**
 * Creates a fresh user profile with the given name.
 * All 36 facts start in box 1, not yet introduced.
 */
export function createNewProfile(name: string): UserProfile {
  const now = todayISO();
  const mysteryTheme = pickRandom(MYSTERY_POOL);
  const divisionMysteryTheme = pickDivisionTheme(mysteryTheme);
  return {
    name,
    startDate: now,
    facts: createInitialFacts(),
    totalSessions: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSessionDate: null,
    streakFreezes: 0,
    badges: [],
    sessionHistory: [],
    hasSeenRulesIntro: false,
    hasSeenRule11: false,
    mysteryTheme,
    divisionFacts: createInitialDivisionFacts(),
    divisionMysteryTheme,
    hasSeenDivisionIntro: false,
    remainderFacts: createInitialRemainderFacts(),
    remainderMysteryTheme: pickRemainderTheme(mysteryTheme, divisionMysteryTheme),
  };
}

/**
 * Migrates older profiles to the current shape.
 * Ensures backward compatibility when new fields are added.
 */
function migrateProfile(profile: UserProfile): UserProfile {
  if (!Array.isArray(profile.sessionHistory)) {
    profile.sessionHistory = [];
  }
  if (typeof profile.hasSeenRulesIntro !== 'boolean') {
    profile.hasSeenRulesIntro = true;
  }
  if (typeof profile.hasSeenRule11 !== 'boolean') {
    // Profils existants : laisser à false. Si l'enfant a déjà débloqué la
    // règle (toutes les tables maîtrisées), il verra la pastille « Nouveau »
    // à sa prochaine visite — c'est ce qu'on veut.
    profile.hasSeenRule11 = false;
  }
  if (typeof profile.streakFreezes !== 'number') {
    // Rétro-attribution : on crédite l'équivalent de ce que l'enfant aurait
    // gagné depuis le début de sa série actuelle (1 gel par tranche de 7 jours,
    // plafonné). Sans ça, un enfant qui a fait 30 jours d'affilée découvre le
    // feature en partant à zéro — frustrant.
    profile.streakFreezes = Math.min(
      Math.floor(profile.currentStreak / STREAK_FREEZE_INTERVAL),
      STREAK_FREEZE_MAX,
    );
  }
  // `village` est accepté tel quel (guide utilisateur) ; sinon le thème
  // doit appartenir au pool, et à défaut on en retire un au hasard.
  const t = profile.mysteryTheme;
  if (t !== 'village' && !MYSTERY_POOL.includes(t)) {
    profile.mysteryTheme = pickRandom(MYSTERY_POOL);
  }
  // Strip deprecated mascotLevel field from older profiles
  delete (profile as UserProfile & { mascotLevel?: number }).mascotLevel;
  // Niveau 2 — division : backfill des 64 faits et de l'image dédiée pour les
  // profils v1. Inoffensif tant que le niveau n'est pas débloqué (faits en
  // boîte 1, non introduits ; jamais proposés avant maîtrise multiplicative).
  if (!Array.isArray(profile.divisionFacts)) {
    profile.divisionFacts = createInitialDivisionFacts();
  }
  if (profile.divisionMysteryTheme === undefined) {
    profile.divisionMysteryTheme = pickDivisionTheme(profile.mysteryTheme);
  }
  if (typeof profile.hasSeenDivisionIntro !== 'boolean') {
    profile.hasSeenDivisionIntro = false;
  }
  // Niveau 3 — division avec reste : même backfill que le niveau 2. Inoffensif
  // tant que le niveau n'est pas débloqué (zones en boîte 1, non introduites).
  if (!Array.isArray(profile.remainderFacts)) {
    profile.remainderFacts = createInitialRemainderFacts();
  }
  if (profile.remainderMysteryTheme === undefined) {
    profile.remainderMysteryTheme = pickRemainderTheme(
      profile.mysteryTheme,
      profile.divisionMysteryTheme,
    );
  }
  // Fix les profils créés avant l'ajout de l'inférence par dominance lors
  // du test de placement : si des faits restent non introduits alors qu'on
  // a une preuve de réussite sur des faits plus durs, on les introduit.
  inferIntroductionsFromKnowns(profile.facts, todayISO());
  // Rétro-attribue les badges d'état déjà mérités mais absents du profil :
  // sans ça, un nouveau badge ajouté après coup demande une séance de plus
  // pour se débloquer. Les badges contextuels (MACHINE/VELOCE/PERSEVERANCE)
  // ne se déclenchent pas ici, faute de stats de séance.
  profile.badges = [...profile.badges, ...checkBadges(profile)];
  return profile;
}

/**
 * Basic structural validation of a profile object.
 */
function isValidProfile(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;

  const p = obj as Record<string, unknown>;

  if (typeof p.name !== 'string') return false;
  if (typeof p.startDate !== 'string') return false;
  if (!Array.isArray(p.facts)) return false;
  if (typeof p.totalSessions !== 'number') return false;
  if (typeof p.currentStreak !== 'number') return false;
  if (typeof p.longestStreak !== 'number') return false;
  if (!Array.isArray(p.badges)) return false;

  // Validate each fact has the expected shape
  for (const fact of p.facts) {
    if (typeof fact !== 'object' || fact === null) return false;
    const f = fact as Record<string, unknown>;
    if (typeof f.a !== 'number' || typeof f.b !== 'number') return false;
    // a ≤ b est garanti par createInitialFacts ; la dominance s'appuie dessus.
    if (f.a > f.b) return false;
    if (typeof f.product !== 'number') return false;
    if (typeof f.box !== 'number' || f.box < 1 || f.box > 5) return false;
    if (typeof f.introduced !== 'boolean') return false;
    if (!Array.isArray(f.history)) return false;
  }

  // divisionFacts est optionnel (absent des profils v1). S'il est présent, il
  // doit avoir la bonne forme — un import corrompu doit être rejeté.
  if (p.divisionFacts !== undefined) {
    if (!Array.isArray(p.divisionFacts)) return false;
    for (const fact of p.divisionFacts) {
      if (typeof fact !== 'object' || fact === null) return false;
      const f = fact as Record<string, unknown>;
      if (typeof f.dividend !== 'number') return false;
      if (typeof f.divisor !== 'number') return false;
      if (typeof f.quotient !== 'number') return false;
      if (typeof f.box !== 'number' || f.box < 1 || f.box > 5) return false;
      if (typeof f.introduced !== 'boolean') return false;
      if (!Array.isArray(f.history)) return false;
    }
  }

  // remainderFacts : même statut optionnel, même exigence de forme.
  if (p.remainderFacts !== undefined) {
    if (!Array.isArray(p.remainderFacts)) return false;
    for (const fact of p.remainderFacts) {
      if (typeof fact !== 'object' || fact === null) return false;
      const f = fact as Record<string, unknown>;
      if (typeof f.divisor !== 'number') return false;
      if (typeof f.quotient !== 'number') return false;
      if (typeof f.box !== 'number' || f.box < 1 || f.box > 5) return false;
      if (typeof f.introduced !== 'boolean') return false;
      if (!Array.isArray(f.history)) return false;
    }
  }

  return true;
}
