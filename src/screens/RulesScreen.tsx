import BackChevron from '../components/BackChevron';
import { useRulesStrings } from '../i18n/home';

interface RulesScreenProps {
  onBack: () => void;
  showRule11?: boolean;
}

export default function RulesScreen({ onBack, showRule11 = false }: RulesScreenProps) {
  const t = useRulesStrings();
  return (
    <div className="rules-screen">
      <div className="rules-header">
        <button className="rules-back-btn" onClick={onBack} aria-label={t.back}>
          <BackChevron />
        </button>
        <div className="rules-title">{t.title}</div>
      </div>

      <div className="rules-content">
        <div className="rules-intro">
          {t.intro}
        </div>

        {/* Règle ×1 */}
        <div className="rule-card rule-card-indigo">
          <div className="rule-card-head">
            <div className="rule-card-badge">×1</div>
            <div>
              <div className="rule-card-eyebrow">{t.ruleNumber(1)}</div>
              <div className="rule-card-heading">{t.multiplyBy(1)}</div>
            </div>
          </div>
          <div className="rule-card-message">
            {t.rule1Message.before}<b>{t.rule1Message.bold}</b>{t.rule1Message.after}
          </div>
          <div className="rule-examples">
            <div className="rule-example">
              2 {'×'} 1 = <span className="rule-example-highlight">2</span>
            </div>
            <div className="rule-example">
              5 {'×'} 1 = <span className="rule-example-highlight">5</span>
            </div>
            <div className="rule-example">
              9 {'×'} 1 = <span className="rule-example-highlight">9</span>
            </div>
            <div className="rule-example">
              123 {'×'} 1 = <span className="rule-example-highlight">123</span>
            </div>
          </div>
          <div className="rule-card-tip">
            {t.rule1Tip}
          </div>
        </div>

        {/* Règle ×10 */}
        <div className="rule-card rule-card-coral">
          <div className="rule-card-head">
            <div className="rule-card-badge">×10</div>
            <div>
              <div className="rule-card-eyebrow">{t.ruleNumber(2)}</div>
              <div className="rule-card-heading">{t.multiplyBy(10)}</div>
            </div>
          </div>
          <div className="rule-card-message">
            {t.rule10Message.before}<b>{t.rule10Message.bold}</b>{t.rule10Message.after}
          </div>
          <div className="rule-glisse">
            <div className="rule-glisse-row">
              <span className="rule-slot rule-slot-empty">&nbsp;</span>
              <span className="rule-slot rule-slot-digit">7</span>
              <span className="rule-glisse-arrow">→</span>
              <span className="rule-slot rule-slot-digit">7</span>
              <span className="rule-slot rule-slot-zero">0</span>
            </div>
            <div className="rule-glisse-caption">7 {'×'} 10 = 70</div>
          </div>
          <div className="rule-examples">
            <div className="rule-example">3 {'×'} 10 = <span className="rule-example-highlight">30</span></div>
            <div className="rule-example">7 {'×'} 10 = <span className="rule-example-highlight">70</span></div>
            <div className="rule-example">12 {'×'} 10 = <span className="rule-example-highlight">120</span></div>
            <div className="rule-example">25 {'×'} 10 = <span className="rule-example-highlight">250</span></div>
          </div>
          <div className="rule-card-tip">
            {t.rule10Tip}
          </div>
        </div>

        {/* Règle bonus ×11 — révélée seulement quand toutes les tables 2-9
            sont maîtrisées (faits en boîte 4+). Cf. isRule11Unlocked. */}
        {showRule11 && (
          <div className="rule-card rule-card-honey">
            <div className="rule-card-head">
              <div className="rule-card-badge">×11</div>
              <div>
                <div className="rule-card-eyebrow">{t.bonusRule}</div>
                <div className="rule-card-heading">{t.multiplyBy(11)}</div>
              </div>
            </div>
            <div className="rule-card-message">
              {t.rule11Message.before}<b>{t.rule11Message.bold}</b>{t.rule11Message.after}
            </div>
            <div className="rule-glisse">
              <div className="rule-glisse-row">
                <span className="rule-slot rule-slot-digit rule-slot-honey">7</span>
                <span className="rule-glisse-arrow">→</span>
                <span className="rule-slot rule-slot-digit rule-slot-honey">7</span>
                <span className="rule-slot rule-slot-digit rule-slot-honey rule-slot-echo">7</span>
              </div>
              <div className="rule-glisse-caption">7 {'×'} 11 = 77</div>
            </div>
            <div className="rule-examples">
              <div className="rule-example">3 {'×'} 11 = <span className="rule-example-highlight">33</span></div>
              <div className="rule-example">5 {'×'} 11 = <span className="rule-example-highlight">55</span></div>
              <div className="rule-example">7 {'×'} 11 = <span className="rule-example-highlight">77</span></div>
              <div className="rule-example">9 {'×'} 11 = <span className="rule-example-highlight">99</span></div>
            </div>
            <div className="rule-card-tip">
              {t.rule11Tip}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
