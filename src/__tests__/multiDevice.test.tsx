import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import { addProfile, createNewProfile, getActiveProfileId, loadProfile } from '../lib/storage';
import { joinAsPlayer, syncProfile } from '../lib/sync';
import { todayISO } from '../lib/utils';
import { addWatched, fetchWatched, startWatch } from '../lib/watch';
import { parseWatchLink } from '../lib/watchStore';
import { onDevice, resetDevices } from './helpers/devices';
import { currentProduct, flushMacrotasks, passIntro, requireButton, typeAnswer } from './helpers/dom';
import { makeSession } from './helpers/sessions';
import { mockWatchServer, stubSupabaseEnv } from './helpers/watchServer';

vi.mock('virtual:pwa-register', () => ({ registerSW: () => () => {}, setBusy: () => {} }));

// ---------------------------------------------------------------------------
// Un enfant qui joue sur deux appareils (specs §14.4), vu de l'app : ce qui a
// été joué ailleurs arrive à l'ouverture, ce qui est joué ici part au dépôt
// (appareils simulés : cf. helpers/devices).
// ---------------------------------------------------------------------------

/** A fait jouer Zoé et la partage ; B la fait jouer aussi. Renvoie le code. */
async function zoeOnTwoDevices() {
  onDevice('A');
  const zoe = createNewProfile('Zoé');
  zoe.hasSeenRulesIntro = true;
  const id = addProfile(zoe);
  const link = (await startWatch(id, zoe))!;
  await syncProfile(id, zoe);
  onDevice('B');
  const paired = (await addWatched(link))!;
  joinAsPlayer(parseWatchLink(link)!, paired.snapshot.profile);
  await syncProfile(getActiveProfileId()!, loadProfile()!);
  return parseWatchLink(link)!;
}

// La synchro enchaîne un import dynamique, le réseau simulé et le
// déchiffrement.
const flush = () => flushMacrotasks(30);

beforeEach(() => {
  resetDevices();
  stubSupabaseEnv();
});

afterEach(async () => {
  cleanup();
  await waitFor(() => expect(window.history.state?.tablitoBack).toBeFalsy());
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('un enfant, deux appareils', () => {
  it('à l’ouverture, l’accueil reçoit la séance jouée sur l’autre appareil', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    await zoeOnTwoDevices();
    // Sur B, Zoé fait sa séance de maths du jour.
    const today = todayISO();
    const played = {
      ...loadProfile()!,
      totalSessions: 1,
      lastSessionDate: today,
      lastMathSessionDate: today,
      currentStreak: 1,
      sessionHistory: [makeSession(today, { id: 'sur-b' })],
    };
    await syncProfile(getActiveProfileId()!, played);

    onDevice('A');
    render(<App />);
    await flush();

    const zoe = loadProfile()!;
    expect(zoe.totalSessions).toBe(1);
    expect(zoe.lastMathSessionDate).toBe(today);
    expect(zoe.sessionHistory.map((s) => s.id)).toEqual(['sur-b']);
  });

  it('les réponses d’une séance arrêtée partent au dépôt', async () => {
    mockWatchServer({ otherCalls: 'ignore' });
    const creds = await zoeOnTwoDevices();
    onDevice('A');
    render(<App />);
    await flush();

    fireEvent.click(requireButton(/C'est parti/));
    passIntro();
    typeAnswer(currentProduct());
    fireEvent.click(document.querySelector('.feedback-overlay')!);
    fireEvent.click(requireButton(/^Arrêter la séance$/));
    fireEvent.click(requireButton(/^Arrêter$/));
    await flush();

    const deposited = await fetchWatched(creds);
    expect(typeof deposited).toBe('object');
    const answered = typeof deposited === 'object' ? deposited.profile.facts.filter((f) => f.history.length > 0) : [];
    expect(answered).toHaveLength(1);
  });
});
