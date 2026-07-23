import { useEffect, useState } from 'react';
import DotGrid from './DotGrid';
import FeedbackStar from './FeedbackStar';
import StrategyHint from './StrategyHint';
import DivisionStrategyHint from './DivisionStrategyHint';
import RemainderStrategyHint from './RemainderStrategyHint';
import { getStrategy } from '../lib/strategies';
import { getDivisionStrategy } from '../lib/divisionStrategies';
import { getRemainderStrategy } from '../lib/remainderStrategies';
import { pickRandom } from '../lib/utils';
import { itemDisplay } from '../lib/sessionItemView';
import { useFeedbackOverlayStrings } from '../i18n/session';
import type { SessionItem } from '../types';

interface FeedbackOverlayProps {
  // Question à laquelle on vient de répondre (multiplication, division ou
  // division avec reste).
  item: SessionItem;
  correct: boolean;
  fast: boolean;
  // Valeur réellement saisie/dite — affichée sur le chemin erreur pour
  // distinguer « mauvaise réponse » de « le micro a mal entendu ». Pour le
  // niveau 3, c'est le QUOTIENT saisi.
  submittedValue: number;
  // Niveau 3 uniquement : reste saisi, ou null si la question s'est arrêtée à
  // un quotient faux — le feedback cible alors l'encadrement, pas l'écart
  // (specs §12.5).
  submittedRemainder?: number | null;
  onDismiss: () => void;
}

export default function FeedbackOverlay({
  item,
  correct,
  fast,
  submittedValue,
  submittedRemainder,
  onDismiss,
}: FeedbackOverlayProps) {
  const t = useFeedbackOverlayStrings();
  const [message] = useState(() =>
    pickRandom(correct ? t.correctMessages : t.incorrectMessages),
  );

  useEffect(() => {
    if (!correct) return;
    const timer = setTimeout(onDismiss, 1800);
    return () => clearTimeout(timer);
  }, [correct, onDismiss]);

  // Opérandes affichés (dérivation partagée avec SessionScreen) + réponse.
  const isRem = item.kind === 'rem';
  const { left, op, right } = itemDisplay(item);
  const answerText = isRem
    ? t.remAnswer(item.fact.quotient, item.remainder)
    : item.kind === 'div'
      ? String(item.fact.quotient)
      : String(item.fact.product);

  if (correct) {
    return (
      <div className="feedback-overlay correct" onClick={onDismiss}>
        <FeedbackStar fast={fast} />
        <div className="feedback-message correct">{message}</div>
        <div className="feedback-answer">
          {left} {op} {right} = <b>{answerText}</b>
        </div>
      </div>
    );
  }

  // Astuce affichée uniquement en début d'apprentissage (boîte ≤ 2) ; la grille
  // de points montre toujours le fait multiplicatif sous-jacent.
  let strategyHint = null;
  if (item.fact.box <= 2) {
    if (item.kind === 'rem') {
      strategyHint = <RemainderStrategyHint strategy={getRemainderStrategy(item)} variant="feedback" />;
    } else if (item.kind === 'div') {
      strategyHint = <DivisionStrategyHint strategy={getDivisionStrategy(item.fact)} variant="feedback" />;
    } else {
      const s = getStrategy(item.fact.a, item.fact.b);
      if (s) strategyHint = <StrategyHint strategy={s} variant="feedback" />;
    }
  }

  // Réponse saisie : composée « quotient, reste » quand la question niveau 3 a
  // atteint l'étape 2 (bon quotient, mauvais reste) ; quotient seul sinon.
  const submittedText =
    isRem && submittedRemainder != null
      ? t.remAnswer(submittedValue, submittedRemainder)
      : String(submittedValue);

  const gridA = item.kind === 'mult' ? item.displayA : isRem ? item.fact.quotient : item.fact.divisor;
  const gridB = item.kind === 'mult' ? item.displayB : isRem ? item.fact.divisor : item.fact.quotient;
  const gridEyebrow = isRem
    ? t.remEyebrow(item.fact.divisor, item.fact.quotient, item.remainder)
    : item.kind === 'div'
      ? `${item.fact.divisor} × ${item.fact.quotient} = ${item.fact.dividend}`
      : `${item.displayA} × ${item.displayB} = ${t.rowsOf(item.displayA, item.displayB)}`;

  return (
    <div className="feedback-overlay incorrect">
      <div className="feedback-card">
        <div className="feedback-message incorrect">{message}</div>
        <div className="feedback-user-answer">
          {t.youAnswered} <b>{submittedText}</b>
        </div>
        <div className="feedback-answer">
          {left} {op} {right} = <b>{answerText}</b>
        </div>
        {strategyHint}
        <div className="feedback-dotgrid">
          <div className="feedback-dotgrid-eyebrow">{gridEyebrow}</div>
          <DotGrid
            a={gridA}
            b={gridB}
            remainderDots={isRem ? item.remainder : 0}
            animated={false}
            bare
          />
        </div>
        <button type="button" className="feedback-ok-btn" onClick={onDismiss}>
          {t.gotIt}
        </button>
      </div>
    </div>
  );
}
