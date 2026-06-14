import type { DivisionStrategy } from '../lib/divisionStrategies';
import StrategyHintShell from './StrategyHintShell';
import { useStrategyHintStrings } from '../i18n/strategies';

interface DivisionStrategyHintProps {
  strategy: DivisionStrategy;
  variant?: 'feedback' | 'intro';
}

// Variante division : une seule stratégie (« pense à la multiplication »), donc
// pas de pivotLabel ni de rappel. L'élément central est l'équation à facteur
// manquant « divisor × ☐ = dividend » : l'enfant retrouve lui-même le facteur,
// geste clé de la relation d'inversion (specs §11.4 ; Van de Walle).
export default function DivisionStrategyHint({ strategy, variant = 'feedback' }: DivisionStrategyHintProps) {
  const t = useStrategyHintStrings();
  const missingFactor = (
    <span className="strategy-hint-pivot">
      {strategy.divisor} × <span className="strategy-hint-box" aria-label={t.missingFactorAria}>?</span> ={' '}
      {strategy.dividend}
    </span>
  );

  return (
    <StrategyHintShell
      variant={variant}
      title={strategy.title}
      lines={[strategy.intro, missingFactor, strategy.conclusion]}
      eyebrow={t.eyebrowDiv}
    />
  );
}
