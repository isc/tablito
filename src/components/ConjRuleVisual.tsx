import { renderConjHintLine } from './conjHintLine';
import type { ConjRuleBlock, ConjStrategy } from '../lib/conjugationRules';
import type { ConjPerson } from '../types';

interface ConjRuleVisualProps {
  rule: ConjStrategy;
  /**
   * Séance (introduction, correction) : le cœur de la règle seulement, et le
   * tableau des marques resserré pour la carte, plus étroite. L'écran « Mes
   * règles » ajoute les blocs de `rule.more`.
   */
  compact?: boolean;
  /** La personne de la question : sa ligne du tableau des marques s'illumine. */
  person?: ConjPerson;
}

function Block({ block, person }: { block: ConjRuleBlock; person?: ConjPerson }) {
  switch (block.kind) {
    case 'marks':
      return (
        <div className="conj-rule-marks">
          {block.rows.map((row) => (
            <div
              key={row.pronoun}
              className={`conj-rule-mark-row${row.person === person ? ' is-current' : ''}`}
            >
              <span className="conj-rule-pronoun">{row.pronoun}</span>
              <span className="conj-rule-mark">{row.mark}</span>
              <span className="conj-rule-form conj-rule-mark-example">{renderConjHintLine(row.example)}</span>
            </div>
          ))}
        </div>
      );
    case 'steps':
      return (
        <ol className="conj-rule-steps">
          {block.steps.map((step, i) => (
            <li key={i} className="conj-rule-step">
              <span className="conj-rule-step-num" aria-hidden>{i + 1}</span>
              <div>
                <div className="conj-rule-label">{step.label}</div>
                <div className="conj-rule-form conj-rule-form--lg">{renderConjHintLine(step.form)}</div>
              </div>
            </li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div className="conj-rule-group">
          <div className="conj-rule-label">{block.label}</div>
          <div className="conj-rule-table">
            {block.forms.map((form) => (
              <div key={form} className="conj-rule-form">{renderConjHintLine(form)}</div>
            ))}
          </div>
        </div>
      );
    case 'chips':
      return (
        <div className="conj-rule-group">
          <div className="conj-rule-label">{block.label}</div>
          <div className="conj-rule-chips">
            {block.forms.map((form) => (
              <span key={form} className="conj-rule-chip conj-rule-form">{renderConjHintLine(form)}</span>
            ))}
          </div>
        </div>
      );
    case 'note':
      return (
        <div className="conj-rule-note">
          <span className="conj-rule-label">{block.label}</span>
          <span className="conj-rule-form">{renderConjHintLine(block.form)}</span>
        </div>
      );
    case 'spotlight':
      return (
        <div className="conj-rule-spotlight">
          <div className="conj-rule-form conj-rule-form--xl">{renderConjHintLine(block.form)}</div>
          <div className="conj-rule-caption">{block.caption}</div>
        </div>
      );
    case 'columns':
      return (
        <div className="conj-rule-columns">
          {block.columns.map((col) => (
            <div key={col.label} className="conj-rule-group">
              <div className="conj-rule-label">{col.label}</div>
              {col.forms.map((form) => (
                <div key={form} className="conj-rule-form">{renderConjHintLine(form)}</div>
              ))}
            </div>
          ))}
        </div>
      );
  }
}

/**
 * Une règle de conjugaison en images : tableau des marques, recette en étapes,
 * temps conjugué, exceptions — dans les couleurs de la forme segmentée. Partagé
 * par l'écran « Mes règles » et l'astuce de la séance, pour que l'enfant
 * retrouve exactement ce qu'il a vu.
 */
export default function ConjRuleVisual({ rule, compact = false, person }: ConjRuleVisualProps) {
  const blocks = compact ? rule.blocks : [...rule.blocks, ...(rule.more ?? [])];
  return (
    <div className={`conj-rule-visual${compact ? ' conj-rule-visual--compact' : ''}`}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} person={person} />
      ))}
    </div>
  );
}
