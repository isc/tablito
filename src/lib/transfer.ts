// Transfert de profil entre appareils (changement de téléphone) via un
// lien/QR éphémère. Le profil est gzippé puis chiffré CÔTÉ CLIENT (AES-GCM,
// clé aléatoire) et déposé dans la table Supabase `transfers` sous un code
// haute entropie — lecture unique, TTL court (cf. supabase/transfers.sql).
// Le lien embarque code + clé dans le fragment d'URL :
//
//   https://tablito.app/#transfer=<code>.<clé>
//
// Le fragment n'est jamais envoyé au serveur (spéc. HTTP) : Supabase ne voit
// passer qu'un blob opaque qu'il ne peut pas déchiffrer. Le nouvel appareil
// scanne le QR (ou ouvre le lien), et main.tsx appelle importTransferFromUrl()
// au boot pour récupérer, déchiffrer et installer le profil.

import type { UserProfile } from '../types';
import { clearUrlHash, importProfile, installProfile } from './storage';
import { bytesToBase64url, gunzip, gzip, urlBase64ToUint8Array } from './codec';
import { supabaseEnv, supabaseHeaders } from './supabase';

/** Durée de validité d'un transfert côté serveur — garder en phase avec
 *  l'interval de read_transfer dans supabase/transfers.sql. */
export const TRANSFER_TTL_MINUTES = 15;

export function transferConfigured(): boolean {
  return supabaseEnv() !== null;
}

const IV_LENGTH = 12; // taille standard du nonce AES-GCM

/** Profil → blob opaque (gzip puis AES-GCM) + clé base64url. Exporté pour les
 *  tests ; le flux nominal passe par createTransfer / importTransferFromUrl. */
export async function packProfile(
  profile: UserProfile,
): Promise<{ payload: string; keyB64: string }> {
  const plain = await gzip(new TextEncoder().encode(JSON.stringify(profile)));
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain),
  );
  const blob = new Uint8Array(IV_LENGTH + cipher.length);
  blob.set(iv);
  blob.set(cipher, IV_LENGTH);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  return { payload: bytesToBase64url(blob), keyB64: bytesToBase64url(raw) };
}

/** Blob opaque + clé → profil validé/migré, ou null si déchiffrement ou
 *  validation échouent. */
export async function unpackProfile(payload: string, keyB64: string): Promise<UserProfile | null> {
  try {
    const blob = urlBase64ToUint8Array(payload);
    const key = await crypto.subtle.importKey(
      'raw',
      urlBase64ToUint8Array(keyB64),
      'AES-GCM',
      false,
      ['decrypt'],
    );
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: blob.slice(0, IV_LENGTH) },
        key,
        blob.slice(IV_LENGTH),
      ),
    );
    return importProfile(new TextDecoder().decode(await gunzip(plain)));
  } catch {
    return null;
  }
}

/**
 * Dépose le profil chiffré côté Supabase et renvoie le lien de transfert à
 * afficher (QR + copie) sur l'ancien appareil. Null si non configuré ou si le
 * dépôt échoue (hors-ligne, service indisponible…).
 */
export async function createTransfer(profile: UserProfile): Promise<string | null> {
  const env = supabaseEnv();
  if (!env) return null;
  try {
    const { payload, keyB64 } = await packProfile(profile);
    // 12 octets aléatoires → 16 chars base64url (96 bits) : inénumérable, et
    // au-dessus du minimum imposé par create_transfer côté SQL.
    const code = bytesToBase64url(crypto.getRandomValues(new Uint8Array(12)));
    const res = await fetch(`${env.url}/rest/v1/rpc/create_transfer`, {
      method: 'POST',
      headers: supabaseHeaders(env.key),
      body: JSON.stringify({ p_code: code, p_payload: payload }),
    });
    if (!res.ok) return null;
    return `${window.location.origin}${import.meta.env.BASE_URL}#transfer=${code}.${keyB64}`;
  } catch {
    return null;
  }
}

// code.clé — deux segments base64url, le code faisant au moins 16 chars.
// ⚠ L'inline script d'index.html teste `location.hash.indexOf('transfer=')`
// en dur (pré-paint, avant tout module) pour sauter la landing statique — si
// le nom du fragment change, mettre à jour les deux.
const TRANSFER_HASH_RE = /[#&]transfer=([A-Za-z0-9_-]{16,64})\.([A-Za-z0-9_-]+)/;

/** Extrait {code, clé} d'un lien/fragment de transfert, null si absent. */
export function parseTransferLink(text: string): { code: string; key: string } | null {
  const match = text.match(TRANSFER_HASH_RE);
  return match ? { code: match[1], key: match[2] } : null;
}

// Récupère le blob (lecture unique côté serveur), le déchiffre et installe le
// profil, qui devient actif (dédup re-transfert : cf. storage.installProfile).
// Null si échec : code expiré/consommé, déchiffrement impossible, hors-ligne.
async function consumeTransfer(code: string, key: string): Promise<UserProfile | null> {
  const env = supabaseEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${env.url}/rest/v1/rpc/read_transfer`, {
      method: 'POST',
      headers: supabaseHeaders(env.key),
      body: JSON.stringify({ p_code: code }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as string | null;
    if (!payload) return null; // code inconnu, expiré ou déjà consommé
    const profile = await unpackProfile(payload, key);
    if (!profile) return null;
    installProfile(profile);
    return profile;
  } catch {
    return null;
  }
}

/**
 * Consomme un lien de transfert scanné par la caméra in-app (WelcomeScreen) —
 * indispensable sur iPhone, où un lien n'ouvre jamais la web app installée et
 * où son stockage est cloisonné de Safari. Renvoie le profil installé, null si
 * le texte n'est pas un lien de transfert ou si le transfert échoue.
 */
export async function importTransferFromLink(text: string): Promise<UserProfile | null> {
  const parsed = parseTransferLink(text);
  return parsed ? consumeTransfer(parsed.code, parsed.key) : null;
}

export type TransferImportResult = 'imported' | 'error' | null;

/**
 * Au boot du nouvel appareil, consomme un éventuel `#transfer=` dans l'URL.
 * À appeler avant de monter l'app. Renvoie null si le fragment est absent,
 * 'error' si le transfert a échoué.
 */
export async function importTransferFromUrl(): Promise<TransferImportResult> {
  const parsed = parseTransferLink(window.location.hash);
  if (!parsed) return null;
  try {
    return (await consumeTransfer(parsed.code, parsed.key)) ? 'imported' : 'error';
  } finally {
    // Retire le fragment pour qu'un refresh ne re-déclenche pas l'import.
    clearUrlHash();
  }
}
