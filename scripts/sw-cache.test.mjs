// Cycles de vie des caches du Service Worker.
//
// Le point sensible : les médias lourds (images mystère, MP3) sont lazy-cachés
// et NE DOIVENT PAS être jetés par le `activate` d'un nouveau build. Ils l'ont
// été pendant longtemps (un seul cache, versionné par build) → ~13 Mo d'images
// et ~55 Mo d'audio repartaient sur le réseau à chaque déploiement.

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STANDALONE_DOCS } from './cache-config.mjs';

const SW_SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sw.js');

const VERSION = '20260101000000';
const LAZY_GROUPS = { audio: ['/audio/'], media: ['/mystery/', '/splash/'] };
const LAZY_VERSIONS = { audio: 'aaaaaaaaaaaa', media: 'mmmmmmmmmmmm' };

const SHELL_CACHE = `tablito-${VERSION}`;
const AUDIO_CACHE = `tablito-audio-${LAZY_VERSIONS.audio}`;
const MEDIA_CACHE = `tablito-media-${LAZY_VERSIONS.media}`;

class FakeCache {
  constructor() { this.entries = new Map(); }
  async put(req, res) { this.entries.set(req.url, res); }
  async add(url) { this.entries.set(new URL(url, 'https://tablito.app').href, { body: url }); }
  async match(req) { return this.entries.get(req.url) ?? null; }
}

class FakeCaches {
  constructor(names = []) {
    this.store = new Map(names.map((n) => [n, new FakeCache()]));
  }
  async open(name) {
    if (!this.store.has(name)) this.store.set(name, new FakeCache());
    return this.store.get(name);
  }
  async keys() { return [...this.store.keys()]; }
  async delete(name) { return this.store.delete(name); }
  async match(req) {
    const key = typeof req === 'string' ? new URL(req, 'https://tablito.app').href : req.url;
    for (const c of this.store.values()) if (c.entries.has(key)) return c.entries.get(key);
    return null;
  }
}

// Charge sw.js avec ses marqueurs substitués (ce que fait scripts/build.mjs) et
// renvoie les handlers enregistrés, plus le CacheStorage qu'ils manipulent.
async function loadSW(existingCaches = []) {
  const src = (await fs.readFile(SW_SRC, 'utf8'))
    .replaceAll('__VERSION__', JSON.stringify(VERSION))
    .replaceAll('__BASE__', JSON.stringify('/'))
    .replaceAll('__ASSETS__', JSON.stringify(['/index.html']))
    .replaceAll('__LAZY_GROUPS__', JSON.stringify(LAZY_GROUPS))
    .replaceAll('__LAZY_VERSIONS__', JSON.stringify(LAZY_VERSIONS))
    .replaceAll('__STANDALONE_DOCS__', JSON.stringify(STANDALONE_DOCS));

  const handlers = {};
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    location: { origin: 'https://tablito.app' },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    registration: { showNotification: async () => {} },
  };
  const caches = new FakeCaches(existingCaches);
  const fetched = [];
  const fetchImpl = async (req) => {
    fetched.push(req.url);
    return { ok: true, type: 'basic', clone: () => ({ body: req.url }) };
  };

  new Function('self', 'caches', 'fetch', src)(self, caches, fetchImpl);
  return { handlers, caches, fetched };
}

// Fait passer une requête GET dans le handler `fetch` et attend la réponse.
async function get(handlers, url) {
  const request = { method: 'GET', url: new URL(url, 'https://tablito.app').href, mode: 'no-cors' };
  let responded;
  handlers.fetch({ request, respondWith: (p) => { responded = p; } });
  await responded;
}

// Fait passer une NAVIGATION dans le handler `fetch`. Renvoie la réponse promise
// par le SW, ou null s'il s'est abstenu — auquel cas le navigateur gère seul.
function navigate(handlers, url) {
  const request = { method: 'GET', url: new URL(url, 'https://tablito.app').href, mode: 'navigate' };
  let responded = null;
  handlers.fetch({ request, respondWith: (p) => { responded = p; } });
  return responded;
}

describe('activate', () => {
  it('garde les caches média quand seule la version du build change', async () => {
    const { handlers, caches } = await loadSW([
      'tablito-20251231000000', // shell du build précédent
      AUDIO_CACHE,
      MEDIA_CACHE,
    ]);

    const waits = [];
    await handlers.activate({ waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);

    expect((await caches.keys()).sort()).toEqual([AUDIO_CACHE, MEDIA_CACHE].sort());
  });

  it("purge un cache média dont le contenu a changé, sans toucher aux autres groupes", async () => {
    const { handlers, caches } = await loadSW([
      'tablito-media-ancienhash',
      AUDIO_CACHE,
    ]);

    const waits = [];
    await handlers.activate({ waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);

    expect(await caches.keys()).toEqual([AUDIO_CACHE]);
  });
});

describe('lazy-cache', () => {
  let sw;
  beforeEach(async () => { sw = await loadSW(); });

  it('écrit une image mystère dans le cache média, pas dans le shell', async () => {
    await get(sw.handlers, '/mystery/ocean/level-3.png');

    expect([...(await sw.caches.open(MEDIA_CACHE)).entries.keys()])
      .toEqual(['https://tablito.app/mystery/ocean/level-3.png']);
    expect((await sw.caches.open(SHELL_CACHE)).entries.size).toBe(0);
  });

  it('écrit un MP3 dans le cache audio', async () => {
    await get(sw.handlers, '/audio/tts/fr/bravo.mp3');

    expect((await sw.caches.open(AUDIO_CACHE)).entries.size).toBe(1);
  });

  it('laisse le reste dans le cache shell, versionné par build', async () => {
    await get(sw.handlers, '/guide/img/session.png');

    expect((await sw.caches.open(SHELL_CACHE)).entries.size).toBe(1);
  });

  it('ne retouche pas le réseau pour un média déjà caché', async () => {
    await get(sw.handlers, '/mystery/ocean/level-3.png');
    await get(sw.handlers, '/mystery/ocean/level-3.png');

    expect(sw.fetched).toEqual(['https://tablito.app/mystery/ocean/level-3.png']);
  });
});

// Les documents autonomes (guide, specs, previews de PR) ont leur propre
// index.html : si le shell les masquait, on servirait l'app à la place. La liste
// est celle de cache-config.mjs, pas une copie — c'est elle que le build utilise
// aussi pour les exclure du précache.
describe('documents autonomes', () => {
  it('laisse le navigateur gérer leurs navigations', async () => {
    const { handlers } = await loadSW();

    for (const doc of STANDALONE_DOCS) {
      expect(navigate(handlers, doc), doc).toBe(null);
      expect(navigate(handlers, `${doc}en/index.html`), doc).toBe(null);
    }
  });

  it("sert l'index.html précaché pour une navigation de l'app", async () => {
    const { handlers, fetched } = await loadSW();
    const installs = [];
    await handlers.install({ waitUntil: (p) => installs.push(p) });
    await Promise.all(installs);

    await expect(navigate(handlers, '/quelque-chose')).resolves.toEqual({ body: '/index.html' });
    expect(fetched).toEqual([]); // cold launch : rien ne part sur le réseau
  });
});
