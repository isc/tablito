import { useState, useEffect } from 'react';

interface DotGridProps {
  a: number;
  b: number;
  animated?: boolean;
  showRotation?: boolean;
  size?: 'normal' | 'small';
  /** Omet le libellé "a × b" et le résultat "= p" (ils sont alors rendus
   *  à côté de la grille par l'appelant, cf. écran d'intro de fait). */
  bare?: boolean;
  /** Intro division : après le remplissage, sépare les `a` rangées en lots
   *  distincts, en met un en avant, et révèle son compte (= `b`, le quotient =
   *  la réponse de la division). Modèle partitif relié à la table (specs §11.4). */
  groupReveal?: boolean;
}

export default function DotGrid({
  a,
  b,
  animated = true,
  showRotation = false,
  size = 'normal',
  bare = false,
  groupReveal = false,
}: DotGridProps) {
  const [visibleRows, setVisibleRows] = useState(animated ? 0 : a);
  const [showResult, setShowResult] = useState(!animated);
  const [rotated, setRotated] = useState(false);
  // Étapes de la révélation "lots" (division) : regroupement puis comptage.
  const [grouped, setGrouped] = useState(false);
  const [counted, setCounted] = useState(false);

  // Animate rows appearing one by one
  useEffect(() => {
    if (!animated) {
      setVisibleRows(a);
      setShowResult(true);
      return;
    }
    setVisibleRows(0);
    setShowResult(false);
    setRotated(false);
    setGrouped(false);
    setCounted(false);
    let row = 0;
    const interval = setInterval(() => {
      row++;
      setVisibleRows(row);
      if (row >= a) {
        clearInterval(interval);
        // Show result after last row's fade-in animation (400ms)
        setTimeout(() => setShowResult(true), 500);
      }
    }, 600);
    return () => clearInterval(interval);
  }, [a, b, animated]);

  // Trigger rotation after all rows appear
  useEffect(() => {
    if (!showRotation || !showResult) return;
    const timeout = setTimeout(() => {
      setRotated(true);
    }, 800);
    return () => clearTimeout(timeout);
  }, [showRotation, showResult]);

  // Révélation "lots" (division) : une fois la grille remplie, on sépare les
  // rangées en paquets (grouped), puis on met un lot en avant et on dévoile son
  // compte = la réponse (counted).
  useEffect(() => {
    if (!groupReveal || !showResult) return;
    const t1 = setTimeout(() => setGrouped(true), 350);
    const t2 = setTimeout(() => setCounted(true), 1300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [groupReveal, showResult]);

  // Scale dots down for large grids so they don't overflow on mobile
  const maxDim = Math.max(a, b);
  const dotSize = maxDim >= 8 ? 14 : maxDim >= 6 ? 18 : 22;
  const dotGap = maxDim >= 8 ? 5 : maxDim >= 6 ? 8 : 10;

  // When the grid rotates 90°, its visual height becomes its original width.
  // CSS transforms don't reflow layout, so we add vertical margin to avoid
  // overlap with the label above and the result below.
  const rotationMargin =
    rotated && b > a ? ((b - a) * (dotSize + dotGap)) / 2 : 0;

  return (
    <div
      className={`dot-grid-wrapper ${size}`}
      style={{ '--dot-size': `${dotSize}px`, '--dot-gap': `${dotGap}px` } as React.CSSProperties}
    >
      {!bare && (
        <div className="dot-grid-label">
          <span>{rotated ? b : a}</span> {'\u00D7'}{' '}
          <span>{rotated ? a : b}</span>
        </div>
      )}
      <div
        className={`dot-grid ${rotated ? 'rotating' : ''} ${grouped ? 'lots' : ''}`}
        style={rotationMargin ? { margin: `${rotationMargin}px 0` } : undefined}
      >
        {Array.from({ length: a }, (_, rowIndex) => {
          const visible = rowIndex < visibleRows;
          const highlight = grouped && counted && rowIndex === 0;
          return (
            <div
              key={rowIndex}
              className={`dot-grid-row ${!animated ? 'no-animation' : visible ? '' : 'hidden'} ${highlight ? 'lot--highlight' : ''}`}
            >
              {Array.from({ length: b }, (_, colIndex) => (
                <div key={colIndex} className="dot" />
              ))}
              {groupReveal && rowIndex === 0 && (
                <span className={`dot-grid-lot-count ${counted ? 'visible' : ''}`} aria-hidden="true">
                  {b}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {!bare && (
        <div className={`dot-grid-result ${showResult ? 'visible' : ''}`}>
          = <strong>{a * b}</strong>
        </div>
      )}
    </div>
  );
}
