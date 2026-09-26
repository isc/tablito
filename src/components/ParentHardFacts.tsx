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

  const kindLabel = (f: HardFact) =>
    f.kind === 'conj'
      ? t.factConjugation
      : f.kind === 'rem'
        ? t.factRemainder
        : f.kind === 'div'
          ? t.factDivision
          : t.factMultiplication;
  const symbol = (f: HardFact) =>
    f.kind === 'conj'
      ? t.conjSymbol
      : f.kind === 'rem'
        ? t.remSymbol
        : f.kind === 'div'
          ? t.divSymbol
          : t.multSymbol;
  const label = (f: HardFact) =>
    f.kind === 'conj'
      ? f.label
      : f.kind === 'rem'
        ? t.formatRemFact(...remainderZoneBounds(f), f.divisor)
        : f.kind === 'div'
          ? t.formatDivFact(f.dividend, f.divisor, f.quotient)
          : t.formatMultFact(f.a, f.b, f.product);

  return (
    <ul className="parent-hard-facts">
      {facts.map((f) => (
        <li key={`${f.kind}-${f.key}`} className="parent-hard-fact">
          <span className={`parent-hard-fact-kind parent-hard-fact-kind--${f.kind}`} aria-label={kindLabel(f)}>
            {symbol(f)}
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
