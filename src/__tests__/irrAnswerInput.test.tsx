import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';

import IrrAnswerInput from '../components/IrrAnswerInput';
import { requireIrrVerbDef } from '../lib/irregularVerbs';

// Saisie au clavier physique des verbes irréguliers (specs §16.6) : passer
// d'une case à l'autre sans deviner Entrée, et reprendre une case au clic.
// jsdom n'a pas de reconnaissance vocale : la saisie est au clavier.

const press = (key: string) => fireEvent.keyDown(window, { key });
const type = (word: string) => [...word].forEach(press);
const slots = () => [...document.querySelectorAll<HTMLElement>('.irr-form--slot')];

afterEach(cleanup);

describe('IrrAnswerInput au clavier', () => {
  it.each([' ', 'Tab', ','])('« %s » passe à la case suivante', (sep) => {
    const onSubmit = vi.fn();
    render(<IrrAnswerInput def={requireIrrVerbDef('go')} onSubmit={onSubmit} token="t" />);
    type('went');
    press(sep);
    expect(slots()[1].classList.contains('is-active')).toBe(true);
    type('gone');
    press(sep);
    expect(onSubmit).toHaveBeenCalledWith(['went', 'gone'], 'keypad');
  });

  it('Tab sur une case vide ne valide rien', () => {
    const onSubmit = vi.fn();
    render(<IrrAnswerInput def={requireIrrVerbDef('go')} onSubmit={onSubmit} token="t" />);
    press('Tab');
    expect(slots()[0].classList.contains('is-active')).toBe(true);
  });

  it('un clic choisit la case, la validation remplit ensuite la case vide restante', () => {
    const onSubmit = vi.fn();
    render(<IrrAnswerInput def={requireIrrVerbDef('go')} onSubmit={onSubmit} token="t" />);
    fireEvent.click(slots()[1]);
    type('gone');
    press('Enter');
    expect(slots()[0].classList.contains('is-active')).toBe(true);
    expect(slots()[1].textContent).toBe('gone');
    type('went');
    press('Enter');
    expect(onSubmit).toHaveBeenCalledWith(['went', 'gone'], 'keypad');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // Réponse partie : une seconde Entrée ne la renvoie pas.
    press('Enter');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('une case remplie se reprend au clic, avec son contenu', () => {
    const onSubmit = vi.fn();
    render(<IrrAnswerInput def={requireIrrVerbDef('go')} onSubmit={onSubmit} token="t" />);
    type('wen');
    press(' ');
    fireEvent.click(slots()[0]);
    type('t');
    press(' ');
    expect(slots()[0].textContent).toBe('went');
    type('gone');
    press(' ');
    expect(onSubmit).toHaveBeenCalledWith(['went', 'gone'], 'keypad');
  });

  describe('« = had » recopie le prétérit dans le participe', () => {
    const sameKey = () => document.querySelector<HTMLButtonElement>('.letterpad-btn-extra');

    it('remplit la case sans valider : l’enfant relit, puis valide', () => {
      const onSubmit = vi.fn();
      render(<IrrAnswerInput def={requireIrrVerbDef('have')} onSubmit={onSubmit} token="t" />);
      expect(sameKey()).toBeNull();
      type('had');
      press(' ');
      expect(sameKey()?.textContent).toBe('= had');
      fireEvent.click(sameKey()!);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(slots()[1].textContent).toBe('had');
      fireEvent.click(document.querySelector('.letterpad-btn-ok')!);
      expect(onSubmit).toHaveBeenCalledWith(['had', 'had'], 'keypad');
    });

    it('remplace ce qui était commencé, et la saisie reste corrigeable', () => {
      const onSubmit = vi.fn();
      render(<IrrAnswerInput def={requireIrrVerbDef('get')} onSubmit={onSubmit} token="t" />);
      type('got');
      press(' ');
      type('ge');
      fireEvent.click(sameKey()!);
      expect(slots()[1].textContent).toBe('got');
      type('ten');
      press('Enter');
      expect(onSubmit).toHaveBeenCalledWith(['got', 'gotten'], 'keypad');
    });

    it('est là aussi quand le participe diffère : sinon elle donnerait la réponse', () => {
      const onSubmit = vi.fn();
      render(<IrrAnswerInput def={requireIrrVerbDef('begin')} onSubmit={onSubmit} token="t" />);
      type('began');
      press(' ');
      fireEvent.click(sameKey()!);
      press('Enter');
      expect(onSubmit).toHaveBeenCalledWith(['began', 'began'], 'keypad');
    });

    it('disparaît quand on revient sur le prétérit', () => {
      render(<IrrAnswerInput def={requireIrrVerbDef('have')} onSubmit={vi.fn()} token="t" />);
      type('had');
      press(' ');
      fireEvent.click(slots()[0]);
      expect(sameKey()).toBeNull();
    });

    it('pas pour « be » : deux prétérits', () => {
      render(<IrrAnswerInput def={requireIrrVerbDef('be')} onSubmit={vi.fn()} token="t" />);
      type('was');
      press(' ');
      type('were');
      press(' ');
      expect(slots()[2].classList.contains('is-active')).toBe(true);
      expect(sameKey()).toBeNull();
    });
  });
});
