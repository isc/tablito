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
}

export default function DotGrid({
  a,
  b,
  animated = true,
  showRotation = false,
  size = 'normal',
  bare = false,
}: DotGridProps) {
  const [visibleRows, setVisibleRows] = useState(animated ? 0 : a);
  const [showResult, setShowResult] = useState(!animated);
  const [rotated, setRotated] = useState(false);

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
        className={`dot-grid ${rotated ? 'rotating' : ''}`}
        style={rotationMargin ? { margin: `${rotationMargin}px 0` } : undefined}
      >
        {Array.from({ length: a }, (_, rowIndex) => {
          const visible = rowIndex < visibleRows;
          return (
            <div
              key={rowIndex}
              className={`dot-grid-row ${!animated ? 'no-animation' : visible ? '' : 'hidden'}`}
            >
              {Array.from({ length: b }, (_, colIndex) => (
                <div key={colIndex} className="dot" />
              ))}
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
