import { useCallback, useEffect, useRef, useState } from 'react';
import NumPad from './NumPad';
import { parseSpokenAnswer, speechRecognitionLang } from '../lib/parseSpokenNumber';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { isAndroid } from '../lib/install';
import { voiceLog } from '../lib/voiceDebug';
import { useInputMode } from '../hooks/useInputMode';
import { useLang } from '../i18n/lang';
import { useVoiceStrings } from '../i18n/voice';

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
// Sur Android, la Web Speech API est adossée au SpeechRecognizer natif :
// sessions mono-énoncé (bip système à chaque démarrage) et pas d'annulation
// d'écho. Micro ouvert pendant la voix de synthèse, le recognizer capture la
// question elle-même, termine sa session dessus, et la réponse de l'enfant
// tombe dans le trou mort entre deux sessions — l'app « bipe et attend ».
// On coupe donc le micro pendant la TTS et on le rouvre dès qu'elle finit :
// le bip de démarrage devient un signal « à toi de parler ». Sur iOS (reco
// on-device + annulation d'écho, ding à chaque toggle), on garde au contraire
// le micro ouvert toute la séance et on filtre l'écho par fenêtre de grâce.

function pickBestNumber(
  primary: string,
  alternatives: string[],
  lang: 'fr' | 'en',
): number | null {
  const candidates = [primary, ...alternatives];
  for (const c of candidates) {
    const n = parseSpokenAnswer(c, lang);
    if (n !== null) return n;
  }
  return null;
}

