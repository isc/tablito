import { useEffect, useState } from 'react';
import DotGrid from './DotGrid';
import DivisionStrategyHint from './DivisionStrategyHint';
import { getDivisionStrategy } from '../lib/divisionStrategies';
import { pickRandom } from '../lib/utils';
import type { DivisionFact } from '../types';

interface DivisionFeedbackOverlayProps {
  correct: boolean;
  fast: boolean;
  fact: DivisionFact;
  submittedValue: number;
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

const INCORRECT_MESSAGES = ['Presque !', 'Pas tout à fait…'];

/**
 * Variante division de FeedbackOverlay. Affiche « dividend ÷ divisor =
 * quotient » et, en cas d'erreur sur un fait peu maîtrisé (boîte ≤ 2),
 * rappelle la stratégie « pense à la multiplication » + la grille de points
 * du fait multiplicatif sous-jacent (divisor × quotient).
 */
export default function DivisionFeedbackOverlay({
  correct,
  fast,
  fact,
  submittedValue,
  onDismiss,
}: DivisionFeedbackOverlayProps) {
  const [message] = useState(() =>
    pickRandom(correct ? CORRECT_MESSAGES : INCORRECT_MESSAGES),
  );

  useEffect(() => {
    if (!correct) return;
    const timer = setTimeout(onDismiss, 1800);
    return () => clearTimeout(timer);
  }, [correct, onDismiss]);

  const { dividend, divisor, quotient } = fact;

  if (correct) {
    return (
      <div className="feedback-overlay correct" onClick={onDismiss}>
        <div className="feedback-star-wrap" aria-label={fast ? 'Étoile dorée' : 'Étoile'}>
          {fast && (
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
          )}
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
          {dividend} {'÷'} {divisor} = <b>{quotient}</b>
        </div>
      </div>
    );
  }

  const strategy = fact.box <= 2 ? getDivisionStrategy(fact) : null;

  return (
    <div className="feedback-overlay incorrect">
      <div className="feedback-card">
        <div className="feedback-message incorrect">{message}</div>
        <div className="feedback-user-answer">
          Tu as répondu <b>{submittedValue}</b>
        </div>
        <div className="feedback-answer">
          {dividend} {'÷'} {divisor} = <b>{quotient}</b>
        </div>
        {strategy && <DivisionStrategyHint strategy={strategy} variant="feedback" />}
        <div className="feedback-dotgrid">
          <div className="feedback-dotgrid-eyebrow">
            {divisor} {'×'} {quotient} = {dividend}
          </div>
          <DotGrid a={divisor} b={quotient} animated={false} bare />
        </div>
        <button type="button" className="feedback-ok-btn" onClick={onDismiss}>
          J'ai compris
        </button>
      </div>
    </div>
  );
}
