import { act, cleanup, createEvent, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import { LangProvider } from '../i18n/LangProvider';
import { applyLang } from '../i18n/lang';
import { addProfile, createNewProfile, exportProfile, loadProfile, setActiveProfile } from '../lib/storage';
import { loadWatchCredentials } from '../lib/watchStore';
import { findButton, requireButton, text } from './helpers/dom';
import { mockWatchServer, stubSupabaseEnv } from './helpers/watchServer';
// Préchauffe le chunk lazy de l'espace parent pour que le React.lazy() d'App
// se résolve dans le test.
import '../screens/ParentDashboard';

// ---------------------------------------------------------------------------
// Réglages de l'espace parent : une liste au bas de l'accueil, dont chaque
// ligne ouvre sa page. Ils concernent l'APPAREIL (ses enfants, ses partages,
// ses suivis) et non le profil affiché.
// ---------------------------------------------------------------------------

// Macrotâches, pas seulement microtâches : lecture de fichier, chiffrement et
// fetch du partage ne se règlent pas en une microtâche.
async function flush(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

// Deux enfants sur l'appareil, Léa active.
function seedChildren(): { leaId: string; tomId: string } {
  const lea = { ...createNewProfile('Léa'), hasSeenRulesIntro: true, totalSessions: 17 };
  const tom = { ...createNewProfile('Tom'), hasSeenRulesIntro: true, totalSessions: 9 };
  const leaId = addProfile(lea);
  const tomId = addProfile(tom);
  setActiveProfile(leaId);
  return { leaId, tomId };
}

// Du démarrage (« Qui joue ? ») à l'accueil de l'espace parent.
async function openParentArea(): Promise<void> {
  fireEvent.click(requireButton(/Léa/));
  fireEvent.click(document.querySelector<HTMLButtonElement>('.home-parent-btn')!);
  const operands = Array.from(document.querySelectorAll('.parent-gate-question span'))
    .map((s) => parseInt(s.textContent ?? '', 10))
    .filter((n) => Number.isFinite(n));
  const input = document.querySelector<HTMLInputElement>('.parent-gate-input')!;
  fireEvent.change(input, { target: { value: String(operands[0] * operands[1]) } });
  fireEvent.click(requireButton(/^Valider$/));
  await flush();
}

async function openPage(row: RegExp): Promise<void> {
  fireEvent.click(requireButton(row));
  await flush(2);
}

const pageTitle = () => document.querySelector('.parent-dashboard--settings .parent-title')?.textContent;

// Le nom et le sous-titre d'une ligne de réglage.
function row(title: string): string | null {
  const titles = Array.from(document.querySelectorAll('.parent-setting-title'));
  const found = titles.find((el) => el.textContent === title);
  return found?.parentElement?.textContent ?? null;
}

let ids: { leaId: string; tomId: string };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('multiplix-skip-install', '1');
  stubSupabaseEnv();
  ids = seedChildren();
});

