import { useState, useEffect } from 'react';
import Mascot from '../components/Mascot';
import { useTTS } from '../hooks/useTTS';
import { useRulesIntroStrings } from '../i18n/onboarding';

interface RulesIntroScreenProps {
  name: string;
  onComplete: () => void;
}

export default function RulesIntroScreen({ name, onComplete }: RulesIntroScreenProps) {
  const [step, setStep] = useState(0);
  const t = useRulesIntroStrings();

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
            {t.introTitle(name)}
          </div>
          <div className="rules-intro-subtitle">
            {t.introSubtitlePart1}
            <br />
            {t.introSubtitlePart2Prefix}<strong>1</strong>{t.introSubtitlePart2Middle}<strong>10</strong>{t.introSubtitlePart2Suffix}
            <br />
            <br />
            {t.introSubtitlePart3}
          </div>
          <button className="btn btn--ink rules-intro-btn" onClick={handleNext}>
            {t.letsGo}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="rules-intro-step" key="x1">
          <div className="rules-intro-badge rules-intro-badge-indigo" aria-hidden>{'\u00d71'}</div>
          <div className="rules-intro-title">{t.x1Title}</div>
          <div className="rules-intro-message">
            {t.x1Message}
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
            {t.x1Tip}
          </div>
          <button className="btn btn--ink rules-intro-btn" onClick={handleNext}>
            {t.next}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="rules-intro-step" key="x10">
          <div className="rules-intro-badge rules-intro-badge-coral" aria-hidden>{'×10'}</div>
          <div className="rules-intro-title">{t.x10Title}</div>
          <div className="rules-intro-message">
            {t.x10MessagePart1}
            <br />
            {t.x10MessagePart2Prefix}<strong>0</strong>{t.x10MessagePart2Suffix}
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
            {t.x10Tip}
          </div>
          <button className="btn btn--ink rules-intro-btn" onClick={handleNext}>
            {t.gotIt}
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
