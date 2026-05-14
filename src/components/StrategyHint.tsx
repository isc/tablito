import type { Strategy } from '../lib/strategies';

interface StrategyHintProps {
  strategy: Strategy;
  variant?: 'feedback' | 'intro';
}

function BulbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2 L 12 5 M 5 7 L 7 9 M 19 7 L 17 9 M 8 14 C 8 10, 16 10, 16 14 L 15 18 L 9 18 Z M 10 20 L 14 20"
        stroke="var(--ink)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function StrategyHint({ strategy, variant = 'feedback' }: StrategyHintProps) {
  const showTenRecall = variant === 'intro' && strategy.kind === 'near-ten';

  // Nom lisible du pivot (×9, ×5, ×3, ×4, ×6, ×7, ×8) pour l'eyebrow
  const pivotLabel = ({
    'near-ten': '×9',
    'skip-count': '×5',
    'double-add': '×3',
    'double-double': '×4',
    'five-plus-one': '×6',
    'five-plus-two': '×7',
    'double-double-double': '×8',
  } as const)[strategy.kind];

  if (variant === 'intro') {
    return (
      <div className="strategy-hint intro">
        <div className="strategy-hint-head">
          <div className="strategy-hint-icon" aria-hidden>
            <BulbIcon />
          </div>
          <div className="strategy-hint-title">{strategy.title}</div>
        </div>
        <div className="strategy-hint-lines">
          {strategy.lines.map((line, i) => (
            <div key={i} className="strategy-hint-line">{line}</div>
          ))}
        </div>
        {showTenRecall && (
          <div className="strategy-hint-recall">
            Rappel : pour {'×'} 10, les chiffres glissent d'une place vers la
            gauche et un 0 prend la place des unités.
          </div>
        )}
      </div>
    );
  }

  // feedback variant (carte honey utilisée en overlay d'erreur)
  return (
    <div className="strategy-hint feedback">
      <div className="strategy-hint-eyebrow">L'astuce du {pivotLabel}</div>
      <div className="strategy-hint-body">{strategy.title}</div>
      <div className="strategy-hint-lines">
        {strategy.lines.map((line, i) => (
          <div key={i} className="strategy-hint-line">{line}</div>
        ))}
      </div>
    </div>
  );
}
