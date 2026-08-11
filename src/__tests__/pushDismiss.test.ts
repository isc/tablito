// Une séance faite retire le rappel du soir déjà affiché dans la barre de
// notifications. Le pendant serveur (le cron saute l'envoi si une séance a eu
// lieu le jour même) est testé dans scripts/send-reminders.test.mjs.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { syncLastSession } from '../lib/push';

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
