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
 * case — « Valider » passe du prétérit au participe.
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
  // Formes déjà validées au clavier, ou entendues à la voix.
  const [filled, setFilled] = useState<string[]>([]);
  // Trois ratés de reconnaissance (ou pas de reconnaissance du tout) : cette
  // question passe au clavier, sans toucher au réglage de l'enfant.
  const [voiceGaveUp, setVoiceGaveUp] = useState(false);
  // Lettres de la case en cours, écrites dans la case elle-même : l'ardoise
  // du clavier est masquée, une seule place pour la réponse.
  const [typing, setTyping] = useState('');
  const [prevToken, setPrevToken] = useState(token);
  if (token !== prevToken) {
    setPrevToken(token);
    setFilled([]);
    setVoiceGaveUp(false);
    setTyping('');
  }

  const voice = inputMode === 'voice' && STT_SUPPORTED && !voiceGaveUp;

  const handleSlot = useCallback(
    (value: string) => {
      setTyping('');
      const next = [...filled, value];
      if (next.length >= slotCount) {
        setFilled(next);
        onSubmit(next, 'keypad');
      } else {
        setFilled(next);
      }
    },
    [filled, slotCount, onSubmit],
  );

  const switchToVoice = useCallback(async () => {
    await preflightMicPermission();
    setVoiceGaveUp(false);
    setFilled([]);
    setInputMode('voice');
  }, [setInputMode]);

  const slots = Array.from({ length: slotCount }, (_, i) =>
    filled[i] ?? (!voice && i === filled.length && typing ? typing : null),
  );
  const activeSlot = voice ? undefined : Math.min(filled.length, slotCount - 1);
  const slotLabel = filled.length < def.preterite.length ? t.slotPreterite : t.slotParticiple;

  return (
    <div className="irr-answer">
      <IrrForms def={def} slots={slots} activeSlot={activeSlot} size="large" />
      {children}
      {voice ? (
        <IrrVoiceInput
          def={def}
          onSubmit={(answers) => onSubmit(answers, 'voice')}
          onHeard={setFilled}
          onRecall={onRecall}
          onGiveUp={() => {
            setVoiceGaveUp(true);
            setFilled([]);
          }}
          onUseKeyboard={() => {
            setFilled([]);
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
            key={`${token}-${filled.length}`}
            onSubmit={handleSlot}
            disabled={disabled || filled.length >= slotCount}
            layout="en"
            onInput={setTyping}
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
