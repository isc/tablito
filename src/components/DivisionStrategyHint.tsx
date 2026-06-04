import type { DivisionStrategy } from '../lib/divisionStrategies';
import StrategyHintShell from './StrategyHintShell';

interface DivisionStrategyHintProps {
  strategy: DivisionStrategy;
  variant?: 'feedback' | 'intro';
}

// Variante division : une seule stratégie (« pense à la multiplication »), donc
// pas de pivotLabel ni de rappel — juste l'eyebrow générique en feedback.
export default function DivisionStrategyHint({ strategy, variant = 'feedback' }: DivisionStrategyHintProps) {
  return (
    <StrategyHintShell
      variant={variant}
      title={strategy.title}
      lines={strategy.lines}
      eyebrow="L'astuce"
    />
  );
}
