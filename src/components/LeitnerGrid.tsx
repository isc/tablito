import { useState, Fragment } from 'react';
import type { BoxLevel } from '../types';
import Modal from './Modal';
import { useBoxLevelStrings, useLeitnerGridStrings } from '../i18n/progress';

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
  // Symbole affiché dans le coin haut-gauche de la grille (× ou ÷). Inutile
  // quand la grille est sans en-têtes.
  operator?: string;
  cellFor: (row: number, col: number) => LeitnerGridCell;
  /**
   * Grille SANS en-têtes de ligne/colonne : les 64 cases ne sont alors qu'un
   * rang (matière conjugaison — un fait n'y est pas indexé par un couple de
   * nombres). `cellFor` reçoit dans ce cas des indices 0..7, dans l'ordre de
   * lecture, exactement comme l'image mystère de la matière.
   */
  showHeaders?: boolean;
}

const HEADERS = [2, 3, 4, 5, 6, 7, 8, 9];
const PLAIN = [0, 1, 2, 3, 4, 5, 6, 7];

function getBoxClass(cell: LeitnerGridCell): string {
  return cell.introduced ? `box-${cell.box}` : 'box-0';
}

/**
 * Grille Leitner générique (8×8) pour l'espace parent (specs §5.1 / §11.5).
 * Chaque case est colorée selon sa boîte et ouvre une modale. La multiplication
 * et la division fournissent leur propre mapping case→fait via `cellFor` —
 * pas de duplication de la grille (cf. dédup MysteryGrid).
 */
export default function LeitnerGrid({ operator, cellFor, showHeaders = true }: LeitnerGridProps) {
  const t = useLeitnerGridStrings();
  const boxLevel = useBoxLevelStrings();
  const [selected, setSelected] = useState<LeitnerGridCell | null>(null);
  const values = showHeaders ? HEADERS : PLAIN;

  return (
    <div className="progress-grid-container">
      <div className={`progress-grid${showHeaders ? '' : ' progress-grid--plain'}`}>
        {showHeaders && (
          <>
            <div className="progress-grid-header progress-grid-corner">{operator}</div>
            {HEADERS.map((h) => (
              <div key={`col-${h}`} className="progress-grid-header">
                {h}
              </div>
            ))}
          </>
        )}

        {values.map((row) => (
          <Fragment key={row}>
            {showHeaders && <div className="progress-grid-header">{row}</div>}
            {values.map((col) => {
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
          <p className="fact-detail-line">{t.level(boxLevel.label(selected.box))}</p>
          <p className="fact-detail-line">
            {selected.modal.totalAttempts > 0
              ? t.correctAnswers(selected.modal.correctCount, selected.modal.totalAttempts)
              : t.notPracticedYet}
          </p>
          <button className="modal-close-btn" onClick={() => setSelected(null)}>
            {t.close}
          </button>
        </Modal>
      )}
    </div>
  );
}
