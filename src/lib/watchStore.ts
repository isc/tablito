// Moitié « stockage local » du suivi à distance : types, identifiants, liste des
// profils suivis, format du lien. Aucune dépendance au chiffrement ni au réseau.
//
// Séparé de lib/watch.ts pour une raison de perf de boot : App.tsx a besoin de
// listWatched() en eager (pour savoir, dès le premier render, si cet appareil
// suit un enfant — cf. initialScreen). Si ce symbole vivait dans watch.ts,
// App tirerait watch.ts → transfer.ts dans le graphe de modules eager, et le
// `await import('./lib/watch')` de main.tsx ne lazy-loaderait plus rien : le
// projet servant chaque module individuellement (nobuild), ça coûterait 2
// requêtes HTTP et un niveau de waterfall à TOUS les boots, y compris ceux qui
// ne touchent jamais au suivi. Ici, rien que des lectures localStorage.

import { supabaseEnv } from './supabase';

/** Identifiants d'un suivi : la ligne serveur (`code`) et de quoi la déchiffrer
 *  (`key`, base64url). Le couple est ce que transporte le QR d'appairage. */
export interface WatchCredentials {
  code: string;
  key: string;
}

/** Un profil suivi, tel que mémorisé sur l'appareil du parent. */
export interface WatchedProfile extends WatchCredentials {
  // Prénom au dernier rafraîchissement réussi — sert de libellé d'onglet avant
  // même d'avoir refetché (donc hors-ligne, ou pendant le chargement).
  name: string;
  addedAt: string;
}

// Identifiants du suivi publié pour un profil local, par id de profil. Gardés
// HORS du UserProfile à dessein : le profil est exporté en JSON et transféré par
// QR, ce qui ferait fuiter la clé de suivi dans des canaux où elle n'a rien à
// faire (et rendrait deux appareils publieurs du même code après un transfert).
const WATCH_KEY_PREFIX = 'multiplix-watch:';
// Liste des profils suivis à distance sur cet appareil.
const WATCHED_KEY = 'multiplix-watched';

export function watchConfigured(): boolean {
  return supabaseEnv() !== null;
}

// Écriture tolérante : en navigation privée stricte, setItem lève. Même parti
// pris que lib/storage — on ne casse pas l'action en cours pour ça.
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/** Lien d'appairage à afficher en QR sur l'appareil de l'enfant. */
export function watchLink({ code, key }: WatchCredentials): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#watch=${code}.${key}`;
}

// ⚠ Le nom du fragment est aussi testé en dur par l'inline script d'index.html
// (pré-paint, avant tout module) pour sauter la landing statique — si `watch=`
// change ici, mettre à jour la regex des fragments de boot là-bas.
const WATCH_HASH_RE = /[#&]watch=([A-Za-z0-9_-]{16,64})\.([A-Za-z0-9_-]+)/;

/** Extrait {code, clé} d'un lien/fragment de suivi, null si absent. */
export function parseWatchLink(text: string): WatchCredentials | null {
  const match = text.match(WATCH_HASH_RE);
  return match ? { code: match[1], key: match[2] } : null;
}

// === Côté publieur : identifiants du partage d'un profil local ===

/** Identifiants du suivi publié pour ce profil, null s'il n'est pas partagé. */
export function loadWatchCredentials(profileId: string): WatchCredentials | null {
  try {
    const raw = localStorage.getItem(WATCH_KEY_PREFIX + profileId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WatchCredentials;
    return typeof parsed?.code === 'string' && typeof parsed?.key === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveWatchCredentials(profileId: string, creds: WatchCredentials): void {
  write(WATCH_KEY_PREFIX + profileId, JSON.stringify(creds));
}

export function clearWatchCredentials(profileId: string): void {
  try {
    localStorage.removeItem(WATCH_KEY_PREFIX + profileId);
  } catch {
    // ignore
  }
}

// === Côté suiveur : liste des enfants suivis sur cet appareil ===

export function listWatched(): WatchedProfile[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(WATCHED_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((w) => typeof w?.code === 'string' && typeof w?.key === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveWatched(list: WatchedProfile[]): void {
  write(WATCHED_KEY, JSON.stringify(list));
}

/** Retire un suivi et renvoie la liste restante (évite un relire-après-écrire
 *  côté appelant, qui doit rafraîchir son état). */
export function removeWatched(code: string): WatchedProfile[] {
  const list = listWatched().filter((w) => w.code !== code);
  saveWatched(list);
  return list;
}
