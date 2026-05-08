import { useCallback, useEffect, useRef, useState } from 'react';
import NumPad from './NumPad';
import { parseFrenchAnswer, parseFrenchNumber } from '../lib/parseFrenchNumber';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useInputMode } from '../hooks/useInputMode';
import './VoiceInput.css';

interface VoiceInputProps {
  onSubmit: (value: number) => void;
  disabled?: boolean;
  // If the TTS is speaking the question, pause listening until it's done.
  isSpeaking?: boolean;
  // Token that changes between questions so we can restart listening.
  questionToken?: string | number;
  // Expected answer — if provided, we validate instantly when the transcript
  // matches it (fast path for correct answers, immune to TTS echo since the
  // echo would say the operands, not the product).
  expectedValue?: number;
}

const MAX_PARSE_FAILS_BEFORE_KEYPAD = 3;
// After the TTS ends, Chrome's recognition may still emit a final carrying
// speaker→mic echo. Drop non-matching finals within this window so the echo
// doesn't count as a wrong answer or push the user to the keypad fallback.
const POST_TTS_GRACE_MS = 2000;
// With the mic running continuously across questions, the trailing final of
// utterance N (or a late interim) can arrive after the question has advanced
// and get re-submitted as the answer to question N+1. We don't blanket-drop
// in this window (would block a fast user chaining answers) — we only drop
// events that echo the value we just submitted, which is the actual signature
// of a same-utterance trailing event.
const POST_SUBMIT_DEAF_MS = 800;
// Safety net for the expectTrailingFinal flag: if for some reason the final
// never arrives (recognizer error, abort), don't keep dropping events forever.
const TRAILING_FINAL_TIMEOUT_MS = 5000;

function pickBestNumber(primary: string, alternatives: string[]): number | null {
  const candidates = [primary, ...alternatives];
  for (const c of candidates) {
    const n = parseFrenchAnswer(c);
    if (n !== null) return n;
  }
  return null;
}

// Only display something if the transcript parses as a valid number answer.
// Raw text like "6 x 530" is never what the user meant — it's noise or echo.
function displayTranscript(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const n = parseFrenchNumber(trimmed);
  if (n !== null && n >= 0 && n <= 100) return String(n);
  return '';
}

