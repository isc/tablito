// Suivi à distance d'un profil : un parent consulte la progression de son
// enfant depuis SON appareil, alors que l'enfant pratique sur un autre.
//
// Deux rôles, non exclusifs sur un même appareil :
//  - PUBLIEUR (appareil de l'enfant) : après chaque séance, dépose un
//    instantané du profil — gzippé puis chiffré CÔTÉ CLIENT (AES-GCM) — dans la
//    table Supabase `watches`, sous un code haute entropie.
//  - SUIVEUR (appareil du parent) : détient code + clé, scannés une fois à
//    l'appairage, relit le blob et le déchiffre localement.
//
// Le profil suivi n'est JAMAIS installé sur l'appareil du parent : il ne vit
// qu'en mémoire, le temps de l'afficher. C'est délibéré — installé, il se
// mêlerait aux profils locaux (« Qui joue ? »), et une séance faite par erreur
// dessus divergerait de l'appareil de l'enfant, que le dépôt suivant écraserait.
//
// Même primitive que lib/transfer : la clé voyage dans le fragment d'URL
//
//   https://tablito.app/#watch=<code>.<clé>
//
// jamais envoyé au serveur (spéc. HTTP), qui ne voit donc passer qu'un blob
// opaque. Deux différences avec un transfert : le dépôt est DURABLE (rafraîchi
// à chaque séance au lieu d'être consommé à la lecture) et relisible autant de
// fois que nécessaire. Le code est donc une capacité permanente, d'où
// stopWatch() côté enfant — cf. l'en-tête de supabase/watches.sql.
//
// Ce module porte le réseau et le chiffrement ; les types et les accès
// localStorage vivent dans lib/watchStore (chargé en eager par App, là où ce
// module-ci ne doit l'être que sur demande).

import type { UserProfile } from '../types';
import { clearUrlHash } from './storage';
import { packProfileWithKey, randomCode, randomKeyB64, unpackProfile } from './transfer';
import { supabaseRpc } from './supabase';
import {
  clearWatchCredentials,
  listWatched,
  loadWatchCredentials,
  saveWatchCredentials,
  saveWatched,
  parseWatchLink,
  watchLink,
  type WatchCredentials,
  type WatchedProfile,
} from './watchStore';

// === Côté publieur (appareil de l'enfant) ===

async function publish(creds: WatchCredentials, profile: UserProfile): Promise<boolean> {
  try {
    const payload = await packProfileWithKey(profile, creds.key);
    const res = await supabaseRpc('publish_watch', { p_code: creds.code, p_payload: payload });
    return res?.ok ?? false;
  } catch {
    return false; // chiffrement indisponible (contexte non sécurisé)
  }
}

/**
 * Ouvre le partage de ce profil : tire un code + une clé, dépose un premier
 * instantané, et mémorise les identifiants pour les dépôts suivants. Renvoie le
 * lien d'appairage (à afficher en QR), ou null si le dépôt a échoué — dans ce
 * cas rien n'est mémorisé, pour ne pas laisser un partage à moitié ouvert.
 */
export async function startWatch(
  profileId: string,
  profile: UserProfile,
): Promise<string | null> {
  const existing = loadWatchCredentials(profileId);
  // Déjà partagé : on ne tire pas un code neuf, sinon les appareils déjà
  // appairés cesseraient silencieusement de voir les mises à jour.
  const creds = existing ?? { code: randomCode(), key: randomKeyB64() };
  if (!(await publish(creds, profile))) return null;
  if (!existing) saveWatchCredentials(profileId, creds);
  return watchLink(creds);
}

/**
 * Rafraîchit l'instantané publié de ce profil. No-op si le profil n'est pas
 * partagé. Best-effort et jamais bloquant : appelé en fin de séance, un échec
 * (hors-ligne) sera rattrapé par la séance suivante.
 */
export async function publishWatchSnapshot(
  profileId: string,
  profile: UserProfile,
): Promise<void> {
  const creds = loadWatchCredentials(profileId);
  if (creds) await publish(creds, profile);
}

