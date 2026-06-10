// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import DotGrid from '../components/DotGrid';

afterEach(cleanup);

describe('DotGrid — révélation "lots" (intro division)', () => {
  it('affiche le compte d\'un lot (= b, le quotient) quand groupReveal', () => {
    // 12 ÷ 6 : 6 lots de 2 → le badge de compte porte 2.
    const { container } = render(<DotGrid a={6} b={2} animated={false} bare groupReveal />);
    const count = container.querySelector('.dot-grid-lot-count');
    expect(count).toBeTruthy();
    expect(count?.textContent).toBe('2');
  });

  it('n\'ajoute pas de badge de compte sans groupReveal (usage multiplication)', () => {
    const { container } = render(<DotGrid a={3} b={5} animated={false} bare />);
    expect(container.querySelector('.dot-grid-lot-count')).toBeNull();
  });
});
