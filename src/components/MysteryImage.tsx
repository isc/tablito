import { useState, useMemo } from 'react';
import type { MultiFact, MysteryTheme } from '../types';
import DotGrid from './DotGrid';
import './MysteryImage.css';

interface MysteryImageProps {
  facts: MultiFact[];
  theme: MysteryTheme;
}

// 0 = not introduced, 1..5 = Leitner box (1 = silhouette, 5 = détail complet)
function getLevel(fact: MultiFact | undefined): number {
  if (!fact || !fact.introduced) return 0;
  return fact.box;
}

const HEADERS = [2, 3, 4, 5, 6, 7, 8, 9];

// Les PNG par niveau sont produits par scripts/generate-mystery-levels.mjs
// et servis depuis public/mystery/<theme>/level-{1..5}.png.
const BASE = import.meta.env.BASE_URL;

export default function MysteryImage({ facts, theme }: MysteryImageProps) {
  const [selectedFact, setSelectedFact] = useState<MultiFact | null>(null);

  const factMap = useMemo(() => {
    const m = new Map<string, MultiFact>();
    for (const f of facts) m.set(`${f.a},${f.b}`, f);
    return m;
  }, [facts]);

  return (
    <div className="mystery-image-container">
      <div className="mystery-image">
        {/* Chaque cellule affiche la tranche (col, row) de la variante de
            finesse correspondant à sa boîte Leitner, via background-size
            800% + background-position en sprite. */}
        <div className="mystery-cells">
          {HEADERS.map((row, rowIdx) =>
            HEADERS.map((col, colIdx) => {
              const a = Math.min(row, col);
              const b = Math.max(row, col);
              const fact = factMap.get(`${a},${b}`);
              const level = getLevel(fact);
              const introduced = fact?.introduced ?? false;

              const style =
                level > 0
                  ? {
                      backgroundImage: `url(${BASE}mystery/${theme}/level-${level}.png)`,
                      backgroundSize: '800% 800%',
                      backgroundPosition: `${(colIdx / 7) * 100}% ${(rowIdx / 7) * 100}%`,
                    }
                  : undefined;

              return (
                <button
                  key={`${row}-${col}`}
                  className={`mystery-cell mystery-level-${level}`}
                  style={style}
                  onClick={() => introduced && fact && setSelectedFact(fact)}
                  aria-label={`${row} fois ${col} = ${row * col}`}
                />
              );
            }),
          )}
        </div>
      </div>

      {selectedFact && (
        <div
          className="mystery-detail-overlay"
          onClick={() => setSelectedFact(null)}
        >
          <div
            className="mystery-detail-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>
              {selectedFact.a} {'\u00D7'} {selectedFact.b} ={' '}
              {selectedFact.product}
            </h3>
            <DotGrid
              a={selectedFact.a}
              b={selectedFact.b}
              animated={false}
              size="small"
            />
            <p className="mystery-detail-box">
              {selectedFact.box === 5
                ? 'Maîtrisé !'
                : selectedFact.box === 1
                  ? 'En apprentissage'
                  : `Boîte ${selectedFact.box}/5`}
            </p>
            <button
              className="mystery-detail-close"
              onClick={() => setSelectedFact(null)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
