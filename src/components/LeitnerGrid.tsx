import { useState, Fragment } from 'react';
import type { BoxLevel } from '../types';
import Modal from './Modal';

export interface LeitnerGridCell {
  box: BoxLevel;
  introduced: boolean;
  ariaLabel: string;
  // Visuellement marquée (border) : carrés de la multiplication. Toujours false
  // pour la division (pas de diagonale particulière).
  diagonal: boolean;
  // Contenu de la modale au tap sur une case introduite.
  modal: {
    title: string;
    correctCount: number;
    totalAttempts: number;
  };
}

interface LeitnerGridProps {
  // Symbole affiché dans le coin haut-gauche de la grille (× ou ÷).
  operator: string;
  cellFor: (row: number, col: number) => LeitnerGridCell;
}

const HEADERS = [2, 3, 4, 5, 6, 7, 8, 9];

function getBoxClass(cell: LeitnerGridCell): string {
  return cell.introduced ? `box-${cell.box}` : 'box-0';
}

/**
 * Grille Leitner générique (8×8) pour l'espace parent (specs §5.1 / §11.5).
 * Chaque case est colorée selon sa boîte et ouvre une modale. La multiplication
 * et la division fournissent leur propre mapping case→fait via `cellFor` —
 * pas de duplication de la grille (cf. dédup MysteryGrid).
 */
export default function LeitnerGrid({ operator, cellFor }: LeitnerGridProps) {
  const [selected, setSelected] = useState<LeitnerGridCell | null>(null);

  return (
    <div className="progress-grid-container">
      <div className="progress-grid">
        <div className="progress-grid-header progress-grid-corner">{operator}</div>

        {HEADERS.map((h) => (
          <div key={`col-${h}`} className="progress-grid-header">
            {h}
          </div>
        ))}

        {HEADERS.map((row) => (
          <Fragment key={row}>
            <div className="progress-grid-header">{row}</div>
            {HEADERS.map((col) => {
              const cell = cellFor(row, col);
              return (
                <button
                  key={`${row}-${col}`}
                  className={`progress-grid-cell ${getBoxClass(cell)} ${cell.diagonal ? 'diagonal' : ''}`}
                  onClick={() => cell.introduced && setSelected(cell)}
                  aria-label={cell.ariaLabel}
                />
              );
            })}
          </Fragment>
        ))}
      </div>

      {selected && (
        <Modal onClose={() => setSelected(null)} className="fact-detail">
          <h3 className="fact-detail-title">{selected.modal.title}</h3>
          <p className="fact-detail-line">
            Niveau :{' '}
            {selected.box === 1
              ? 'En apprentissage'
              : selected.box === 5
                ? 'Maîtrisé !'
                : `Boîte ${selected.box}/5`}
          </p>
          <p className="fact-detail-line">
            {selected.modal.totalAttempts > 0
              ? `${selected.modal.correctCount}/${selected.modal.totalAttempts} bonnes réponses`
              : 'Pas encore pratiqué'}
          </p>
          <button className="modal-close-btn" onClick={() => setSelected(null)}>
            Fermer
          </button>
        </Modal>
      )}
    </div>
  );
}