export default function VoiceInput({
  onSubmit,
  disabled = false,
  isSpeaking = false,
  questionToken,
  expectedValue,
}: VoiceInputProps) {
  const [showKeypad, setShowKeypad] = useState(false);
  const [, setParseFails] = useState(0);
  const pauseMicDuringTTS = isAndroid();
  // Même plateforme, autre motif : le recognizer Android rate souvent un mot
  // isolé (« quatre ») mais capte très bien les phrases — on coache la
  // formulation. Flag distinct de la politique micro pour que chacun porte
  // sa propre raison si l'un des deux évolue.
  const coachSentenceAnswer = isAndroid();
  const { setInputMode } = useInputMode();
  const { lang } = useLang();
  const t = useVoiceStrings();
  // Lu dans les callbacks de reconnaissance sans les recréer à chaque render.
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
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
    voiceLog('tts', isSpeaking ? 'speaking' : 'ended');
    if (!isSpeaking) {
      lastSpeakEndRef.current = Date.now();
    }
  }, [isSpeaking]);

  if (questionToken !== prevQuestionToken) {
    setPrevQuestionToken(questionToken);
    setParseFails(0);
  }

  const isEchoOfLastSubmit = useCallback((value: number | null) => {
    if (value === null || value !== lastSubmittedValueRef.current) return false;
    return Date.now() - lastSubmitAtRef.current < POST_SUBMIT_DEAF_MS;
  }, []);

  const clearTrailingFinal = useCallback(() => {
    expectTrailingFinalRef.current = false;
    if (trailingTimeoutRef.current) {
      clearTimeout(trailingTimeoutRef.current);
      trailingTimeoutRef.current = null;
    }
  }, []);

  const handleFinal = useCallback(
    (transcript: string, alternatives: string[]) => {
      const expected = expectedRef.current;
      const best = pickBestNumber(transcript, alternatives, langRef.current);
      const sinceSpeakEndMs = Date.now() - lastSpeakEndRef.current;
      // Drop the trailing final from a fast-path-submitted utterance. With
      // continuous=false, exactly one final follows the interim that triggered
      // submit — and on iOS it can arrive 2-3 s later (TTS of the next question
      // delays silence detection), well past any reasonable time window.
      if (expectTrailingFinalRef.current) {
        voiceLog('drop:trailing-final');
        clearTrailingFinal();
        return;
      }
      if (disabledRef.current) {
        voiceLog('drop:disabled');
        return;
      }
      // Heuristique "chiffre redoublé" : quand l'enfant répète son chiffre
      // ("huit huit"), iOS fusionne souvent les digits en un seul nombre
      // ("88"). Si expected est 1..9 et best vaut exactement 11×expected,
      // on interprète comme une répétition de la bonne réponse. (La
      // répétition mot-à-mot non fusionnée — "huit huit" tel quel — est
      // gérée sans contexte dans spokenNumber.ts.)
      let bestEffective = best;
      if (
        expected !== undefined
        && expected >= 1 && expected <= 9
        && best !== null
        && best === expected * 11
      ) {
        bestEffective = expected;
      }
      if (isEchoOfLastSubmit(bestEffective)) {
        voiceLog('drop:echo-of-submit', String(bestEffective));
        return;
      }
      // Micro coupé pendant la TTS (Android) : aucun écho possible, et jeter
      // les finals post-TTS avalerait la réponse rapide d'un enfant qui se
      // trompe. La fenêtre de grâce ne s'applique qu'au mode micro-ouvert.
      const withinGrace = !pauseMicDuringTTS && sinceSpeakEndMs < POST_TTS_GRACE_MS;
      if (withinGrace && (bestEffective === null || bestEffective !== expected)) {
        // Drop echo silently — don't count it as a user parse failure,
        // otherwise 3 consecutive echoes would flip us to the keypad.
        voiceLog('drop:grace', `best=${bestEffective} sinceTTS=${sinceSpeakEndMs}ms`);
        return;
      }
      if (bestEffective !== null) {
        voiceLog('submit:final', String(bestEffective));
        setParseFails(0);
        lastSubmitAtRef.current = Date.now();
        lastSubmittedValueRef.current = bestEffective;
        onSubmit(bestEffective);
      } else {
        voiceLog('parse-fail');
        setParseFails((n) => {
          const next = n + 1;
          if (next >= MAX_PARSE_FAILS_BEFORE_KEYPAD) {
            setShowKeypad(true);
          }
          return next;
        });
      }
    },
    [onSubmit, isEchoOfLastSubmit, pauseMicDuringTTS, clearTrailingFinal],
  );

  const handleInterim = useCallback(
    (text: string) => {
      const parsed = parseSpokenAnswer(text, langRef.current);
      const expected = expectedRef.current;
      if (isEchoOfLastSubmit(parsed)) return;
      // We deliberately don't display interim transcripts to the user:
      // showing "40" while they're still saying "quarante-deux" → 42 is
      // confusing. We still parse interims here for the fast-path submit
      // below — feedback comes from the session UI once the answer is in.
      if (expected === undefined || disabledRef.current) return;
      if (parsed === expected) {
        voiceLog('submit:interim-fast-path', String(expected));
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
    lang: speechRecognitionLang(lang),
  });

  // Keep the mic on for the whole session — don't restart between questions
  // or pause during TTS. iOS plays a system "ding" on every recognition
  // start/stop, so toggling per question makes a beep storm. Echoes from the
  // TTS are dropped by the POST_TTS_GRACE_MS window, and the disabledRef
  // guard in handleFinal prevents accidental submissions during feedback.
  //
  // Sur Android en revanche, micPaused coupe le micro pendant la synthèse
  // (voir le commentaire de tête de fichier) : la dépendance dérivée reste
  // constamment false sur iOS, donc les toggles TTS n'y re-déclenchent jamais
  // l'effet. Chaque abort lève aussi l'attente d'un final traînant : après
  // abort(), ce final n'arrivera jamais, et le flag laissé armé avalerait la
  // première vraie réponse à la réouverture du micro.
  const micPaused = pauseMicDuringTTS && isSpeaking;
  useEffect(() => {
    if (!isSupported) return;
    if (showKeypad || micPaused) {
      voiceLog('mic:closed', micPaused ? 'tts-speaking' : 'keypad');
      abort();
      clearTrailingFinal();
      return;
    }
    start();
    return () => {
      abort();
      clearTrailingFinal();
    };
  }, [isSupported, showKeypad, micPaused, start, abort, clearTrailingFinal]);

  // If unsupported, fall through to the keypad.
  if (!isSupported) {
    return <NumPad onSubmit={onSubmit} disabled={disabled} />;
  }

  if (showKeypad) {
    return (
      <div className="voice-fallback">
        <div className="voice-fallback-msg">
          {t.hardToHear}
        </div>
        <NumPad onSubmit={onSubmit} disabled={disabled} />
        <button
          className="voice-retry-btn"
          onClick={() => {
            setShowKeypad(false);
            setParseFails(0);
          }}
          disabled={disabled}
          aria-label={t.retryWithVoice}
        >
          {'🎤'} {t.retryWithVoice}
        </button>
      </div>
    );
  }

  const permissionBlocked = error === 'not-allowed' || error === 'service-not-allowed';
  const networkError = error === 'network';

  return (
    <div className="voice-input">
      <button
        type="button"
        className={`voice-mic${isListening ? ' listening' : ''}${disabled ? ' disabled' : ''}`}
        onClick={() => {
          if (disabled) return;
          if (isListening) {
            abort();
            clearTrailingFinal();
          } else {
            start();
          }
        }}
        aria-label={isListening ? t.listening : t.speak}
        aria-pressed={isListening}
        disabled={disabled}
      >
        <span className="voice-mic-icon">{'🎤'}</span>
        {isListening && <span className="voice-mic-ring" aria-hidden="true" />}
      </button>

      <div className="voice-transcript" aria-live="polite">
        {isListening ? (coachSentenceAnswer ? t.sentenceHint : t.listeningHint) : t.tapToSpeak}
      </div>

      {permissionBlocked && (
        <div className="voice-error">
          {t.micBlocked}
        </div>
      )}
      {networkError && (
        <div className="voice-error">
          {t.needsInternet}
        </div>
      )}

      <button
        type="button"
        className="session-input-switch"
        onClick={() => setInputMode('keypad')}
        disabled={disabled}
      >
        {'⌨️'} {t.useKeyboard}
      </button>
    </div>
  );
}
