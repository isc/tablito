import { useState, useRef, useCallback, useEffect } from 'react';
import type { SessionQuestion, SessionResult, MultiFact, BoxLevel } from '../types';
import NumPad from '../components/NumPad';
import VoiceInput from '../components/VoiceInput';
import DotGrid from '../components/DotGrid';
import FeedbackOverlay from '../components/FeedbackOverlay';
import StrategyHint from '../components/StrategyHint';
import { RESPONSE_TIME } from '../types';
import { getFactKey } from '../lib/facts';
import { getStrategy, hasStrategy } from '../lib/strategies';
import { todayISO } from '../lib/utils';
import { useSound } from '../hooks/useSound';
import { useTTS } from '../hooks/useTTS';
import { useInputMode } from '../hooks/useInputMode';
import { isSpeechRecognitionSupported } from '../hooks/useSpeechRecognition';
import { useWakeLock } from '../hooks/useWakeLock';
import './SessionScreen.css';

// Voice mode: lower threshold for the "fast" reward (étoile dorée) since oral
// recall is faster than typing. Leitner promotion still uses RESPONSE_TIME.SLOW.
const VOICE_FEEDBACK_FAST = 2000;

// Borne dure sur la longueur d'une session : composeSession vise 12-15 questions,
// chaque erreur peut insérer une retry. Sans cap, des erreurs en chaîne (surtout
// en mode vocal où la reconnaissance rate plus souvent) rendent la session
// interminable alors que les points de progression sont déjà tous remplis.
const MAX_SESSION_LENGTH = 20;

const STT_SUPPORTED = isSpeechRecognitionSupported();

interface SessionScreenProps {
  questions: SessionQuestion[];
  onComplete: (result: Omit<SessionResult, 'factsPromoted'>) => void;
  onAnswer: (
    fact: MultiFact,
    correct: boolean,
    timeMs: number,
    answered: number | null,
    isBonusReview: boolean,
  ) => void;
}

interface QuestionResult {
  correct: boolean;
}

type IntroStep = 'grid' | 'commute' | 'strategy';

