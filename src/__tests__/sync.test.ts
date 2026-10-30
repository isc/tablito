// Synchro d'un enfant qui joue sur deux appareils (src/lib/sync.ts, specs
// §14.4), contre le serveur `watches` en mémoire (cf. helpers/devices).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addProfile, getActiveProfileId, listProfiles, loadProfile, saveProfile } from '../lib/storage';
import { joinAsPlayer, leaveSync, syncProfile, type SyncOutcome } from '../lib/sync';
import { addWatched, startWatch } from '../lib/watch';
import { getDeviceId, listWatched, loadWatchCredentials, otherPlayersCount, parseWatchLink } from '../lib/watchStore';
import type { UserProfile } from '../types';
import { fact78, onDevice, playSession as play, practising, resetDevices } from './helpers/devices';
import { mockSupabaseServer, stubSupabaseEnv } from './helpers/watchServer';

/** Le soir du jour donné. */
function at(day: string): void {
  vi.setSystemTime(new Date(`${day}T18:00:00Z`));
}

const box78 = (p: UserProfile) => fact78(p).box;

// Synchronise le profil actif de l'appareil courant et applique la fusion, ce
// que fait App sur l'accueil.
async function syncHere(local = loadProfile()!): Promise<{ outcome: SyncOutcome; profile: UserProfile }> {
  const outcome = await syncProfile(getActiveProfileId()!, local);
  const profile = outcome.status === 'merged' ? outcome.apply(local) : local;
  saveProfile(profile);
  return { outcome, profile };
}

// Appareil A : l'enfant y joue et partage. Appareil B : on scanne le QR et on
// choisit « Jouer ici aussi ».
async function pairTwoDevices() {
  const rows = mockSupabaseServer().watches;
  onDevice('A');
  const profile = practising();
  const id = addProfile(profile);
  const link = (await startWatch(id, profile))!;
  await syncHere();
  onDevice('B');
  const paired = (await addWatched(link))!;
  joinAsPlayer(parseWatchLink(link)!, paired.snapshot.profile);
  await syncHere();
  return { rows, code: parseWatchLink(link)!.code };
}

beforeEach(() => {
  // Toute fusion règle la série au jour courant : l'horloge suit les jours
  // joués (cf. at). Seule la date est figée, pas les minuteurs.
  vi.useFakeTimers({ toFake: ['Date'] });
  at('2026-10-23');
  resetDevices();
  stubSupabaseEnv();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('deux appareils pour un même enfant', () => {
  it('l’appairage installe un profil synchronisé et cesse le simple suivi', async () => {
    await pairTwoDevices();
    expect(listProfiles()).toHaveLength(1);
    expect(listWatched()).toHaveLength(0);
    expect(loadWatchCredentials(getActiveProfileId()!)).not.toBeNull();
    expect(loadProfile()!.totalSessions).toBe(40);
    // Chacun sait que l'autre joue aussi.
    expect(otherPlayersCount(loadProfile()!)).toBe(1);
    onDevice('A');
    await syncHere();
    expect(otherPlayersCount(loadProfile()!)).toBe(1);
  });

  it('en alternance, chaque appareil reçoit les séances de l’autre', async () => {
    await pairTwoDevices();
    at('2026-10-24');
    onDevice('A');
    await syncHere(play(loadProfile()!, '2026-10-24', true, 'a1'));
    onDevice('B');
    const { outcome, profile } = await syncHere();
    expect(outcome.status).toBe('merged');
    expect(profile.totalSessions).toBe(41);
    expect(box78(profile)).toBe(4);
    at('2026-10-25');
    await syncHere(play(profile, '2026-10-25', true, 'b1'));
    onDevice('A');
    const back = (await syncHere()).profile;
    expect(back.totalSessions).toBe(42);
    expect(back.currentStreak).toBe(14);
    expect(box78(back)).toBe(5);
  });

  it('deux séances hors ligne convergent sans rien perdre', async () => {
    await pairTwoDevices();
    // Chacun joue sans réseau : on n'appelle la synchro qu'après. B, qui n'a
    // pas reçu samedi, le croit manqué et dépense son gel.
    at('2026-10-24');
    onDevice('A');
    saveProfile(play(loadProfile()!, '2026-10-24', true, 'samedi'));
    at('2026-10-25');
    onDevice('B');
    saveProfile(play(loadProfile()!, '2026-10-25', false, 'dimanche'));
    expect(loadProfile()!.streakFreezes).toBe(0);

    onDevice('A');
    await syncHere();
    onDevice('B');
    const b = (await syncHere()).profile;
    onDevice('A');
    const a = (await syncHere()).profile;
    for (const p of [a, b]) {
      expect(p.totalSessions).toBe(42);
      expect(box78(p)).toBe(1); // l'erreur de dimanche gagne
      expect(p.currentStreak).toBe(14);
      expect(p.streakFreezes).toBe(1); // le gel que B avait cru perdre
    }
  });

  it('un dépôt concurrent est relu et refusionné, pas écrasé', async () => {
    const { rows, code } = await pairTwoDevices();
    // A a relu le dépôt ; B dépose entre-temps.
    onDevice('A');
    await syncHere();
    onDevice('B');
    await syncHere(play(loadProfile()!, '2026-10-24', true, 'b1'));
    onDevice('A');
    await syncHere(play(loadProfile()!, '2026-10-24', true, 'a1'));
    onDevice('B');
    const b = (await syncHere()).profile;
    expect(b.sessionHistory.map((s) => s.id).sort()).toEqual(['a1', 'b1']);
    expect(rows.has(code)).toBe(true);
  });

  it('un partage arrêté ailleurs rend le profil local', async () => {
    const { rows, code } = await pairTwoDevices();
    rows.delete(code);
    const { outcome } = await syncHere();
    expect(outcome.status).toBe('revoked');
    expect(loadWatchCredentials(getActiveProfileId()!)).toBeNull();
    expect(listProfiles()).toHaveLength(1);
  });

  it('retirer l’enfant d’un appareil garde le dépôt tant qu’il joue ailleurs', async () => {
    const { rows, code } = await pairTwoDevices();
    const meB = getDeviceId();
    await leaveSync(getActiveProfileId()!, loadProfile()!);
    expect(rows.has(code)).toBe(true);
    onDevice('A');
    const a = (await syncHere()).profile;
    expect(a.players![meB].left).toBeTruthy();
    expect(otherPlayersCount(a)).toBe(0);
    // Le dernier appareil qui retire l'enfant arrête le partage.
    await leaveSync(getActiveProfileId()!, a);
    expect(rows.has(code)).toBe(false);
  });

  it('fusionne avec une copie déjà présente (ancien transfert) au lieu de la dupliquer', async () => {
    mockSupabaseServer();
    onDevice('A');
    const profile = practising();
    const id = addProfile(profile);
    const link = (await startWatch(id, profile))!;
    // B a une vieille copie de Léa, qui a divergé : une séance faite là-bas.
    onDevice('B');
    addProfile(play(structuredClone(profile), '2026-10-24', true, 'sur-b'));
    const paired = (await addWatched(link))!;
    const joined = joinAsPlayer(parseWatchLink(link)!, paired.snapshot.profile);
    expect(listProfiles()).toHaveLength(1);
    expect(joined.sessionHistory.map((s) => s.id)).toEqual(['sur-b']);
    expect(joined.totalSessions).toBe(41);
  });
});
