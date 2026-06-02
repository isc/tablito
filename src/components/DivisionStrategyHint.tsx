import type { DivisionStrategy } from '../lib/divisionStrategies';

interface DivisionStrategyHintProps {
  strategy: DivisionStrategy;
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

/**
 * Variante division de StrategyHint. Réutilise les mêmes classes CSS, mais
 * sans `kind`/pivotLabel (la division n'a qu'une stratégie, cf.
 * lib/divisionStrategies.ts).
 */
export default function DivisionStrategyHint({
  strategy,
  variant = 'feedback',
}: DivisionStrategyHintProps) {
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
      </div>
    );
  }

  return (
    <div className="strategy-hint feedback">
      <div className="strategy-hint-eyebrow">L'astuce</div>
      <div className="strategy-hint-body">{strategy.title}</div>
      <div className="strategy-hint-lines">
        {strategy.lines.map((line, i) => (
          <div key={i} className="strategy-hint-line">{line}</div>
        ))}
      </div>
    </div>
  );
}
