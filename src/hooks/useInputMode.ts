import { useCallback, useSyncExternalStore } from 'react';

export type InputMode = 'keypad' | 'voice';

export const INPUT_MODE_STORAGE_KEY = 'multiplix-input-mode';

// Store partagé entre toutes les instances du hook : sans ça, SessionScreen
// et VoiceInput auraient chacun leur propre useState et le clic sur
// « Utiliser le clavier » dans VoiceInput ne re-rendrait pas SessionScreen.
function readMode(): InputMode {
  try {
    return localStorage.getItem(INPUT_MODE_STORAGE_KEY) === 'voice' ? 'voice' : 'keypad';
  } catch {
    return 'keypad';
  }
}

export function isVoiceMode(): boolean {
  return readMode() === 'voice';
}

let currentMode: InputMode = readMode();
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): InputMode {
  return currentMode;
}

export function useInputMode(): {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
} {
  const inputMode = useSyncExternalStore(subscribe, getSnapshot);

  const setInputMode = useCallback((mode: InputMode) => {
    if (currentMode === mode) return;
    currentMode = mode;
    try {
      localStorage.setItem(INPUT_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
    // Snapshot pour ne pas itérer sur le set en cours de mutation si un
    // listener déclenche un unsubscribe synchrone (ex: composant qui
    // s'unmount à cause du nouveau mode).
    for (const listener of [...listeners]) listener();
  }, []);

  return { inputMode, setInputMode };
}

// === Verbes irréguliers anglais (specs §16.6) ===
// Réglage PROPRE à la matière, et voix par défaut : l'interrogation en classe
// est orale, et dire les formes aide à les retenir. Le clavier reste à un geste
// (et il est mémorisé si l'enfant le choisit). Le réglage commun ne convient
// pas : son défaut est le clavier, et la conjugaison comme les maths le
// gardent.
export const IRR_INPUT_MODE_STORAGE_KEY = 'multiplix-irr-input-mode';

function readIrrMode(): InputMode {
  try {
    return localStorage.getItem(IRR_INPUT_MODE_STORAGE_KEY) === 'keypad' ? 'keypad' : 'voice';
  } catch {
    return 'voice';
  }
}

export function isIrrVoiceMode(): boolean {
  return readIrrMode() === 'voice';
}

let currentIrrMode: InputMode = readIrrMode();
const irrListeners = new Set<() => void>();

function subscribeIrr(callback: () => void): () => void {
  irrListeners.add(callback);
  return () => {
    irrListeners.delete(callback);
  };
}

export function useIrrInputMode(): {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
} {
  const inputMode = useSyncExternalStore(subscribeIrr, () => currentIrrMode);
  const setInputMode = useCallback((mode: InputMode) => {
    if (currentIrrMode === mode) return;
    currentIrrMode = mode;
    try {
      localStorage.setItem(IRR_INPUT_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
    for (const listener of [...irrListeners]) listener();
  }, []);
  return { inputMode, setInputMode };
}
