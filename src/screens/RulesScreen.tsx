import { useState } from 'react';
import BackChevron from '../components/BackChevron';
import ConjRuleVisual from '../components/ConjRuleVisual';
import ListenButton from '../components/ListenButton';
import { renderConjHintLine } from '../components/conjHintLine';
import { useTTS } from '../hooks/useTTS';
import { useRulesStrings } from '../i18n/home';
import { conjRuleTtsKey, type ConjStrategy } from '../lib/conjugationRules';

interface RulesScreenProps {
  onBack: () => void;
  showRule11?: boolean;
  // Règles de conjugaison déjà rencontrées (cf. metConjRules), vides en anglais
  // et tant que la matière n'a pas été ouverte : l'écran reste alors celui des
  // seules règles de maths, sans onglets.
  conjRules?: readonly ConjStrategy[];
}

export default function RulesScreen({ onBack, showRule11 = false, conjRules = [] }: RulesScreenProps) {
  const t = useRulesStrings();
  const hasConj = conjRules.length > 0;
  // Deux onglets plutôt qu'une seule colonne : les règles de conjugaison, plus
  // longues, enterraient celles des maths sous plusieurs écrans de défilement.
  const [tab, setTab] = useState<'maths' | 'conj'>('maths');
  const showConj = hasConj && tab === 'conj';
  const { speak } = useTTS();
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

        {hasConj && (
          <nav className="rules-tabs" role="tablist">
            {(['maths', 'conj'] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`rules-tab${tab === id ? ' is-active' : ''}`}
                onClick={() => setTab(id)}
              >
                {id === 'maths' ? t.sectionMaths : t.sectionConj}
              </button>
            ))}
          </nav>
        )}

        {!showConj && (
          <>
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
          </>
        )}

        {/* Règles de conjugaison (§15.3) : la règle en images, les mêmes blocs
            que l'astuce de la séance (qui n'en montre que le cœur), puis la
            règle écrite en entier, repliée, pour qui veut la lire. */}
        {showConj &&
          conjRules.map((rule) => (
            <div key={rule.id} className="rule-card rule-card-conj">
              <div className="rule-card-head">
                <div className="rule-card-badge" aria-hidden>
                  {renderConjHintLine(rule.badge)}
                </div>
                <div className="rule-card-heading">{rule.title}</div>
                <ListenButton onClick={() => speak(conjRuleTtsKey(rule))} label={t.listen} />
              </div>
              <ConjRuleVisual rule={rule} />
              {rule.tip && <div className="rule-card-tip">{rule.tip}</div>}
              <details className="rule-card-details">
                <summary>{t.readFull}</summary>
                <div className="rule-card-lines">
                  {rule.lines.map((line, i) => (
                    <div key={i}>{renderConjHintLine(line)}</div>
                  ))}
                </div>
              </details>
            </div>
          ))}
      </div>
    </div>
  );
}