/**
 * Ferme le partage : supprime la ligne serveur et oublie les identifiants.
 * Appelé par « Ne plus partager », et à la suppression d'un profil — sinon un
 * dépôt relisible survivrait à l'enfant dont il porte la progression.
 */
export async function stopWatch(profileId: string): Promise<void> {
  const creds = loadWatchCredentials(profileId);
  clearWatchCredentials(profileId);
  if (creds) await supabaseRpc('revoke_watch', { p_code: creds.code });
}

// === Côté suiveur (appareil du parent) ===

/** Instantané distant déchiffré, avec la date de son dépôt. */
export interface WatchSnapshot {
  profile: UserProfile;
  updatedAt: string;
}

// Issue d'une relecture. « revoked » (le partage a été arrêté côté enfant, la
// ligne n'existe plus) est distingué de « error » : c'est définitif, donc le
// message affiché diffère.
export type WatchFetchResult = WatchSnapshot | 'revoked' | 'error';

/** Relit et déchiffre l'instantané d'un profil suivi. */
export async function fetchWatched(creds: WatchCredentials): Promise<WatchFetchResult> {
  const res = await supabaseRpc('read_watch', { p_code: creds.code });
  if (!res?.ok) return 'error';
  let row: { payload?: string; updated_at?: string } | null = null;
  try {
    row = await res.json();
  } catch {
    return 'error';
  }
  if (!row) return 'revoked';
  const profile = await unpackProfile(row.payload ?? '', creds.key);
  if (!profile) return 'error';
  // Le prénom peut avoir changé depuis l'appairage : on garde le libellé à jour
  // (écriture seulement s'il a bougé).
  const list = listWatched();
  const entry = list.find((w) => w.code === creds.code);
  if (entry && entry.name !== profile.name) {
    entry.name = profile.name;
    saveWatched(list);
  }
  return { profile, updatedAt: row.updated_at ?? new Date().toISOString() };
}

/** Un suivi fraîchement appairé, avec de quoi l'afficher tout de suite. */
export interface WatchPairing {
  entry: WatchedProfile;
  snapshot: WatchSnapshot;
}

/**
 * Appaire un suivi depuis un lien scanné ou ouvert : vérifie qu'il est lisible
 * (un QR mémorisé sans jamais avoir été déchiffré donnerait un onglet mort),
 * puis l'ajoute à la liste. Renvoie l'entrée créée ET l'instantané, pour un
 * premier affichage immédiat sans second aller-retour réseau.
 */
export async function addWatched(text: string): Promise<WatchPairing | null> {
  const creds = parseWatchLink(text);
  if (!creds) return null;
  const snapshot = await fetchWatched(creds);
  if (typeof snapshot === 'string') return null;
  const list = listWatched();
  let entry = list.find((w) => w.code === creds.code);
  if (entry) {
    // Re-scan du même QR (parent qui doute d'avoir réussi) : on rafraîchit la
    // clé au lieu d'empiler un doublon. Le prénom, lui, vient d'être synchronisé
    // par fetchWatched.
    entry.key = creds.key;
  } else {
    entry = {
      ...creds,
      name: snapshot.profile.name,
      addedAt: new Date().toISOString(),
    };
    list.push(entry);
  }
  saveWatched(list);
  return { entry, snapshot };
}

/**
 * Au boot, consomme un éventuel `#watch=` dans l'URL — le parent vient de
 * scanner le QR affiché sur l'appareil de l'enfant. Contrairement à un
 * transfert, RIEN n'est installé : l'appareil devient seulement suiveur, ce qui
 * doit fonctionner même s'il n'a aucun profil local (parent qui découvre
 * Tablito par ce QR). Renvoie null si le fragment est absent.
 */
export async function importWatchFromUrl(): Promise<WatchPairing | 'error' | null> {
  if (!parseWatchLink(window.location.hash)) return null;
  try {
    return (await addWatched(window.location.hash)) ?? 'error';
  } finally {
    // Retire le fragment pour qu'un refresh ne relance pas l'appairage.
    clearUrlHash();
  }
}
