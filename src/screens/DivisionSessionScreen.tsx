import { useState, useRef, useCallback, useEffect } from 'react';
import type { DivisionSessionQuestion, SessionResult, DivisionFact } from '../types';
import NumPad from '../components/NumPad';
import VoiceInput from '../components/VoiceInput';
import DotGrid from '../components/DotGrid';
import DivisionFeedbackOverlay from '../components/DivisionFeedbackOverlay';
import DivisionStrategyHint from '../components/DivisionStrategyHint';
import { DIVISION_FAST_THRESHOLD_MS } from '../types';
import { getDivisionFactKey } from '../lib/divisionFacts';
import { getDivisionStrategy } from '../lib/divisionStrategies';
import { todayISO } from '../lib/utils';
import { useSound } from '../hooks/useSound';
import { useTTS } from '../hooks/useTTS';
import { useInputMode } from '../hooks/useInputMode';
import { isSpeechRecognitionSupported } from '../hooks/useSpeechRecognition';
import { useWakeLock } from '../hooks/useWakeLock';

// Même borne dure que la multiplication (cf. SessionScreen).
const MAX_SESSION_LENGTH = 20;
const STT_SUPPORTED = isSpeechRecognitionSupported();
const DIV = '÷';

interface DivisionSessionScreenProps {
  questions: DivisionSessionQuestion[];
  onComplete: (result: Omit<SessionResult, 'factsPromoted'>) => void;
  onAnswer: (
    fact: DivisionFact,
    correct: boolean,
    timeMs: number,
    answered: number | null,
    isBonusReview: boolean,
    inputMode: 'keypad' | 'voice',
  ) => void;
}

