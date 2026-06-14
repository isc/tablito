import { useState } from 'react';
import type { MysteryTheme, BoxLevel } from '../types';
import { boxLevelLabel } from '../lib/leitner';
import DotGrid from './DotGrid';
import { useMysteryGridStrings } from '../i18n/progress';

export interface MysteryCell {
  level: number; // 0 = non introduit, 1..5 = boîte Leitner
  introduced: boolean;
  ariaLabel: string;
  detailHeading: string; // « 7 × 8 = 56 » / « 56 ÷ 7 = 8 »
  gridA: number; // DotGrid de l'overlay (rangées)
  gridB: number; // DotGrid de l'overlay (colonnes)
  box: BoxLevel;
}

const HEADERS = [2, 3, 4, 5, 6, 7, 8, 9];

// Les PNG par niveau sont produits par scripts/generate-mystery-levels.mjs et
// servis depuis public/mystery/<theme>/level-{1..5}.png.
const BASE = import.meta.env.BASE_URL;

interface MysteryGridProps {
  theme: MysteryTheme;
  cellFor: (row: number, col: number) => MysteryCell;
}

/**
 * Grille mystère générique (specs §5.1 / §11.5). 8×8 cases ; chaque case affiche
 * une tranche de l'image du thème selon sa boîte Leitner (sprite, background-size
 * 800% + background-position). La multiplication et la division fournissent leur
 * propre mapping case→fait via `cellFor` — d'où aucune duplication de la grille.
 */
export default function MysteryGrid({ theme, cellFor }: MysteryGridProps) {
  const t = useMysteryGridStrings();
  const [selected, setSelected] = useState<MysteryCell | null>(null);

  return (
    <div className="mystery-image-container">
      <div className="mystery-image">
        <div className="mystery-cells">
          {HEADERS.map((row, rowIdx) =>
            HEADERS.map((col, colIdx) => {
              const cell = cellFor(row, col);
              const style =
                cell.level > 0
                  ? {
                      backgroundImage: `url(${BASE}mystery/${theme}/level-${cell.level}.png)`,
                      backgroundSize: '800% 800%',
                      backgroundPosition: `${(colIdx / 7) * 100}% ${(rowIdx / 7) * 100}%`,
                    }
                  : undefined;
              return (
                <button
                  key={`${row}-${col}`}
                  className={`mystery-cell mystery-level-${cell.level}`}
                  style={style}
                  onClick={() => cell.introduced && setSelected(cell)}
                  aria-label={cell.ariaLabel}
                />
              );
            }),
          )}
        </div>
      </div>

      {selected && (
        <div className="mystery-detail-overlay" onClick={() => setSelected(null)}>
          <div className="mystery-detail-card" onClick={(e) => e.stopPropagation()}>
            <h3>{selected.detailHeading}</h3>
            <DotGrid a={selected.gridA} b={selected.gridB} animated={false} size="small" />
            <p className="mystery-detail-box">{boxLevelLabel(selected.box)}</p>
            <button className="mystery-detail-close" onClick={() => setSelected(null)}>
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
