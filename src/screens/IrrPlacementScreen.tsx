import { useCallback, useEffect, useRef, useState } from 'react';
import IrrAnswerInput from '../components/IrrAnswerInput';
import IrrForms from '../components/IrrForms';
import Mascot from '../components/Mascot';
import {
  IRR_MAX_CONSECUTIVE_FAILURES,
  irrPlacementProbes,
  type IrrPlacementResult,
} from '../lib/irregularPlacement';
import { irrPromptTtsKey, requireIrrVerbDef } from '../lib/irregularVerbs';
import { isIrrAccepted, judgeIrrAnswer } from '../lib/irregularComposer';
import { useTTS } from '../hooks/useTTS';
import { irrStrings as t } from '../i18n/irregular';
import { activeMsSince, NOT_STARTED, startQuestion } from '../lib/questionClock';

/** Le verdict s'affiche brièvement, sans commentaire ni son négatif. */
const FEEDBACK_MS = { correct: 600, incorrect: 1400 } as const;

const PROBES = irrPlacementProbes();

interface IrrPlacementScreenProps {
  onComplete: (results: IrrPlacementResult[]) => void;
}

/**
 * Placement des verbes irréguliers (specs §16.8) : quelques sondes sur les
 * verbes les plus fréquents, « Je ne sais pas » toujours à portée, arrêt après
 * 3 échecs consécutifs. Contrairement à la conjugaison, il accepte la voix
 * comme le clavier : c'est l'oral que la classe a entraîné.
 */
export default function IrrPlacementScreen({ onComplete }: IrrPlacementScreenProps) {
  const { speak, stop: stopSpeech, isSpeaking } = useTTS();
  const [step, setStep] = useState<'intro' | 'test' | 'done'>('intro');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<IrrPlacementResult[]>([]);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const startedAt = useRef(NOT_STARTED);

  const key = PROBES[index];
  const def = requireIrrVerbDef(key);

  useEffect(() => {
    if (step !== 'test') return;
    speak(irrPromptTtsKey(key));
    startedAt.current = startQuestion();
  }, [step, index, key, speak]);

  const record = useCallback(
    (correct: boolean, inputMode: 'keypad' | 'voice') => {
      if (feedback !== null) return;
      stopSpeech();
      const updated = [...results, { key, correct, timeMs: activeMsSince(startedAt.current), inputMode }];
      setResults(updated);
      const failures = correct ? 0 : consecutiveFailures + 1;
      setConsecutiveFailures(failures);
      setFeedback(correct ? 'correct' : 'incorrect');
      setTimeout(() => {
        setFeedback(null);
        if (index + 1 >= PROBES.length || failures >= IRR_MAX_CONSECUTIVE_FAILURES) {
          setStep('done');
        } else {
          setIndex(index + 1);
        }
      }, correct ? FEEDBACK_MS.correct : FEEDBACK_MS.incorrect);
    },
    [feedback, results, key, consecutiveFailures, index, stopSpeech],
  );

  const handleSubmit = useCallback(
    // Le juge de la séance, pas une égalité de chaînes : le placement ne doit
    // pas être plus sévère que le jeu lui-même.
    (answers: string[], source: 'keypad' | 'voice') =>
      record(isIrrAccepted(judgeIrrAnswer(def, answers, source)), source),
    [def, record],
  );

  if (step === 'intro') {
    return (
      <div className="welcome-screen">
        <div className="welcome-step" key="irr-intro">
          <Mascot mood="idle" />
          <div className="welcome-title">{t.placementTitle}</div>
          <div className="welcome-subtitle">{t.placementSubtitle}</div>
          <button className="btn btn--ink welcome-btn" onClick={() => setStep('test')}>
            {t.placementStart}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    const seeded = results.some((r) => r.correct);
    return (
      <div className="welcome-screen">
        <div className="welcome-step" key="irr-done">
          <Mascot mood="celebrate" />
          <div className="welcome-title">{seeded ? t.placementDoneTitle : t.placementEmptyTitle}</div>
          <div className="welcome-subtitle">
            {seeded ? t.placementDoneSubtitle : t.placementEmptySubtitle}
          </div>
          <button className="btn btn--ink welcome-btn" onClick={() => onComplete(results)}>
            {t.placementDoneCta}
          </button>
        </div>
      </div>
    );
  }

  const dots = PROBES.map((_, i) => (i < index ? 'done' : i === index ? 'current' : 'pending'));

  return (
    <div className="welcome-screen">
      <div className="welcome-step irr-placement" key="irr-test">
        <div className="welcome-test-progress">
          {dots.map((status, i) => (
            <div key={i} className={`welcome-test-progress-dot ${status}`} />
          ))}
        </div>

        {feedback ? (
          <>
            <IrrForms def={def} size="large" />
            <div className={`welcome-test-feedback ${feedback}`}>{feedback === 'correct' ? '✓' : ''}</div>
          </>
        ) : (
          <>
            <IrrAnswerInput
              def={def}
              onSubmit={handleSubmit}
              isSpeaking={isSpeaking}
              token={`probe-${index}`}
            />
            <button className="welcome-dontknow" onClick={() => record(false, 'keypad')}>
              <span className="welcome-dontknow-mark">?</span>
              <span>{t.placementDontKnow}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
