import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import { addProfile, createNewProfile, listProfiles } from '../lib/storage';
import { startWatch, addWatched, type WatchPairing } from '../lib/watch';
import { listWatched } from '../lib/watchStore';
import { childChip, childChips, sessionsShown } from './helpers/dom';
import { mockWatchServer, stubSupabaseEnv } from './helpers/watchServer';
// Préchauffe les chunks lazy (espace parent, et sa page Nouveautés) pour que
// leur React.lazy() se résolve en synchrone dans les tests qui les ouvrent.
import '../screens/ParentDashboard';
import '../screens/ChangelogScreen';

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
async function renderApp(
  props: { watchPairing?: WatchPairing | 'error' | null; recapRequested?: boolean } = {},
) {
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

  it('le geste retour ramène d’une page de matière à l’accueil, sans fermer l’app', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await seedWatcherOnly();

    await renderApp();
    await act(async () => {
      fireEvent.click(document.querySelector<HTMLButtonElement>('.parent-subject-card--math')!);
    });

    // L'accueil n'a pas de retour sur cet appareil, la page de matière si :
    // sans entrée d'historique, le geste y fermerait l'app.
    expect(document.querySelector('.parent-dashboard--subject')).not.toBeNull();
    expect(document.querySelector('.parent-back-btn')).not.toBeNull();
    expect(window.history.state?.tablitoBack).toBe(true);

    await act(async () => window.history.back());
    await flush();
    expect(document.querySelector('.parent-dashboard--subject')).toBeNull();
    expect(sessionsShown()).toBe('9');
    expect(document.querySelector('.parent-back-btn')).toBeNull();
  });

  it('masque les sections propres à un profil local', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await seedWatcherOnly();

    await renderApp();

    // Profils, sauvegarde et suppression parleraient d'une progression qui
    // n'est pas sur cet appareil : pas de ligne pour eux dans les réglages.
    expect(findButton(/^Profils et sauvegarde/)).toBeNull();
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
    // Le chemin pour réessayer : la page du suivi à distance, et son scanner.
    await act(async () => {
      fireEvent.click(findButton(/^Suivi à distance/)!);
    });
    expect(findButton(/^Scanner un QR code$/)).not.toBeNull();
  });
  it('n’affiche pas un écran blanc quand un QR périmé est scanné sur un appareil vierge', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    // Appareil totalement vierge : ni profil local, ni suivi déjà connu. C'est le
    // cas d'un parent sans Tablito qui scanne un QR expiré ou révoqué.
    expect(listProfiles()).toHaveLength(0);
    expect(listWatched()).toHaveLength(0);

    await renderApp({ watchPairing: 'error' });

    // Quelque chose DOIT s'afficher, avec un chemin de récupération : le
    // bouton mène au scanner de la page du suivi à distance.
    expect(document.querySelector('.parent-dashboard')).not.toBeNull();
    await act(async () => {
      fireEvent.click(findButton(/^Suivre un enfant à distance$/)!);
    });
    expect(findButton(/^Scanner un QR code$/)).not.toBeNull();
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

describe('lien profond #recap (clic sur la notification hebdomadaire)', () => {
  it('ouvre l’espace parent même quand un profil local existe', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    const { link } = await shareChildProgress('Zoé', 12);
    localStorage.clear();
    localStorage.setItem('multiplix-lang', 'fr');
    await addWatched(link);
    const mine = createNewProfile('Papa');
    mine.hasSeenRulesIntro = true;
    addProfile(mine);

    // Boot ordinaire : l'accueil de l'enfant local.
    await renderApp();
    expect(document.querySelector('.parent-dashboard')).toBeNull();
    cleanup();

    // Clic sur la notification : on atterrit dans l'espace parent, sinon elle
    // déposerait le parent sur un écran qui n'a rien à voir avec le recap.
    // (La consommation du fragment #recap elle-même vit dans main.tsx boot(),
    // avec celle des autres fragments.)
    await renderApp({ recapRequested: true });
    expect(document.querySelector('.parent-dashboard')).not.toBeNull();

    // …et sur l'enfant SUIVI, pas sur le profil local : la notification parle de
    // la progression de l'enfant, l'ouvrir sur « Papa » obligerait à taper
    // l'onglet à chaque fois.
    expect(document.querySelector('.parent-title')?.textContent).toContain('Zoé');
    expect(childChips().find((c) => c.active)?.name).toBe('Zoé');
  });
});

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

  // Espace parent ouvert sur l'enfant suivi, avec le profil local disponible en
  // 2e onglet. L'appairage au boot évite de rejouer le ParentGate (déjà couvert
  // par multiProfile.test.tsx). Le snapshot distant est construit ici, une fois :
  // trois rédactions du « Zoé, 30 séances » dériveraient en silence.
  async function renderMixed() {
    await seedMixed();
    const entry = listWatched()[0];
    const child = { ...createNewProfile('Zoé'), totalSessions: 30 };
    await renderApp({
      watchPairing: { entry, snapshot: { profile: child, updatedAt: new Date().toISOString() } },
    });
    return { entry, child };
  }

  async function selectChild(name: string) {
    await act(async () => {
      fireEvent.click(childChip(name));
    });
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
    await renderMixed();

    // Un seul sélecteur pour les deux : le profil de l'appareil, puis l'enfant
    // suivi, marqué « à distance ».
    expect(childChips()).toEqual([
      { name: 'Papa', remote: false, active: false },
      { name: 'Zoé', remote: true, active: true },
    ]);

    // On arrive sur l'enfant scanné…
    expect(sessionsShown()).toBe('30');
    // Les réglages tiennent à l'appareil, pas au profil affiché : les profils
    // de cet appareil restent à portée, même sur l'enfant suivi.
    expect(findButton(/^Profils et sauvegarde/)).not.toBeNull();

    // …et la bascule vers le profil local montre bien SES stats.
    await selectChild('Papa');
    expect(sessionsShown()).toBe('4');
  });

  // « J'ai coché joindre l'historique détaillé du profil mais je ne sais pas si
  // ça va envoyer uniquement le mien ou aussi celui de Zoé que je suis à
  // distance » (avis du 15/09/2026). C'était le sien — donc un avis qui parlait
  // de l'enfant partait sans l'historique qui aurait permis de le reproduire.
  // L'avis suit désormais l'onglet ouvert.
  it('l’avis joint le profil AFFICHÉ, enfant suivi à distance compris', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await renderMixed();

    // « Envoyer un avis » vit dans la page « Aide et infos ».
    const openFeedback = async () => {
      await act(async () => {
        fireEvent.click(findButton(/^Aide et infos/)!);
      });
      await act(async () => {
        fireEvent.click(findButton(/^Envoyer un avis/)!);
      });
    };
    // Crochet stable plutôt que le texte du libellé : recopier la copy ici la
    // ferait dériver, et un `?? ''` rendrait l'assertion négative vacuante.
    const attachLabel = () => document.querySelector('.feedback-checkbox')?.textContent ?? null;

    // Ce qui part vraiment, pas seulement ce que le libellé annonce : le
    // snapshot est reconnaissable à son nombre de séances (Zoé 30, Papa 4).
    const sentSnapshot = async () => {
      const mock = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock;
      const call = [...mock.calls].reverse().find((c) => String(c[0]).includes('/feedback'));
      expect(call, 'aucun POST de feedback intercepté').toBeDefined();
      return JSON.parse(String((call![1] as RequestInit).body)).context;
    };
    const sendFeedback = async () => {
      fireEvent.input(document.querySelector('textarea')!, { target: { value: 'coucou' } });
      fireEvent.click(document.querySelector('.feedback-checkbox input')!);
      await act(async () => {
        fireEvent.click(findButton(/^Envoyer$/)!);
      });
      return sentSnapshot();
    };

    // Onglet de l'enfant suivi : c'est SON historique qui part.
    await openFeedback();
    expect(attachLabel()).toContain('Zoé');
    expect(attachLabel()).not.toContain('Papa');
    const remote = await sendFeedback();
    expect(remote.profile_snapshot.totalSessions).toBe(30);
    // Le user-agent décrit l'appareil du parent, l'historique celui de l'enfant :
    // sans ce champ, l'avis se relirait sur le mauvais appareil.
    expect(remote.profile_source).toBe('watched');
    expect(remote.profile_fetched_at).toBeTruthy();
    await act(async () => {
      // Après l'envoi, la modale passe sur l'écran de remerciement.
      fireEvent.click(document.querySelector<HTMLButtonElement>('.modal-close-btn')!);
    });
    // Retour à l'accueil de l'espace parent, où se choisit le profil affiché.
    await act(async () => {
      fireEvent.click(document.querySelector<HTMLButtonElement>('.parent-back-btn')!);
    });

    // Bascule sur le profil local : l'avis suit.
    await selectChild('Papa');
    await openFeedback();
    expect(attachLabel()).toContain('Papa');
    expect(attachLabel()).not.toContain('Zoé');
    const local = await sendFeedback();
    expect(local.profile_snapshot.totalSessions).toBe(4);
    expect(local.profile_source).toBe('local');
    expect(local.profile_fetched_at).toBeUndefined();
  });

  // Quitter la page d'aide par le geste retour, fenêtre d'avis ouverte, la
  // faisait resurgir à l'ouverture de la page de réglage suivante.
  it('la fenêtre d’avis se referme avec sa page, même quittée par le geste retour', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await renderMixed();
    await act(async () => {
      fireEvent.click(findButton(/^Aide et infos/)!);
    });
    await act(async () => {
      fireEvent.click(findButton(/^Envoyer un avis/)!);
    });
    expect(document.querySelector('.modal-overlay')).not.toBeNull();

    await act(async () => window.history.back());
    await flush();
    expect(document.querySelector('.parent-dashboard--settings')).toBeNull();
    expect(document.querySelector('.modal-overlay')).toBeNull();

    await act(async () => {
      fireEvent.click(findButton(/^Suivi à distance/)!);
    });
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  // Les pages d'information ne démontent plus l'espace parent : la source
  // affichée (ici le profil local, qui n'est pas celle du démarrage) survit à
  // l'aller-retour.
  it('revenir des Nouveautés garde la source affichée', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await renderMixed();
    await selectChild('Papa');

    await act(async () => {
      fireEvent.click(findButton(/^Aide et infos/)!);
    });
    await act(async () => {
      fireEvent.click(findButton(/^Nouveautés$/)!);
    });
    await flush();
    expect(document.querySelector('.changelog-screen')).not.toBeNull();

    await act(async () => {
      fireEvent.click(document.querySelector<HTMLButtonElement>('.changelog-back-btn')!);
    });
    await act(async () => {
      fireEvent.click(document.querySelector<HTMLButtonElement>('.parent-back-btn')!);
    });
    expect(childChips().find((c) => c.active)?.name).toBe('Papa');
    expect(sessionsShown()).toBe('4');
  });

  // L'espace parent reste monté quand son dernier profil local disparaît : il
  // doit alors basculer sur l'enfant suivi, pas afficher un espace vide.
  it('supprimer le dernier profil local montre l’enfant suivi', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await renderMixed();
    await selectChild('Papa');

    await act(async () => {
      fireEvent.click(findButton(/^Profils et sauvegarde/)!);
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => {
      fireEvent.click(findButton(/^Supprimer le profil de Papa$/)!);
    });
    await flush();

    expect(listProfiles()).toHaveLength(0);
    // Retour à l'accueil de l'espace parent, sans page de réglage orpheline.
    expect(document.querySelector('.parent-dashboard--settings')).toBeNull();
    expect(document.querySelector('.parent-title')?.textContent).toBe('Zoé');
    expect(sessionsShown()).toBe('30');
  });
});
