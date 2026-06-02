import { useState, useMemo } from 'react';
import type { DivisionFact, MysteryTheme } from '../types';
import DotGrid from './DotGrid';

interface DivisionMysteryImageProps {
  facts: DivisionFact[];
  theme: MysteryTheme;
}

// 0 = non introduit, 1..5 = boîte Leitner (1 = silhouette, 5 = détail complet)
function getLevel(fact: DivisionFact | undefined): number {
  if (!fact || !fact.introduced) return 0;
  return fact.box;
}

const HEADERS = [2, 3, 4, 5, 6, 7, 8, 9];
const BASE = import.meta.env.BASE_URL;

/**
 * Image mystère de la division (specs §11.5). Même grille 8×8 que la
 * multiplication, MÊME mécanique de sprite, mais :
 *   - la cellule (row=divisor, col=quotient) porte le fait dividend÷divisor ;
 *   - AUCUNE canonicalisation min/max → les cases miroir (7,8)=56÷7 et
 *     (8,7)=56÷8 évoluent indépendamment, fidèle à la non-commutativité.
 * Bijection : 64 cases ↔ 64 faits.
 */
export default function DivisionMysteryImage({ facts, theme }: DivisionMysteryImageProps) {
  const [selectedFact, setSelectedFact] = useState<DivisionFact | null>(null);

  const factMap = useMemo(() => {
    const m = new Map<string, DivisionFact>();
    for (const f of facts) m.set(`${f.divisor},${f.quotient}`, f);
    return m;
  }, [facts]);

  return (
    <div className="mystery-image-container">
      <div className="mystery-image">
        <div className="mystery-cells">
          {HEADERS.map((row, rowIdx) =>
            HEADERS.map((col, colIdx) => {
              const fact = factMap.get(`${row},${col}`);
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
                  aria-label={`${row * col} divisé par ${row}`}
                />
              );
            }),
          )}
        </div>
      </div>

      {selectedFact && (
        <div className="mystery-detail-overlay" onClick={() => setSelectedFact(null)}>
          <div className="mystery-detail-card" onClick={(e) => e.stopPropagation()}>
            <h3>
              {selectedFact.dividend} {'÷'} {selectedFact.divisor} = {selectedFact.quotient}
            </h3>
            <DotGrid
              a={selectedFact.divisor}
              b={selectedFact.quotient}
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
            <button className="mystery-detail-close" onClick={() => setSelectedFact(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
