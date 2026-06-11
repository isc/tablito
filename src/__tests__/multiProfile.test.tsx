import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import {
  PROFILES_INDEX_KEY,
  addProfile,
  createNewProfile,
  listProfiles,
  loadProfile,
} from '../lib/storage';
// Préchauffe le chunk de ParentDashboard pour que le React.lazy() côté App.tsx
// se résolve en synchrone dans les tests qui ouvrent le dashboard.
import '../screens/ParentDashboard';

// ---------------------------------------------------------------------------
// Mode multi-profils : plusieurs enfants partagent le même appareil. Tests
// d'intégration DOM (vrai <App />, vrais clics) couvrant la migration depuis
// l'ancien schéma mono-profil, l'ajout d'un second enfant, l'écran
// « Qui joue ? » au boot, le changement de joueur et la suppression.
// ---------------------------------------------------------------------------

const START_DATE = new Date('2026-01-05T08:00:00.000Z');

// PRNG déterministe (mulberry32) — même rationale que userJourney.test.tsx.
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function findButton(label: RegExp | string): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll('button'));
  return (
    (buttons.find((b) => {
      const text = (b.textContent ?? '').trim();
      return typeof label === 'string' ? text === label : label.test(text);
    }) as HTMLButtonElement | null) ?? null
  );
}

function readGreeting(): string {
  return document.querySelector('.home-greeting')?.textContent ?? '';
}

