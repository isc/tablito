import { useMemo } from 'react';
import type { ConjFact } from '../types';
import LeitnerGrid, { type LeitnerGridCell } from './LeitnerGrid';
import { CONJ_FACT_DEFS, conjSubject, resolveConjQuestion } from '../lib/conjugationFacts';

interface ConjProgressGridProps {
  facts: ConjFact[];
}

// Même ordre de cases que l'image mystère de la matière (l'inventaire) : le
// parent qui regarde la grille et l'enfant qui regarde son image voient la
// même chose au même endroit.
const ORDERED = CONJ_FACT_DEFS;

/**
 * Grille Leitner de la conjugaison pour l'espace parent : 63 faits sur 8×8,
 * sans en-têtes — un fait de conjugaison n'est pas indexé par un couple de
 * nombres, contrairement aux tables (cf. LeitnerGrid `showHeaders`). La 64e
 * case reste vide (non introduite), comme sur l'image mystère.
 */
export default function ConjProgressGrid({ facts }: ConjProgressGridProps) {
  const factMap = useMemo(() => {
    const m = new Map<string, ConjFact>();
    for (const f of facts) m.set(f.key, f);
    return m;
  }, [facts]);

  const cellFor = (row: number, col: number): LeitnerGridCell => {
    const index = row * 8 + col;
    const def = ORDERED[index];
    if (!def) {
      return {
        box: 1,
        introduced: false,
        ariaLabel: '',
        diagonal: false,
        modal: { title: '', correctCount: 0, totalAttempts: 0 },
      };
    }
    const fact = factMap.get(def.key);
    const view = resolveConjQuestion(def, 0);
    const label = `${conjSubject(view.person, view.form)}${view.form}`;
    return {
      box: fact?.box ?? 1,
      introduced: fact?.introduced ?? false,
      ariaLabel: label,
      diagonal: false,
      modal: {
        title: label,
        correctCount: fact ? fact.history.filter((h) => h.correct).length : 0,
        totalAttempts: fact?.history.length ?? 0,
      },
    };
  };

  return <LeitnerGrid cellFor={cellFor} showHeaders={false} />;
}
