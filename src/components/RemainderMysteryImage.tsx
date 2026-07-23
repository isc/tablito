import { useMemo } from 'react';
import type { RemainderFact, MysteryTheme } from '../types';
import MysteryGrid, { type MysteryCell } from './MysteryGrid';
import { getRemainderFactKey, remainderZoneBounds } from '../lib/remainderFacts';
import { useFactCellStrings } from '../i18n/progress';

interface RemainderMysteryImageProps {
  facts: RemainderFact[];
  theme: MysteryTheme;
}

// Image mystère du niveau 3 : la case (row, col) porte la ZONE (diviseur row,
// quotient col) — les dividendes de row×col à row×(col+1)−1 divisés par row.
// Sans canonicalisation, comme la division (specs §12.6).
export default function RemainderMysteryImage({ facts, theme }: RemainderMysteryImageProps) {
  const t = useFactCellStrings();
  const factMap = useMemo(() => {
    const m = new Map<string, RemainderFact>();
    for (const f of facts) m.set(getRemainderFactKey(f.divisor, f.quotient), f);
    return m;
  }, [facts]);

  const cellFor = (row: number, col: number): MysteryCell => {
    const fact = factMap.get(getRemainderFactKey(row, col));
    const [lo, hi] = remainderZoneBounds({ divisor: row, quotient: col });
    return {
      level: fact?.introduced ? fact.box : 0,
      introduced: fact?.introduced ?? false,
      ariaLabel: t.remLabel(lo, hi, row),
      detailHeading: fact ? `${lo}–${hi} ÷ ${fact.divisor}` : '',
      gridA: fact?.divisor ?? row,
      gridB: fact?.quotient ?? col,
      box: fact?.box ?? 1,
    };
  };

  return <MysteryGrid theme={theme} cellFor={cellFor} />;
}
