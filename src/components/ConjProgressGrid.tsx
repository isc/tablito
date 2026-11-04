import { useMemo } from 'react';
import type { ConjFact, ConjLevel } from '../types';
import LeitnerGrid, { type LeitnerGridCell } from './LeitnerGrid';
import { conjGrid } from '../lib/conjugationFacts';

interface ConjProgressGridProps {
  facts: ConjFact[];
  level?: ConjLevel;
}

/**
 * Grille Leitner d'un niveau de la conjugaison pour l'espace parent, sans
 * en-têtes — un fait de conjugaison n'est pas indexé par un couple de nombres,
 * contrairement aux tables (cf. LeitnerGrid `size`). Les cases au-delà des faits
 * restent vides (non introduites), comme sur l'image mystère : même `conjGrid`,
 * donc le parent qui regarde la grille et l'enfant qui regarde son image voient
 * la même chose au même endroit.
 */
export default function ConjProgressGrid({ facts, level = 1 }: ConjProgressGridProps) {
  const factMap = useMemo(() => {
    const m = new Map<string, ConjFact>();
    for (const f of facts) m.set(f.key, f);
    return m;
  }, [facts]);

  // Libellés des cases : ils ne dépendent que de l'inventaire, jamais de
  // l'état Leitner — dérivés une fois au montage plutôt qu'à chaque rendu.
  const grid = useMemo(() => conjGrid(level), [level]);

  const cellFor = (row: number, col: number): LeitnerGridCell => {
    const view = grid.viewAt(row, col);
    if (!view) {
      return {
        box: 1,
        introduced: false,
        ariaLabel: '',
        diagonal: false,
        modal: { title: '', correctCount: 0, totalAttempts: 0 },
      };
    }
    const fact = factMap.get(view.def.key);
    return {
      box: fact?.box ?? 1,
      introduced: fact?.introduced ?? false,
      ariaLabel: view.label,
      diagonal: false,
      modal: {
        title: view.label,
        correctCount: fact ? fact.history.filter((h) => h.correct).length : 0,
        totalAttempts: fact?.history.length ?? 0,
      },
    };
  };

  return <LeitnerGrid cellFor={cellFor} size={grid.size} />;
}
