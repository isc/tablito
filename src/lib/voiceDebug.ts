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

const FLAG_KEY = 'multiplix-voice-debug';
const MAX_ENTRIES = 400;
const OVERLAY_LINES = 12;

function readFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const param = new URLSearchParams(window.location.search).get('voicedebug');
    if (param === '1') localStorage.setItem(FLAG_KEY, '1');
    if (param === '0') localStorage.removeItem(FLAG_KEY);
    return localStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

const enabled = readFlag();
const entries: string[] = [];
let logEl: HTMLElement | null = null;

function ensureOverlay(): HTMLElement {
  if (logEl) return logEl;

  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;z-index:99999;'
    + 'background:rgba(0,0,0,.82);color:#8f8;font:10px/1.35 monospace;'
    + 'padding:4px 6px;pointer-events:none;white-space:pre-wrap;word-break:break-all;';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copier le journal vocal';
  copyBtn.style.cssText =
    'pointer-events:auto;font:inherit;color:#fff;background:#444;'
    + 'border:1px solid #888;border-radius:4px;padding:2px 8px;margin-bottom:2px;';
  copyBtn.onclick = () => {
    void navigator.clipboard?.writeText(entries.join('\n')).then(
      () => { copyBtn.textContent = 'Copié ✓'; },
      () => { copyBtn.textContent = 'Échec de la copie'; },
    );
  };

  logEl = document.createElement('div');
  root.append(copyBtn, logEl);
  document.body.append(root);
  return logEl;
}

export function voiceLog(event: string, detail = ''): void {
  if (!enabled) return;
  const line = `${new Date().toISOString().slice(11, 23)} ${event}${detail ? ` ${detail}` : ''}`;
  console.debug(`[voice] ${line}`);
  entries.push(line);
  if (entries.length > MAX_ENTRIES) entries.shift();
  ensureOverlay().textContent = entries.slice(-OVERLAY_LINES).join('\n');
}
