import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useLatestRef } from '../hooks/useLatestRef';
import { isAndroid } from '../lib/install';
import { voiceLog } from '../lib/voiceDebug';
import { judgeIrrAnswer } from '../lib/irregularComposer';
import { irrHeardForms, irrSpokenAnswer, irrSpokenWords } from '../lib/parseSpokenIrregular';
import type { IrrVerbDef } from '../lib/irregularVerbs';
import { irrStrings as t } from '../i18n/irregular';
import { useVoiceStrings } from '../i18n/voice';

// Réponse dite à voix haute, en anglais (specs §16.6). Même mécanique que le
// vocal des maths (VoiceInput) — micro ouvert toute la séance sur iOS, coupé
// pendant la voix de synthèse sur Android, écho filtré par fenêtre de grâce —,
// avec deux différences :
//
// - la reconnaissance est en ANGLAIS, quelle que soit la langue de l'interface ;
// - une réponse a plusieurs mots, et l'enfant peut la dire en deux fois
//   (« went »… « gone ») : les mots entendus s'accumulent sur la question, et
//   la réponse n'est jugée qu'une fois complète.

/** Langue de reconnaissance : la variante la mieux reconnue des navigateurs. */
export const IRR_RECOGNITION_LANG = 'en-US';

/** Ratés de reconnaissance (rien d'exploitable) avant de proposer le clavier. */
const MAX_PARSE_FAILS = 3;
/** Cf. VoiceInput : l'écho de la voix de synthèse arrive juste après elle. */
const POST_TTS_GRACE_MS = 2000;
/** Cf. VoiceInput : le final qui suit une validation à la volée est jeté. */
const TRAILING_FINAL_TIMEOUT_MS = 5000;

interface IrrVoiceInputProps {
  def: IrrVerbDef;
  onSubmit: (answers: string[]) => void;
  /** Les formes entendues jusqu'ici, pour les cases à l'écran. */
  onHeard: (heard: string[]) => void;
  /** Première forme entendue : la latence de rappel (specs §16.6). */
  onRecall?: () => void;
  /** Trois ratés d'affilée : la question passe au clavier. */
  onGiveUp: () => void;
  /** L'enfant préfère le clavier (mémorisé). */
  onUseKeyboard: () => void;
  disabled?: boolean;
  isSpeaking?: boolean;
  questionToken: string;
}

