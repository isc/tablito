import { useState, useRef, useCallback, useEffect } from 'react';
import type { SessionItem, SessionResult } from '../types';
import NumPad from '../components/NumPad';
import VoiceInput from '../components/VoiceInput';
import DotGrid from '../components/DotGrid';
import FeedbackOverlay from '../components/FeedbackOverlay';
import StrategyHint from '../components/StrategyHint';
import DivisionStrategyHint from '../components/DivisionStrategyHint';
import { FAST_THRESHOLD_MS, DIVISION_FAST_THRESHOLD_MS } from '../types';
import { getStrategy, hasStrategy } from '../lib/strategies';
import { getDivisionStrategy } from '../lib/divisionStrategies';
import { getDivisionFactKey } from '../lib/divisionFacts';
import { getFactKey } from '../lib/facts';
import { todayISO } from '../lib/utils';
import { useSound } from '../hooks/useSound';
import { useTTS } from '../hooks/useTTS';
import { useInputMode } from '../hooks/useInputMode';
import { isSpeechRecognitionSupported } from '../hooks/useSpeechRecognition';
import { useWakeLock } from '../hooks/useWakeLock';

// Borne dure sur la longueur d'une session : la composition vise 12-15
// questions, chaque erreur peut insérer une retry. Sans cap, des erreurs en
// chaîne (surtout en vocal) rendent la session interminable.
const MAX_SESSION_LENGTH = 20;
const STT_SUPPORTED = isSpeechRecognitionSupported();

// Écran de séance UNIFIÉ (specs §11.6). Une séance est une liste de SessionItem
// qui peut être 100% multiplication (avant déblocage de la division) ou mixte
// (division + entretien des tables, après déblocage). Chaque question est
// rendue selon son `kind`.
type IntroStep = 'grid' | 'commute' | 'strategy';

interface SessionScreenProps {
  questions: SessionItem[];
  onComplete: (result: Omit<SessionResult, 'factsPromoted'>) => void;
  onAnswer: (
    item: SessionItem,
    correct: boolean,
    timeMs: number,
    answered: number | null,
    inputMode: 'keypad' | 'voice',
  ) => void;
}

// Vue d'affichage selon le type : opérateur, opérandes affichés, réponse
// attendue, seuil de rapidité, clé TTS de la question.
function view(item: SessionItem) {
  if (item.kind === 'div') {
    const { dividend, divisor, quotient } = item.fact;
    return {
      left: dividend,
      op: '÷',
      right: divisor,
      answer: quotient,
      fastMs: DIVISION_FAST_THRESHOLD_MS,
      qKey: `qd-${dividend}-${divisor}`,
      token: `d-${dividend}-${divisor}`,
    };
  }
  return {
    left: item.displayA,
    op: '×',
    right: item.displayB,
    answer: item.fact.product,
    fastMs: FAST_THRESHOLD_MS,
    qKey: `q-${item.displayA}-${item.displayB}`,
    token: `m-${item.displayA}-${item.displayB}`,
  };
}

function itemKey(item: SessionItem): string {
  return item.kind === 'div'
    ? getDivisionFactKey(item.fact.dividend, item.fact.divisor)
    : getFactKey(item.fact.a, item.fact.b);
}

