import { useEffect, useState } from 'react';
import DotGrid from './DotGrid';
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
        <div className="feedback-star-wrap" aria-label={fast ? 'Étoile dorée' : undefined}>
          <svg width="180" height="180" viewBox="-10 -10 120 120" className="feedback-star-rays">
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
              const x1 = 50 + Math.cos(a) * 42;
              const y1 = 50 + Math.sin(a) * 42;
              const x2 = 50 + Math.cos(a) * 56;
              const y2 = 50 + Math.sin(a) * 56;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="var(--honey)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <svg width="86" height="86" viewBox="0 0 24 24" className="feedback-star-shape">
            <path
              d="M12 2l2.6 6.3 6.8.6-5.2 4.5 1.6 6.6L12 16.8 6.2 20l1.6-6.6L2.6 8.9l6.8-.6z"
              fill="var(--honey)"
              stroke="var(--ink)"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </div>
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
