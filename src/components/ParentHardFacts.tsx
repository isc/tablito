// Liste « À retravailler » de l'espace parent : une ligne par fait, marquée de
// sa nature (×, ÷, reste, conjugaison) pour se lire dans une liste mélangée —
// celle de l'accueil croise les matières, celle d'une page de matière les
// niveaux.

import type { HardFact } from '../lib/hardestFacts';
import { remainderZoneBounds } from '../lib/remainderFacts';
import { useParentDashboardStrings } from '../i18n/parent';

interface HardFactListProps {
  facts: HardFact[];
  // Page de matière : la boîte de chaque fait, que la grille voisine situe.
  // L'accueil s'en tient au nombre d'erreurs.
  showBox?: boolean;
}

export default function HardFactList({ facts, showBox = false }: HardFactListProps) {
  const t = useParentDashboardStrings();

  const marker: Record<HardFact['kind'], { name: string; symbol: string }> = {
    mult: { name: t.factMultiplication, symbol: t.multSymbol },
    div: { name: t.factDivision, symbol: t.divSymbol },
    rem: { name: t.factRemainder, symbol: t.remSymbol },
    conj: { name: t.factConjugation, symbol: t.conjSymbol },
  };
  const label = (f: HardFact): string => {
    switch (f.kind) {
      case 'mult':
        return t.formatMultFact(f.a, f.b, f.product);
      case 'div':
        return t.formatDivFact(f.dividend, f.divisor, f.quotient);
      case 'rem':
        return t.formatRemFact(...remainderZoneBounds(f), f.divisor);
      case 'conj':
        return f.label;
    }
  };

  return (
    <ul className="parent-hard-facts">
      {facts.map((f) => (
        <li key={`${f.kind}-${f.key}`} className="parent-hard-fact">
          <span className={`parent-hard-fact-kind parent-hard-fact-kind--${f.kind}`} aria-label={marker[f.kind].name}>
            {marker[f.kind].symbol}
          </span>
          <span className="parent-hard-fact-name">{label(f)}</span>
          <span className="parent-hard-fact-errors">
            {showBox ? `${t.errors(f.errorCount)} · ${t.boxLabel(f.box)}` : t.errors(f.errorCount)}
          </span>
        </li>
      ))}
    </ul>
  );
}
