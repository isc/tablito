import { useCallback, useEffect, useRef, useState } from 'react';
import ConjForm from '../components/ConjForm';
import LetterKeyboard from '../components/LetterKeyboard';
import Mascot from '../components/Mascot';
import {
  CONJ_MAX_CONSECUTIVE_FAILURES,
  CONJ_PLACEMENT_PROBES,
  type ConjPlacementResult,
} from '../lib/conjugationPlacement';
import { requireConjFactDef, resolveConjQuestion } from '../lib/conjugationFacts';
import { isConjAccepted, judgeConjAnswer } from '../lib/conjugationComposer';
import { useTTS } from '../hooks/useTTS';
import { conjStrings as t } from '../i18n/conjugation';

/**
 * Test de placement de la matière conjugaison (spec Verbito §6.1).
 *
 * Ce n'est PAS un examen : c'est le premier geste de réassurance du jeu. ≤ 15
 * sondes en difficulté croissante, un bouton « Je ne sais pas » toujours à
 * portée, arrêt après 3 échecs consécutifs — puis l'ensemencement des boîtes
 * (côté App, `seedConjFromPlacement`) fait démarrer l'image mystère déjà
 * partiellement révélée. Le message passe sans un mot : tu n'as pas tout
 * oublié, regarde tout ce qui est déjà là.
 *
 * Écran FR-only comme le reste de la matière (cf. i18n/conjugation.ts).
 */

/** Le verdict s'affiche brièvement, sans commentaire ni son négatif (§5.3). */
const FEEDBACK_MS = { correct: 600, incorrect: 1100 } as const;

interface ConjPlacementScreenProps {
  /** Appelé une fois le test terminé (ou arrêté par la règle des 3 échecs). */
  onComplete: (results: ConjPlacementResult[]) => void;
}

export default function ConjPlacementScreen({ onComplete }: ConjPlacementScreenProps) {
  const { speak, stop: stopSpeech } = useTTS();
  const [step, setStep] = useState<'intro' | 'test' | 'done'>('intro');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ConjPlacementResult[]>([]);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  // Le verdict affiché est AUSSI le verrou de saisie : tant qu'il est là, la
  // sonde est jouée et le clavier comme le « Je ne sais pas » ont disparu.
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const startedAt = useRef(0);

  const probe = CONJ_PLACEMENT_PROBES[index];
  const view = resolveConjQuestion(requireConjFactDef(probe.key), probe.carrierIndex);

  // La consigne comme la question sont lues à voix haute : « l'exercice ne doit
  // jamais commencer par un déchiffrage » (§8).
  useEffect(() => {
    if (step !== 'test') return;
    speak(view.promptTtsKey);
    startedAt.current = Date.now();
  }, [step, index, view.promptTtsKey, speak]);

  const record = useCallback(
    (correct: boolean) => {
      if (feedback !== null) return;
      stopSpeech();

      const updated = [
        ...results,
        { key: probe.key, correct, timeMs: Date.now() - startedAt.current },
      ];
      setResults(updated);
      const failures = correct ? 0 : consecutiveFailures + 1;
      setConsecutiveFailures(failures);
      setFeedback(correct ? 'correct' : 'incorrect');

      setTimeout(() => {
        setFeedback(null);
        const isLast = index + 1 >= CONJ_PLACEMENT_PROBES.length;
        if (isLast || failures >= CONJ_MAX_CONSECUTIVE_FAILURES) {
          setStep('done');
        } else {
          setIndex(index + 1);
        }
      }, correct ? FEEDBACK_MS.correct : FEEDBACK_MS.incorrect);
    },
    [feedback, results, probe.key, consecutiveFailures, index, stopSpeech],
  );

  const handleSubmit = useCallback(
    (typed: string) => {
      // EXACTEMENT le juge de la séance (§4.5), pas une égalité de chaînes : le
      // placement serait sinon plus sévère que le jeu lui-même — « etais » sans
      // accent refusé ici et accepté là, la forme entière tapée quand seule la
      // terminaison est demandée comptée fausse. Or un échec de plus, c'est un
      // pas de plus vers l'arrêt à 3 échecs consécutifs, sur le premier geste
      // de réassurance de la matière (§6.1) — et on ne pénalise jamais
      // l'orthographe lexicale (§8).
      record(isConjAccepted(judgeConjAnswer(view, typed).verdict));
    },
    [record, view],
  );

  if (step === 'intro') {
    return (
      <div className="welcome-screen">
        <div className="welcome-step" key="conj-intro">
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
    // Le message de réassurance n'est tenable que s'il y a vraiment quelque
    // chose à montrer : une sonde réussie = des boîtes ensemencées = une image
    // qui démarre révélée. Sinon on annonce la suite, sans nommer l'échec.
    const seeded = results.some((r) => r.correct);
    return (
      <div className="welcome-screen">
        <div className="welcome-step" key="conj-done">
          <Mascot mood="celebrate" />
          <div className="welcome-title">
            {seeded ? t.placementDoneTitle : t.placementEmptyTitle}
          </div>
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

  const dots = CONJ_PLACEMENT_PROBES.map((_, i) =>
    i < index ? 'done' : i === index ? 'current' : 'pending',
  );

  return (
    <div className="welcome-screen">
      <div className="welcome-step" key="conj-test">
        <div className="welcome-test-progress">
          {dots.map((status, i) => (
            <div key={i} className={`welcome-test-progress-dot ${status}`} />
          ))}
        </div>

        <div className="conj-sentence">
          <ConjForm
            stacked
            before={view.carrier.before}
            subject={view.subject}
            segment={[view.displayedStem, '']}
            blank
            after={view.tail}
          />
        </div>
        <div className="conj-question-meta">
          <span className="conj-intro-infinitive">{t.infinitive(view.verb)}</span>
        </div>

        {feedback ? (
          // Jamais de croix ni de correction claironnée : un ✓ quand c'est
          // juste, la forme attendue en couleurs sinon (§5.3).
          <div className={`welcome-test-feedback ${feedback}`}>
            {feedback === 'correct' ? (
              '✓'
            ) : (
              <ConjForm subject={view.subject} segment={view.segment} />
            )}
          </div>
        ) : (
          <>
            <div className="conj-keyboard-area">
              <LetterKeyboard
                key={`probe-${index}`}
                onSubmit={handleSubmit}
                prefix={view.displayedStem}
              />
            </div>
            <button className="welcome-dontknow" onClick={() => record(false)}>
              <span className="welcome-dontknow-mark">?</span>
              <span>{t.placementDontKnow}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
