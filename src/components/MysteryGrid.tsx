import { useState, type CSSProperties, type ReactNode } from 'react';
import type { MysteryTheme, BoxLevel } from '../types';
import DotGrid from './DotGrid';
import { useBoxLevelStrings, useMysteryGridStrings } from '../i18n/progress';

export interface MysteryCell {
  level: number; // 0 = non introduit, 1..5 = boîte Leitner
  introduced: boolean;
  ariaLabel: string;
  detailHeading: string; // « 7 × 8 = 56 » / « 56 ÷ 7 = 8 » / « nous chantons »
  // Corps de l'overlay de détail. Les matières mathématiques laissent le défaut
  // (la grille de points a×b) en fournissant gridA/gridB ; la conjugaison, où
  // « 8 rangées de 6 points » ne veut rien dire, fournit son propre corps
  // (la forme segmentée radical|terminaison) via `detailBody`.
  gridA?: number;
  gridB?: number;
  detailBody?: ReactNode;
  box: BoxLevel;
}

const HEADERS = [2, 3, 4, 5, 6, 7, 8, 9];

// Les PNG par niveau sont produits par scripts/generate-mystery-levels.mjs et
// servis depuis public/mystery/<theme>/level-{1..5}.png.
const BASE = import.meta.env.BASE_URL;

interface MysteryGridProps {
  theme: MysteryTheme;
  cellFor: (row: number, col: number) => MysteryCell;
  /**
   * Dit dans quel repère `cellFor` reçoit sa case. Absent : les valeurs des
   * tables, 2..9 — la case EST le fait (a × b). Présent : le côté de la grille,
   * et des indices à partir de 0 en ordre de lecture, pour une matière dont les
   * faits ne sont pas indexés par un couple de nombres (la conjugaison). Même
   * contrat que LeitnerGrid, à dessein : les deux grilles d'une même matière
   * doivent numéroter leurs cases pareil.
   */
  size?: number;
}

/**
 * Grille mystère générique (specs §5.1 / §11.5). 8×8 cases par défaut ; chaque
 * case affiche une tranche de l'image du thème selon sa boîte Leitner (sprite,
 * background-size + background-position). La multiplication et la division
 * fournissent leur propre mapping case→fait via `cellFor` — d'où aucune
 * duplication de la grille.
 */
export default function MysteryGrid({ theme, cellFor, size }: MysteryGridProps) {
  const t = useMysteryGridStrings();
  const boxLevel = useBoxLevelStrings();
  const [selected, setSelected] = useState<MysteryCell | null>(null);
  const values = size === undefined ? HEADERS : Array.from({ length: size }, (_, i) => i);
  const side = values.length;
  const last = side - 1;

  return (
    <div className="mystery-image-container">
      <div className="mystery-image">
        <div className="mystery-cells" style={{ '--mystery-size': side } as CSSProperties}>
          {values.map((row, rowIdx) =>
            values.map((col, colIdx) => {
              const cell = cellFor(row, col);
              const style =
                cell.level > 0
                  ? {
                      backgroundImage: `url(${BASE}mystery/${theme}/level-${cell.level}.png)`,
                      backgroundSize: `${side * 100}% ${side * 100}%`,
                      backgroundPosition: `${(colIdx / last) * 100}% ${(rowIdx / last) * 100}%`,
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
            {selected.detailBody ??
              (selected.gridA !== undefined && selected.gridB !== undefined ? (
                <DotGrid a={selected.gridA} b={selected.gridB} animated={false} size="small" />
              ) : null)}
            <p className="mystery-detail-box">{boxLevel.label(selected.box)}</p>
            <button className="mystery-detail-close" onClick={() => setSelected(null)}>
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
