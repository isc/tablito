import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SessionScreen, { type MathAnswer } from '../screens/SessionScreen';
import { isMultiplicationSlip } from '../lib/divisionStrategies';
import type { DivisionFact } from '../types';
import { typeAnswer } from './helpers/dom';
import { divItem } from './helpers/mathItems';

// Erreur de signe en division (specs §11.6) : 27 pour 9 ÷ 3, c'est une
// multiplication faite à la place de la division, pas un fait oublié. L'app ne
// juge pas ce geste : elle pointe le signe et redemande une fois.

function divFact(dividend: number, divisor: number): DivisionFact {
  return divItem(dividend, divisor).fact as DivisionFact;
}

function renderSession() {
  const onAnswer = vi.fn<(answer: MathAnswer) => void>();
  render(
    <SessionScreen
      questions={[divItem(9, 3), divItem(8, 4)]}
      onComplete={() => {}}
      onAnswer={onAnswer}
      onConjAnswer={() => {}}
    />,
  );
  return onAnswer;
}

afterEach(() => cleanup());

describe('isMultiplicationSlip', () => {
  it('reconnaît le produit des deux nombres affichés', () => {
    expect(isMultiplicationSlip(divFact(9, 3), 27)).toBe(true);
    expect(isMultiplicationSlip(divFact(8, 4), 32)).toBe(true);
  });

  it('ne confond ni la bonne réponse ni une erreur de table', () => {
    expect(isMultiplicationSlip(divFact(9, 3), 3)).toBe(false);
    expect(isMultiplicationSlip(divFact(56, 7), 7)).toBe(false);
  });
});

describe('Séance — seconde chance après une erreur de signe', () => {
  it('ne compte pas le produit, pointe le signe, puis accepte la bonne réponse sans la dire rapide', () => {
    const onAnswer = renderSession();

    typeAnswer(27);
    expect(onAnswer).not.toHaveBeenCalled();
    expect(document.querySelector('.session-sign-slip')?.textContent).toContain('9 × 3 = 27');
    expect(document.querySelector('.formula-operator.is-flagged')).not.toBeNull();
    expect(document.querySelector('.feedback-overlay')).toBeNull();

    typeAnswer(3);
    expect(onAnswer).toHaveBeenCalledTimes(1);
    // Répondu en quelques ms : sans la seconde chance, ce serait « rapide ».
    expect(onAnswer.mock.calls[0][0]).toMatchObject({
      correct: true,
      answered: 3,
      fast: false,
      afterSignSlip: true,
    });
    expect(document.querySelector('.feedback-overlay.correct')).not.toBeNull();
  });

  it('une seule seconde chance : le produit redonné est une erreur ordinaire', () => {
    const onAnswer = renderSession();

    typeAnswer(27);
    typeAnswer(27);
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: false, afterSignSlip: true });
    expect(document.querySelector('.feedback-overlay.incorrect')).not.toBeNull();
  });

  it('la question suivante repart sans seconde chance consommée', () => {
    const onAnswer = renderSession();

    typeAnswer(3);
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: true, fast: true, afterSignSlip: false });
    fireEvent.click(document.querySelector('.feedback-overlay')!);
    expect(document.querySelector('.session-sign-slip')).toBeNull();

    typeAnswer(32);
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.session-sign-slip')?.textContent).toContain('8 × 4 = 32');
  });
});
