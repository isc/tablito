import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNewProfile } from '../lib/storage';

// ---------------------------------------------------------------------------
// Easter egg de la home : 4 chatouilles d'affilée sur Piou → fou rire, saut,
// fête, envol. Il laisse une plume et revient en volant 15 min plus tard.
// L'état vit au niveau module de HomeScreen : chaque test ré-importe le module
// (vi.resetModules) pour repartir d'un compteur vierge.
// ---------------------------------------------------------------------------

const noop = () => {};

async function renderHome() {
  const { default: HomeScreen } = await import('../screens/HomeScreen');
  const profile = createNewProfile('Léa');
  const props = {
    profile,
    hasSessionAvailable: true,
    hasNewRule: false,
    divisionUnlocked: false,
    conjAvailable: false,
    hasConjSessionAvailable: false,
    conjVisible: false,
    onStartConj: noop,
    onStart: noop,
    onShowProgress: noop,
    onShowBadges: noop,
    onShowRules: noop,
    onShowParent: noop,
  };
  const utils = render(<HomeScreen {...props} />);
  return { ...utils, HomeScreen, props };
}

function mascotMood(): string | null {
  const el = document.querySelector('.mascot');
  if (!el) return null;
  return Array.from(el.classList).find((c) => c !== 'mascot') ?? null;
}

function tickle() {
  const btn = document.querySelector('.home-mascot-tickle');
  if (!btn) throw new Error('Piou absent de la home');
  fireEvent.click(btn);
}

describe('easter egg : chatouiller Piou', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T08:00:00.000Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('enchaîne fou rire, saut, fête puis envol, et laisse une plume qui tombe', async () => {
    await renderHome();
    expect(mascotMood()).toBe('idle');

    const moods: (string | null)[] = [];
    for (let i = 0; i < 4; i++) {
      act(() => tickle());
      moods.push(mascotMood());
      act(() => {
        vi.advanceTimersByTime(300);
      });
    }
    expect(moods).toEqual(['giggle', 'happy', 'celebrate', 'flyaway']);

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(document.querySelector('.home-mascot-tickle')).toBeNull();
    const empty = document.querySelector('.home-mascot-empty');
    expect(empty?.classList.contains('is-falling')).toBe(true);
  });

  it('réarme le compteur quand on arrête de chatouiller', async () => {
    await renderHome();
    act(() => tickle());
    act(() => tickle());
    act(() => tickle());
    expect(mascotMood()).toBe('celebrate');

    // Pause trop longue : on repart du fou rire au lieu de s'envoler.
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    act(() => tickle());
    expect(mascotMood()).toBe('giggle');
  });

  it('revient en volant au bout de 15 min, puis se pose', async () => {
    await renderHome();
    for (let i = 0; i < 4; i++) act(() => tickle());
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(mascotMood()).toBeNull();

    act(() => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });
    expect(mascotMood()).toBe('flyin');
    // Pas de chatouille pendant l'atterrissage.
    act(() => tickle());
    expect(mascotMood()).toBe('flyin');

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(mascotMood()).toBe('idle');
    // Compteur remis à zéro : la chatouille suivante repart du fou rire.
    act(() => tickle());
    expect(mascotMood()).toBe('giggle');
  });

  it("revient en volant si la home n'était pas affichée à son retour", async () => {
    const { unmount, HomeScreen, props } = await renderHome();
    for (let i = 0; i < 4; i++) act(() => tickle());
    act(() => {
      vi.advanceTimersByTime(900);
    });
    unmount();

    // Au retour sur la home pendant l'absence, la plume est déjà au sol.
    const during = render(<HomeScreen {...props} />);
    const empty = document.querySelector('.home-mascot-empty');
    expect(empty).not.toBeNull();
    expect(empty?.classList.contains('is-falling')).toBe(false);
    during.unmount();

    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    render(<HomeScreen {...props} />);
    expect(mascotMood()).toBe('flyin');
  });
});
