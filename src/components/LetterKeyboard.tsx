import { useState, useCallback, useEffect, useRef } from 'react';
import { conjStrings as t } from '../i18n/conjugation';
import { useLatestRef } from '../hooks/useLatestRef';
import { LETTER_KEYS as KEYS, LETTER_KEY_COLUMNS } from '../lib/letterKeys';

// Mini-clavier ALPHABÉTIQUE à grosses touches (spec Verbito §4.2). L'AZERTY
// a été essayé puis abandonné (test en conditions réelles, 17/08/2026) : à
// 9 ans on ne connaît pas sa géographie, on cherche les lettres visuellement
// — et l'ordre alphabétique, lui, est su par cœur et donne une stratégie de
// recherche (« le s est vers la fin »). L'insertion de é/ê avait de toute
// façon déjà brisé la disposition standard, au prix de rangées inégales et
// de touches de largeurs variables. Ici : 26 lettres + é + ê = 28 touches =
// 4 rangées de 7, toutes identiques — é et ê se rangent naturellement après
// le e. L'argument du transfert vers l'AZERTY réel pèse peu face au mode
// vocal épelé (§15.10) et à l'usage grandissant du STT.
//
// Comme sur NumPad, la validation est EXPLICITE : la réponse fait de 1 (« a »)
// à 11 caractères (« regarderons »), on ne peut pas deviner qu'elle est finie.

// Verbes irréguliers anglais (specs §16.6) : les 26 lettres, sans é ni ê —
// même ordre alphabétique, même grille de 7 (la dernière rangée en a 5).
const KEYS_EN = KEYS.filter((k) => k !== 'é' && k !== 'ê');

const LETTERS = new Set(KEYS);
const LETTERS_EN = new Set(KEYS_EN);

/**
 * Garde-fou de saisie : « regarderons » (11) est la plus longue forme attendue
 * du périmètre — le futur régulier se tape en entier (§4.2), il a détrôné
 * « viendront » (9). 14 laisse de la marge pour une hésitation sans laisser
 * l'enfant remplir l'écran.
 *
 * ⚠ Donnée DÉRIVÉE de l'inventaire de conjugaison : un verbe plus long ajouté
 * à `CONJ_GROUP1_VERBS` tronquerait la réponse de l'enfant en silence (aucune
 * erreur, juste une bonne réponse impossible à saisir). L'invariant est
 * verrouillé par `conjugationFacts.test.ts`, pas maintenu à la main.
 */
export const MAX_LENGTH = 14;

interface LetterKeyboardProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  /**
   * Texte imposé de l'extérieur, réappliqué à chaque fois qu'il CHANGE : c'est
   * l'écho visuel du mode vocal épelé (§15.10), les lettres reconnues qui
   * remplissent la saisie à mesure qu'on les entend. Entre deux changements, le
   * clavier reste maître de sa saisie — sans quoi la correction au clavier,
   * promise par la spec, serait effacée au render suivant.
   */
  value?: string;
  /** L'enfant a pris la main au clavier (touche ou effacement). */
  onEdit?: () => void;
  /** Jeu de touches : `fr` (avec é, ê) par défaut, `en` pour l'anglais. */
  layout?: 'fr' | 'en';
  /**
   * La saisie en cours, à chaque frappe. Le clavier n'a pas d'ardoise : la
   * saisie s'écrit là où va la réponse — sur le trait de la phrase porteuse
   * (§15.5), dans la case du verbe irrégulier (§16.6).
   */
  onInput: (value: string) => void;
  /**
   * Libellé du bouton de validation (« Valider » par défaut) : « Suivant → »
   * quand la validation passe à la case suivante (verbes irréguliers).
   */
  submitLabel?: string;
  /**
   * Espace, virgule et Tab valident aussi, au clavier physique : entre deux
   * mots, c'est le geste naturel (« was were been »), et Entrée ne se devine pas.
   */
  submitOnSpace?: boolean;
}

export default function LetterKeyboard({
  onSubmit,
  disabled = false,
  value,
  onEdit,
  layout = 'fr',
  onInput,
  submitLabel = t.submit,
  submitOnSpace = false,
}: LetterKeyboardProps) {
  const keys = layout === 'en' ? KEYS_EN : KEYS;
  // `input` est miroré dans `inputRef` pour éviter les closures stales : sous
  // Preact, deux pressions rapides peuvent voir la même closure capturée si on
  // dépend de `input` dans les useCallback (cf. NumPad).
  const [input, setInput] = useState('');
  const inputRef = useRef('');
  const onInputRef = useLatestRef(onInput);
  const setInputBoth = useCallback((next: string) => {
    inputRef.current = next;
    setInput(next);
    onInputRef.current(next);
  }, [onInputRef]);

  // Pas de reset à la ré-activation : les appelants re-keyent le clavier à
  // chaque question (`answer-<index>`, `copy-<index>-<essai>`, `probe-<index>`),
  // donc chaque question repart d'un composant neuf.

  // Écho vocal : on adopte la valeur imposée quand elle CHANGE, et seulement
  // là — entre deux changements, le clavier garde la main, sinon la correction
  // au clavier promise par la spec serait effacée au render suivant.
  useEffect(() => {
    if (value !== undefined) setInputBoth(value);
  }, [value, setInputBoth]);

  const handleLetter = useCallback(
    (letter: string) => {
      if (disabled) return;
      onEdit?.();
      if (inputRef.current.length >= MAX_LENGTH) return;
      setInputBoth(inputRef.current + letter);
    },
    [disabled, onEdit, setInputBoth],
  );

  const handleBackspace = useCallback(() => {
    if (disabled) return;
    onEdit?.();
    setInputBoth(inputRef.current.slice(0, -1));
  }, [disabled, onEdit, setInputBoth]);

  const handleOk = useCallback(() => {
    if (disabled || inputRef.current.length === 0) return;
    onSubmit(inputRef.current);
  }, [disabled, onSubmit]);

  // Listener clavier physique attaché UNE fois au montage, dispatch via ref
  // (même raison que NumPad : ne pas dé-/réattacher à chaque render).
  const letters = layout === 'en' ? LETTERS_EN : LETTERS;
  const callbacksRef = useRef({ handleLetter, handleBackspace, handleOk, letters, submitOnSpace });
  // eslint-disable-next-line react-hooks/refs
  callbacksRef.current = { handleLetter, handleBackspace, handleOk, letters, submitOnSpace };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cb = callbacksRef.current;
      if (e.key === 'Backspace') {
        cb.handleBackspace();
      } else if (e.key === 'Enter') {
        cb.handleOk();
      } else if (cb.submitOnSpace && (e.key === ' ' || e.key === ',')) {
        // Pas de défilement de la page sur la barre d'espace.
        e.preventDefault();
        cb.handleOk();
      } else if (cb.submitOnSpace && e.key === 'Tab' && !e.shiftKey && inputRef.current) {
        // Tab passe à la case suivante. Saisie vide : Tab garde son rôle de
        // navigation, le focus n'est jamais piégé.
        e.preventDefault();
        cb.handleOk();
      } else if (e.key.length === 1) {
        const lower = e.key.toLowerCase();
        if (cb.letters.has(lower)) cb.handleLetter(lower);
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
      <div className="letterpad-rows">
        <div className="letterpad-keys" style={{ '--letterpad-cols': LETTER_KEY_COLUMNS } as React.CSSProperties}>
          {keys.map(key)}
        </div>
        <div className="letterpad-row--actions">
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
            aria-label={submitLabel}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
