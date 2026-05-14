import { useState, useMemo, Fragment } from 'react';
import type { MultiFact } from '../types';

interface ProgressGridProps {
  facts: MultiFact[];
}

function getBoxClass(fact: MultiFact | undefined): string {
  if (!fact || !fact.introduced) return 'box-0';
  return `box-${fact.box}`;
}

export default function ProgressGrid({ facts }: ProgressGridProps) {
  const [selectedFact, setSelectedFact] = useState<MultiFact | null>(null);
  const headers = [2, 3, 4, 5, 6, 7, 8, 9];

  const factMap = useMemo(() => {
    const m = new Map<string, MultiFact>();
    for (const f of facts) m.set(`${f.a},${f.b}`, f);
    return m;
  }, [facts]);

  return (
    <div className="progress-grid-container">
      <div className="progress-grid">
        <div className="progress-grid-header progress-grid-corner">{'\u00D7'}</div>

        {headers.map((h) => (
          <div key={`col-${h}`} className="progress-grid-header">
            {h}
          </div>
        ))}

        {headers.map((row) => (
          <Fragment key={row}>
            <div className="progress-grid-header">
              {row}
            </div>

            {headers.map((col) => {
              const a = Math.min(row, col);
              const b = Math.max(row, col);
              const fact = factMap.get(`${a},${b}`);
              const boxClass = getBoxClass(fact);
              const isDiagonal = row === col;

              return (
                <button
                  key={`${row}-${col}`}
                  className={`progress-grid-cell ${boxClass} ${isDiagonal ? 'diagonal' : ''}`}
                  onClick={() => fact && fact.introduced && setSelectedFact(fact)}
                  aria-label={`${row} fois ${col} = ${row * col}`}
                />
              );
            })}
          </Fragment>
        ))}
      </div>

      {selectedFact && (
        <div
          className="fact-detail-overlay"
          onClick={() => setSelectedFact(null)}
        >
          <div
            className="fact-detail-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>
              {selectedFact.a} {'\u00D7'} {selectedFact.b} = {selectedFact.product}
            </h3>
            <p>
              Niveau :{' '}
              {selectedFact.box === 1
                ? 'En apprentissage'
                : selectedFact.box === 5
                  ? 'Maîtrisé !'
                  : `Boîte ${selectedFact.box}/5`}
            </p>
            <p>
              {selectedFact.history.length > 0
                ? `${selectedFact.history.filter((h) => h.correct).length}/${selectedFact.history.length} bonnes réponses`
                : 'Pas encore pratiqué'}
            </p>
            <button
              className="fact-detail-close"
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