export default function IrrVoiceInput({
  def,
  onSubmit,
  onHeard,
  onRecall,
  onGiveUp,
  onUseKeyboard,
  disabled = false,
  isSpeaking = false,
  questionToken,
}: IrrVoiceInputProps) {
  const v = useVoiceStrings();
  const pauseMicDuringTTS = isAndroid();
  const [notHeard, setNotHeard] = useState(false);
  const defRef = useLatestRef(def);
  const disabledRef = useLatestRef(disabled);
  const onSubmitRef = useLatestRef(onSubmit);
  const onHeardRef = useLatestRef(onHeard);
  const onRecallRef = useLatestRef(onRecall);
  const onGiveUpRef = useLatestRef(onGiveUp);
  // Mots déjà entendus sur la question (finals), et ratés d'affilée.
  const wordsRef = useRef<string[]>([]);
  const failsRef = useRef(0);
  const recalledRef = useRef(false);
  const lastSpeakEndRef = useRef(0);
  const expectTrailingFinalRef = useRef(false);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nouvelle question : on repart d'une écoute vierge, sans re-monter le
  // composant (iOS joue un « ding » à chaque ouverture du micro).
  const [prevToken, setPrevToken] = useState(questionToken);
  if (questionToken !== prevToken) {
    setPrevToken(questionToken);
    setNotHeard(false);
  }
  useEffect(() => {
    wordsRef.current = [];
    failsRef.current = 0;
    recalledRef.current = false;
  }, [questionToken]);

  useEffect(() => {
    if (!isSpeaking) lastSpeakEndRef.current = Date.now();
  }, [isSpeaking]);

  const clearTrailing = useCallback(() => {
    expectTrailingFinalRef.current = false;
    if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current);
    trailingTimerRef.current = null;
  }, []);

  const report = useCallback(
    (words: string[]) => {
      const heard = irrHeardForms(words, defRef.current);
      onHeardRef.current(heard);
      if (heard.length > 0 && !recalledRef.current) {
        recalledRef.current = true;
        onRecallRef.current?.();
      }
    },
    [defRef, onHeardRef, onRecallRef],
  );

  const submit = useCallback(
    (answer: string[]) => {
      failsRef.current = 0;
      wordsRef.current = [];
      onSubmitRef.current(answer);
    },
    [onSubmitRef],
  );

  const isCorrect = useCallback(
    (words: string[]) => {
      const answer = irrSpokenAnswer(words, defRef.current);
      return answer !== null && judgeIrrAnswer(defRef.current, answer, 'voice') === 'correct';
    },
    [defRef],
  );

  const handleInterim = useCallback(
    (text: string) => {
      if (disabledRef.current || expectTrailingFinalRef.current) return;
      const words = [...wordsRef.current, ...irrSpokenWords(text, defRef.current)];
      report(words);
      // Validation à la volée d'une réponse JUSTE : pas besoin d'attendre le
      // silence. Une réponse fausse, elle, attend le final.
      if (isCorrect(words)) {
        voiceLog('irr:submit-interim', text);
        expectTrailingFinalRef.current = true;
        trailingTimerRef.current = setTimeout(clearTrailing, TRAILING_FINAL_TIMEOUT_MS);
        submit(irrSpokenAnswer(words, defRef.current)!);
      }
    },
    [defRef, disabledRef, report, isCorrect, submit, clearTrailing],
  );

  const handleFinal = useCallback(
    (transcript: string, alternatives: string[]) => {
      if (expectTrailingFinalRef.current) {
        voiceLog('irr:drop-trailing');
        clearTrailing();
        return;
      }
      if (disabledRef.current) return;
      const def = defRef.current;
      const candidates = [transcript, ...alternatives].map((c) => [
        ...wordsRef.current,
        ...irrSpokenWords(c, def),
      ]);
      // L'alternative qui donne la bonne réponse l'emporte : la reconnaissance
      // classe souvent « eight » devant « ate ».
      const words = candidates.find(isCorrect) ?? candidates[0];
      const added = words.length - wordsRef.current.length;
      const withinGrace = !pauseMicDuringTTS && Date.now() - lastSpeakEndRef.current < POST_TTS_GRACE_MS;
      if (withinGrace && !isCorrect(words)) {
        // Écho de la voix de synthèse : ni réponse, ni raté.
        voiceLog('irr:drop-grace', transcript);
        return;
      }
      if (added <= 0) {
        failsRef.current++;
        setNotHeard(true);
        if (failsRef.current >= MAX_PARSE_FAILS) onGiveUpRef.current();
        return;
      }
      setNotHeard(false);
      wordsRef.current = words;
      report(words);
      const answer = irrSpokenAnswer(words, def);
      if (answer) {
        voiceLog('irr:submit-final', words.join(' '));
        submit(answer);
      }
    },
    [defRef, disabledRef, isCorrect, report, submit, clearTrailing, pauseMicDuringTTS, onGiveUpRef],
  );

  const { start, abort, isListening, error, isSupported } = useSpeechRecognition({
    onFinal: handleFinal,
    onInterim: handleInterim,
    lang: IRR_RECOGNITION_LANG,
  });

  const micPaused = pauseMicDuringTTS && isSpeaking;
  useEffect(() => {
    if (!isSupported) return;
    if (micPaused) {
      abort();
      clearTrailing();
      return;
    }
    start();
    return () => {
      abort();
      clearTrailing();
    };
  }, [isSupported, micPaused, start, abort, clearTrailing]);

  // Navigateur sans reconnaissance : la question passe au clavier.
  useEffect(() => {
    if (!isSupported) onGiveUpRef.current();
  }, [isSupported, onGiveUpRef]);

  const restart = () => {
    wordsRef.current = [];
    onHeardRef.current([]);
    setNotHeard(false);
  };

  const permissionBlocked = error === 'not-allowed' || error === 'service-not-allowed';

  return (
    <div className="voice-input irr-voice-input">
      <button
        type="button"
        className={`voice-mic${isListening ? ' listening' : ''}${disabled ? ' disabled' : ''}`}
        onClick={() => {
          if (disabled) return;
          if (isListening) abort();
          else start();
        }}
        aria-label={isListening ? v.listening : v.speak}
        aria-pressed={isListening}
        disabled={disabled}
      >
        <span className="voice-mic-icon">{'🎤'}</span>
        {isListening && <span className="voice-mic-ring" aria-hidden="true" />}
      </button>

      <div className="voice-transcript" aria-live="polite">
        {notHeard ? t.voiceNotHeard : isListening ? t.voiceHint : v.tapToSpeak}
      </div>

      {permissionBlocked && <div className="voice-error">{v.micBlocked}</div>}
      {error === 'network' && <div className="voice-error">{v.needsInternet}</div>}

      <div className="irr-voice-actions">
        <button type="button" className="session-input-switch" onClick={restart} disabled={disabled}>
          {'↺'} {t.voiceRestart}
        </button>
        <button type="button" className="session-input-switch" onClick={onUseKeyboard} disabled={disabled}>
          {'⌨️'} {v.useKeyboard}
        </button>
      </div>
    </div>
  );
}