export default function SessionScreen({
  questions: initialQuestions,
  onComplete,
  onAnswer,
}: SessionScreenProps) {
  const [questions, setQuestions] = useState<SessionItem[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<{ correct: boolean }[]>([]);
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState<IntroStep>('grid');
  const [feedback, setFeedback] = useState<{
    item: SessionItem;
    correct: boolean;
    fast: boolean;
    submittedValue: number;
  } | null>(null);
  const [numpadDisabled, setNumpadDisabled] = useState(false);
  const submittingRef = useRef(false);

  const { playCorrect, playIncorrect } = useSound();
  const { speak, stop: stopSpeech, preload, isSpeaking } = useTTS();
  const { inputMode, setInputMode } = useInputMode();
  useWakeLock(true);

  const questionStartTime = useRef(0);
  const correctCount = useRef(0);
  const totalTimeMs = useRef(0);
  const introducedFacts = useRef(new Set<string>());

  const currentItem = questions[currentIndex] as SessionItem | undefined;

  const speakQuestion = useCallback((item: SessionItem) => speak(view(item).qKey), [speak]);

  // Précharge l'audio de toutes les questions de la séance dès son ouverture.
  // Sans cela, le MP3 d'une question est décodé à la volée quand on l'atteint :
  // un enfant qui connaît le fait peut répondre avant la fin de ce décodage, et
  // le stop() de la réponse annule alors une lecture jamais démarrée — la
  // question n'est jamais lue à voix haute (bug des séances mixtes où les
  // divisions, plus lentes à répondre, s'entendaient mais pas les tables
  // connues). Préchargé = `speak` démarre par le chemin synchrone, increvable.
  useEffect(() => {
    const keys = new Set<string>();
    for (const item of initialQuestions) {
      keys.add(view(item).qKey);
      if (item.isIntroduction) {
        keys.add(
          item.kind === 'div'
            ? `introd-${item.fact.dividend}-${item.fact.divisor}`
            : `intro-${item.fact.a}-${item.fact.b}`,
        );
      }
    }
    preload([...keys]);
    // Une seule fois à l'ouverture : les retrys réutilisent des clés déjà en cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ajuste l'état UI au changement de question (render-time, cf. ancien
  // SessionScreen — reset synchrone du guard anti double-submit).
  const [prevIndex, setPrevIndex] = useState(-1);
  if (currentIndex !== prevIndex && currentItem) {
    submittingRef.current = false;
    setPrevIndex(currentIndex);
    if (currentItem.isIntroduction) {
      setShowIntro(true);
      setIntroStep('grid');
    } else {
      setShowIntro(false);
    }
    setNumpadDisabled(false);
  }

  useEffect(() => {
    if (!currentItem) return;
    if (currentItem.isIntroduction) {
      introducedFacts.current.add(itemKey(currentItem));
      if (currentItem.kind === 'div') {
        speak(`introd-${currentItem.fact.dividend}-${currentItem.fact.divisor}`);
      } else {
        speak(`intro-${currentItem.fact.a}-${currentItem.fact.b}`);
      }
    } else {
      speakQuestion(currentItem);
    }
    questionStartTime.current = Date.now();
  }, [currentIndex, currentItem, speak, speakQuestion]);

  // En vocal, démarrer le timer à la fin du TTS (ne pas compter la lecture).
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
      if (!currentItem || submittingRef.current) return;
      submittingRef.current = true;
      setNumpadDisabled(true);
      stopSpeech();

      const v = view(currentItem);
      const timeMs = Date.now() - questionStartTime.current;
      const correct = value === v.answer;
      const fast = correct && timeMs < v.fastMs[inputMode];

      totalTimeMs.current += timeMs;
      if (correct) correctCount.current++;

      if (correct) playCorrect();
      else playIncorrect();

      onAnswer(currentItem, correct, timeMs, value, inputMode);

      // Réintroduction après erreur (capée — cf. MAX_SESSION_LENGTH).
      if (!correct && questions.length < MAX_SESSION_LENGTH) {
        const retryPosition = Math.min(currentIndex + 3, questions.length);
        const retryItem = { ...currentItem, isRetry: true, isIntroduction: false } as SessionItem;
        setQuestions((prev) => {
          const next = [...prev];
          next.splice(retryPosition, 0, retryItem);
          return next;
        });
      }

      setResults((prev) => [...prev, { correct }]);
      setFeedback({ item: currentItem, correct, fast, submittedValue: value });

      // Astuce parlée sur l'overlay d'erreur (gated boîte ≤ 2 comme l'overlay).
      if (!correct && currentItem.fact.box <= 2) {
        if (currentItem.kind === 'div') {
          speak(`strategyd-${currentItem.fact.dividend}-${currentItem.fact.divisor}`);
        } else if (hasStrategy(currentItem.fact.a, currentItem.fact.b)) {
          speak(`strategy-${currentItem.fact.a}-${currentItem.fact.b}`);
        }
      }
    },
    [currentItem, currentIndex, questions.length, onAnswer, playCorrect, playIncorrect, stopSpeech, speak, inputMode],
  );

  const handleFeedbackDismiss = useCallback(() => {
    setFeedback(null);
    moveToNext();
  }, [moveToNext]);

  const handleIntroNext = useCallback(() => {
    if (!currentItem) return;

    const finish = () => {
      setShowIntro(false);
      questionStartTime.current = Date.now();
      speakQuestion(currentItem);
    };

    // Division : intro en une étape (« pense à la multiplication »).
    if (currentItem.kind === 'div') {
      finish();
      return;
    }

    // Multiplication : grille → commutativité (sauf carrés) → astuce → question.
    const { a, b } = currentItem.fact;
    const goToStrategyOrFinish = () => {
      if (hasStrategy(a, b)) {
        setIntroStep('strategy');
        speak(`strategy-${a}-${b}`);
      } else {
        finish();
      }
    };

    if (introStep === 'grid') {
      if (a === b) {
        goToStrategyOrFinish();
      } else {
        setIntroStep('commute');
        speak(`comm-${a}-${b}`);
      }
    } else if (introStep === 'commute') {
      goToStrategyOrFinish();
    } else {
      finish();
    }
  }, [introStep, currentItem, speak, speakQuestion]);

  if (!currentItem) return null;

  const v = view(currentItem);
  const introStrategy =
    showIntro && currentItem.kind === 'mult' && introStep === 'strategy'
      ? getStrategy(currentItem.fact.a, currentItem.fact.b)
      : null;
  const divIntroStrategy =
    showIntro && currentItem.kind === 'div' ? getDivisionStrategy(currentItem.fact) : null;

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

      {/* Introduction — multiplication (grille / commutativité / astuce) */}
      {showIntro && currentItem.kind === 'mult' && (
        <div className="session-intro">
          <div className="session-intro-title">Nouveau&nbsp;!</div>

          {introStep === 'grid' ? (
            <>
              <div className="session-intro-formula">
                {currentItem.fact.a}
                <span className="session-intro-operator">{'×'}</span>
                {currentItem.fact.b}
              </div>
              <DotGrid a={currentItem.fact.a} b={currentItem.fact.b} animated size="normal" bare />
              <div className="session-intro-result">
                = <b>{currentItem.fact.product}</b>
              </div>
              <div className="session-intro-explanation">
                <strong>
                  {currentItem.fact.a} {'×'} {currentItem.fact.b}
                </strong>
                , c'est{' '}
                {Array.from({ length: currentItem.fact.a })
                  .map(() => currentItem.fact.b.toString())
                  .join(' + ')}{' '}
                = <strong>{currentItem.fact.product}</strong>
              </div>
              <button className="btn btn--ink session-intro-btn" onClick={handleIntroNext}>
                Suivant →
              </button>
            </>
          ) : introStep === 'commute' ? (
            <>
              <DotGrid a={currentItem.fact.a} b={currentItem.fact.b} animated={false} showRotation size="normal" />
              <div className="session-intro-commutativity">
                {currentItem.fact.b} {'×'} {currentItem.fact.a}, c'est pareil&nbsp;!
                <br />
                C'est aussi <strong>{currentItem.fact.product}</strong>
              </div>
              <button className="btn btn--ink session-intro-btn" onClick={handleIntroNext}>
                Suivant →
              </button>
            </>
          ) : (
            <>
              {introStrategy && <StrategyHint strategy={introStrategy} variant="intro" />}
              <div className="session-intro-explanation">Une petite astuce pour s'en souvenir&nbsp;!</div>
              <button className="btn btn--ink session-intro-btn" onClick={handleIntroNext}>
                J'ai compris&nbsp;!
              </button>
            </>
          )}
        </div>
      )}

      {/* Introduction — division (« pense à la multiplication ») */}
      {showIntro && currentItem.kind === 'div' && (
        <div className="session-intro">
          <div className="session-intro-title">Nouveau&nbsp;!</div>
          <div className="session-intro-formula">
            {v.left}
            <span className="session-intro-operator">{v.op}</span>
            {v.right}
          </div>
          <DotGrid a={currentItem.fact.divisor} b={currentItem.fact.quotient} animated size="normal" bare groupReveal />
          <div className="session-intro-explanation">
            On partage {currentItem.fact.dividend} en {currentItem.fact.divisor} lots
            égaux — combien dans chaque&nbsp;?
          </div>
          {divIntroStrategy && <DivisionStrategyHint strategy={divIntroStrategy} variant="intro" />}
          <button className="btn btn--ink session-intro-btn" onClick={handleIntroNext}>
            J'ai compris&nbsp;!
          </button>
        </div>
      )}

      {/* Question */}
      {!showIntro && (
        <div className="session-question">
          <div className="formula-text session-question-text">
            {v.left}
            <span className="formula-operator">{v.op}</span>
            {v.right}
            <span className="formula-equals">=</span>
            <span className="formula-placeholder">?</span>
          </div>
          <div className="session-numpad-area">
            {inputMode === 'voice' ? (
              <VoiceInput
                onSubmit={handleAnswer}
                disabled={numpadDisabled}
                isSpeaking={isSpeaking}
                questionToken={`${v.token}-${currentIndex}`}
                expectedValue={v.answer}
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

      {/* Feedback — un seul composant, qui rend × ou ÷ selon l'item */}
      {feedback && (
        <FeedbackOverlay
          item={feedback.item}
          correct={feedback.correct}
          fast={feedback.fast}
          submittedValue={feedback.submittedValue}
          onDismiss={handleFeedbackDismiss}
        />
      )}
    </div>
  );
}
