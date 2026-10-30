// Une séance faite retire le rappel du soir déjà affiché dans la barre de
// notifications. Le pendant serveur (le cron saute l'envoi si une séance a eu
// lieu le jour même) est testé dans scripts/send-reminders.test.mjs.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { syncLastSession } from '../lib/push';
import { addProfile, createNewProfile } from '../lib/storage';
import { saveWatchCredentials } from '../lib/watchStore';
import { stubSupabaseEnv } from './helpers/watchServer';

function installServiceWorker(registration: object): void {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => registration },
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('syncLastSession', () => {
  it('ferme le rappel quotidien resté affiché', async () => {
    const close = vi.fn();
    // Le tag est écrit en dur des deux côtés du réseau (scripts/send-reminders.mjs
    // le pose sur le payload) : on épingle la valeur, pas la constante.
    const getNotifications = vi.fn(async () => [{ close }, { close }]);
    installServiceWorker({ getNotifications });

    await syncLastSession();

    expect(getNotifications).toHaveBeenCalledWith({ tag: 'daily-reminder' });
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("ne casse pas quand le navigateur n'expose pas l'API notifications", async () => {
    installServiceWorker({});

    await expect(syncLastSession()).resolves.toBeUndefined();
  });
});

// Un enfant qui joue sur plusieurs appareils (specs §14.4) : la séance marque
// tout le groupe, même depuis un appareil sans abonnement push — c'est souvent
// celui où l'enfant joue.
describe('syncLastSession, enfant synchronisé', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('marque la séance sur tout le groupe de l’enfant', async () => {
    installServiceWorker({});
    stubSupabaseEnv();
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    // Zoé, l'enfant actif, est partagée : son groupe dérive de son code.
    saveWatchCredentials(addProfile(createNewProfile('Zoé')), { code: 'code-de-zoe-0123456', key: 'k' });

    await syncLastSession();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://sb.test/rest/v1/rpc/mark_group_session');
    expect(JSON.parse(String(init.body))).toMatchObject({
      p_group: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
      p_endpoint: null,
      p_session_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });
});
