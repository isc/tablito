// Journal de diagnostic de la saisie vocale, pour comprendre sur appareil réel
// ce que fait la reconnaissance (les comportements du SpeechRecognizer Android
// ne sont pas reproductibles en local). Flag levé : console.debug + overlay à
// l'écran avec un bouton « Copier » — utilisable sur téléphone sans câble ni
// chrome://inspect.
//
// Activation : ouvrir l'app avec ?voicedebug=1 (persiste en localStorage),
// désactivation avec ?voicedebug=0. Flag éteint, voiceLog est un no-op : les
// transcripts (voix des enfants) ne doivent laisser aucune trace, même en
// console, chez les utilisateurs normaux.

import { createDebugOverlay, readDebugFlag } from './debugTools';

const MAX_ENTRIES = 400;
const OVERLAY_LINES = 12;

const enabled = readDebugFlag('voicedebug', 'multiplix-voice-debug');
const entries: string[] = [];
let logEl: HTMLElement | null = null;

export function voiceLog(event: string, detail = ''): void {
  if (!enabled) return;
  const line = `${new Date().toISOString().slice(11, 23)} ${event}${detail ? ` ${detail}` : ''}`;
  console.debug(`[voice] ${line}`);
  entries.push(line);
  if (entries.length > MAX_ENTRIES) entries.shift();
  // Créé paresseusement : l'overlay n'apparaît qu'au premier événement vocal.
  logEl ??= createDebugOverlay({
    copyLabel: 'Copier le journal vocal',
    copyText: () => entries.join('\n'),
    position: 'bottom',
  });
  logEl.textContent = entries.slice(-OVERLAY_LINES).join('\n');
}
