import { useEffect, useState } from 'react';
import DotGrid from './DotGrid';
import FeedbackStar from './FeedbackStar';
import StrategyHint from './StrategyHint';
import DivisionStrategyHint from './DivisionStrategyHint';
import RemainderStrategyHint from './RemainderStrategyHint';
import { getStrategy } from '../lib/strategies';
import { getDivisionStrategy } from '../lib/divisionStrategies';
import { getRemainderStrategy } from '../lib/remainderStrategies';
import type { SessionItem } from '../types';
import { pickRandom } from '../lib/utils';
import { itemDisplay } from '../lib/sessionItemView';
import { useFeedbackOverlayStrings } from '../i18n/session';

/**
 * Durée d'affichage d'un feedback ACCEPTÉ avant enchaînement automatique :
 * assez pour voir l'étoile, trop court pour couper l'élan. Partagée avec le
 * feedback de la conjugaison — c'est le même rythme de séance.
 */
export const FEEDBACK_DISMISS_MS = 1800;

/** Le « presque » des matières à formes écrites montre une forme à relire :
    un peu plus de temps qu'un feedback accepté. */
export const FEEDBACK_ALMOST_DISMISS_MS = 2600;

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
  // un quotient faux. Le feedback vise l'étape ratée (specs §12.5) : un
  // quotient faux ré-affiche l'encadrement, rangées qui se remplissent ; un
  // bon quotient avec un mauvais reste ne ré-explique que l'écart.
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
    const timer = setTimeout(onDismiss, FEEDBACK_DISMISS_MS);
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

  // Niveau 3, bon quotient : l'erreur est sur le reste seul. L'encadrement est
  // acquis, seul l'écart est ré-expliqué — à toute boîte, comme la grille :
  // c'est le détail de la réponse, pas une astuce.
  const remainderMissed = isRem && submittedRemainder != null;

  // Astuce affichée uniquement en début d'apprentissage (boîte ≤ 2) ; la grille
  // de points montre toujours le fait multiplicatif sous-jacent.
  let strategyHint = null;
  if (!remainderMissed && item.fact.box <= 2) {
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
    remainderMissed
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
        {remainderMissed && (
          <div className="feedback-rem-gap">{t.remGap(item.fact.divisor, item.fact.quotient, item.remainder)}</div>
        )}
        {strategyHint}
        <div className="feedback-dotgrid">
          <div className="feedback-dotgrid-eyebrow">{gridEyebrow}</div>
          <DotGrid
            a={gridA}
            b={gridB}
            remainderDots={isRem ? item.remainder : 0}
            animated={isRem && !remainderMissed}
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
