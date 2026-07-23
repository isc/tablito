import { useMemo } from 'react';
import type { RemainderFact } from '../types';
import LeitnerGrid, { type LeitnerGridCell } from './LeitnerGrid';
import { getRemainderFactKey, remainderZoneBounds } from '../lib/remainderFacts';
import { useFactCellStrings } from '../i18n/progress';

interface RemainderProgressGridProps {
  facts: RemainderFact[];
}

// Grille Leitner du niveau 3 : la case (row, col) porte la zone (diviseur row,
// quotient col) — cf. RemainderMysteryImage. Pas de diagonale particulière.
export default function RemainderProgressGrid({ facts }: RemainderProgressGridProps) {
  const t = useFactCellStrings();
  const factMap = useMemo(() => {
    const m = new Map<string, RemainderFact>();
    for (const f of facts) m.set(getRemainderFactKey(f.divisor, f.quotient), f);
    return m;
  }, [facts]);

  const cellFor = (row: number, col: number): LeitnerGridCell => {
    const fact = factMap.get(getRemainderFactKey(row, col));
    const correctCount = fact ? fact.history.filter((h) => h.correct).length : 0;
    const [lo, hi] = remainderZoneBounds({ divisor: row, quotient: col });
    return {
      box: fact?.box ?? 1,
      introduced: fact?.introduced ?? false,
      ariaLabel: t.remLabel(lo, hi, row),
      diagonal: false,
      modal: {
        title: fact ? `${lo}–${hi} ÷ ${fact.divisor}` : '',
        correctCount,
        totalAttempts: fact?.history.length ?? 0,
      },
    };
  };

  return <LeitnerGrid operator="÷" cellFor={cellFor} />;
}
