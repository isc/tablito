import type { Strategy } from '../lib/strategies';
import StrategyHintShell from './StrategyHintShell';

interface StrategyHintProps {
  strategy: Strategy;
  variant?: 'feedback' | 'intro';
}

// Nom lisible du pivot pour l'eyebrow de la carte feedback.
const PIVOT_LABEL = {
  'near-ten': '×9',
  'skip-count': '×5',
  'double-add': '×3',
  'double-double': '×4',
  'five-plus-one': '×6',
  'five-plus-two': '×7',
  'double-double-double': '×8',
} as const;

const TEN_RECALL =
  "Rappel : pour × 10, les chiffres glissent d'une place vers la gauche et un 0 prend la place des unités.";

export default function StrategyHint({ strategy, variant = 'feedback' }: StrategyHintProps) {
  return (
    <StrategyHintShell
      variant={variant}
      title={strategy.title}
      lines={strategy.lines}
      eyebrow={`L'astuce du ${PIVOT_LABEL[strategy.kind]}`}
      recall={variant === 'intro' && strategy.kind === 'near-ten' ? TEN_RECALL : undefined}
    />
  );
}