export default function VoiceInput({
  onSubmit,
  disabled = false,
  isSpeaking = false,
  questionToken,
  expectedValue,
}: VoiceInputProps) {
  const [interim, setInterim] = useState('');
  const [showKeypad, setShowKeypad] = useState(false);
  const [, setParseFails] = useState(0);
  const { setInputMode } = useInputMode();
  const [prevQuestionToken, setPrevQuestionToken] = useState(questionToken);
  const disabledRef = useRef(disabled);
  const expectedRef = useRef(expectedValue);
  const lastSpeakEndRef = useRef<number>(0);
  const lastSubmitAtRef = useRef<number>(0);
  const lastSubmittedValueRef = useRef<number | null>(null);
  // Set to true when a fast-path interim submit fires. With continuous=false,
  // the recognizer will deliver exactly one final for that utterance — we
  // drop it. The timeout is a safety net in case the final never arrives.
  const expectTrailingFinalRef = useRef(false);
  const trailingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);
  useEffect(() => {
    expectedRef.current = expectedValue;
  }, [expectedValue]);
  useEffect(() => {
    if (!isSpeaking) {
      lastSpeakEndRef.current = Date.now();
    }
  }, [isSpeaking]);

  if (questionToken !== prevQuestionToken) {
    setPrevQuestionToken(questionToken);
    setInterim('');
    setParseFails(0);
  }

  const isEchoOfLastSubmit = useCallback((value: number | null) => {
    if (value === null || value !== lastSubmittedValueRef.current) return false;
    return Date.now() - lastSubmitAtRef.current < POST_SUBMIT_DEAF_MS;
  }, []);

  const handleFinal = useCallback(
    (transcript: string, alternatives: string[]) => {
      const expected = expectedRef.current;
      const best = pickBestNumber(transcript, alternatives);
      const sinceSpeakEndMs = Date.now() - lastSpeakEndRef.current;
      // Drop the trailing final from a fast-path-submitted utterance. With
      // continuous=false, exactly one final follows the interim that triggered
      // submit — and on iOS it can arrive 2-3 s later (TTS of the next question
      // delays silence detection), well past any reasonable time window.
      if (expectTrailingFinalRef.current) {
        expectTrailingFinalRef.current = false;
        if (trailingTimeoutRef.current) {
          clearTimeout(trailingTimeoutRef.current);
          trailingTimeoutRef.current = null;
        }
        return;
      }
      if (disabledRef.current) return;
      // Heuristique "chiffre redoublé" : quand l'enfant répète son chiffre
      // ("huit huit"), iOS fusionne souvent les digits en un seul nombre
      // ("88"). Si expected est 1..9 et best vaut exactement 11×expected,
      // on interprète comme une répétition de la bonne réponse.
      let bestEffective = best;
      if (
        expected !== undefined
        && expected >= 1 && expected <= 9
        && best !== null
        && best === expected * 11
      ) {
        bestEffective = expected;
      }
      if (isEchoOfLastSubmit(bestEffective)) return;
      const withinGrace = sinceSpeakEndMs < POST_TTS_GRACE_MS;
      if (withinGrace && (bestEffective === null || bestEffective !== expected)) {
        // Drop echo silently — don't count it as a user parse failure,
        // otherwise 3 consecutive echoes would flip us to the keypad.
        return;
      }
      setInterim('');
      if (bestEffective !== null) {
        setParseFails(0);
        lastSubmitAtRef.current = Date.now();
        lastSubmittedValueRef.current = bestEffective;
        onSubmit(bestEffective);
      } else {
        setParseFails((n) => {
          const next = n + 1;
          if (next >= MAX_PARSE_FAILS_BEFORE_KEYPAD) {
            setShowKeypad(true);
          }
          return next;
        });
      }
    },
    [onSubmit, isEchoOfLastSubmit],
  );

  const handleInterim = useCallback(
    (text: string) => {
      const parsed = parseFrenchAnswer(text);
      const expected = expectedRef.current;
      if (isEchoOfLastSubmit(parsed)) return;
      setInterim(text);
      if (expected === undefined || disabledRef.current) return;
      if (parsed === expected) {
        setInterim('');
        setParseFails(0);
        lastSubmitAtRef.current = Date.now();
        lastSubmittedValueRef.current = expected;
        expectTrailingFinalRef.current = true;
        if (trailingTimeoutRef.current) clearTimeout(trailingTimeoutRef.current);
        trailingTimeoutRef.current = setTimeout(() => {
          expectTrailingFinalRef.current = false;
          trailingTimeoutRef.current = null;
        }, TRAILING_FINAL_TIMEOUT_MS);
        onSubmit(expected);
      }
    },
    [onSubmit, isEchoOfLastSubmit],
  );

  const { start, abort, isListening, error, isSupported } = useSpeechRecognition({
    onFinal: handleFinal,
    onInterim: handleInterim,
    lang: 'fr-FR',
  });

  // Keep the mic on for the whole session — don't restart between questions
  // or pause during TTS. iOS plays a system "ding" on every recognition
  // start/stop, so toggling per question makes a beep storm. Echoes from the
  // TTS are dropped by the POST_TTS_GRACE_MS window, and the disabledRef
  // guard in handleFinal prevents accidental submissions during feedback.
  useEffect(() => {
    if (!isSupported) return;
    if (showKeypad) {
      abort();
      return;
    }
    start();
    return () => {
      abort();
      if (trailingTimeoutRef.current) {
        clearTimeout(trailingTimeoutRef.current);
        trailingTimeoutRef.current = null;
      }
    };
  }, [isSupported, showKeypad, start, abort]);

  // If unsupported, fall through to the keypad.
  if (!isSupported) {
    return <NumPad onSubmit={onSubmit} disabled={disabled} />;
  }

  if (showKeypad) {
    return (
      <div className="voice-fallback">
        <div className="voice-fallback-msg">
          Je t'entends mal. Tape ta réponse&nbsp;!
        </div>
        <NumPad onSubmit={onSubmit} disabled={disabled} />
        <button
          className="voice-retry-btn"
          onClick={() => {
            setShowKeypad(false);
            setParseFails(0);
          }}
          disabled={disabled}
          aria-label="Réessayer avec la voix"
        >
          {'🎤'} Réessayer avec la voix
        </button>
      </div>
    );
  }

  const permissionBlocked = error === 'not-allowed' || error === 'service-not-allowed';
  const networkError = error === 'network';
  const transcriptNumber = displayTranscript(interim);

  return (
    <div className="voice-input">
      <button
        type="button"
        className={`voice-mic${isListening ? ' listening' : ''}${disabled ? ' disabled' : ''}`}
        onClick={() => {
          if (disabled) return;
          if (isListening) abort();
          else start();
        }}
        aria-label={isListening ? 'Écoute en cours' : 'Parler'}
        aria-pressed={isListening}
        disabled={disabled}
      >
        <span className="voice-mic-icon">{'🎤'}</span>
        {isListening && <span className="voice-mic-ring" aria-hidden="true" />}
      </button>

      <div className="voice-transcript" aria-live="polite">
        {transcriptNumber ? (
          <span className="voice-transcript-number">{transcriptNumber}</span>
        ) : (
          isListening ? 'Je t\'écoute…' : 'Appuie pour parler'
        )}
      </div>

      {permissionBlocked && (
        <div className="voice-error">
          Le micro est bloqué. Autorise-le dans les paramètres du navigateur.
        </div>
      )}
      {networkError && (
        <div className="voice-error">
          La reconnaissance vocale a besoin d'internet.
        </div>
      )}

      <button
        type="button"
        className="session-input-switch"
        onClick={() => setInputMode('keypad')}
        disabled={disabled}
      >
        {'⌨️'} Utiliser le clavier
      </button>
    </div>
  );
}