export default function DivisionSessionScreen({
  questions: initialQuestions,
  onComplete,
  onAnswer,
}: DivisionSessionScreenProps) {
  const [questions, setQuestions] = useState<DivisionSessionQuestion[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<{ correct: boolean }[]>([]);
  const [showIntro, setShowIntro] = useState(false);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    fast: boolean;
    fact: DivisionFact;
    submittedValue: number;
  } | null>(null);
  const [numpadDisabled, setNumpadDisabled] = useState(false);
  const submittingRef = useRef(false);

  const { playCorrect, playIncorrect } = useSound();
  const { speak, stop: stopSpeech, isSpeaking } = useTTS();
  const { inputMode, setInputMode } = useInputMode();
  useWakeLock(true);

  const questionStartTime = useRef(0);
  const correctCount = useRef(0);
  const totalTimeMs = useRef(0);
  const introducedFacts = useRef(new Set<string>());

  const currentQuestion = questions[currentIndex] as DivisionSessionQuestion | undefined;

  const speakQuestion = useCallback(
    (q: DivisionSessionQuestion) => speak(`qd-${q.fact.dividend}-${q.fact.divisor}`),
    [speak],
  );

  // Adjust UI state when the question changes (render-time, cf. SessionScreen).
  const [prevIndex, setPrevIndex] = useState(-1);
  if (currentIndex !== prevIndex && currentQuestion) {
    // eslint-disable-next-line react-hooks/refs
    submittingRef.current = false;
    setPrevIndex(currentIndex);
    setShowIntro(currentQuestion.isIntroduction);
    setNumpadDisabled(false);
  }

  // Side effects when the question changes (TTS, timer, tracking).
  useEffect(() => {
    if (!currentQuestion) return;
    const { dividend, divisor } = currentQuestion.fact;
    if (currentQuestion.isIntroduction) {
      introducedFacts.current.add(getDivisionFactKey(dividend, divisor));
      speak(`introd-${dividend}-${divisor}`);
    } else {
      speakQuestion(currentQuestion);
    }
    questionStartTime.current = Date.now();
  }, [currentIndex, currentQuestion, speak, speakQuestion]);

  // En mode vocal, démarrer le timer à la fin du TTS (ne pas compter la lecture).
  useEffect(() => {
    if (inputMode !== 'voice') return;
    if (showIntro) return;
    if (!isSpeaking) {
      questionStartTime.current = Date.now();
    }
  }, [isSpeaking, inputMode, showIntro, currentIndex]);

  const moveToNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      const totalQuestions = results.length + (feedback ? 1 : 0);
      const avgTime = totalQuestions > 0 ? totalTimeMs.current / totalQuestions : 0;
      onComplete({
        date: todayISO(),
        questionsCount: questions.length,
        correctCount: correctCount.current,
        averageTimeMs: Math.round(avgTime),
        newFactsIntroduced: introducedFacts.current.size,
      });
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, questions, results.length, feedback, onComplete]);

  const handleAnswer = useCallback(
    (value: number) => {
      if (!currentQuestion || submittingRef.current) return;
      submittingRef.current = true;
      setNumpadDisabled(true);
      stopSpeech();

      const timeMs = Date.now() - questionStartTime.current;
      const correct = value === currentQuestion.fact.quotient;
      const fast = correct && timeMs < DIVISION_FAST_THRESHOLD_MS[inputMode];

      totalTimeMs.current += timeMs;
      if (correct) correctCount.current++;

      if (correct) playCorrect();
      else playIncorrect();

      onAnswer(
        currentQuestion.fact,
        correct,
        timeMs,
        value,
        currentQuestion.isBonusReview,
        inputMode,
      );

      if (!correct && questions.length < MAX_SESSION_LENGTH) {
        const retryPosition = Math.min(currentIndex + 3, questions.length);
        const retryQuestion: DivisionSessionQuestion = {
          ...currentQuestion,
          isRetry: true,
          isIntroduction: false,
        };
        setQuestions((prev) => {
          const next = [...prev];
          next.splice(retryPosition, 0, retryQuestion);
          return next;
        });
      }

      setResults((prev) => [...prev, { correct }]);

      setFeedback({ correct, fast, fact: currentQuestion.fact, submittedValue: value });

      // Astuce parlée en cas d'erreur sur un fait peu maîtrisé (boîte ≤ 2).
      if (!correct && currentQuestion.fact.box <= 2) {
        speak(`strategyd-${currentQuestion.fact.dividend}-${currentQuestion.fact.divisor}`);
      }
    },
    [currentQuestion, currentIndex, questions.length, onAnswer, playCorrect, playIncorrect, stopSpeech, speak, inputMode],
  );

  const handleFeedbackDismiss = useCallback(() => {
    setFeedback(null);
    moveToNext();
  }, [moveToNext]);

  const handleIntroNext = useCallback(() => {
    if (!currentQuestion) return;
    setShowIntro(false);
    questionStartTime.current = Date.now();
    speakQuestion(currentQuestion);
  }, [currentQuestion, speakQuestion]);

  if (!currentQuestion) return null;

  const introStrategy = showIntro ? getDivisionStrategy(currentQuestion.fact) : null;
  const { dividend, divisor, quotient } = currentQuestion.fact;

  const maxDots = Math.min(questions.length, MAX_SESSION_LENGTH);
  const progressDots = Array.from({ length: maxDots }, (_, i) => {
    if (i < results.length) return results[i].correct ? 'correct' : 'incorrect';
    if (i === results.length) return 'current';
    return 'pending';
  });

  return (
    <div className="session-screen">
      {!showIntro && (
        <div className="session-header">
          <div className="session-progress">
            {progressDots.map((status, i) => (
              <div key={i} className={`session-progress-dot ${status}`} />
            ))}
          </div>
        </div>
      )}

      {/* Introduction : pense à la multiplication */}
      {showIntro && (
        <div className="session-intro">
          <div className="session-intro-title">Nouveau&nbsp;!</div>
          <div className="session-intro-formula">
            {dividend}
            <span className="session-intro-operator">{DIV}</span>
            {divisor}
          </div>
          <DotGrid a={divisor} b={quotient} animated size="normal" bare />
          {introStrategy && <DivisionStrategyHint strategy={introStrategy} variant="intro" />}
          <button className="btn btn--ink session-intro-btn" onClick={handleIntroNext}>
            J'ai compris&nbsp;!
          </button>
        </div>
      )}

      {/* Question */}
      {!showIntro && (
        <div className="session-question">
          <div className="formula-text session-question-text">
            {dividend}
            <span className="formula-operator">{DIV}</span>
            {divisor}
            <span className="formula-equals">=</span>
            <span className="formula-placeholder">?</span>
          </div>
          <div className="session-numpad-area">
            {inputMode === 'voice' ? (
              <VoiceInput
                onSubmit={handleAnswer}
                disabled={numpadDisabled}
                isSpeaking={isSpeaking}
                questionToken={`${dividend}-${divisor}-${currentIndex}`}
                expectedValue={quotient}
              />
            ) : (
              <>
                <NumPad onSubmit={handleAnswer} disabled={numpadDisabled} />
                {STT_SUPPORTED && (
                  <button
                    type="button"
                    className="session-input-switch"
                    onClick={() => setInputMode('voice')}
                    disabled={numpadDisabled}
                  >
                    {'🎤'} Utiliser le micro
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {feedback && (
        <DivisionFeedbackOverlay
          correct={feedback.correct}
          fast={feedback.fast}
          fact={feedback.fact}
          submittedValue={feedback.submittedValue}
          onDismiss={handleFeedbackDismiss}
        />
      )}
    </div>
  );
}
