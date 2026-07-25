import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import { addProfile, createNewProfile, listProfiles } from '../lib/storage';
import { startWatch, addWatched, type WatchPairing } from '../lib/watch';
import { listWatched } from '../lib/watchStore';
import { mockWatchServer, stubSupabaseEnv } from './helpers/watchServer';
// Préchauffe le chunk de ParentDashboard pour que le React.lazy() côté App.tsx
// se résolve en synchrone dans les tests qui ouvrent le dashboard.
import '../screens/ParentDashboard';

// ---------------------------------------------------------------------------
// Suivi à distance, vu de l'app entière : l'appareil du parent affiche la
// progression d'un enfant qui pratique ailleurs. Le cas nerveux est l'appareil
// SANS profil local — un parent qui découvre Tablito en scannant le QR de son
// enfant ne doit jamais tomber sur l'onboarding enfant (prénom, test de
// placement), qui n'a aucun sens pour lui.
// ---------------------------------------------------------------------------

// Joue le côté enfant : un profil pratiquant, partagé, et le lien à scanner.
async function shareChildProgress(name: string, totalSessions = 9) {
  const profile = createNewProfile(name);
  profile.hasSeenRulesIntro = true;
  profile.totalSessions = totalSessions;
  const id = addProfile(profile);
  const link = (await startWatch(id, profile))!;
  return { link, id, profile };
}

// Monte l'app et laisse le React.lazy() de ParentDashboard se résoudre : il se
// règle en microtâche, donc le tout premier rendu d'un fichier de test a besoin
// d'un tick de plus que les suivants (où le module est déjà résolu).
async function renderApp(props: { watchPairing?: WatchPairing | 'error' | null } = {}) {
  await act(async () => {
    render(<App {...props} />);
  });
  await flush();
}

// Boucle de flush, dans l'esprit de openParentDashboard (multiProfile.test.tsx),
// mais sur des MACROtâches : deux chaînes asynchrones s'enchaînent ici, l'import
// dynamique de ParentDashboard (lazy + Suspense) puis la relecture du suivi, et
// le Response.json() d'undici ne se règle pas en microtâche — un flush de
// Promise.resolve() laisserait la vue bloquée sur « Récupération… ».
async function flush(rounds = 20) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function findButton(label: RegExp): HTMLButtonElement | null {
  return (
    (Array.from(document.querySelectorAll('button')).find((b) =>
      label.test((b.textContent ?? '').trim()),
    ) as HTMLButtonElement | null) ?? null
  );
}

function tabLabels(): string[] {
  return Array.from(document.querySelectorAll('.parent-op-tabs .progress-tab')).map((t) =>
    (t.textContent ?? '').trim(),
  );
}

// Nombre affiché sous le libellé « Séances » de la vue d'ensemble.
function sessionsShown(): string {
  const cards = Array.from(document.querySelectorAll('.parent-stat-card'));
  const card = cards.find((c) =>
    /Séances/.test(c.querySelector('.parent-stat-label')?.textContent ?? ''),
  );
  return card?.querySelector('.parent-stat-value')?.textContent ?? '';
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('multiplix-lang', 'fr');
  stubSupabaseEnv();
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('appareil qui ne fait que suivre (aucun profil local)', () => {
  // Reproduit l'appareil du parent : l'enfant a partagé depuis le sien, le
  // parent a scanné, et il ne reste QUE l'entrée de suivi en local.
  async function seedWatcherOnly(name = 'Zoé', totalSessions = 9) {
    const { link } = await shareChildProgress(name, totalSessions);
    localStorage.clear();
    localStorage.setItem('multiplix-lang', 'fr');
    const paired = await addWatched(link);
    return { link, paired: paired! };
  }

  it('boote sur l’espace parent au lieu de l’onboarding enfant', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await seedWatcherOnly();
    expect(listProfiles()).toHaveLength(0);

    await renderApp();

    // Espace parent, pas le Welcome : aucun champ de prénom ni test de placement.
    expect(document.querySelector('.parent-dashboard')).not.toBeNull();
    expect(document.querySelector('.welcome-screen')).toBeNull();
    expect(sessionsShown()).toBe('9');
    // Rien où revenir : pas de chevron de retour.
    expect(document.querySelector('.parent-back-btn')).toBeNull();
  });

  it('masque les sections propres à un profil local', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await seedWatcherOnly();

    await renderApp();

    // Sauvegarde / transfert / rappels / suppression parleraient d'une
    // progression qui n'est pas sur cet appareil.
    expect(findButton(/^Transférer$/)).toBeNull();
    expect(findButton(/^Supprimer ce profil$/)).toBeNull();
    expect(document.querySelector('.notification-settings')).toBeNull();
    // En revanche, la porte de sortie vers un profil local est offerte.
    expect(findButton(/Créer un profil sur cet appareil/)).not.toBeNull();
  });

  it('laisse ressortir de l’onboarding après « Créer un profil sur cet appareil »', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await seedWatcherOnly();

    await renderApp();
    await act(async () => {
      fireEvent.click(findButton(/Créer un profil sur cet appareil/)!);
    });

    // L'onboarding enfant s'ouvre — mais il DOIT être annulable : sans profil
    // local, l'ancien garde (`profileCount > 0`) n'affichait aucun bouton
    // Annuler et le parent restait piégé là, sans retour vers son espace.
    const cancel = findButton(/^Annuler$/);
    expect(cancel).not.toBeNull();
    await act(async () => {
      fireEvent.click(cancel!);
    });
    await flush();
    expect(document.querySelector('.parent-dashboard')).not.toBeNull();
  });

  it('affiche directement l’enfant appairé au boot depuis un #watch=', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    const { paired } = await seedWatcherOnly('Nino', 21);

    await renderApp({ watchPairing: paired });

    expect(document.querySelector('.parent-title')?.textContent).toContain('Nino');
    expect(sessionsShown()).toBe('21');
  });

  it('reste sur l’espace parent si l’appairage a échoué, pour pouvoir réessayer', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await seedWatcherOnly();

    await renderApp({ watchPairing: 'error' });

    expect(document.querySelector('.parent-dashboard')).not.toBeNull();
    expect(findButton(/Suivre un enfant à distance/)).not.toBeNull();
  });
  it('n’affiche pas un écran blanc quand un QR périmé est scanné sur un appareil vierge', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    // Appareil totalement vierge : ni profil local, ni suivi déjà connu. C'est le
    // cas d'un parent sans Tablito qui scanne un QR expiré ou révoqué.
    expect(listProfiles()).toHaveLength(0);
    expect(listWatched()).toHaveLength(0);

    await renderApp({ watchPairing: 'error' });

    // Quelque chose DOIT s'afficher, avec un chemin de récupération.
    expect(document.querySelector('.parent-dashboard')).not.toBeNull();
    expect(findButton(/Suivre un enfant à distance/)).not.toBeNull();
  });
});

