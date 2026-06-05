import { useEffect, useState } from 'react';
import DotGrid from './DotGrid';
import FeedbackStar from './FeedbackStar';
import StrategyHint from './StrategyHint';
import DivisionStrategyHint from './DivisionStrategyHint';
import { getStrategy } from '../lib/strategies';
import { getDivisionStrategy } from '../lib/divisionStrategies';
import { pickRandom } from '../lib/utils';
import type { SessionItem } from '../types';

interface FeedbackOverlayProps {
  // Question à laquelle on vient de répondre (multiplication ou division).
  item: SessionItem;
  correct: boolean;
  fast: boolean;
  // Valeur réellement saisie/dite — affichée sur le chemin erreur pour
  // distinguer « mauvaise réponse » de « le micro a mal entendu ».
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

export default function FeedbackOverlay({
  item,
  correct,
  fast,
  submittedValue,
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

  // Opérandes affichés + réponse, selon le type de question.
  const left = item.kind === 'div' ? item.fact.dividend : item.displayA;
  const op = item.kind === 'div' ? '÷' : '×';
  const right = item.kind === 'div' ? item.fact.divisor : item.displayB;
  const answer = item.kind === 'div' ? item.fact.quotient : item.fact.product;

  if (correct) {
    return (
      <div className="feedback-overlay correct" onClick={onDismiss}>
        <FeedbackStar fast={fast} />
        <div className="feedback-message correct">{message}</div>
        <div className="feedback-answer">
          {left} {op} {right} = <b>{answer}</b>
        </div>
      </div>
    );
  }

  // Astuce affichée uniquement en début d'apprentissage (boîte ≤ 2) ; la grille
  // de points montre toujours le fait multiplicatif sous-jacent.
  let strategyHint = null;
  if (item.fact.box <= 2) {
    if (item.kind === 'div') {
      strategyHint = <DivisionStrategyHint strategy={getDivisionStrategy(item.fact)} variant="feedback" />;
    } else {
      const s = getStrategy(item.fact.a, item.fact.b);
      if (s) strategyHint = <StrategyHint strategy={s} variant="feedback" />;
    }
  }

  const gridA = item.kind === 'div' ? item.fact.divisor : item.displayA;
  const gridB = item.kind === 'div' ? item.fact.quotient : item.displayB;
  const gridEyebrow =
    item.kind === 'div'
      ? `${item.fact.divisor} × ${item.fact.quotient} = ${item.fact.dividend}`
      : `${item.displayA} × ${item.displayB} = ${item.displayA} rangée${item.displayA > 1 ? 's' : ''} de ${item.displayB}`;

  return (
    <div className="feedback-overlay incorrect">
      <div className="feedback-card">
        <div className="feedback-message incorrect">{message}</div>
        <div className="feedback-user-answer">
          Tu as répondu <b>{submittedValue}</b>
        </div>
        <div className="feedback-answer">
          {left} {op} {right} = <b>{answer}</b>
        </div>
        {strategyHint}
        <div className="feedback-dotgrid">
          <div className="feedback-dotgrid-eyebrow">{gridEyebrow}</div>
          <DotGrid a={gridA} b={gridB} animated={false} bare />
        </div>
        <button type="button" className="feedback-ok-btn" onClick={onDismiss}>
          J'ai compris
        </button>
      </div>
    </div>
  );
}
