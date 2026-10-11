import { useMemo } from 'react';
import type { IrrFact } from '../types';
import LeitnerGrid, { type LeitnerGridCell } from './LeitnerGrid';
import { irrGridIndex, irrRecitation, irrVerbDefs } from '../lib/irregularVerbs';

interface IrrProgressGridProps {
  facts: IrrFact[];
}

/**
 * Grille Leitner des verbes irréguliers pour l'espace parent : 64 verbes sur
 * 8×8, sans en-têtes, dans l'ordre de l'inventaire — le même que l'image
 * mystère (cf. ConjProgressGrid), donc le parent et l'enfant voient la même
 * chose au même endroit.
 */
export default function IrrProgressGrid({ facts }: IrrProgressGridProps) {
  const factMap = useMemo(() => new Map(facts.map((f) => [f.key, f])), [facts]);
  const labels = useMemo(() => irrVerbDefs().map((def) => ({ key: def.key, label: irrRecitation(def) })), []);

  const cellFor = (row: number, col: number): LeitnerGridCell => {
    const verb = labels[irrGridIndex(row, col)];
    const fact = verb ? factMap.get(verb.key) : undefined;
    return {
      box: fact?.box ?? 1,
      introduced: fact?.introduced ?? false,
      ariaLabel: verb?.label ?? '',
      diagonal: false,
      modal: {
        title: verb?.label ?? '',
        correctCount: fact ? fact.history.filter((h) => h.correct).length : 0,
        totalAttempts: fact?.history.length ?? 0,
      },
    };
  };

  return <LeitnerGrid cellFor={cellFor} showHeaders={false} />;
}
