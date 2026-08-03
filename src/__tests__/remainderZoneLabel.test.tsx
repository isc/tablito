// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import RemainderProgressGrid from '../components/RemainderProgressGrid';
import { createInitialRemainderFacts } from '../lib/remainderFacts';

afterEach(cleanup);

// Zone (divisor, quotient) → index du bouton dans la grille 8×8 (2..9).
function cellIndex(divisor: number, quotient: number): number {
  return (divisor - 2) * 8 + (quotient - 2);
}

function gridWithIntroducedZones() {
  const facts = createInitialRemainderFacts().map((f) => ({ ...f, introduced: true }));
  return render(<RemainderProgressGrid facts={facts} />);
}

describe('Titre d\'une zone de division avec reste', () => {
  it('relie les deux dividendes par « ou » quand la zone en compte deux (÷ 2)', () => {
    const { container } = gridWithIntroducedZones();
    const cells = container.querySelectorAll('.progress-grid-cell');
    fireEvent.click(cells[cellIndex(2, 3)]);
    expect(container.querySelector('.fact-detail-title')?.textContent).toBe('6 ou 7 ÷ 2');
  });

  it('annonce une plage avec « à » au-delà de deux dividendes', () => {
    const { container } = gridWithIntroducedZones();
    const cells = container.querySelectorAll('.progress-grid-cell');
    fireEvent.click(cells[cellIndex(9, 3)]);
    expect(container.querySelector('.fact-detail-title')?.textContent).toBe('27 à 35 ÷ 9');
  });
});
