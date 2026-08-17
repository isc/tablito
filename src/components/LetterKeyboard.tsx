import { useState, useCallback, useEffect, useRef } from 'react';
import { conjStrings as t } from '../i18n/conjugation';

// Mini-clavier AZERTY à grosses touches (spec Verbito §4.2). Disposition
// scolaire familière, plus é et ê (les seuls diacritiques du périmètre :
// j'étais, vous êtes) — placés juste après le « e », là où l'enfant les
// cherche, plutôt qu'à leur place AZERTY (qui n'existe pas dans les trois
// rangées de lettres).
//
// Différence de fond avec NumPad : la validation est EXPLICITE. Le pavé
// numérique auto-valide à 2 chiffres parce que la longueur d'un produit est
// bornée et prévisible ; ici la réponse fait de 1 (« a ») à 9 caractères
// (« viendront »), on ne peut donc pas deviner qu'elle est finie.

const ROW_TOP = ['a', 'z', 'e', 'é', 'ê', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
const ROW_MID = ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'];
const ROW_BOTTOM = ['w', 'x', 'c', 'v', 'b', 'n'];

const LETTERS = new Set([...ROW_TOP, ...ROW_MID, ...ROW_BOTTOM]);

/**
 * Garde-fou de saisie : « viendront » (9) est la plus longue forme attendue du
 * périmètre. 12 laisse de la marge pour une hésitation sans laisser l'enfant
 * remplir l'écran.
 */
const MAX_LENGTH = 12;

interface LetterKeyboardProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  /**
   * Radical affiché à gauche de la saisie, en encre douce (« chant » quand
   * l'enfant ne tape que la terminaison, §4.2). Purement visuel : il n'est
   * jamais inclus dans la valeur soumise.
   */
  prefix?: string;
}

export default function LetterKeyboard({
  onSubmit,
  disabled = false,
  prefix = '',
}: LetterKeyboardProps) {
  // `input` est miroré dans `inputRef` pour éviter les closures stales : sous
  // Preact, deux pressions rapides peuvent voir la même closure capturée si on
  // dépend de `input` dans les useCallback (cf. NumPad).
  const [input, setInput] = useState('');
  const inputRef = useRef('');
  const setInputBoth = useCallback((next: string) => {
    inputRef.current = next;
    setInput(next);
  }, []);

  // Pas de reset à la ré-activation : les trois appelants re-keyent le clavier
  // à chaque question (`answer-<index>`, `copy-<index>-<essai>`,
  // `probe-<index>`), donc chaque question repart d'un composant neuf.

  const handleLetter = useCallback(
    (letter: string) => {
      if (disabled) return;
      if (inputRef.current.length >= MAX_LENGTH) return;
      setInputBoth(inputRef.current + letter);
    },
    [disabled, setInputBoth],
  );

  const handleBackspace = useCallback(() => {
    if (disabled) return;
    setInputBoth(inputRef.current.slice(0, -1));
  }, [disabled, setInputBoth]);

  const handleOk = useCallback(() => {
    if (disabled || inputRef.current.length === 0) return;
    onSubmit(inputRef.current);
  }, [disabled, onSubmit]);

  // Listener clavier physique attaché UNE fois au montage, dispatch via ref
  // (même raison que NumPad : ne pas dé-/réattacher à chaque render).
  const callbacksRef = useRef({ handleLetter, handleBackspace, handleOk });
  // eslint-disable-next-line react-hooks/refs
  callbacksRef.current = { handleLetter, handleBackspace, handleOk };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cb = callbacksRef.current;
      if (e.key === 'Backspace') {
        cb.handleBackspace();
      } else if (e.key === 'Enter') {
        cb.handleOk();
      } else if (e.key.length === 1) {
        const lower = e.key.toLowerCase();
        if (LETTERS.has(lower)) cb.handleLetter(lower);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const key = (letter: string) => (
    <button
      key={letter}
      type="button"
      className="pad-btn letterpad-btn"
      onClick={() => handleLetter(letter)}
      disabled={disabled}
      aria-label={letter}
    >
      {letter}
    </button>
  );

  return (
    <div className="pad-container letterpad-container">
      <div className="pad-display letterpad-display" aria-live="polite">
        {prefix && <span className="letterpad-display-prefix">{prefix}</span>}
        <span className="letterpad-display-input">{input}</span>
        {!disabled && <span className="pad-display-cursor" />}
      </div>
      <div className="letterpad-rows">
        <div className="letterpad-row">{ROW_TOP.map(key)}</div>
        <div className="letterpad-row">{ROW_MID.map(key)}</div>
        <div className="letterpad-row letterpad-row--bottom">{ROW_BOTTOM.map(key)}</div>
        <div className="letterpad-row letterpad-row--actions">
          <button
            type="button"
            className="pad-btn letterpad-btn pad-btn-backspace letterpad-btn-backspace"
            onClick={handleBackspace}
            disabled={disabled || input.length === 0}
            aria-label={t.backspace}
          >
            ⌫
          </button>
          <button
            type="button"
            className="pad-btn letterpad-btn pad-btn-ok letterpad-btn-ok"
            onClick={handleOk}
            disabled={disabled || input.length === 0}
            aria-label={t.submit}
          >
            {t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
