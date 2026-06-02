import { useEffect, useState } from 'react';
import DotGrid from './DotGrid';
import FeedbackStar from './FeedbackStar';
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
        <FeedbackStar fast={fast} />
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
