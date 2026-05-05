import { useState, useCallback, useEffect, useRef } from 'react';
import './NumPad.css';

interface NumPadProps {
  onSubmit: (value: number) => void;
  disabled?: boolean;
}

export default function NumPad({ onSubmit, disabled = false }: NumPadProps) {
  // `input` est miroré dans `inputRef` pour éviter les closures stales :
  // sous Preact, deux pressions clavier rapides peuvent voir la même closure
  // capturée si on dépend de `input` dans les useCallback.
  const [input, setInput] = useState('');
  const inputRef = useRef('');
  const setInputBoth = useCallback((next: string) => {
    inputRef.current = next;
    setInput(next);
  }, []);

  // Reset l'input quand on re-active le pad (= nouvelle question). On le fait
  // en render-time synchrone (pattern React 18 pour state dérivé de props) :
  // un useEffect serait async-microtask sous Preact et laisserait passer des
  // touches voyant encore l'ancienne valeur d'`inputRef`.
  const [prevDisabled, setPrevDisabled] = useState(disabled);
  if (prevDisabled !== disabled) {
    setPrevDisabled(disabled);
    if (!disabled) {
      // Garde de transition (prev !== next) → ne peut pas créer de boucle.
      // eslint-disable-next-line react-hooks/refs
      inputRef.current = '';
      setInput('');
    }
  }

  const handleDigit = useCallback(
    (digit: number) => {
      if (disabled) return;
      const newInput = inputRef.current + digit.toString();
      setInputBoth(newInput);
      if (newInput.length >= 2) {
        onSubmit(parseInt(newInput, 10));
      }
    },
    [disabled, onSubmit, setInputBoth],
  );

  const handleBackspace = useCallback(() => {
    if (disabled) return;
    setInputBoth(inputRef.current.slice(0, -1));
  }, [disabled, setInputBoth]);

  const handleOk = useCallback(() => {
    if (disabled || inputRef.current.length === 0) return;
    onSubmit(parseInt(inputRef.current, 10));
  }, [disabled, onSubmit]);

  // Listener clavier : attaché UNE fois au montage, dispatch via ref pour
  // éviter de dé-/réattacher à chaque render. Sans ça, sous Preact, des
  // pressions peuvent tomber dans la fenêtre où l'ancien listener a été
  // retiré et le nouveau pas encore attaché.
  // L'écriture du ref est synchrone (en render-time) : repousser dans un
  // useEffect serait microtask-async sous Preact et laisserait passer des
  // touches dispatchées vers des callbacks stales (ex: `disabled=true` après
  // une réponse, alors qu'on vient de passer à false).
  const callbacksRef = useRef({ handleDigit, handleBackspace, handleOk });
  // eslint-disable-next-line react-hooks/refs
  callbacksRef.current = { handleDigit, handleBackspace, handleOk };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cb = callbacksRef.current;
      if (e.key >= '0' && e.key <= '9') {
        cb.handleDigit(parseInt(e.key, 10));
      } else if (e.key === 'Backspace') {
        cb.handleBackspace();
      } else if (e.key === 'Enter') {
        cb.handleOk();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="numpad-container">
      <div className="numpad-display" aria-live="polite">
        {input || ''}
        {!disabled && <span className="numpad-display-cursor" />}
      </div>
      <div className="numpad-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            className="numpad-btn"
            onClick={() => handleDigit(d)}
            disabled={disabled}
            aria-label={d.toString()}
          >
            {d}
          </button>
        ))}
        <button
          className="numpad-btn numpad-btn-backspace"
          onClick={handleBackspace}
          disabled={disabled || input.length === 0}
          aria-label="Effacer"
        >
          ⌫
        </button>
        <button
          className="numpad-btn"
          onClick={() => handleDigit(0)}
          disabled={disabled}
          aria-label="0"
        >
          0
        </button>
        <button
          className="numpad-btn numpad-btn-ok"
          onClick={handleOk}
          disabled={disabled || input.length === 0}
          aria-label="Valider"
        >
          OK
        </button>
      </div>
    </div>
  );
}