export default function SessionScreen({
  questions: initialQuestions,
  onComplete,
  onAnswer,
}: SessionScreenProps) {
  const [questions, setQuestions] = useState<SessionQuestion[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState<IntroStep>('grid');
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    fast: boolean;
    correctAnswer: number;
    fact: { a: number; b: number };
    factBox: BoxLevel;
  } | null>(null);
  const [numpadDisabled, setNumpadDisabled] = useState(false);
  // Double-submit guard : les clics synchrones rapides sur « Valider » ne
  // laissent pas le temps à React de re-rendre avec numpadDisabled=true, donc
  // la closure du handler voit l'ancien state. On ajoute une barrière via ref
  // évaluée en synchrone, à reset à chaque changement de question.
  const submittingRef = useRef(false);

  const { isMuted, playCorrect, playIncorrect } = useSound();
  const { speak, stop: stopSpeech, isSpeaking } = useTTS(isMuted);
  const { inputMode, setInputMode } = useInputMode();
  useWakeLock(true);

  const speakQuestion = useCallback(
    (q: SessionQuestion) => speak(`q-${q.displayA}-${q.displayB}`),
    [speak],
  );
  const questionStartTime = useRef(0);
  const correctCount = useRef(0);
  const totalTimeMs = useRef(0);
  const introducedFacts = useRef(new Set<string>());

  const currentQuestion = questions[currentIndex] as SessionQuestion | undefined;

  // Adjust UI state when the question changes (render-time)
  const [prevIndex, setPrevIndex] = useState(-1);
  if (currentIndex !== prevIndex && currentQuestion) {
    // Reset le guard ici (pas dans un useEffect plus bas), sinon une réponse
    // trop rapide après le changement de question voit submittingRef encore
    // à true (l'effet est microtask-async sous Preact). Garde de transition
    // (prev !== next) → ne peut pas boucler.
    // eslint-disable-next-line react-hooks/refs
    submittingRef.current = false;
    setPrevIndex(currentIndex);
    if (currentQuestion.isIntroduction) {
      setShowIntro(true);
      setIntroStep('grid');
    } else {
      setShowIntro(false);
    }
    setNumpadDisabled(false);
  }

  // Side effects when the question changes (TTS, timer, tracking).
  useEffect(() => {
    if (!currentQuestion) return;

    if (currentQuestion.isIntroduction) {
      introducedFacts.current.add(getFactKey(currentQuestion.fact.a, currentQuestion.fact.b));
      const { a, b } = currentQuestion.fact;
      speak(`intro-${a}-${b}`);
    } else {
      speakQuestion(currentQuestion);
    }

    questionStartTime.current = Date.now();
  }, [currentIndex, currentQuestion, speak, speakQuestion]);

  // In voice mode, start the response timer when the TTS finishes so we
  // don't count the question playback against the user's response time.
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
      // Session complete
      const totalQuestions = results.length + (feedback ? 1 : 0);
      const avgTime =
        totalQuestions > 0 ? totalTimeMs.current / totalQuestions : 0;

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
      const correct = value === currentQuestion.fact.product;
      const fastThreshold = inputMode === 'voice' ? VOICE_FEEDBACK_FAST : RESPONSE_TIME.FAST;
      const fast = correct && timeMs < fastThreshold;

      totalTimeMs.current += timeMs;
      if (correct) correctCount.current++;

      if (correct) playCorrect();
      else playIncorrect();

      // Notify parent (App) to update Leitner state
      onAnswer(currentQuestion.fact, correct, timeMs, value, currentQuestion.isBonusReview);

      // If incorrect, insert a retry 2-3 questions later (capped to keep
      // sessions from running away when answers chain wrong — see MAX_SESSION_LENGTH).
      if (!correct && questions.length < MAX_SESSION_LENGTH) {
        const retryPosition = Math.min(
          currentIndex + 3,
          questions.length,
        );
        const retryQuestion: SessionQuestion = {
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

      // Show feedback
      setFeedback({
        correct,
        fast,
        correctAnswer: currentQuestion.fact.product,
        fact: {
          a: currentQuestion.displayA,
          b: currentQuestion.displayB,
        },
        factBox: currentQuestion.fact.box,
      });

      // Speak the strategy hint when it's shown on the incorrect overlay
      // (gated by box ≤ 2 in FeedbackOverlay — kept in sync here).
      if (
        !correct &&
        currentQuestion.fact.box <= 2 &&
        hasStrategy(currentQuestion.fact.a, currentQuestion.fact.b)
      ) {
        speak(`strategy-${currentQuestion.fact.a}-${currentQuestion.fact.b}`);
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
    const { a, b } = currentQuestion.fact;
    const isSquare = a === b;

    const goToStrategyOrFinish = () => {
      if (hasStrategy(a, b)) {
        setIntroStep('strategy');
        speak(`strategy-${a}-${b}`);
      } else {
        setShowIntro(false);
        questionStartTime.current = Date.now();
        speakQuestion(currentQuestion);
      }
    };

    if (introStep === 'grid') {
      // Skip commutativity step for square numbers (a === b) — it's nonsensical
      if (isSquare) {
        goToStrategyOrFinish();
      } else {
        setIntroStep('commute');
        speak(`comm-${a}-${b}`);
      }
    } else if (introStep === 'commute') {
      goToStrategyOrFinish();
    } else {
      // 'strategy' step → start the question
      setShowIntro(false);
      questionStartTime.current = Date.now();
      speakQuestion(currentQuestion);
    }
  }, [introStep, currentQuestion, speak, speakQuestion]);

  if (!currentQuestion) {
    return null;
  }

  const introStrategy =
    introStep === 'strategy'
      ? getStrategy(currentQuestion.fact.a, currentQuestion.fact.b)
      : null;

  // Progress dots: aligné sur MAX_SESSION_LENGTH pour que la barre reflète
  // bien la progression réelle, retries inclus.
  const maxDots = Math.min(questions.length, MAX_SESSION_LENGTH);
  const progressDots = Array.from({ length: maxDots }, (_, i) => {
    if (i < results.length) {
      return results[i].correct ? 'correct' : 'incorrect';
    }
    if (i === results.length) return 'current';
    return 'pending';
  });

  return (
    <div className="session-screen">
      {/* Progress bar (centered dots) */}
      {!showIntro && (
        <div className="session-header">
          <div className="session-progress">
            {progressDots.map((status, i) => (
              <div key={i} className={`session-progress-dot ${status}`} />
            ))}
          </div>
        </div>
      )}

      {/* Introduction phase */}
      {showIntro && (
        <div className="session-intro">
          <div className="session-intro-title">Nouveau&nbsp;!</div>

          {introStep === 'grid' ? (
            <>
              <div className="session-intro-formula">
                {currentQuestion.fact.a}
                <span className="session-intro-operator">{'\u00D7'}</span>
                {currentQuestion.fact.b}
              </div>
              <DotGrid
                a={currentQuestion.fact.a}
                b={currentQuestion.fact.b}
                animated
                size="normal"
                bare
              />
              <div className="session-intro-result">
                = <b>{currentQuestion.fact.product}</b>
              </div>
              <div className="session-intro-explanation">
                <strong>
                  {currentQuestion.fact.a} {'\u00D7'}{' '}
                  {currentQuestion.fact.b}
                </strong>
                , c'est{' '}
                {Array.from({ length: currentQuestion.fact.a })
                  .map(() => currentQuestion.fact.b.toString())
                  .join(' + ')}{' '}
                = <strong>{currentQuestion.fact.product}</strong>
              </div>
              <button
                className="session-intro-btn"
                onClick={handleIntroNext}
              >
                Suivant →
              </button>
            </>
          ) : introStep === 'commute' ? (
            <>
              <DotGrid
                a={currentQuestion.fact.a}
                b={currentQuestion.fact.b}
                animated={false}
                showRotation
                size="normal"
              />
              <div className="session-intro-commutativity">
                {currentQuestion.fact.b} {'\u00D7'}{' '}
                {currentQuestion.fact.a}, c'est pareil&nbsp;!
                <br />
                C'est aussi{' '}
                <strong>{currentQuestion.fact.product}</strong>
              </div>
              <button
                className="session-intro-btn"
                onClick={handleIntroNext}
              >
                Suivant →
              </button>
            </>
          ) : (
            <>
              {introStrategy && <StrategyHint strategy={introStrategy} variant="intro" />}
              <div className="session-intro-explanation">
                Une petite astuce pour s'en souvenir&nbsp;!
              </div>
              <button
                className="session-intro-btn"
                onClick={handleIntroNext}
              >
                J'ai compris&nbsp;!
              </button>
            </>
          )}
        </div>
      )}

      {/* Question phase */}
      {!showIntro && (
        <div className="session-question">
          <div className="session-question-text">
            {currentQuestion.displayA}
            <span className="operator">{'\u00D7'}</span>
            {currentQuestion.displayB}
            <span className="equals">=</span>
            <span className="placeholder">?</span>
          </div>
          <div className="session-numpad-area">
            {inputMode === 'voice' ? (
              <VoiceInput
                onSubmit={handleAnswer}
                disabled={numpadDisabled}
                isSpeaking={isSpeaking}
                questionToken={`${currentQuestion.displayA}-${currentQuestion.displayB}-${currentIndex}`}
                expectedValue={currentQuestion.fact.product}
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

      {/* Feedback overlay */}
      {feedback && (
        <FeedbackOverlay
          correct={feedback.correct}
          fast={feedback.fast}
          correctAnswer={feedback.correctAnswer}
          fact={feedback.fact}
          factBox={feedback.factBox}
          onDismiss={handleFeedbackDismiss}
        />
      )}
    </div>
  );
}
