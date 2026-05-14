import { useState, useRef, useCallback, useEffect } from 'react';
import Mascot from '../components/Mascot';
import NumPad from '../components/NumPad';
import { shuffle } from '../lib/utils';
import { PLACEMENT_FACTS, type PlacementResult } from '../lib/placement';
import { useTTS } from '../hooks/useTTS';

export type { PlacementResult };

interface WelcomeScreenProps {
  onComplete: (name: string, placementResults: PlacementResult[]) => void;
}

export default function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');

  const { speak, stop: stopSpeech } = useTTS();

  // Placement test state
  const [testFacts] = useState(() => shuffle([...PLACEMENT_FACTS]));
  const [testIndex, setTestIndex] = useState(0);
  const [testResults, setTestResults] = useState<PlacementResult[]>([]);
  const [numpadDisabled, setNumpadDisabled] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [lastAnswer, setLastAnswer] = useState<number | null>(null);
  const questionStartTime = useRef(0);

  // TTS for the welcome steps
  useEffect(() => {
    if (step === 0) {
      speak('welcome-hello');
    } else if (step === 1) {
      speak('welcome-name');
    } else if (step === 2) {
      speak('welcome-test');
    }
  }, [step, speak]);

  const handleNext = () => {
    if (step === 0) {
      setStep(1);
    } else if (step === 1 && name.trim()) {
      setStep(2);
    } else if (step === 2) {
      // Start placement test
      setStep(3);
      questionStartTime.current = Date.now();
    }
  };

  const handleSkipTest = () => {
    onComplete(name.trim(), []);
  };

  const recordTestResult = useCallback(
    (correct: boolean) => {
      if (numpadDisabled) return;
      setNumpadDisabled(true);
      stopSpeech();

      const fact = testFacts[testIndex];
      const [a, b] = fact;
      const timeMs = Date.now() - questionStartTime.current;

      const result: PlacementResult = {
        a: Math.min(a, b),
        b: Math.max(a, b),
        correct,
        timeMs,
      };

      const updatedResults = [...testResults, result];
      setTestResults(updatedResults);

      // Brief feedback
      setFeedback(correct ? 'correct' : 'incorrect');

      setTimeout(() => {
        setFeedback(null);
        setNumpadDisabled(false);
        setLastAnswer(null);

        if (testIndex + 1 >= testFacts.length) {
          // Test complete
          onComplete(name.trim(), updatedResults);
        } else {
          setTestIndex(testIndex + 1);
          questionStartTime.current = Date.now();
        }
      }, correct ? 600 : 1200);
    },
    [numpadDisabled, testFacts, testIndex, testResults, name, onComplete, stopSpeech],
  );

  const handleTestAnswer = useCallback(
    (value: number) => {
      const [a, b] = testFacts[testIndex];
      setLastAnswer(value);
      recordTestResult(value === a * b);
    },
    [testFacts, testIndex, recordTestResult],
  );

  const handleDontKnow = useCallback(() => {
    recordTestResult(false);
  }, [recordTestResult]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      handleNext();
    }
  };

  // Pre-compute display orders once per test (stable across re-renders)
  const [displayOrders] = useState(
    () => testFacts.map(([a, b]) => (Math.random() > 0.5 ? [a, b] : [b, a])),
  );

  useEffect(() => {
    if (step !== 3) return;
    const [displayA, displayB] = displayOrders[testIndex];
    const questionKey = `q-${displayA}-${displayB}`;
    if (testIndex === 0) {
      speak('placement-intro', () => speak(questionKey));
    } else {
      speak(questionKey);
    }
  }, [step, testIndex, displayOrders, speak]);

  // Placement test screen
  if (step === 3) {
    const fact = testFacts[testIndex];
    const [a, b] = fact;
    const [displayA, displayB] = displayOrders[testIndex];

    const progressDots = Array.from({ length: testFacts.length }, (_, i) => {
      if (i < testIndex) return 'done';
      if (i === testIndex) return 'current';
      return 'pending';
    });

    return (
      <div className="welcome-screen">
        <div className="welcome-step" key="test">
          <div className="welcome-test-progress">
            {progressDots.map((status, i) => (
              <div key={i} className={`welcome-test-progress-dot ${status}`} />
            ))}
          </div>
          <div className="formula-text welcome-test-question">
            {displayA}
            <span className="formula-operator">{'\u00D7'}</span>
            {displayB}
            <span className="formula-equals">=</span>
            {lastAnswer != null ? (
              <span className="welcome-test-answer">{lastAnswer}</span>
            ) : (
              <span className="formula-placeholder">?</span>
            )}
          </div>
          {feedback && (
            <div className={`welcome-test-feedback ${feedback}`}>
              {feedback === 'correct' ? '✓' : `${a * b}`}
            </div>
          )}
          {!feedback && (
            <>
              <NumPad onSubmit={handleTestAnswer} disabled={numpadDisabled} />
              <button
                className="welcome-dontknow"
                onClick={handleDontKnow}
                disabled={numpadDisabled}
              >
                <span className="welcome-dontknow-mark">?</span>
                <span>Je ne sais pas</span>
              </button>
              <div className="welcome-test-hint">
                Réponds du mieux que tu peux&nbsp;!
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-screen">
      {step === 0 && (
        <div className="welcome-step" key="step0">
          <Mascot mood="idle" />
          <div className="welcome-title">Bonjour&nbsp;!</div>
          <div className="welcome-subtitle">
            Je suis Piou, ton petit copain d'apprentissage.
            <br />
            On va apprendre les tables de multiplication ensemble&nbsp;!
          </div>
          <button className="btn btn--ink welcome-btn" onClick={handleNext}>
            Suivant →
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="welcome-step welcome-step-name" key="step1">
          <Mascot mood="happy" />
          <div className="welcome-title">Comment tu t'appelles&nbsp;?</div>
          <input
            className="welcome-input"
            type="text"
            placeholder="Ton prénom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            maxLength={20}
          />
          <button
            className="btn btn--ink welcome-btn"
            onClick={handleNext}
            disabled={!name.trim()}
          >
            C'est moi&nbsp;! →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="welcome-step" key="step2">
          <Mascot mood="celebrate" />
          <div className="welcome-title">
            Salut {name}&nbsp;!
          </div>
          <div className="welcome-subtitle">
            Avant de commencer, je vais te poser quelques questions
            pour voir ce que tu connais déjà.
            <br />
            <br />
            Pas de stress : si tu ne sais pas, tape sur «&nbsp;Je ne sais pas&nbsp;».
          </div>
          <button className="btn btn--ink welcome-btn" onClick={handleNext}>
            C'est parti&nbsp;! →
          </button>
          <button className="welcome-btn-skip" onClick={handleSkipTest}>
            Passer le test
          </button>
        </div>
      )}

      {/* Step indicator dots */}
      <div className="welcome-dots">
        {[0, 1, 2].map((s) => (
          <div key={s} className={`welcome-dot ${s === step ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
}
