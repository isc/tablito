import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import { composeConjSession } from '../lib/conjugationComposer';
import { createInitialConjFacts } from '../lib/conjugationFacts';
import { MAX_FRAGILE } from '../lib/leitner';
import { composeSession } from '../lib/sessionComposer';
import { createNewProfile, saveProfile } from '../lib/storage';
import type { SessionQuestion, UserProfile } from '../types';
import { findButton, requireButton, tapLetters, typeAnswer } from './helpers/dom';

// La séance du jour de chaque matière ne se compose que sur l'accueil, jamais
// pendant une séance (cf. App). Les composeurs restent les vrais : on ne fait
// que compter leurs appels.
vi.mock('../lib/sessionComposer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/sessionComposer')>();
  return { ...mod, composeSession: vi.fn(mod.composeSession) };
});
vi.mock('../lib/conjugationComposer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/conjugationComposer')>();
  return { ...mod, composeConjSession: vi.fn(mod.composeConjSession) };
});

/** Compositions de séance lancées depuis le début du test, maths et conjugaison. */
function compositions(): number {
  return (
    vi.mocked(composeSession).mock.calls.length + vi.mocked(composeConjSession).mock.calls.length
  );
}

/**
 * Les deux matières jouables, sans introduction : les 36 faits de maths dus en
 * boîte 1 ; en conjugaison (ouverte et placée), un fait fragile de plus que le
 * plafond, dus eux aussi.
 */
function readyProfile(): UserProfile {
  const fragile = { introduced: true, box: 1 as const, lastSeen: '2026-01-01', nextDue: '2026-01-01' };
  const p = createNewProfile('Zoé');
  p.hasSeenRulesIntro = true;
  p.facts = p.facts.map((f) => ({ ...f, ...fragile }));
  p.hasSeenConjIntro = true;
  p.hasDoneConjPlacement = true;
  p.conjFacts = createInitialConjFacts().map((f, i) => (i <= MAX_FRAGILE ? { ...f, ...fragile } : f));
  return p;
}

/**
 * Joue la séance de maths affichée jusqu'au récap, sans faute. Renvoie les
 * questions posées, dans l'ordre, telles qu'affichées (`[a, b]` de « a × b »).
 */
function playMathSession(): Array<[number, number]> {
  const asked: Array<[number, number]> = [];
  for (let i = 0; i < 200 && !document.querySelector('.recap-screen'); i++) {
    const feedback = document.querySelector<HTMLElement>('.feedback-overlay');
    if (feedback) {
      fireEvent.click(feedback);
      continue;
    }
    const question = document
      .querySelector('.session-question-text')
      ?.textContent?.match(/(\d+)\D+(\d+)/);
    if (!question) throw new Error('séance : ni question, ni retour, ni récap à l’écran');
    const [a, b] = [Number(question[1]), Number(question[2])];
    asked.push([a, b]);
    typeAnswer(a * b);
  }
  return asked;
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
  vi.setSystemTime(new Date('2026-08-17T10:00:00Z'));
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  localStorage.clear();
});

describe('Séance du jour : composée sur l’accueil, jamais pendant une séance', () => {
  it('maths : la séance jouée est celle composée sur l’accueil, recomposée seulement au retour', () => {
    saveProfile(readyProfile());
    render(<App />);

    // L'accueil compose la séance pour savoir si sa tuile est jouable.
    expect(composeSession).toHaveBeenCalled();
    const composed: SessionQuestion[] = vi.mocked(composeSession).mock.results.at(-1)!.value;
    const atStart = compositions();

    fireEvent.click(requireButton(/Maths/));
    // C'est cette composition qui est jouée, question pour question, et rien
    // ne s'est recomposé : ni au lancement, ni pendant la séance, ni au récap.
    expect(playMathSession()).toEqual(composed.map((q) => [q.displayA, q.displayB]));
    expect(compositions()).toBe(atStart);

    // De retour à l'accueil, la composition reprend : la conjugaison reste à jouer.
    fireEvent.click(requireButton(/À demain/));
    expect(findButton(/Conjugaison/)!.disabled).toBe(false);
  });

  it('conjugaison : une réponse ne recompose aucune des deux matières', () => {
    saveProfile(readyProfile());
    render(<App />);
    const atStart = compositions();

    fireEvent.click(requireButton(/Conjugaison/));
    // Juste ou faux, peu importe : toute réponse change le profil.
    tapLetters('ez');
    expect(document.querySelector('.feedback-overlay')).not.toBeNull();
    expect(compositions()).toBe(atStart);
  });
});
