import { useEffect, useState } from 'react';
import FeedbackStar from './FeedbackStar';
import IrrForms from './IrrForms';
import StrategyHintShell from './StrategyHintShell';
import { FEEDBACK_DISMISS_MS } from './FeedbackOverlay';
import { isIrrAccepted, irrWrittenAnswer, type IrrVerdict } from '../lib/irregularComposer';
import { irrRecitation, irrRecitationTtsKey, type IrrVerbDef } from '../lib/irregularVerbs';
import { pickRandom } from '../lib/utils';
import { IRR_FAMILY_HINTS, IRR_FAMILY_NAMES, irrStrings as t } from '../i18n/irregular';
import type { BoxLevel } from '../types';

/** Le « presque » montre une forme à relire : un peu plus long (cf. conjugaison). */
const DISMISS_ALMOST_MS = 2600;

interface IrrFeedbackOverlayProps {
  def: IrrVerbDef;
  verdict: IrrVerdict;
  fast: boolean;
  /** Ce que l'enfant a dit ou écrit. */
  answers: string[];
  source: 'keypad' | 'voice';
  /** Boîte du verbe posé — l'astuce de famille est gatée à ≤ 2 (§16.6). */
  box: BoxLevel;
  /** Verbe déjà su de la même famille, pour l'analogie (null sinon). */
  analogy: IrrVerbDef | null;
  onDismiss: () => void;
  onSpeak: (key: string) => void;
}

/**
 * Feedback des verbes irréguliers (specs §16.6) : mêmes quatre cas que la
 * conjugaison, jamais de son négatif. En cas d'erreur, la récitation complète
 * est rejouée par la voix anglaise — l'enfant réentend le verbe juste.
 */
export default function IrrFeedbackOverlay({
  def,
  verdict,
  fast,
  answers,
  source,
  box,
  analogy,
  onDismiss,
  onSpeak,
}: IrrFeedbackOverlayProps) {
  const [praise] = useState(() => pickRandom(t.correctMessages));
  const accepted = isIrrAccepted(verdict);

  useEffect(() => {
    if (!accepted) {
      onSpeak(irrRecitationTtsKey(def.key));
      return;
    }
    const timer = setTimeout(onDismiss, verdict === 'almost' ? DISMISS_ALMOST_MS : FEEDBACK_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [accepted, verdict, onDismiss, onSpeak, def.key]);

  if (accepted) {
    return (
      <div className="feedback-overlay correct irr-feedback" onClick={onDismiss}>
        <FeedbackStar fast={fast} />
        <div className="feedback-message correct">{fast ? praise : t.wellDone}</div>
        <IrrForms def={def} />
      </div>
    );
  }

  // Une seule astuce : celle qui nomme l'erreur quand on la reconnaît (le -ed,
  // l'ordre), sinon l'analogie de famille en début d'apprentissage.
  const specific =
    verdict === 'regularized' ? t.regularizedHint : verdict === 'swapped' ? t.swappedHint : null;
  const familyHint = !specific && box <= 2 && def.family !== 'unique';

  return (
    <div className="feedback-overlay incorrect irr-feedback">
      <div className="feedback-card">
        <div className="feedback-message incorrect">{t.incorrectMessage}</div>
        <div className="feedback-user-answer">
          {source === 'voice' ? t.youSaid : t.youWrote} <b lang="en">{irrWrittenAnswer(answers)}</b>
        </div>
        <IrrForms def={def} size="large" />
        <div className="irr-translation">{def.fr}</div>
        <button
          type="button"
          className="conj-replay-btn"
          onClick={() => onSpeak(irrRecitationTtsKey(def.key))}
        >
          {'🔊'} {t.listen}
        </button>
        {specific && <div className="irr-hint-line">{specific}</div>}
        {familyHint && (
          <StrategyHintShell
            title={IRR_FAMILY_NAMES[def.family]}
            variant="feedback"
            eyebrow={t.hintEyebrow}
            lines={[
              IRR_FAMILY_HINTS[def.family],
              ...(analogy ? [t.introFamily(irrRecitation(analogy))] : []),
            ]}
          />
        )}
        <button type="button" className="feedback-ok-btn" onClick={onDismiss}>
          {t.gotIt}
        </button>
      </div>
    </div>
  );
}
