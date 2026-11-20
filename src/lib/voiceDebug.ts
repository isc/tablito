// Journal de diagnostic de la saisie vocale, pour comprendre sur appareil réel
// ce que fait la reconnaissance (les comportements du SpeechRecognizer d'Android
// ou de WebKit ne sont pas reproductibles en local).
//
// Toujours tenu, sur l'appareil seulement : les dernières lignes vivent en
// localStorage et survivent à la fermeture de l'app. Elles ne sortent qu'avec un
// avis, si le parent coche « Joindre le journal du micro » (FeedbackModal), qui
// les efface une fois l'avis parti. Elles contiennent ce que la reconnaissance a
// compris (les réponses dites par l'enfant), jamais le son. Sans ça, il fallait
// connaître le geste caché AVANT le bug, le reproduire, puis copier-coller le
// journal : personne d'autre que le développeur ne l'envoyait.
//
// Le bandeau à l'écran (bouton « Copier ») et la console restent derrière un
// flag : ouvrir l'app avec ?voicedebug=1 (persiste en localStorage), ou toucher
// 7 fois le numéro de version en bas de l'espace parent ; même geste,
// ?voicedebug=0 ou le bouton « Désactiver » du bandeau pour couper.

import { createDebugOverlay, readDebugFlag, setDebugFlag, type DebugOverlay } from './debugTools';

const MAX_ENTRIES = 400;
const OVERLAY_LINES = 12;
const FLAG_KEY = 'multiplix-voice-debug';
const LOG_KEY = 'multiplix-voice-log';

let enabled = readDebugFlag('voicedebug', FLAG_KEY);
const entries: string[] = loadEntries();
let overlay: DebugOverlay | null = null;

function loadEntries(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((l): l is string => typeof l === 'string') : [];
  } catch {
    return [];
  }
}

// Écrit à chaque ligne, sans différer : un plantage de la page (ce qu'on cherche
// justement à comprendre) emporterait les dernières lignes en attente.
function persist(write: (storage: Storage) => void): void {
  try {
    write(localStorage);
  } catch {
    // Stockage plein ou indisponible : le journal ne vaut que pour la page.
  }
}

export function isVoiceDebugOn(): boolean {
  return enabled;
}

/** Bandeau et console : le journal, lui, tourne dans tous les cas. */
export function setVoiceDebug(on: boolean): void {
  enabled = on;
  setDebugFlag(FLAG_KEY, on);
  if (on) return;
  overlay?.remove();
  overlay = null;
}

/** Les lignes gardées sur cet appareil, de la plus ancienne à la plus récente. */
export function getVoiceLog(): string[] {
  return [...entries];
}

export function clearVoiceLog(): void {
  entries.length = 0;
  persist((s) => s.removeItem(LOG_KEY));
  if (overlay) overlay.log.textContent = '';
}

export function voiceLog(event: string, detail = ''): void {
  // Date comprise : le journal court sur plusieurs jours et plusieurs séances.
  const line = `${new Date().toISOString().slice(0, 23)} ${event}${detail ? ` ${detail}` : ''}`;
  entries.push(line);
  if (entries.length > MAX_ENTRIES) entries.shift();
  persist((s) => s.setItem(LOG_KEY, JSON.stringify(entries)));
  if (!enabled) return;
  console.debug(`[voice] ${line}`);
  // Créé paresseusement : l'overlay n'apparaît qu'au premier événement vocal.
  overlay ??= createDebugOverlay({
    copyLabel: 'Copier le journal vocal',
    copyText: () => entries.join('\n'),
    position: 'bottom',
    onDisable: () => setVoiceDebug(false),
  });
  overlay.log.textContent = entries.slice(-OVERLAY_LINES).join('\n');
}
