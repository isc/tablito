import { useEffect, useState } from 'react';
import DotGrid from './DotGrid';
import FeedbackStar from './FeedbackStar';
import StrategyHint from './StrategyHint';
import { getStrategy } from '../lib/strategies';
import { pickRandom } from '../lib/utils';
import type { BoxLevel } from '../types';

interface FeedbackOverlayProps {
  correct: boolean;
  fast: boolean;
  correctAnswer: number;
  // The value the user actually entered/said — shown on the wrong-answer
  // path so they (or a parent looking over their shoulder) can tell apart
  // "I gave a wrong answer" from "the mic misheard me".
  submittedValue: number;
  fact: { a: number; b: number };
  factBox: BoxLevel;
  onDismiss: () => void;
}

const CORRECT_MESSAGES = [
  'Super !',
  'Bravo !',
  'Génial !',
  'Bien joué !',
  'Excellent !',
  'Parfait !',
  'Trop fort !',
];

const INCORRECT_MESSAGES = [
  'Presque !',
  'Pas tout à fait…',
];

export default function FeedbackOverlay({
  correct,
  fast,
  correctAnswer,
  submittedValue,
  fact,
  factBox,
  onDismiss,
}: FeedbackOverlayProps) {
  const [message] = useState(() =>
    pickRandom(correct ? CORRECT_MESSAGES : INCORRECT_MESSAGES),
  );

  useEffect(() => {
    if (!correct) return;
    const timer = setTimeout(onDismiss, 1800);
    return () => clearTimeout(timer);
  }, [correct, onDismiss]);

  if (correct) {
    return (
      <div className="feedback-overlay correct" onClick={onDismiss}>
        <FeedbackStar fast={fast} />
        <div className="feedback-message correct">{message}</div>
        <div className="feedback-answer">
          {fact.a} {'×'} {fact.b} = <b>{correctAnswer}</b>
        </div>
      </div>
    );
  }

  const strategy = factBox <= 2 ? getStrategy(fact.a, fact.b) : null;

  return (
    <div className="feedback-overlay incorrect">
      <div className="feedback-card">
        <div className="feedback-message incorrect">{message}</div>
        <div className="feedback-user-answer">
          Tu as répondu <b>{submittedValue}</b>
        </div>
        <div className="feedback-answer">
          {fact.a} {'×'} {fact.b} = <b>{correctAnswer}</b>
        </div>
        {strategy && <StrategyHint strategy={strategy} variant="feedback" />}
        <div className="feedback-dotgrid">
          <div className="feedback-dotgrid-eyebrow">
            {fact.a} {'×'} {fact.b} = {fact.a} rangée{fact.a > 1 ? 's' : ''} de {fact.b}
          </div>
          <DotGrid a={fact.a} b={fact.b} animated={false} bare />
        </div>
        <button type="button" className="feedback-ok-btn" onClick={onDismiss}>
          J'ai compris
        </button>
      </div>
    </div>
  );
}
