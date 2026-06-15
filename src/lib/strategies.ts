// Stratégies de dérivation par fait — voir specs §3.4bis et audit §4.

export type StrategyKind =
  | 'near-ten'           // ×9 : n×10 − n
  | 'skip-count'         // ×5 : compter par 5
  | 'double-add'         // ×3 : n×2 + n
  | 'double-double'      // ×4 : (n×2) × 2
  | 'five-plus-one'      // ×6 : n×5 + n
  | 'five-plus-two'      // ×7 : n×5 + n×2
  | 'double-double-double'; // ×8 : ((n×2)×2)×2

export interface Strategy {
  kind: StrategyKind;
  /** Phrase courte expliquant l'astuce (ex : « × 9, c'est × 10 moins une fois »). */
  title: string;
  /** Étapes de calcul, une par ligne, à afficher en colonne. */
  lines: string[];
}

import { getStrategyTemplates } from '../i18n/strategies';

/**
 * Retourne une stratégie de dérivation adaptée au fait (a, b), ou null
 * si aucune stratégie n'est plus parlante que la grille / l'addition répétée.
 *
 * Faits de base exclus (table de 2, 3 × 3) : la grille animée et
 * l'addition répétée sont déjà la meilleure introduction.
 */
export function getStrategy(a: number, b: number): Strategy | null {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);

  if (lo === 2) return null;
  if (lo === hi && lo === 3) return null;

  for (const [pivot, template] of getStrategyTemplates()) {
    if (lo === pivot || hi === pivot) {
      const other = pivot === lo ? hi : lo;
      return {
        kind: template.kind,
        title: template.title,
        lines: template.lines(other, pivot * other),
      };
    }
  }
  return null;
}

export function hasStrategy(a: number, b: number): boolean {
  return getStrategy(a, b) !== null;
}
