import { useMemo } from 'react';
import type { ConjFact } from '../types';
import LeitnerGrid, { type LeitnerGridCell } from './LeitnerGrid';
import { conjFactDefs, conjGridIndex, resolveConjQuestion } from '../lib/conjugationFacts';

interface ConjProgressGridProps {
  facts: ConjFact[];
}

/**
 * Grille Leitner de la conjugaison pour l'espace parent : 63 faits sur 8×8,
 * sans en-têtes — un fait de conjugaison n'est pas indexé par un couple de
 * nombres, contrairement aux tables (cf. LeitnerGrid `showHeaders`). La 64e
 * case reste vide (non introduite), comme sur l'image mystère : même ordre de
 * cases (l'inventaire), même formule d'indexation (`conjGridIndex`), donc le
 * parent qui regarde la grille et l'enfant qui regarde son image voient la
 * même chose au même endroit.
 */
export default function ConjProgressGrid({ facts }: ConjProgressGridProps) {
  const factMap = useMemo(() => {
    const m = new Map<string, ConjFact>();
    for (const f of facts) m.set(f.key, f);
    return m;
  }, [facts]);

  // Libellés des 63 cases : ils ne dépendent que de l'inventaire, jamais de
  // l'état Leitner — dérivés une fois au montage plutôt qu'à chaque rendu.
  const views = useMemo(() => conjFactDefs().map((def) => resolveConjQuestion(def, 0)), []);

  const cellFor = (row: number, col: number): LeitnerGridCell => {
    const view = views[conjGridIndex(row, col)];
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

  return <LeitnerGrid cellFor={cellFor} showHeaders={false} />;
}
