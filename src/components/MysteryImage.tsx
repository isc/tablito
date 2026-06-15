import { useMemo } from 'react';
import type { MultiFact, MysteryTheme } from '../types';
import MysteryGrid, { type MysteryCell } from './MysteryGrid';
import { useFactCellStrings } from '../i18n/progress';

interface MysteryImageProps {
  facts: MultiFact[];
  theme: MysteryTheme;
}

// Image mystère de la multiplication : la case (row, col) porte le fait
// canonique (min × max) — les cases miroir se révèlent en synchrone (§5.1).
export default function MysteryImage({ facts, theme }: MysteryImageProps) {
  const t = useFactCellStrings();
  const factMap = useMemo(() => {
    const m = new Map<string, MultiFact>();
    for (const f of facts) m.set(`${f.a},${f.b}`, f);
    return m;
  }, [facts]);

  const cellFor = (row: number, col: number): MysteryCell => {
    const a = Math.min(row, col);
    const b = Math.max(row, col);
    const fact = factMap.get(`${a},${b}`);
    return {
      level: fact?.introduced ? fact.box : 0,
      introduced: fact?.introduced ?? false,
      ariaLabel: t.multLabel(row, col, row * col),
      detailHeading: fact ? `${fact.a} × ${fact.b} = ${fact.product}` : '',
      gridA: fact?.a ?? a,
      gridB: fact?.b ?? b,
      box: fact?.box ?? 1,
    };
  };

  return <MysteryGrid theme={theme} cellFor={cellFor} />;
}
