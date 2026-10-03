import { useCallback, useSyncExternalStore } from 'react';

export type InputMode = 'keypad' | 'voice';

export const INPUT_MODE_STORAGE_KEY = 'multiplix-input-mode';

// Verbes irréguliers anglais (specs §16.6) : réglage PROPRE à la matière, et
// voix par défaut — l'interrogation en classe est orale, et dire les formes
// aide à les retenir. Le clavier reste à un geste (et il est mémorisé si
// l'enfant le choisit). Le réglage commun ne convient pas : son défaut est le
// clavier, et la conjugaison comme les maths le gardent.
export const IRR_INPUT_MODE_STORAGE_KEY = 'multiplix-irr-input-mode';

/**
 * Un réglage de saisie persisté, partagé entre toutes les instances du hook :
 * sans store commun, SessionScreen et VoiceInput auraient chacun leur propre
 * useState et le clic sur « Utiliser le clavier » dans VoiceInput ne
 * re-rendrait pas SessionScreen.
 */
function createInputModeStore(storageKey: string, defaultMode: InputMode) {
  const other: InputMode = defaultMode === 'voice' ? 'keypad' : 'voice';
  function read(): InputMode {
    try {
      return localStorage.getItem(storageKey) === other ? other : defaultMode;
    } catch {
      return defaultMode;
    }
  }

  let current = read();
  const listeners = new Set<() => void>();
  const subscribe = (callback: () => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  };
  const getSnapshot = () => current;

  function useMode(): { inputMode: InputMode; setInputMode: (mode: InputMode) => void } {
    const inputMode = useSyncExternalStore(subscribe, getSnapshot);
    const setInputMode = useCallback((mode: InputMode) => {
      if (current === mode) return;
      current = mode;
      try {
        localStorage.setItem(storageKey, mode);
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

  return { useMode, isVoice: () => read() === 'voice' };
}

const shared = createInputModeStore(INPUT_MODE_STORAGE_KEY, 'keypad');
const irr = createInputModeStore(IRR_INPUT_MODE_STORAGE_KEY, 'voice');

export const useInputMode = shared.useMode;
export const isVoiceMode = shared.isVoice;
export const useIrrInputMode = irr.useMode;
export const isIrrVoiceMode = irr.isVoice;
