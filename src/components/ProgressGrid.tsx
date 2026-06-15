import { useMemo } from 'react';
import type { MultiFact } from '../types';
import LeitnerGrid, { type LeitnerGridCell } from './LeitnerGrid';
import { useFactCellStrings } from '../i18n/progress';

interface ProgressGridProps {
  facts: MultiFact[];
}

// Grille Leitner de la multiplication : la case (row, col) porte le fait
// canonique (min × max) — les cases miroir partagent le même état (§5.1).
export default function ProgressGrid({ facts }: ProgressGridProps) {
  const t = useFactCellStrings();
  const factMap = useMemo(() => {
    const m = new Map<string, MultiFact>();
    for (const f of facts) m.set(`${f.a},${f.b}`, f);
    return m;
  }, [facts]);

  const cellFor = (row: number, col: number): LeitnerGridCell => {
    const a = Math.min(row, col);
    const b = Math.max(row, col);
    const fact = factMap.get(`${a},${b}`);
    const correctCount = fact ? fact.history.filter((h) => h.correct).length : 0;
    return {
      box: fact?.box ?? 1,
      introduced: fact?.introduced ?? false,
      ariaLabel: t.multLabel(row, col, row * col),
      diagonal: row === col,
      modal: {
        title: fact ? `${fact.a} × ${fact.b} = ${fact.product}` : '',
        correctCount,
        totalAttempts: fact?.history.length ?? 0,
      },
    };
  };

  return <LeitnerGrid operator="×" cellFor={cellFor} />;
}
