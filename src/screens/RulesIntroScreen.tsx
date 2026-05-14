import { useState, useEffect } from 'react';
import Mascot from '../components/Mascot';
import { useTTS } from '../hooks/useTTS';

interface RulesIntroScreenProps {
  name: string;
  onComplete: () => void;
}

export default function RulesIntroScreen({ name, onComplete }: RulesIntroScreenProps) {
  const [step, setStep] = useState(0);

  const { speak } = useTTS();

  useEffect(() => {
    if (step === 0) speak('rules-intro-welcome');
    else if (step === 1) speak('rules-intro-x1');
    else if (step === 2) speak('rules-intro-x10');
  }, [step, speak]);

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="rules-intro-screen">
      {step === 0 && (
        <div className="rules-intro-step" key="intro">
          <Mascot mood="celebrate" />
          <div className="rules-intro-title">
            Avant de commencer, {name}&nbsp;!
          </div>
          <div className="rules-intro-subtitle">
            Je vais te montrer deux règles toutes simples
            <br />
            pour multiplier par <strong>1</strong> et par <strong>10</strong>.
            <br />
            <br />
            Pas besoin de les apprendre par cœur : tu vas comprendre comment elles marchent&nbsp;!
          </div>
          <button className="rules-intro-btn rules-intro-btn-primary" onClick={handleNext}>
            C'est parti&nbsp;!
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="rules-intro-step" key="x1">
          <div className="rules-intro-badge rules-intro-badge-indigo" aria-hidden>{'\u00d71'}</div>
          <div className="rules-intro-title">Multiplier par 1</div>
          <div className="rules-intro-message">
            Tout nombre multiplié par 1 reste le même&nbsp;!
          </div>
          <div className="rules-intro-examples">
            <div className="rules-intro-example">
              4 {'\u00D7'} 1 = <span className="rules-intro-highlight">4</span>
            </div>
            <div className="rules-intro-example">
              8 {'\u00D7'} 1 = <span className="rules-intro-highlight">8</span>
            </div>
          </div>
          <div className="rules-intro-tip">
            Facile, non&nbsp;?
          </div>
          <button className="rules-intro-btn rules-intro-btn-primary" onClick={handleNext}>
            Suivant
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="rules-intro-step" key="x10">
          <div className="rules-intro-badge rules-intro-badge-coral" aria-hidden>{'×10'}</div>
          <div className="rules-intro-title">Multiplier par 10</div>
          <div className="rules-intro-message">
            Les chiffres glissent d'une place vers la gauche&nbsp;!
            <br />
            Un <strong>0</strong> vient prendre la place des unités.
          </div>

          <div className="glisse-demo" aria-hidden>
            <div className="glisse-side">
              <div className="glisse-labels">
                <span>d</span>
                <span>u</span>
              </div>
              <div className="glisse-row">
                <div className="glisse-cell empty" />
                <div className="glisse-cell">3</div>
              </div>
              <div className="glisse-caption">3</div>
            </div>

            <div className="glisse-arrow">
              <span className="glisse-arrow-label">{'\u00D7'} 10</span>
              <span className="glisse-arrow-icon">{'\u2192'}</span>
            </div>

            <div className="glisse-side">
              <div className="glisse-labels">
                <span>d</span>
                <span>u</span>
              </div>
              <div className="glisse-row">
                <div className="glisse-cell slide-in-left">3</div>
                <div className="glisse-cell fade-in-zero">0</div>
              </div>
              <div className="glisse-caption">30</div>
            </div>
          </div>

          <div className="rules-intro-examples">
            <div className="rules-intro-example">
              7 {'\u00D7'} 10 = <span className="rules-intro-highlight">70</span>
            </div>
            <div className="rules-intro-example">
              12 {'\u00D7'} 10 = <span className="rules-intro-highlight">120</span>
            </div>
          </div>
          <div className="rules-intro-tip">
            Astuce : tous les résultats de la table de 10 se terminent par 0&nbsp;!
          </div>
          <button className="rules-intro-btn rules-intro-btn-primary" onClick={handleNext}>
            J'ai compris&nbsp;!
          </button>
        </div>
      )}

      <div className="rules-intro-dots">
        {[0, 1, 2].map((s) => (
          <div key={s} className={`rules-intro-dot ${s === step ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
}
