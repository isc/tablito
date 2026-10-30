// Synchro d'un profil que l'enfant joue sur plusieurs appareils (specs §14.4),
// par le canal chiffré du suivi à distance : même table `watches`, même code,
// même clé (cf. lib/watch). Chaque appareil qui fait jouer l'enfant relit le
// dépôt, le fusionne avec sa copie (lib/syncMerge) et redépose le résultat ;
// ceux qui ne font que suivre lisent toujours un profil complet.
//
// Le dépôt est conditionnel (publish_watch_if, supabase/watches.sql) : il
// échoue si un autre appareil a déposé depuis la relecture, et l'on relit,
// refusionne, réessaie. Chaque appareil garde sa copie entière : un dépôt
// perdu (hors ligne, appli fermée) ne perd donc rien, il est rattrapé à la
// synchro suivante.
//
// Ce module ne touche pas au profil d'App : il rend une fonction qui applique
// la fusion, et App choisit le moment (jamais en pleine séance).

import type { UserProfile } from '../types';
import { attachPushGroup } from './push';
import { addProfile, findSameChild, normalizeProfile, saveProfile, setActiveProfile } from './storage';
import { supabaseRpc } from './supabase';
import { mergeProfiles, stableStringify, syncBaseOf, withPlayer, withoutPlayer, type SyncBase } from './syncMerge';
import { unpackProfile } from './transfer';
import { packSnapshot, readWatchRow, stopWatch, SYNC_FORMAT } from './watch';
import {
  clearWatchCredentials,
  getDeviceId,
  loadSyncBase,
  loadWatchCredentials,
  playsElsewhere,
  removeWatched,
  saveSyncBase,
  saveWatchCredentials,
  type WatchCredentials,
} from './watchStore';

const MAX_ATTEMPTS = 3;

// Le contenu d'un profil, sans les estampilles posées au dépôt.
function content(profile: UserProfile): string {
  return stableStringify({ ...profile, appVersion: undefined, syncFormat: undefined });
}

/** Un état du dépôt : sa date, le profil et son contenu sérialisé. */
interface Deposit {
  stamp: string;
  profile: UserProfile;
  content: string;
}

// Le dernier état connu de chaque dépôt, par code : la relecture suivante ne
// retélécharge le profil que s'il a changé depuis, et une synchro où rien n'a
// bougé ne fusionne rien. En mémoire seulement — un démarrage relit tout une
// fois.
const known = new Map<string, Deposit>();

// Toute fusion repasse par la normalisation (série réglée au jour, badges
// d'état), sur une copie : la fusion partage des faits avec ses entrées, qui
// sont l'état d'App.
function merge(local: UserProfile, remote: UserProfile, base: SyncBase | null): UserProfile {
  return normalizeProfile(structuredClone(mergeProfiles(local, remote, base)));
}

// Le dépôt tel qu'il est maintenant : l'état gardé, s'il n'a pas changé depuis.
async function readRemote(
  creds: WatchCredentials,
  cached: Deposit | undefined,
): Promise<Deposit | 'offline' | 'missing' | 'outdated'> {
  const row = await readWatchRow(creds.code, cached?.stamp ?? null);
  if (row === 'error') return 'offline';
  if (!row) return 'missing';
  if (!row.payload) return cached ?? 'offline';
  const profile = await unpackProfile(row.payload, creds.key);
  // Illisible (clé qui ne correspond pas) : surtout ne rien écraser.
  if (!profile) return 'offline';
  if ((profile.syncFormat ?? 0) > SYNC_FORMAT) return 'outdated';
  return { stamp: row.updated_at, profile, content: content(profile) };
}

async function publish(
  creds: WatchCredentials,
  profile: UserProfile,
  expected: string,
): Promise<string | 'conflict' | 'missing' | 'offline'> {
  let payload: string;
  try {
    payload = await packSnapshot(profile, creds.key);
  } catch {
    return 'offline';
  }
  const res = await supabaseRpc('publish_watch_if', { p_code: creds.code, p_payload: payload, p_expected: expected });
  if (!res?.ok) return 'offline';
  try {
    const out = (await res.json()) as { status?: string; updated_at?: string };
    if (out.status === 'ok' && out.updated_at) return out.updated_at;
    if (out.status === 'conflict' || out.status === 'missing') return out.status;
  } catch {
    // réponse illisible : comme hors ligne
  }
  return 'offline';
}

