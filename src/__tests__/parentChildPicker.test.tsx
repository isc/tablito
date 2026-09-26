import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../App';
import { addProfile, createNewProfile, getActiveProfileId, setActiveProfile } from '../lib/storage';
import {
  childChip,
  childChips,
  flushMicrotasks,
  openParentDashboard,
  requireButton,
  sessionsShown,
} from './helpers/dom';
// Préchauffe le chunk lazy de l'espace parent pour que le React.lazy() d'App
// se résolve dans le test.
import '../screens/ParentDashboard';

// ---------------------------------------------------------------------------
// Un seul sélecteur d'enfant dans l'espace parent : les enfants de l'appareil
// y sont tous, pas seulement celui qui joue. Voir la progression de Tom sur la
// tablette de Léa ne demande plus de repasser par « Qui joue ? ».
// ---------------------------------------------------------------------------

let leaId: string;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('multiplix-skip-install', '1');
  leaId = addProfile({ ...createNewProfile('Léa'), hasSeenRulesIntro: true, totalSessions: 17 });
  addProfile({ ...createNewProfile('Tom'), hasSeenRulesIntro: true, totalSessions: 9 });
  setActiveProfile(leaId);
});

afterEach(cleanup);

const title = () => document.querySelector('.parent-dashboard .parent-title')?.textContent;

describe("sélecteur d'enfant de l'espace parent", () => {
  it("liste tous les enfants de l'appareil, ouvert sur celui qui joue", async () => {
    render(<App />);
    fireEvent.click(requireButton(/Léa/));
    await openParentDashboard();

    expect(childChips()).toEqual([
      { name: 'Léa', remote: false, active: true },
      { name: 'Tom', remote: false, active: false },
    ]);
    expect(title()).toBe('Léa');
    expect(sessionsShown()).toBe('17');
  });

  it("montre la progression d'un autre enfant sans changer celui qui joue", async () => {
    render(<App />);
    fireEvent.click(requireButton(/Léa/));
    await openParentDashboard();

    fireEvent.click(childChip('Tom'));
    expect(title()).toBe('Tom');
    expect(sessionsShown()).toBe('9');
    expect(childChips().find((c) => c.active)?.name).toBe('Tom');

    // Le parent a regardé, il n'a pas pris la main : c'est toujours Léa qui
    // retrouve son accueil en sortant de l'espace parent.
    expect(getActiveProfileId()).toBe(leaId);
    fireEvent.click(document.querySelector<HTMLButtonElement>('.parent-back-btn')!);
    await flushMicrotasks();
    expect(document.querySelector('.home-greeting')?.textContent).toContain('Léa');
  });

  it("la page d'une matière suit l'enfant choisi", async () => {
    render(<App />);
    fireEvent.click(requireButton(/Léa/));
    await openParentDashboard();

    fireEvent.click(childChip('Tom'));
    fireEvent.click(document.querySelector<HTMLButtonElement>('.parent-subject-card--math')!);
    expect(document.querySelector('.parent-dashboard--subject .parent-eyebrow')?.textContent).toBe('Tom');
  });
});
