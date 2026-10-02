import { cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import FeedbackOverlay from '../components/FeedbackOverlay';
import type { RemainderFact, SessionItem } from '../types';

// Niveau 3, feedback ciblé par étape (specs §12.5) : un quotient faux
// ré-affiche l'encadrement ; un bon quotient avec un mauvais reste ne
// ré-explique que l'écart.

// 45 ÷ 7 = 6, reste 3 ; boîte 1 : l'astuce d'encadrement est éligible.
function question(): SessionItem {
  const fact: RemainderFact = {
    divisor: 7, quotient: 6, box: 1, lastSeen: '', nextDue: '', history: [], introduced: true,
  };
  return { kind: 'rem', fact, remainder: 3, isIntroduction: false, isRetry: false, isBonusReview: false };
}

const show = (submittedValue: number, submittedRemainder: number | null) =>
  render(
    <FeedbackOverlay
      item={question()}
      correct={false}
      fast={false}
      submittedValue={submittedValue}
      submittedRemainder={submittedRemainder}
      onDismiss={() => {}}
    />,
  );

afterEach(cleanup);

describe('Feedback du niveau 3', () => {
  it('quotient faux : l’encadrement complet, sans l’écart', () => {
    show(5, null);
    expect(document.querySelector('.strategy-hint')).not.toBeNull();
    expect(document.querySelector('.feedback-rem-gap')).toBeNull();
  });

  it('bon quotient, mauvais reste : seulement l’écart', () => {
    show(6, 2);
    expect(document.querySelector('.strategy-hint')).toBeNull();
    expect(document.querySelector('.feedback-rem-gap')?.textContent).toBe(
      '7 × 6 = 42 : il manque 3 pour arriver à 45.',
    );
    expect(document.querySelector('.feedback-user-answer')?.textContent).toContain('6, reste 2');
  });
});
