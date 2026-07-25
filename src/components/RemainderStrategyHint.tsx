import type { RemainderStrategy } from '../lib/remainderStrategies';
import StrategyHintShell from './StrategyHintShell';
import { useStrategyHintStrings } from '../i18n/strategies';

interface RemainderStrategyHintProps {
  strategy: RemainderStrategy;
  variant?: 'feedback' | 'intro';
}

// Variante niveau 3 : une seule stratégie (« cherche le multiple juste en
// dessous »). L'élément central est l'équation à ENCADREMENT
// « divisor × ☐ ≤ dividend » (specs §12.4) — prolongement de l'équation à
// facteur manquant de la division : l'enfant cherche le plus grand facteur
// qui tient sans dépasser, le reste étant l'écart.
export default function RemainderStrategyHint({
  strategy,
  variant = 'feedback',
}: RemainderStrategyHintProps) {
  const t = useStrategyHintStrings();
  const bounding = (
    <span className="strategy-hint-pivot">
      {strategy.divisor} × <span className="strategy-hint-box" aria-label={t.missingFactorAria}>?</span>{' '}
      {'≤'} {strategy.dividend}
    </span>
  );

  return (
    <StrategyHintShell
      variant={variant}
      title={strategy.title}
      lines={[strategy.intro, bounding, strategy.conclusion]}
      eyebrow={t.eyebrowDiv}
    />
  );
}
