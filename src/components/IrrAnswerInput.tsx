import { useCallback, useState, type ReactNode } from 'react';
import IrrForms from './IrrForms';
import IrrVoiceInput from './IrrVoiceInput';
import LetterKeyboard from './LetterKeyboard';
import { irrSlotCount, type IrrVerbDef } from '../lib/irregularVerbs';
import { isSpeechRecognitionSupported } from '../hooks/useSpeechRecognition';
import { useIrrInputMode } from '../hooks/useInputMode';
import { preflightMicPermission } from '../lib/micPreflight';
import { irrStrings as t } from '../i18n/irregular';

const STT_SUPPORTED = isSpeechRecognitionSupported();

function withSlot(values: readonly string[], index: number, value: string): string[] {
  return values.map((v, i) => (i === index ? value : v));
}

/**
 * La prochaine case vide après `at` (en reprenant au début), hors `at`
 * elle-même ; -1 quand toutes les autres sont remplies.
 */
function nextBlank(values: readonly string[], at: number): number {
  for (let k = 1; k < values.length; k++) {
    const i = (at + k) % values.length;
    if (values[i] === '') return i;
  }
  return -1;
}

interface IrrAnswerInputProps {
  def: IrrVerbDef;
  onSubmit: (answers: string[], source: 'keypad' | 'voice') => void;
  /** Première forme dite (voix seulement) : la latence de rappel. */
  onRecall?: () => void;
  disabled?: boolean;
  isSpeaking?: boolean;
  /** Change à chaque question : la saisie repart de zéro. */
  token: string;
  /** Sous les cases, avant la saisie (le bouton « Réécouter » de la question). */
  children?: ReactNode;
}

/**
 * Saisie d'un verbe irrégulier (specs §16.6) : les cases « go → ___ → ___ »,
 * remplies à la voix (mode par défaut de la matière) ou au clavier, case par
 * case — « Suivant » (ou espace, Tab) passe du prétérit au participe, et un
 * clic sur une case la reprend.
 */
export default function IrrAnswerInput({
  def,
  onSubmit,
  onRecall,
  disabled = false,
  isSpeaking = false,
  token,
  children,
}: IrrAnswerInputProps) {
  const { inputMode, setInputMode } = useIrrInputMode();
  const slotCount = irrSlotCount(def);
  const blank = () => Array<string>(slotCount).fill('');
  // Formes entendues à la voix, dans l'ordre.
  const [heard, setHeard] = useState<string[]>([]);
  // Au clavier : le contenu de chaque case ('' = vide) et la case en cours.
  // L'enfant passe à la suivante en validant (bouton, Entrée, espace, Tab) ou
  // choisit une case au clic.
  const [values, setValues] = useState<string[]>(blank);
  const [active, setActive] = useState(0);
  // Réponse partie : plus de saisie jusqu'à la question suivante (une seconde
  // Entrée la renverrait).
  const [submitted, setSubmitted] = useState(false);
  // Trois ratés de reconnaissance (ou pas de reconnaissance du tout) : cette
  // question passe au clavier, sans toucher au réglage de l'enfant.
  const [voiceGaveUp, setVoiceGaveUp] = useState(false);
  const [prevToken, setPrevToken] = useState(token);
  if (token !== prevToken) {
    setPrevToken(token);
    setHeard([]);
    setValues(blank());
    setActive(0);
    setSubmitted(false);
    setVoiceGaveUp(false);
  }

  const voice = inputMode === 'voice' && STT_SUPPORTED && !voiceGaveUp;

  // La case en cours s'écrit dans la case elle-même : l'ardoise du clavier
  // est masquée, une seule place pour la réponse.
  const handleTyping = useCallback(
    (value: string) => setValues((prev) => (prev[active] === value ? prev : withSlot(prev, active, value))),
    [active],
  );

  const handleSlot = useCallback(
    (value: string) => {
      const next = withSlot(values, active, value);
      setValues(next);
      const i = nextBlank(next, active);
      if (i >= 0) {
        setActive(i);
        return;
      }
      setSubmitted(true);
      onSubmit(next, 'keypad');
    },
    [values, active, onSubmit],
  );

  const resetKeyboard = () => {
    setValues(blank());
    setActive(0);
  };

  const switchToVoice = useCallback(async () => {
    await preflightMicPermission();
    setVoiceGaveUp(false);
    setHeard([]);
    setInputMode('voice');
  }, [setInputMode]);

  const slots = voice
    ? Array.from({ length: slotCount }, (_, i) => heard[i] ?? null)
    : values.map((v) => v || null);
  const activeSlot = voice ? undefined : active;
  const slotLabel = active < def.preterite.length ? t.slotPreterite : t.slotParticiple;

  return (
    <div className="irr-answer">
      <IrrForms
        def={def}
        slots={slots}
        activeSlot={activeSlot}
        size="large"
        onSlotClick={voice || disabled || submitted ? undefined : setActive}
      />
      {children}
      {voice ? (
        <IrrVoiceInput
          def={def}
          onSubmit={(answers) => onSubmit(answers, 'voice')}
          onHeard={setHeard}
          onRecall={onRecall}
          onGiveUp={() => {
            setVoiceGaveUp(true);
            resetKeyboard();
          }}
          onUseKeyboard={() => {
            resetKeyboard();
            setInputMode('keypad');
          }}
          disabled={disabled}
          isSpeaking={isSpeaking}
          questionToken={token}
        />
      ) : (
        <div className="conj-keyboard-area">
          <div className="irr-slot-label">{slotLabel}</div>
          <LetterKeyboard
            // Re-monté à chaque changement de case, repris sur son contenu.
            key={`${token}-${active}`}
            value={values[active]}
            onSubmit={handleSlot}
            disabled={disabled || submitted}
            layout="en"
            onInput={handleTyping}
            // Une autre case reste vide : on passe à elle.
            submitLabel={nextBlank(values, active) >= 0 ? t.nextSlot : undefined}
            submitOnSpace
          />
          {STT_SUPPORTED && (
            <button type="button" className="session-input-switch" onClick={switchToVoice} disabled={disabled}>
              {'🎤'} {t.voiceUseMic}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
