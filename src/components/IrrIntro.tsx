import { useCallback, useEffect, useState } from 'react';
import IrrForms from './IrrForms';
import IrrAnswerInput from './IrrAnswerInput';
import StrategyHintShell from './StrategyHintShell';
import { isIrrAccepted, judgeIrrAnswer } from '../lib/irregularComposer';
import { irrRecitation, irrRecitationTtsKey, type IrrVerbDef } from '../lib/irregularVerbs';
import { IRR_FAMILY_HINTS, IRR_FAMILY_NAMES, irrStrings as t } from '../i18n/irregular';

/** Durée d'exposition du modèle avant masquage, étape 3 (cf. conjugaison). */
const COPY_REVEAL_MS = 4000;
/** Copies ratées tolérées : un geste d'ancrage, jamais une épreuve. */
const COPY_MAX_ATTEMPTS = 3;

type Step = 'listen' | 'family' | 'copy';

interface IrrIntroProps {
  def: IrrVerbDef;
  /** Verbe déjà su de la même famille : l'étape 2 n'existe qu'avec lui. */
  analogy: IrrVerbDef | null;
  onSpeak: (key: string) => void;
  isSpeaking: boolean;
  /** Fin de l'introduction : la première question suit (étape 4). */
  onFinish: () => void;
  token: string;
}

/**
 * Introduction d'un verbe nouveau (specs §16.7) :
 *   1. écouter — les trois formes affichées et récitées par la voix anglaise,
 *      avec la traduction en petit ;
 *   2. la famille — l'analogie avec un verbe déjà su, s'il y en a un ;
 *   3. copie différée — les formes 4 s, masquées, l'enfant les dit ou les
 *      écrit (« je lis, je cache, je redis »).
 * La 4ᵉ étape est la question elle-même, la 5ᵉ le re-test différé.
 */
export default function IrrIntro({ def, analogy, onSpeak, isSpeaking, onFinish, token }: IrrIntroProps) {
  const [step, setStep] = useState<Step>('listen');
  const [modelVisible, setModelVisible] = useState(true);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (step !== 'copy' || !modelVisible) return;
    const timer = setTimeout(() => setModelVisible(false), COPY_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [step, modelVisible]);

  const startCopy = useCallback(() => {
    setStep('copy');
    setModelVisible(true);
    onSpeak(irrRecitationTtsKey(def.key));
  }, [def.key, onSpeak]);

  const handleCopy = useCallback(
    (answers: string[], source: 'keypad' | 'voice') => {
      const ok = isIrrAccepted(judgeIrrAnswer(def, answers, source));
      const next = attempts + 1;
      setAttempts(next);
      if (ok || next >= COPY_MAX_ATTEMPTS) {
        onFinish();
      } else {
        setModelVisible(true);
        onSpeak(irrRecitationTtsKey(def.key));
      }
    },
    [def, attempts, onFinish, onSpeak],
  );

  return (
    <div className="session-intro irr-intro">
      <div className="session-intro-title">{t.new}</div>

      {step === 'listen' && (
        <>
          <div className="session-intro-explanation">{t.introListen}</div>
          <IrrForms def={def} size="large" />
          <div className="irr-translation">{def.fr}</div>
          <button type="button" className="conj-replay-btn" onClick={() => onSpeak(irrRecitationTtsKey(def.key))}>
            {'🔊'} {t.listen}
          </button>
          <button
            className="btn btn--ink session-intro-btn"
            onClick={() => (analogy ? setStep('family') : startCopy())}
          >
            {t.next}
          </button>
        </>
      )}

      {step === 'family' && analogy && (
        <>
          <IrrForms def={def} size="large" />
          <StrategyHintShell
            title={IRR_FAMILY_NAMES[def.family]}
            variant="intro"
            lines={[t.introFamily(irrRecitation(analogy)), IRR_FAMILY_HINTS[def.family]]}
          />
          <button className="btn btn--ink session-intro-btn" onClick={startCopy}>
            {t.next}
          </button>
        </>
      )}

      {step === 'copy' && (
        <>
          <div className="session-intro-explanation" aria-live="polite">
            {modelVisible ? (attempts > 0 ? t.copyAgain : t.copyLook) : t.copySay}
          </div>
          {modelVisible ? (
            <IrrForms def={def} size="large" />
          ) : (
            <IrrAnswerInput
              def={def}
              onSubmit={handleCopy}
              isSpeaking={isSpeaking}
              token={`${token}-copy-${attempts}`}
            />
          )}
        </>
      )}
    </div>
  );
}
