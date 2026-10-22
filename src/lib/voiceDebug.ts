// Journal de diagnostic de la saisie vocale, pour comprendre sur appareil réel
// ce que fait la reconnaissance (les comportements du SpeechRecognizer Android
// ne sont pas reproductibles en local). Flag levé : console.debug + overlay à
// l'écran avec un bouton « Copier » — utilisable sur téléphone sans câble ni
// chrome://inspect.
//
// Activation : ouvrir l'app avec ?voicedebug=1 (persiste en localStorage),
// ou toucher 7 fois le numéro de version en bas de l'espace parent ; même
// geste, ?voicedebug=0 ou le bouton « Désactiver » du bandeau pour couper.
// Flag éteint, voiceLog est un no-op : les transcripts (voix des enfants) ne
// doivent laisser aucune trace, même en console, chez les utilisateurs normaux.

import { createDebugOverlay, readDebugFlag, setDebugFlag, type DebugOverlay } from './debugTools';

const MAX_ENTRIES = 400;
const OVERLAY_LINES = 12;
const STORAGE_KEY = 'multiplix-voice-debug';

let enabled = readDebugFlag('voicedebug', STORAGE_KEY);
const entries: string[] = [];
let overlay: DebugOverlay | null = null;

export function isVoiceDebugOn(): boolean {
  return enabled;
}

export function setVoiceDebug(on: boolean): void {
  enabled = on;
  setDebugFlag(STORAGE_KEY, on);
  if (on) return;
  entries.length = 0;
  overlay?.remove();
  overlay = null;
}

export function voiceLog(event: string, detail = ''): void {
  if (!enabled) return;
  const line = `${new Date().toISOString().slice(11, 23)} ${event}${detail ? ` ${detail}` : ''}`;
  console.debug(`[voice] ${line}`);
  entries.push(line);
  if (entries.length > MAX_ENTRIES) entries.shift();
  // Créé paresseusement : l'overlay n'apparaît qu'au premier événement vocal.
  overlay ??= createDebugOverlay({
    copyLabel: 'Copier le journal vocal',
    copyText: () => entries.join('\n'),
    position: 'bottom',
    onDisable: () => setVoiceDebug(false),
  });
  overlay.log.textContent = entries.slice(-OVERLAY_LINES).join('\n');
}
