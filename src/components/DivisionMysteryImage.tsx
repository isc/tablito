import { useMemo } from 'react';
import type { DivisionFact, MysteryTheme } from '../types';
import MysteryGrid, { type MysteryCell } from './MysteryGrid';
import { useFactCellStrings } from '../i18n/progress';

interface DivisionMysteryImageProps {
  facts: DivisionFact[];
  theme: MysteryTheme;
}

// Image mystère de la division : la case (row, col) porte « (row×col) ÷ row »,
// SANS canonicalisation — les cases miroir évoluent indépendamment, fidèle à la
// non-commutativité (specs §11.5).
export default function DivisionMysteryImage({ facts, theme }: DivisionMysteryImageProps) {
  const t = useFactCellStrings();
  const factMap = useMemo(() => {
    const m = new Map<string, DivisionFact>();
    for (const f of facts) m.set(`${f.divisor},${f.quotient}`, f);
    return m;
  }, [facts]);

  const cellFor = (row: number, col: number): MysteryCell => {
    const fact = factMap.get(`${row},${col}`);
    return {
      level: fact?.introduced ? fact.box : 0,
      introduced: fact?.introduced ?? false,
      ariaLabel: t.divLabel(row * col, row),
      detailHeading: fact ? `${fact.dividend} ÷ ${fact.divisor} = ${fact.quotient}` : '',
      gridA: fact?.divisor ?? row,
      gridB: fact?.quotient ?? col,
      box: fact?.box ?? 1,
    };
  };

  return <MysteryGrid theme={theme} cellFor={cellFor} />;
}
