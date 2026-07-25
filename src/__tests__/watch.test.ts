// Suivi à distance (src/lib/watch.ts) : l'appareil de l'enfant publie des
// instantanés chiffrés durables, l'appareil du parent les relit sans jamais
// installer le profil — y compris quand il n'a aucun profil local (parent qui
// découvre Tablito en scannant le QR).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addProfile, createNewProfile, listProfiles } from '../lib/storage';
import {
  startWatch,
  stopWatch,
  publishWatchSnapshot,
  addWatched,
  fetchWatched,
  importWatchFromUrl,
} from '../lib/watch';
import {
  listWatched,
  loadWatchCredentials,
  parseWatchLink,
  removeWatched,
} from '../lib/watchStore';
import { mockWatchServer, stubSupabaseEnv } from './helpers/watchServer';

function makeProfile(name = 'Zoé') {
  const profile = createNewProfile(name);
  profile.totalSessions = 7;
  profile.currentStreak = 3;
  return profile;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('multiplix-lang', 'fr');
  stubSupabaseEnv();
  window.location.hash = '';
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('côté publieur (appareil de l’enfant)', () => {
  it('ouvre un partage, mémorise les identifiants et publie un instantané', async () => {
    const rows = mockWatchServer();
    const profile = makeProfile();
    const id = addProfile(profile);

    const link = await startWatch(id, profile);
    expect(link).toMatch(/#watch=[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
    expect(rows.size).toBe(1);

    const creds = loadWatchCredentials(id);
    expect(creds).not.toBeNull();
    // Le blob déposé est opaque : le prénom n'y apparaît pas.
    expect(rows.get(creds!.code)!.payload).not.toContain('Zoé');
  });

  it('réutilise le même code si le partage est déjà ouvert', async () => {
    mockWatchServer();
    const profile = makeProfile();
    const id = addProfile(profile);

    const first = await startWatch(id, profile);
    const second = await startWatch(id, profile);
    // Un code neuf couperait silencieusement les appareils déjà appairés.
    expect(second).toBe(first);
  });

  it('ne mémorise rien si le premier dépôt échoue', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));
    const profile = makeProfile();
    const id = addProfile(profile);

    expect(await startWatch(id, profile)).toBeNull();
    // Sinon l'espace parent afficherait « partagé » sans ligne côté serveur.
    expect(loadWatchCredentials(id)).toBeNull();
  });

  it('rafraîchit l’instantané en fin de séance, no-op si non partagé', async () => {
    const rows = mockWatchServer();
    const profile = makeProfile();
    const id = addProfile(profile);

    // Non partagé : aucun appel réseau.
    await publishWatchSnapshot(id, profile);
    expect(rows.size).toBe(0);

    await startWatch(id, profile);
    const { code } = loadWatchCredentials(id)!;
    const firstBlob = rows.get(code)!.payload;

    await publishWatchSnapshot(id, { ...profile, totalSessions: 8 });
    expect(rows.get(code)!.payload).not.toBe(firstBlob);
    expect(rows.size).toBe(1); // rafraîchi, pas empilé
  });
});

