import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
// Précharge les chunks lazy du parcours (cf. conjIntegration).
import '../screens/IrrPlacementScreen';
import '../screens/ProgressScreen';
import '../screens/BadgesScreen';
import '../screens/RulesScreen';
import { LangProvider } from '../i18n/LangProvider';
import { applyLang } from '../i18n/lang';
import { createNewProfile, exportProfile, importProfile, loadProfile, saveProfile } from '../lib/storage';
import { visibleBadgeDefinitions } from '../lib/badges';
import { createInitialIrrFacts, irrExpectedForms, requireIrrVerbDef } from '../lib/irregularVerbs';
import { advance, findButton as button, flushMicrotasks, tapLetters } from './helpers/dom';
import type { UserProfile } from '../types';

// Tests d'INTÉGRATION de la matière verbes irréguliers anglais (specs §16) :
// l'accueil à trois matières, le masquage en anglais, le parcours placement →
// première séance → récap, et la migration des profils. Sans reconnaissance
// vocale (jsdom), la voix retombe sur le clavier : c'est ce chemin qu'on joue.

const TODAY = '2026-10-03';

function renderApp() {
  return render(
    <LangProvider>
      <App />
    </LangProvider>,
  );
}

function freshProfile(): UserProfile {
  const p = createNewProfile('Zoé');
  p.hasSeenRulesIntro = true;
  p.lastSessionDate = null;
  return p;
}

/** Le verbe affiché (l'infinitif de la récitation), ou null. */
function shownVerb(): string | null {
  return document.querySelector('.irr-form--base')?.textContent ?? null;
}

/** Répond juste, case par case, au verbe affiché. */
function answerShownVerb(): string {
  const key = shownVerb();
  if (!key) throw new Error('aucun verbe à l’écran');
  for (const form of irrExpectedForms(requireIrrVerbDef(key))) tapLetters(form);
  return key;
}

/** Joue une introduction : écouter, (famille), copie différée. */
function playIntro(): void {
  while (button(/Suivant/)) fireEvent.click(button(/Suivant/)!);
  advance(4000); // le modèle se masque
  answerShownVerb();
}

/** Joue la séance jusqu'au récap. Renvoie les verbes posés. */
function playIrrSession(): string[] {
  const asked: string[] = [];
  while (asked.length < 25 && !document.querySelector('.recap-screen')) {
    if (document.querySelector('.irr-intro')) playIntro();
    asked.push(answerShownVerb());
    advance(2500);
  }
  return asked;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
  applyLang('fr');
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  localStorage.clear();
  applyLang('fr');
});

describe('Accueil (specs §16)', () => {
  it('en français : une troisième tuile, avec sa pastille de découverte', () => {
    saveProfile(freshProfile());
    renderApp();
    const tile = button(/Verbes anglais/);
    expect(tile).not.toBeNull();
    expect(tile!.querySelector('.home-subject-dot')).not.toBeNull();
  });

  it('en anglais : aucune trace de la matière', () => {
    applyLang('en');
    saveProfile(freshProfile());
    renderApp();
    expect(button(/English verbs/)).toBeNull();
  });
});

describe('Parcours placement → première séance (specs §16.8)', () => {
  it('ensemence les verbes réussis, puis enchaîne sur une séance jouée jusqu’au récap', async () => {
    saveProfile(freshProfile());
    renderApp();

    fireEvent.click(button(/Verbes anglais/)!);
    await flushMicrotasks();
    fireEvent.click(button(/C’est parti/)!);

    // Sonde 1 : « be », réussie (was, were, been).
    expect(shownVerb()).toBe('be');
    answerShownVerb();
    advance(700);
    // Puis trois « Je ne sais pas » : arrêt après 3 échecs consécutifs.
    for (let i = 0; i < 3; i++) {
      fireEvent.click(button(/Je ne sais pas/)!);
      advance(1500);
    }
    fireEvent.click(button(/^Commencer$/)!);
    await flushMicrotasks();

    const afterPlacement = loadProfile()!;
    expect(afterPlacement.hasDoneIrrPlacement).toBe(true);
    const be = afterPlacement.irrFacts!.find((f) => f.key === 'be')!;
    expect(be.introduced).toBe(true);
    expect(afterPlacement.irrFacts!.filter((f) => f.introduced)).toHaveLength(1);

    // La séance s'ouvre sur l'introduction des deux verbes suivants.
    expect(document.querySelector('.irr-intro')).not.toBeNull();
    const asked = playIrrSession();
    expect(document.querySelector('.recap-screen')).not.toBeNull();
    expect(asked).toContain('have');
    // Deux intros, leurs re-tests, et « be » en révision bonus.
    expect(asked.length).toBeGreaterThanOrEqual(5);
    expect(asked).toContain('be');

    // Fin de séance : la matière a sa date du jour, la flamme est partagée.
    fireEvent.click(document.querySelector<HTMLButtonElement>('.recap-btn')!);
    expect(document.querySelector('.home-screen')).not.toBeNull();
    const saved = loadProfile()!;
    expect(saved.lastIrrSessionDate).toBe(TODAY);
    expect(saved.lastSessionDate).toBe(TODAY);
    expect(saved.lastMathSessionDate).toBeNull();
    expect(saved.sessionHistory.at(-1)!.kind).toBe('irr');
    expect(saved.irrFacts!.find((f) => f.key === 'have')!.introduced).toBe(true);
  });
});

describe('Profils (specs §16)', () => {
  it('migre un profil antérieur sans ensemencer les verbes', () => {
    const legacy = createNewProfile('Zoé');
    const raw = JSON.parse(exportProfile(legacy)) as Record<string, unknown>;
    for (const field of ['irrFacts', 'irrMysteryTheme', 'hasSeenIrrIntro', 'hasDoneIrrPlacement', 'lastIrrSessionDate']) {
      delete raw[field];
    }
    localStorage.setItem('multiplix-profile', JSON.stringify(raw));
    const migrated = loadProfile()!;
    expect(migrated.irrFacts).toBeUndefined();
    expect(migrated.irrMysteryTheme).toBeDefined();
    expect(migrated.irrMysteryTheme).not.toBe(migrated.conjMysteryTheme);
    expect(migrated.hasDoneIrrPlacement).toBe(false);
    expect(migrated.lastIrrSessionDate).toBeNull();
  });

  it('rejette un import aux verbes mal formés, garde ceux bien formés', () => {
    const p = freshProfile();
    p.irrFacts = createInitialIrrFacts();
    expect(importProfile(exportProfile(p))!.irrFacts).toHaveLength(64);
    const raw = JSON.parse(exportProfile(p)) as Record<string, unknown>;
    raw.irrFacts = [{ key: '', box: 9 }];
    expect(importProfile(JSON.stringify(raw))).toBeNull();
  });

  it('montre les badges de famille une fois la matière ouverte, jamais en anglais', () => {
    const p = freshProfile();
    expect(visibleBadgeDefinitions(p).some((d) => d.id.startsWith('irr-'))).toBe(false);
    p.hasSeenIrrIntro = true;
    expect(visibleBadgeDefinitions(p).filter((d) => d.id.startsWith('irr-famille-'))).toHaveLength(10);
    applyLang('en');
    expect(visibleBadgeDefinitions(p).some((d) => d.id.startsWith('irr-'))).toBe(false);
  });
});
