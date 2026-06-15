import { useMemo } from 'react';
import type { DivisionFact } from '../types';
import LeitnerGrid, { type LeitnerGridCell } from './LeitnerGrid';
import { useFactCellStrings } from '../i18n/progress';

interface DivisionProgressGridProps {
  facts: DivisionFact[];
}

// Grille Leitner de la division : la case (row, col) porte « (row×col) ÷ row »,
// SANS canonicalisation — les cases miroir évoluent indépendamment, fidèle à
// la non-commutativité (specs §11.5). Pas de diagonale particulière.
export default function DivisionProgressGrid({ facts }: DivisionProgressGridProps) {
  const t = useFactCellStrings();
  const factMap = useMemo(() => {
    const m = new Map<string, DivisionFact>();
    for (const f of facts) m.set(`${f.divisor},${f.quotient}`, f);
    return m;
  }, [facts]);

  const cellFor = (row: number, col: number): LeitnerGridCell => {
    const fact = factMap.get(`${row},${col}`);
    const correctCount = fact ? fact.history.filter((h) => h.correct).length : 0;
    return {
      box: fact?.box ?? 1,
      introduced: fact?.introduced ?? false,
      ariaLabel: t.divLabel(row * col, row),
      diagonal: false,
      modal: {
        title: fact ? `${fact.dividend} ÷ ${fact.divisor} = ${fact.quotient}` : '',
        correctCount,
        totalAttempts: fact?.history.length ?? 0,
      },
    };
  };

  return <LeitnerGrid operator="÷" cellFor={cellFor} />;
}
