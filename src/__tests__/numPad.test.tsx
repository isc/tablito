import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';

import NumPad from '../components/NumPad';
import { tapOk, typeAnswer, typeDigits } from './helpers/dom';

// Le pavé numérique ne valide jamais seul (specs §3.3) : à 2 chiffres, il le
// faisait, et une faute de frappe partait sans pouvoir être effacée.

const display = () => document.querySelector('.numpad-display')?.textContent;

afterEach(cleanup);

describe('NumPad', () => {
  it('2 chiffres ne valident pas : « OK » valide', () => {
    const onSubmit = vi.fn();
    render(<NumPad onSubmit={onSubmit} />);
    typeDigits(54);
    expect(onSubmit).not.toHaveBeenCalled();
    tapOk();
    expect(onSubmit).toHaveBeenCalledWith(54);
  });

  it('une faute de frappe s’efface avant de valider', () => {
    const onSubmit = vi.fn();
    render(<NumPad onSubmit={onSubmit} />);
    typeDigits(56);
    fireEvent.click(document.querySelector<HTMLButtonElement>('.numpad-btn-backspace')!);
    typeAnswer(4);
    expect(onSubmit).toHaveBeenCalledWith(54);
  });

  it('pas plus de 2 chiffres (9 × 9 = 81)', () => {
    render(<NumPad onSubmit={vi.fn()} />);
    typeDigits(427);
    expect(display()).toBe('42');
  });

  it('Entrée au clavier physique valide, comme « OK »', () => {
    const onSubmit = vi.fn();
    render(<NumPad onSubmit={onSubmit} />);
    fireEvent.keyDown(window, { key: '8' });
    fireEvent.keyDown(window, { key: '1' });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith(81);
  });
});
