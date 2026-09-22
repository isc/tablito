import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../App';
import { requireButton } from './helpers/dom';
import { addProfile, createNewProfile } from '../lib/storage';
// Préchauffe les chunks lazy pour que le React.lazy() d'App se résolve vite.
import '../screens/ParentDashboard';
import '../screens/ChangelogScreen';

// ---------------------------------------------------------------------------
// Geste retour Android (avis du 21/09/2026) : depuis l'espace parent, il
// fermait l'app au lieu de revenir à l'accueil — aucune entrée d'historique
// n'existait. `history.back()` est ici le geste : même traversée, même
// popstate asynchrone qu'un vrai retour système.
// ---------------------------------------------------------------------------

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function openParentDashboard(): Promise<void> {
  fireEvent.click(document.querySelector<HTMLButtonElement>('.home-parent-btn')!);
  const operands = Array.from(document.querySelectorAll('.parent-gate-question span'))
    .map((s) => parseInt(s.textContent ?? '', 10))
    .filter((n) => Number.isFinite(n));
  const input = document.querySelector<HTMLInputElement>('.parent-gate-input')!;
  fireEvent.change(input, { target: { value: String(operands[0] * operands[1]) } });
  fireEvent.click(requireButton(/^Valider$/));
  await flush();
}

const onHome = () => document.querySelector('.home-parent-btn') !== null;
const onParent = () => document.querySelector('.parent-back-btn') !== null;

describe('geste retour du système', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('multiplix-skip-install', '1');
    const profile = createNewProfile('Zoé');
    profile.hasSeenRulesIntro = true;
    addProfile(profile);
  });

  afterEach(cleanup);

  it("ramène de l'espace parent à l'accueil au lieu de quitter l'app", async () => {
    render(<App />);
    await openParentDashboard();
    expect(onParent()).toBe(true);

    await act(async () => window.history.back());
    await waitFor(() => expect(onHome()).toBe(true));
  });

  it('remonte écran par écran : nouveautés → espace parent → accueil', async () => {
    render(<App />);
    await openParentDashboard();
    fireEvent.click(requireButton(/^Nouveautés$/));
    await flush();
    expect(onParent()).toBe(false);

    await act(async () => window.history.back());
    await waitFor(() => expect(onParent()).toBe(true));
    // L'entrée est ré-empilée par un effet, après le rendu de l'espace parent.
    await waitFor(() => expect(window.history.state?.tablitoBack).toBe(true));

    await act(async () => window.history.back());
    await waitFor(() => expect(onHome()).toBe(true));
  });

  it("le bouton retour de l'UI retire l'entrée d'historique qu'il laisserait", async () => {
    render(<App />);
    await openParentDashboard();
    expect(window.history.state?.tablitoBack).toBe(true);

    fireEvent.click(document.querySelector<HTMLButtonElement>('.parent-back-btn')!);
    await waitFor(() => expect(window.history.state?.tablitoBack).toBeFalsy());
    expect(onHome()).toBe(true);
  });
});