describe('côté suiveur (appareil du parent)', () => {
  // Rejoue un appairage complet : l'enfant partage, le parent scanne. Renvoie
  // le lien et le profil publié.
  async function pairedLink(name = 'Zoé') {
    const profile = makeProfile(name);
    const id = addProfile(profile);
    const link = (await startWatch(id, profile))!;
    return { link, profile, id };
  }

  it('suit un profil sans jamais l’installer localement', async () => {
    mockWatchServer();
    const { link } = await pairedLink();

    // « Téléphone du parent » : appareil distinct, sans aucun profil.
    localStorage.clear();
    const paired = await addWatched(link);

    expect(paired?.snapshot.profile.name).toBe('Zoé');
    expect(paired?.snapshot.profile.totalSessions).toBe(7);
    expect(paired?.snapshot.updatedAt).toBeTruthy();
    // L'entrée créée est renvoyée : l'UI sélectionne le bon onglet sans avoir à
    // retrouver le suivi par prénom (deux enfants peuvent s'appeler pareil).
    expect(paired?.entry.code).toBe(parseWatchLink(link)!.code);
    // L'essentiel : le profil suivi ne rejoint PAS les profils locaux, sinon il
    // apparaîtrait dans « Qui joue ? » et une séance dessus le ferait diverger.
    expect(listProfiles()).toHaveLength(0);
    expect(listWatched()).toHaveLength(1);
    expect(listWatched()[0].name).toBe('Zoé');
  });

  it('voit les mises à jour publiées ensuite (lecture non consommante)', async () => {
    mockWatchServer();
    const { link, profile, id } = await pairedLink();
    await addWatched(link);
    const creds = parseWatchLink(link)!;

    // Deux relectures d'affilée : rien n'est consommé côté serveur.
    expect(await fetchWatched(creds)).not.toBe('error');
    await publishWatchSnapshot(id, { ...profile, totalSessions: 42 });

    const result = await fetchWatched(creds);
    expect(typeof result).toBe('object');
    expect(typeof result === 'object' && result.profile.totalSessions).toBe(42);
  });

  it('signale un partage arrêté côté enfant', async () => {
    mockWatchServer();
    const { link, id } = await pairedLink();
    await addWatched(link);

    await stopWatch(id);
    expect(loadWatchCredentials(id)).toBeNull();
    // « revoked » et non « error » : c'est définitif, le message doit différer.
    expect(await fetchWatched(parseWatchLink(link)!)).toBe('revoked');
  });

  it('ne duplique pas un QR rescanné et suit le renommage de l’enfant', async () => {
    mockWatchServer();
    const { link, profile, id } = await pairedLink('Zoe');

    await addWatched(link);
    await addWatched(link);
    expect(listWatched()).toHaveLength(1);

    // L'enfant corrige son prénom sur son appareil → le libellé suit.
    await publishWatchSnapshot(id, { ...profile, name: 'Zoé' });
    await fetchWatched(parseWatchLink(link)!);
    expect(listWatched()[0].name).toBe('Zoé');
  });

  it('refuse un lien étranger ou une clé invalide sans rien mémoriser', async () => {
    mockWatchServer();
    const { link } = await pairedLink();

    expect(parseWatchLink('https://example.com/menu-du-jour')).toBeNull();
    expect(await addWatched('bonjour')).toBeNull();
    // Bonne ligne, mauvaise clé : le déchiffrement échoue.
    const tampered = link.replace(/\.[A-Za-z0-9_-]+$/, '.aaaabbbbccccddddeeeeffff');
    expect(await addWatched(tampered)).toBeNull();
    expect(listWatched()).toHaveLength(0);
  });

  it('oublie un suivi retiré', async () => {
    mockWatchServer();
    const { link } = await pairedLink();
    await addWatched(link);
    removeWatched(parseWatchLink(link)!.code);
    expect(listWatched()).toHaveLength(0);
  });
});

describe('appairage au boot (importWatchFromUrl)', () => {
  it('appaire depuis le fragment sur un appareil vierge et nettoie l’URL', async () => {
    mockWatchServer();
    const profile = makeProfile('Nino');
    const link = (await startWatch(addProfile(profile), profile))!;

    // Parent qui découvre Tablito en scannant le QR : rien en local.
    localStorage.clear();
    window.location.hash = link.slice(link.indexOf('#'));

    const result = await importWatchFromUrl();
    expect(result).not.toBe('error');
    expect(result !== 'error' && result?.snapshot.profile.name).toBe('Nino');
    expect(listWatched()).toHaveLength(1);
    expect(listProfiles()).toHaveLength(0);
    // Fragment nettoyé : un refresh ne relance pas l'appairage.
    expect(window.location.hash).toBe('');
  });

  it('ne fait rien sans fragment #watch=', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await importWatchFromUrl()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renvoie « error » si le code est inconnu', async () => {
    mockWatchServer();
    window.location.hash = '#watch=abcdefgh12345678.aaaabbbbccccddddeeeeffff';
    expect(await importWatchFromUrl()).toBe('error');
    expect(listWatched()).toHaveLength(0);
  });
});