export type SyncOutcome =
  // Rien à appliquer : à jour, hors ligne, ou dépôt d'un format plus récent.
  | { status: 'idle' }
  // Le partage n'existe plus : le profil redevient local.
  | { status: 'revoked' }
  // Le dépôt apportait du neuf : `apply` le fusionne dans le profil d'App, tel
  // qu'il sera au moment où App l'applique.
  | { status: 'merged'; apply: (current: UserProfile) => UserProfile };

const IDLE: SyncOutcome = { status: 'idle' };

/**
 * Synchronise un profil local avec son dépôt. Best-effort : hors ligne, rien ne
 * bouge, et la synchro suivante rattrape. `leave` retire cet appareil de ceux
 * qui font jouer l'enfant (cf. leaveSync).
 */
export async function syncProfile(
  profileId: string,
  local: UserProfile,
  { leave = false }: { leave?: boolean } = {},
): Promise<SyncOutcome> {
  const creds = loadWatchCredentials(profileId);
  if (!creds) return IDLE;
  const startBase = loadSyncBase(profileId);
  let base = startBase;
  const now = new Date().toISOString();
  let mine = leave ? withoutPlayer(local, getDeviceId(), now) : withPlayer(local, getDeviceId(), now);
  const localContent = content(local);
  let mineContent = mine === local ? localContent : content(mine);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const theirs = await readRemote(creds, known.get(creds.code));
    if (theirs === 'offline' || theirs === 'outdated') return IDLE;
    if (theirs === 'missing') {
      clearWatchCredentials(profileId);
      return { status: 'revoked' };
    }
    known.set(creds.code, theirs);
    if (mineContent !== theirs.content) {
      mine = merge(mine, theirs.profile, base);
      mineContent = content(mine);
    }
    base = syncBaseOf(theirs.profile);
    if (mineContent !== theirs.content) {
      const published = await publish(creds, mine, theirs.stamp);
      if (published === 'conflict') continue;
      if (published === 'missing') {
        clearWatchCredentials(profileId);
        return { status: 'revoked' };
      }
      // Hors ligne : le dépôt relu est intégré ici, et reste l'ancêtre commun.
      if (published === 'offline') {
        saveSyncBase(profileId, base);
        break;
      }
      known.set(creds.code, { stamp: published, profile: mine, content: mineContent });
    }
    saveSyncBase(profileId, syncBaseOf(mine));
    break;
  }

  // Première synchro de ce profil ici : la souscription push rejoint le groupe
  // de rappel des appareils de l'enfant (cf. lib/push).
  if (!startBase && !leave) void attachPushGroup();
  if (mineContent === localContent) return IDLE;
  const merged = mine;
  return { status: 'merged', apply: (current) => (current === local ? merged : merge(current, merged, startBase)) };
}

/**
 * Retire un profil de cet appareil sans couper l'enfant de ses autres
 * appareils : s'il joue encore ailleurs, on s'en retire et le dépôt reste ;
 * sinon, comme avant, on arrête le partage (un dépôt relisible ne doit pas
 * survivre à l'enfant).
 */
export async function leaveSync(profileId: string, profile: UserProfile): Promise<void> {
  if (playsElsewhere(profileId, profile)) {
    await syncProfile(profileId, profile, { leave: true });
    clearWatchCredentials(profileId);
  } else {
    await stopWatch(profileId);
  }
}

/**
 * « Faire jouer <prénom> ici aussi » : installe le profil suivi comme profil
 * local synchronisé, qui devient actif, et cesse de le suivre en lecture
 * seule. Si l'enfant est déjà sur l'appareil (une copie d'un ancien
 * transfert), les deux copies sont fusionnées. Renvoie le profil installé.
 */
export function joinAsPlayer(creds: WatchCredentials, snapshot: UserProfile): UserProfile {
  const existing = findSameChild(snapshot);
  const profile = withPlayer(
    existing ? merge(existing.profile, snapshot, null) : snapshot,
    getDeviceId(),
    new Date().toISOString(),
  );
  let id: string;
  if (existing) {
    id = existing.id;
    clearWatchCredentials(id); // un ancien partage de cette copie, et sa base
    setActiveProfile(id);
    saveProfile(profile);
  } else {
    id = addProfile(profile);
  }
  saveWatchCredentials(id, creds);
  removeWatched(creds.code);
  return profile;
}
