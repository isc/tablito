import { useEffect, useState } from 'react';
import ConjForm from './ConjForm';
import FeedbackStar from './FeedbackStar';
import StrategyHintShell from './StrategyHintShell';
import type { ConjQuestionView } from '../lib/conjugationFacts';
import { getConjStrategy } from '../lib/conjugationStrategies';
import { pickRandom } from '../lib/utils';
import { conjStrings as t } from '../i18n/conjugation';
import type { BoxLevel } from '../types';
import { isConjAccepted, type ConjVerdict } from '../lib/conjugationComposer';
import { FEEDBACK_DISMISS_MS } from './FeedbackOverlay';

// Feedback de la matière conjugaison — quatre cas (spec Verbito §5.3), tous
// non ego-involving (Butler 1988) :
//
//   correct rapide → étoile dorée rayonnante (+ montée de boîte, côté Leitner) ;
//   correct lent   → « Bravo ! », étoile sans rayons, pas de montée. La lenteur
//                    n'est JAMAIS verbalisée ;
//   presque        → accepté, forme correcte montrée segmentée, sans commentaire
//                    sur la coquille (on ne pénalise jamais l'orthographe
//                    lexicale dans un jeu de conjugaison) ;
//   erreur         → AUCUN son négatif ; la forme correcte s'affiche segmentée,
//                    le pronom et sa marque s'illuminent ; astuce seulement pour
//                    les faits en boîte ≤ 2.

/** Le cas « presque » montre une forme à lire : un peu plus de temps que le
    délai commun d'un feedback accepté (cf. FEEDBACK_DISMISS_MS). */
const DISMISS_ALMOST_MS = 2600;

interface ConjFeedbackOverlayProps {
  view: ConjQuestionView;
  verdict: ConjVerdict;
  fast: boolean;
  /** Ce que l'enfant a réellement tapé (chemin erreur uniquement). */
  typed: string;
  /** Boîte du fait posé — l'astuce est gatée à ≤ 2 (§5.3). */
  box: BoxLevel;
  onDismiss: () => void;
}

export default function ConjFeedbackOverlay({
  view,
  verdict,
  fast,
  typed,
  box,
  onDismiss,
}: ConjFeedbackOverlayProps) {
  // Message tiré une fois pour toutes au montage (pas à chaque render).
  const [praise] = useState(() => pickRandom(t.correctMessages));
  const accepted = isConjAccepted(verdict);

  useEffect(() => {
    if (!accepted) return;
    const timer = setTimeout(
      onDismiss,
      verdict === 'almost' ? DISMISS_ALMOST_MS : FEEDBACK_DISMISS_MS,
    );
    return () => clearTimeout(timer);
  }, [accepted, verdict, onDismiss]);

  if (accepted) {
    return (
      <div className="feedback-overlay correct conj-feedback" onClick={onDismiss}>
        <FeedbackStar fast={fast} />
        {/* Le « Bravo ! » invariable couvre le correct-lent ET le presque :
            dans les deux cas la réponse est acceptée, et rien de ce qui a
            manqué (la vitesse, la coquille) n'est nommé. */}
        <div className="feedback-message correct">{fast ? praise : t.wellDone}</div>
        <div className="conj-feedback-form">
          <ConjForm segment={view.segment} subject={view.subject} />
        </div>
      </div>
    );
  }

  // Astuce en début d'apprentissage seulement : une seule règle à la fois,
  // jamais un mur de règles.
  const strategy = box <= 2 ? getConjStrategy(view) : null;

  return (
    <div className="feedback-overlay incorrect conj-feedback">
      <div className="feedback-card">
        <div className="feedback-message incorrect">{t.incorrectMessage}</div>
        <div className="feedback-user-answer">
          {t.youWrote} <b>{view.displayedStem}{typed}</b>
        </div>
        {/* La forme correcte, segmentée, pronom et marque illuminés : le support
            conceptuel de l'erreur — l'équivalent de la grille de points. */}
        <div className="conj-feedback-form">
          <ConjForm segment={view.segment} subject={view.subject} lit="both" />
        </div>
        <div className="conj-feedback-sentence">{view.sentence}</div>
        {strategy && (
          <StrategyHintShell
            title={strategy.title}
            lines={[...strategy.lines]}
            variant="feedback"
            eyebrow={t.hintEyebrow}
          />
        )}
        <button type="button" className="feedback-ok-btn" onClick={onDismiss}>
          {t.gotIt}
        </button>
      </div>
    </div>
  );
}