// Simule un passage arrière-plan / premier plan de la PWA. jsdom n'expose pas
// de setter pour visibilityState : on shadow le getter sur l'instance (retiré
// dans afterEach pour ne pas fuiter sur les autres tests).
function setVisibility(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

// Avance l'horloge mockée sans déclencher les timers en attente (contrairement
// à advanceTimersByTime) : on simule du temps passé app cachée, pas des timers.
function jumpClock(ms: number): void {
  vi.setSystemTime(new Date(Date.now() + ms));
}

// Crée un profil via le vrai parcours Welcome (prénom + « Passer le test »)
// puis ferme l'intro des règles pour atterrir sur Home.
function completeWelcome(name: string): void {
  fireEvent.click(findButton(/^Suivant/)!);
  const nameInput = document.querySelector<HTMLInputElement>('input.welcome-input')!;
  fireEvent.change(nameInput, { target: { value: name } });
  fireEvent.click(findButton(/^C'est moi/)!);
  fireEvent.click(findButton('Passer le test')!);
  // RulesIntroScreen (3 étapes).
  fireEvent.click(findButton(/C'est parti/)!);
  fireEvent.click(findButton(/Suivant/)!);
  fireEvent.click(findButton(/J'ai compris/)!);
}

// Ouvre le dashboard parent depuis Home (même helper que userJourney).
async function openParentDashboard(): Promise<void> {
  fireEvent.click(document.querySelector<HTMLButtonElement>('.home-parent-btn')!);
  const question = document.querySelector('.parent-gate-question');
  if (!question) throw new Error('ParentGate non affiché');
  const operands = Array.from(question.querySelectorAll('span'))
    .map((s) => parseInt(s.textContent ?? '', 10))
    .filter((n) => Number.isFinite(n));
  if (operands.length < 2) throw new Error('Opérandes du ParentGate introuvables');
  const product = operands[0] * operands[1];
  const input = document.querySelector<HTMLInputElement>('.parent-gate-input')!;
  fireEvent.change(input, { target: { value: String(product) } });
  fireEvent.click(findButton('Valider')!);
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('Mode multi-profils (DOM)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('multiplix-skip-install', '1');
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(1));
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    vi.setSystemTime(START_DATE);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    // Retire l'éventuel shadow posé par setVisibility (le getter du prototype
    // reprend la main).
    delete (document as { visibilityState?: unknown }).visibilityState;
  });

  it("migre l'ancien profil mono-clé vers le schéma multi-profils sans rien perdre", () => {
    // Profil au format historique, écrit directement sous l'ancienne clé.
    const legacy = createNewProfile('Zoe');
    legacy.hasSeenRulesIntro = true;
    legacy.totalSessions = 7;
    localStorage.setItem('multiplix-profile', JSON.stringify(legacy));

    render(<App />);

    // Boot direct sur Home (un seul profil → pas d'écran « Qui joue ? »).
    expect(readGreeting()).toContain('Zoe');

    // L'ancienne clé a été migrée : index + clé par-profil, données intactes.
    expect(localStorage.getItem('multiplix-profile')).toBeNull();
    expect(localStorage.getItem(PROFILES_INDEX_KEY)).not.toBeNull();
    expect(listProfiles()).toHaveLength(1);
    const migrated = loadProfile()!;
    expect(migrated.name).toBe('Zoe');
    expect(migrated.totalSessions).toBe(7);
  });

  it('ajoute un second enfant depuis l’espace parent, puis propose « Qui joue ? » au boot', async () => {
    render(<App />);

    // Enfant 1 : onboarding complet.
    completeWelcome('Zoe');
    expect(readGreeting()).toContain('Zoe');
    // Mono-profil : pas de bouton « changer de joueur ».
    expect(document.querySelector('.home-switch-btn')).toBeNull();

    // Enfant 2 : ajout via l'espace parent.
    await openParentDashboard();
    fireEvent.click(findButton('Ajouter un enfant')!);
    completeWelcome('Max');
    expect(readGreeting()).toContain('Max');

    // Les deux profils coexistent, chacun avec sa progression.
    expect(listProfiles().map((p) => p.name).sort()).toEqual(['Max', 'Zoe']);
    expect(loadProfile()!.name).toBe('Max');

    // Relance de l'app → écran « Qui joue ? ».
    cleanup();
    render(<App />);
    expect(document.querySelector('.profile-select-screen')).not.toBeNull();
    expect(findButton(/Zoe/)).not.toBeNull();
    expect(findButton(/Max/)).not.toBeNull();

    // Sélection de Zoé → son accueil, et son profil devient l'actif.
    fireEvent.click(findButton(/Zoe/)!);
    expect(readGreeting()).toContain('Zoe');
    expect(loadProfile()!.name).toBe('Zoe');

    // Le bouton « changer de joueur » ramène à l'écran de sélection.
    fireEvent.click(document.querySelector<HTMLButtonElement>('.home-switch-btn')!);
    expect(document.querySelector('.profile-select-screen')).not.toBeNull();
  });

  it("annuler l'ajout d'un enfant ne crée pas de profil", async () => {
    render(<App />);
    completeWelcome('Zoe');

    await openParentDashboard();
    fireEvent.click(findButton('Ajouter un enfant')!);
    // Welcome en mode ajout → bouton Annuler présent.
    fireEvent.click(findButton('Annuler')!);

    expect(listProfiles()).toHaveLength(1);
    expect(readGreeting()).toContain('Zoe');
  });

  it("repropose « Qui joue ? » au retour au premier plan après une longue absence", () => {
    const zoe = createNewProfile('Zoe');
    zoe.hasSeenRulesIntro = true;
    addProfile(zoe);
    const max = createNewProfile('Max');
    max.hasSeenRulesIntro = true;
    addProfile(max);

    render(<App />);
    fireEvent.click(findButton(/Max/)!);
    expect(readGreeting()).toContain('Max');

    // Aller-retour court (< 15 min) : on ne touche à rien.
    setVisibility('hidden');
    jumpClock(5 * 60 * 1000);
    setVisibility('visible');
    expect(document.querySelector('.profile-select-screen')).toBeNull();
    expect(readGreeting()).toContain('Max');

    // Longue absence : retour sur le choix du joueur.
    setVisibility('hidden');
    jumpClock(16 * 60 * 1000);
    setVisibility('visible');
    expect(document.querySelector('.profile-select-screen')).not.toBeNull();
  });

  it("ne repropose pas le choix du joueur en pleine séance ni en mono-profil", () => {
    // Mono-profil : une longue absence ne déclenche rien.
    const zoe = createNewProfile('Zoe');
    zoe.hasSeenRulesIntro = true;
    addProfile(zoe);
    render(<App />);
    expect(readGreeting()).toContain('Zoe');
    setVisibility('hidden');
    jumpClock(60 * 60 * 1000);
    setVisibility('visible');
    expect(document.querySelector('.profile-select-screen')).toBeNull();
    expect(readGreeting()).toContain('Zoe');

    // Multi-profils mais séance en cours : jamais d'interruption.
    const max = createNewProfile('Max');
    max.hasSeenRulesIntro = true;
    addProfile(max);
    cleanup();
    render(<App />);
    fireEvent.click(findButton(/Max/)!);
    fireEvent.click(findButton(/C'est parti/)!);
    const inSession = () =>
      document.querySelector('.session-intro') !== null ||
      document.querySelector('.session-question-text') !== null;
    expect(inSession()).toBe(true);

    setVisibility('hidden');
    jumpClock(60 * 60 * 1000);
    setVisibility('visible');
    expect(document.querySelector('.profile-select-screen')).toBeNull();
    expect(inSession()).toBe(true);
  });

  it("supprimer le profil actif bascule sur l'autre enfant", async () => {
    // Deux profils seedés directement (Max actif, dernier ajouté).
    const zoe = createNewProfile('Zoe');
    zoe.hasSeenRulesIntro = true;
    addProfile(zoe);
    const max = createNewProfile('Max');
    max.hasSeenRulesIntro = true;
    addProfile(max);

    render(<App />);
    fireEvent.click(findButton(/Max/)!);
    expect(readGreeting()).toContain('Max');

    await openParentDashboard();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(findButton('Supprimer ce profil')!);
    confirmSpy.mockRestore();

    // Il ne reste que Zoé : retour direct sur son accueil.
    expect(listProfiles().map((p) => p.name)).toEqual(['Zoe']);
    expect(loadProfile()!.name).toBe('Zoe');
    expect(readGreeting()).toContain('Zoe');
  });
});
