// Transfert de profil entre appareils (src/lib/transfer.ts) : chiffrement
// bout-en-bout, dépôt/consommation via les RPC Supabase (fetch mocké), et
// comportement au boot (importTransferFromUrl).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { addProfile, createNewProfile, listProfiles, loadProfile } from '../lib/storage';
import {
  packProfile,
  unpackProfile,
  createTransfer,
  importTransferFromUrl,
} from '../lib/transfer';

// jsdom expose parfois un `crypto` sans SubtleCrypto : on garantit l'API
// WebCrypto complète de Node (même implémentation que les navigateurs).
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

function makeProfile(name = 'Léa') {
  const profile = createNewProfile(name);
  profile.totalSessions = 12;
  profile.currentStreak = 4;
  return profile;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('multiplix-lang', 'fr');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://sb.test');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'pk_test');
  window.location.hash = '';
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('packProfile / unpackProfile', () => {
  it('fait un aller-retour fidèle (gzip + AES-GCM)', async () => {
    const profile = makeProfile();
    const { payload, keyB64 } = await packProfile(profile);
    // Le blob est opaque : le JSON du profil n'y apparaît pas en clair.
    expect(payload).not.toContain('Léa');
    const restored = await unpackProfile(payload, keyB64);
    expect(restored).not.toBeNull();
    expect(restored!.name).toBe('Léa');
    expect(restored!.totalSessions).toBe(12);
    expect(restored!.facts).toHaveLength(36);
  });

  it('refuse une mauvaise clé', async () => {
    const { payload } = await packProfile(makeProfile());
    const { keyB64: otherKey } = await packProfile(makeProfile());
    expect(await unpackProfile(payload, otherKey)).toBeNull();
  });
});

describe('createTransfer + importTransferFromUrl', () => {
  it('transfère un profil de bout en bout via les RPC', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        if (String(url).endsWith('/rpc/create_transfer')) {
          store.set(body.p_code, body.p_payload);
          return new Response(null, { status: 204 });
        }
        if (String(url).endsWith('/rpc/read_transfer')) {
          const payload = store.get(body.p_code) ?? null;
          store.delete(body.p_code); // lecture unique, comme côté SQL
          return new Response(JSON.stringify(payload), { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const link = await createTransfer(makeProfile('Nino'));
    expect(link).toMatch(/#transfer=[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);

    // « Nouveau téléphone » : appareil vierge qui ouvre le lien.
    localStorage.clear();
    window.location.hash = link!.slice(link!.indexOf('#'));
    expect(await importTransferFromUrl()).toBe('imported');
    expect(loadProfile()?.name).toBe('Nino');
    expect(loadProfile()?.totalSessions).toBe(12);
    // Le fragment est nettoyé : un refresh ne retente pas l'import.
    expect(window.location.hash).toBe('');

    // Re-scan du même QR : le code a été consommé côté serveur → erreur.
    window.location.hash = link!.slice(link!.indexOf('#'));
    expect(await importTransferFromUrl()).toBe('error');
  });

  it("met à jour le profil existant du même enfant au lieu de le dupliquer", async () => {
    const profile = makeProfile('Nino');
    const { payload, keyB64 } = await packProfile({ ...profile, totalSessions: 20 });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );

    // L'appareil a déjà ce profil (même prénom + même date de début)…
    addProfile(profile);
    window.location.hash = `#transfer=abcdefgh12345678.${keyB64}`;
    expect(await importTransferFromUrl()).toBe('imported');
    // …donc pas de doublon, et la progression transférée a pris le dessus.
    expect(listProfiles()).toHaveLength(1);
    expect(loadProfile()?.totalSessions).toBe(20);
  });

  it("renvoie 'error' si le code est expiré ou déjà consommé", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('null', { status: 200 })));
    window.location.hash = '#transfer=abcdefgh12345678.aaaabbbbccccdddd';
    expect(await importTransferFromUrl()).toBe('error');
    expect(listProfiles()).toHaveLength(0);
  });

  it('ne fait rien sans fragment #transfer=', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await importTransferFromUrl()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