afterEach(() => {
  cleanup();
  applyLang('fr');
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("réglages de l'espace parent", () => {
  it("l'accueil liste les réglages de l'appareil, et chaque ligne ouvre sa page", async () => {
    render(<App />);
    await openParentArea();

    expect(row('Suivi à distance')).not.toBeNull();
    expect(row('Profils et sauvegarde')).toBe('Profils et sauvegardeLéa et Tom · sauvegarde');
    expect(row('Langue')).not.toBeNull();
    expect(row('Aide et infos')).not.toBeNull();

    await openPage(/^Profils et sauvegarde/);
    expect(pageTitle()).toBe('Profils et sauvegarde');
    fireEvent.click(document.querySelector<HTMLButtonElement>('.parent-back-btn')!);
    await openPage(/^Aide et infos/);
    expect(pageTitle()).toBe('Aide et infos');
    expect(findButton(/^Nouveautés$/)).not.toBeNull();
    expect(findButton(/^Confidentialité$/)).not.toBeNull();
  });

  it('la page des profils liste les enfants de l’appareil et marque le profil actif', async () => {
    render(<App />);
    await openParentArea();
    await openPage(/^Profils et sauvegarde/);

    expect(row('Léa')).toBe('LéaProfil actif · 17 séances');
    expect(row('Tom')).toBe('Tom9 séances');
    expect(findButton(/^Ajouter un enfant$/)).not.toBeNull();
    // La suppression nomme le profil qu'elle efface.
    expect(findButton(/^Supprimer le profil de Léa$/)).not.toBeNull();
  });
});

describe('import d’une sauvegarde par fichier', () => {
  // Un vrai événement `change`, comme le navigateur à la sélection d'un
  // fichier : `fireEvent.change` enverrait un `input` sous preact/compat.
  function chooseFile(content: string): void {
    const input = document.querySelector<HTMLInputElement>('.parent-import-input')!;
    const file = new File([content], 'sauvegarde.json', { type: 'application/json' });
    fireEvent(input, createEvent.change(input, { target: { files: [file] } }));
  }

  async function openBackup(): Promise<void> {
    render(<App />);
    await openParentArea();
    await openPage(/^Profils et sauvegarde/);
  }

  it('remplace la progression du profil actif, après confirmation', async () => {
    await openBackup();
    const backup = exportProfile({ ...createNewProfile('Léa'), totalSessions: 42 });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    chooseFile(backup);
    await flush();

    // La confirmation dit ce qu'on s'apprête à remplacer, et par quoi.
    expect(confirmSpy).toHaveBeenCalledWith(
      'Remplacer la progression de Léa par cette sauvegarde (Léa, 42 séances) ?',
    );
    expect(loadProfile()!.totalSessions).toBe(42);
    expect(text()).toContain('Sauvegarde importée : la progression de Léa est restaurée.');
  });

  it("refuse un fichier qui n'est pas une sauvegarde, sans rien toucher", async () => {
    await openBackup();
    const confirmSpy = vi.spyOn(window, 'confirm');

    chooseFile('{ "pas": "une sauvegarde" }');
    await flush();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(loadProfile()!.totalSessions).toBe(17);
    expect(text()).toContain("Ce fichier n'est pas une sauvegarde Tablito.");
  });

  it('annuler la confirmation laisse la progression intacte', async () => {
    await openBackup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    chooseFile(exportProfile({ ...createNewProfile('Léa'), totalSessions: 42 }));
    await flush();

    expect(loadProfile()!.totalSessions).toBe(17);
    expect(text()).not.toContain('Sauvegarde importée');
  });
});

describe('suivi à distance : un partage par enfant de l’appareil', () => {
  it('partage la progression d’un enfant qui n’est pas le profil actif, puis l’arrête', async () => {
    const rows = mockWatchServer({ otherCalls: 'ignore' });
    render(<App />);
    await openParentArea();
    await openPage(/^Suivi à distance/);

    const card = (name: string) =>
      Array.from(document.querySelectorAll('.parent-share-card')).find((c) =>
        c.querySelector('.parent-share-name')?.textContent === name,
      )!;
    expect(card('Tom').textContent).toContain('Progression non partagée');

    fireEvent.click(requireButton(/^Partager la progression de Tom$/));
    await flush(20);

    // Le partage est posé sous l'id de Tom, et celui de Léa reste fermé.
    const tomCreds = loadWatchCredentials(ids.tomId);
    expect(tomCreds).not.toBeNull();
    expect(rows.has(tomCreds!.code)).toBe(true);
    expect(loadWatchCredentials(ids.leaId)).toBeNull();
    expect(card('Tom').textContent).toContain('Progression partagée');

    fireEvent.click(card('Tom').querySelector<HTMLButtonElement>('.parent-watch-remove')!);
    await flush();
    expect(loadWatchCredentials(ids.tomId)).toBeNull();
    expect(rows.has(tomCreds!.code)).toBe(false);
    expect(card('Tom').textContent).toContain('Progression non partagée');
  });
});

describe('langue', () => {
  it('se change sur place, depuis sa ligne de réglage', async () => {
    render(
      <LangProvider>
        <App />
      </LangProvider>,
    );
    await openParentArea();

    fireEvent.click(requireButton(/^English$/));
    await flush(2);
    expect(row('Help and info')).not.toBeNull();
    expect(document.querySelector('.parent-settings-start .parent-overline')?.textContent).toBe(
      'Settings and info',
    );
  });
});