// Crée un profil via le vrai parcours Welcome (prénom + « Passer le test »),
// puis ferme l'intro des règles. Même helper que multiProfile.test.tsx.
function completeWelcome(name: string): void {
  fireEvent.click(findButton(/^Suivant/)!);
  const nameInput = document.querySelector<HTMLInputElement>('input.welcome-input')!;
  fireEvent.change(nameInput, { target: { value: name } });
  fireEvent.click(findButton(/^C'est moi/)!);
  fireEvent.click(findButton(/Passer le test/)!);
  fireEvent.click(findButton(/C'est parti/)!);
  fireEvent.click(findButton(/Suivant/)!);
  fireEvent.click(findButton(/J'ai compris/)!);
}

describe('appareil mixte : un profil local ET un enfant suivi', () => {
  // Le cas d'usage d'origine : le parent pratique lui-même sur son téléphone et
  // suit son enfant, qui pratique sur un autre appareil.
  async function seedMixed() {
    const { link } = await shareChildProgress('Zoé', 30);
    localStorage.clear();
    localStorage.setItem('multiplix-lang', 'fr');
    await addWatched(link);
    const mine = createNewProfile('Papa');
    mine.hasSeenRulesIntro = true;
    mine.totalSessions = 4;
    addProfile(mine);
  }

  it('un suiveur peut se créer un profil après coup, et les deux coexistent', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    // Départ : appareil de parent, aucun profil local, un enfant suivi.
    const { link } = await shareChildProgress('Zoé', 30);
    localStorage.clear();
    localStorage.setItem('multiplix-lang', 'fr');
    await addWatched(link);

    await renderApp();
    // Il est bien sur l'espace parent, et la porte de sortie est offerte.
    await act(async () => {
      fireEvent.click(findButton(/Créer un profil sur cet appareil/)!);
    });

    // Parcours d'onboarding complet, pour lui cette fois. Hors act() : fireEvent
    // enveloppe déjà chaque événement, et tout batcher empêcherait les étapes de
    // Welcome de se rendre entre les clics.
    completeWelcome('Papa');
    await flush();

    // Le profil local existe SANS avoir chassé le suivi de Zoé.
    expect(listProfiles().map((p) => p.name)).toEqual(['Papa']);
    expect(listWatched().map((w) => w.name)).toEqual(['Zoé']);
    // Et il atterrit sur SON accueil, pas sur l'espace parent.
    expect(document.querySelector('.home-greeting')?.textContent).toContain('Papa');
  });

  it('propose les deux sources et bascule de l’une à l’autre', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await seedMixed();

    await renderApp();
    // Boot normal : l'accueil de l'enfant local, pas l'espace parent.
    expect(document.querySelector('.parent-dashboard')).toBeNull();

    // Le suivi ne pollue PAS les profils locaux (« Qui joue ? » reste mono).
    expect(listProfiles()).toHaveLength(1);
    expect(listWatched()).toHaveLength(1);
  });

  it('sélecteur de source : profil local par défaut, puis l’enfant distant', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await seedMixed();
    const paired = listWatched()[0];

    // On ouvre l'espace parent via l'appairage au boot, ce qui évite de rejouer
    // le ParentGate (déjà couvert par multiProfile.test.tsx).
    const child = { ...createNewProfile('Zoé'), totalSessions: 30 };
    await renderApp({
      watchPairing: { entry: paired, snapshot: { profile: child, updatedAt: new Date().toISOString() } },
    });

    // Deux onglets de source : le profil local et l'enfant suivi.
    const labels = tabLabels();
    expect(labels.some((l) => /Papa/.test(l))).toBe(true);
    expect(labels.some((l) => /Zoé/.test(l) && /distance/.test(l))).toBe(true);

    // On arrive sur l'enfant scanné…
    expect(sessionsShown()).toBe('30');

    // …et la bascule vers le profil local montre bien SES stats.
    const localTab = Array.from(
      document.querySelectorAll('.parent-op-tabs .progress-tab'),
    ).find((t) => /Papa/.test(t.textContent ?? '')) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(localTab);
    });
    expect(sessionsShown()).toBe('4');
    // Sur le profil local, les actions locales réapparaissent.
    expect(findButton(/^Supprimer ce profil$/)).not.toBeNull();
  });
});
