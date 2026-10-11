import { useState } from 'react';
import IrrForms from './IrrForms';
import StrategyHintShell from './StrategyHintShell';
import { irrRecitation, irrRecitationTtsKey, type IrrVerbDef } from '../lib/irregularVerbs';
import { IRR_FAMILY_HINTS, IRR_FAMILY_NAMES, irrStrings as t } from '../i18n/irregular';

type Step = 'listen' | 'family';

interface IrrIntroProps {
  def: IrrVerbDef;
  /** Verbe déjà su de la même famille : l'étape 2 n'existe qu'avec lui. */
  analogy: IrrVerbDef | null;
  onSpeak: (key: string) => void;
  /** Fin de l'introduction : la première question suit (étape 3). */
  onFinish: () => void;
}

/**
 * Introduction d'un verbe nouveau (specs §16.7) :
 *   1. écouter — les trois formes affichées et récitées par la voix anglaise,
 *      avec la traduction en petit ;
 *   2. la famille — l'analogie avec un verbe déjà su, s'il y en a un.
 * La 3ᵉ étape est la première question, ouverte sur le modèle affiché puis
 * masqué (la copie différée, cf. SessionScreen), la 4ᵉ le re-test différé.
 */
export default function IrrIntro({ def, analogy, onSpeak, onFinish }: IrrIntroProps) {
  const [step, setStep] = useState<Step>('listen');

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
            onClick={() => (analogy ? setStep('family') : onFinish())}
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
          <button className="btn btn--ink session-intro-btn" onClick={onFinish}>
            {t.next}
          </button>
        </>
      )}
    </div>
  );
}
