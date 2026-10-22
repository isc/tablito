import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import SessionScreen, { type MathAnswer } from '../screens/SessionScreen';
import { addProfile, createNewProfile, loadProfile } from '../lib/storage';
import { todayISO } from '../lib/utils';
import { advance, onHome, requireButton, typeAnswer } from './helpers/dom';
import { multItem } from './helpers/mathItems';

// ---------------------------------------------------------------------------
// Arrêter une séance en cours (avis du 21/10/2026 : « How can I leave a running
// lecture w/o leaving the app? »). Le × et le geste retour demandent
// confirmation ; arrêter ramène à l'accueil en gardant les réponses données,
// sans compter la séance (specs §3.2).
// ---------------------------------------------------------------------------

const inSession = () => document.querySelector('.session-screen') !== null;
const quitDialog = () => document.querySelector('.session-quit-modal');

function passIntro(): void {
  for (let i = 0; i < 5 && document.querySelector('.session-intro'); i++) {
    fireEvent.click(document.querySelector<HTMLButtonElement>('.session-intro-btn')!);
  }
  expect(document.querySelector('.session-intro')).toBeNull();
}

/** Réponse juste à la multiplication affichée. */
function currentProduct(): number {
  const [, a, b] = document.querySelector('.session-question-text')!.textContent!.match(/(\d+)\s*×\s*(\d+)/)!;
  return Number(a) * Number(b);
}

describe('arrêter une séance en cours', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('multiplix-skip-install', '1');
    const profile = createNewProfile('Zoé');
    profile.hasSeenRulesIntro = true;
    addProfile(profile);
  });

  // Démonter la séance dépile son entrée d'historique, de façon asynchrone :
  // l'attendre, sinon ce retour tomberait dans le test suivant.
  afterEach(async () => {
    cleanup();
    await waitFor(() => expect(window.history.state?.tablitoBack).toBeFalsy());
  });

  it('« Continuer » referme la confirmation et laisse la séance où elle était', () => {
    render(<App />);
    fireEvent.click(requireButton(/C'est parti/));
    passIntro();

    fireEvent.click(requireButton(/^Arrêter la séance$/));
    expect(quitDialog()?.textContent).toContain('Tes réponses sont gardées');

    // La saisie est coupée tant que la confirmation est ouverte.
    const question = document.querySelector('.session-question-text')!.textContent;
    typeAnswer(currentProduct());
    expect(document.querySelector('.feedback-overlay')).toBeNull();

    fireEvent.click(requireButton(/^Continuer$/));
    expect(quitDialog()).toBeNull();
    expect(document.querySelector('.session-question-text')!.textContent).toBe(question);
  });

  it("« Arrêter » ramène à l'accueil : les réponses sont gardées, la séance ne compte pas", async () => {
    render(<App />);
    fireEvent.click(requireButton(/C'est parti/));
    passIntro();
    typeAnswer(currentProduct());
    fireEvent.click(document.querySelector('.feedback-overlay')!);

    fireEvent.click(requireButton(/^Arrêter la séance$/));
    fireEvent.click(requireButton(/^Arrêter$/));
    expect(onHome()).toBe(true);

    const saved = loadProfile()!;
    const answered = saved.facts.filter((f) => f.history.length > 0);
    expect(answered).toHaveLength(1);
    expect(answered[0]).toMatchObject({ introduced: true, introducedAt: todayISO() });
    expect(saved.totalSessions).toBe(0);
    expect(saved.sessionHistory).toEqual([]);
    expect(saved.lastSessionDate).not.toBe(todayISO());

    // L'entrée d'historique de la séance est retirée avec elle.
    await waitFor(() => expect(window.history.state?.tablitoBack).toBeFalsy());
    // Et la séance du jour reste à faire.
    expect(requireButton(/C'est parti/).disabled).toBe(false);
  });

  it("le geste retour ouvre la confirmation au lieu de fermer l'app, un second la referme", async () => {
    render(<App />);
    fireEvent.click(requireButton(/C'est parti/));
    expect(window.history.state?.tablitoBack).toBe(true);

    await act(async () => window.history.back());
    await waitFor(() => expect(quitDialog()).not.toBeNull());
    expect(inSession()).toBe(true);
    // Entrée ré-empilée : le geste suivant reste dans l'app.
    await waitFor(() => expect(window.history.state?.tablitoBack).toBe(true));

    await act(async () => window.history.back());
    await waitFor(() => expect(quitDialog()).toBeNull());
    expect(inSession()).toBe(true);
    await waitFor(() => expect(window.history.state?.tablitoBack).toBe(true));

    await act(async () => window.history.back());
    await waitFor(() => expect(quitDialog()).not.toBeNull());
    fireEvent.click(requireButton(/^Arrêter$/));
    expect(onHome()).toBe(true);
  });
});

describe('chrono pendant la confirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('le temps passé sur la confirmation ne compte pas dans le temps de réponse', () => {
    const onAnswer = vi.fn<(answer: MathAnswer) => void>();
    render(
      <SessionScreen
        questions={[multItem(3, 4), multItem(6, 7)]}
        onComplete={() => {}}
        onQuit={() => {}}
        onAnswer={onAnswer}
        onConjAnswer={() => {}}
      />,
    );

    advance(1000);
    fireEvent.click(requireButton(/^Arrêter la séance$/));
    advance(30_000);
    fireEvent.click(requireButton(/^Continuer$/));
    advance(1000);
    typeAnswer(12);

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: true, timeMs: 2000, fast: true });
  });
});
