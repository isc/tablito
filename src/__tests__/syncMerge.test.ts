// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mergeProfiles, stableStringify, syncBaseOf, withPlayer, withoutPlayer } from '../lib/syncMerge';
import type { MultiFact, UserProfile } from '../types';
import { practising, playSession as play } from './helpers/devices';

const fact = (p: UserProfile, a: number, b: number): MultiFact => p.facts.find((f) => f.a === a && f.b === b)!;
// Une séance d'une question sur a×b.
const playSession = (p: UserProfile, day: string, a: number, b: number, correct: boolean, id: string) =>
  play(p, day, correct, id, [a, b]);

// ---------------------------------------------------------------------------
// Fusion de deux copies d'un profil (specs §14.4) : un enfant qui pratique sur
// deux appareils, y compris hors ligne sur les deux.
// ---------------------------------------------------------------------------

const clone = (p: UserProfile): UserProfile => structuredClone(p);

describe('mergeProfiles', () => {
  it('est neutre sur deux copies identiques', () => {
    const p = practising();
    expect(stableStringify(mergeProfiles(clone(p), clone(p), syncBaseOf(p)))).toBe(stableStringify(p));
  });

  it("prend la suite quand un seul appareil a joué", () => {
    const base = practising();
    const ahead = playSession(clone(base), '2026-10-24', 7, 8, true, 's1');
    for (const [local, remote] of [
      [clone(base), ahead],
      [ahead, clone(base)],
    ]) {
      const merged = mergeProfiles(local, remote, syncBaseOf(base));
      expect(fact(merged, 7, 8).box).toBe(4);
      expect(merged.totalSessions).toBe(41);
      expect(merged.currentStreak).toBe(13);
      expect(merged.sessionHistory.map((s) => s.id)).toEqual(['s1']);
    }
  });

  // L'exemple de la note de conception : samedi sur A en mode avion, dimanche
  // sur B qui n'a pas reçu samedi.
  it('deux séances hors ligne : rien n’est perdu, l’erreur gagne, la série est rejouée', () => {
    const base = practising();
    const a = playSession(clone(base), '2026-10-24', 7, 8, true, 'samedi');
    const b = playSession(clone(base), '2026-10-25', 7, 8, false, 'dimanche');
    // B a cru samedi manqué : un gel dépensé.
    expect(b.streakFreezes).toBe(0);

    for (const merged of [
      mergeProfiles(a, b, syncBaseOf(base)),
      mergeProfiles(b, a, syncBaseOf(base)),
    ]) {
      const f = fact(merged, 7, 8);
      expect(f.box).toBe(1);
      expect(f.history.map((h) => h.date)).toEqual(['2026-10-24', '2026-10-25']);
      expect(merged.totalSessions).toBe(42);
      expect(merged.sessionHistory.map((s) => s.id)).toEqual(['samedi', 'dimanche']);
      expect(merged.currentStreak).toBe(14);
      expect(merged.streakFreezes).toBe(1); // le gel de B est rendu
      expect(merged.lastSessionDate).toBe('2026-10-25');
    }
  });

  it('même jour sur les deux appareils : la série ne compte qu’une fois', () => {
    const base = practising();
    const a = playSession(clone(base), '2026-10-24', 7, 8, true, 'a');
    const b = playSession(clone(base), '2026-10-24', 3, 4, true, 'b');
    const merged = mergeProfiles(a, b, syncBaseOf(base));
    expect(merged.currentStreak).toBe(13);
    expect(merged.totalSessions).toBe(42);
    expect(fact(merged, 7, 8).box).toBe(4);
    expect(fact(merged, 3, 4).history).toHaveLength(1);
  });

  it('ne confond pas un historique rogné avec du neuf', () => {
    const base = practising();
    const f = fact(base, 7, 8);
    f.history = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      correct: true,
      responseTimeMs: 1000 + i,
      answeredWith: 56,
    }));
    // A répond encore : sa plus vieille tentative tombe. B n'a rien fait.
    const a = playSession(clone(base), '2026-10-24', 7, 8, true, 'a');
    expect(fact(a, 7, 8).history).toHaveLength(30);
    const merged = mergeProfiles(clone(base), a, syncBaseOf(base));
    expect(fact(merged, 7, 8).box).toBe(4); // pas la règle prudente
    expect(fact(merged, 7, 8).history).toEqual(fact(a, 7, 8).history);
  });

  it('sans base (deux copies déjà divergées), garde la série du côté le plus récent', () => {
    const base = practising();
    const a = playSession(clone(base), '2026-10-24', 7, 8, true, 'a');
    const b = playSession(clone(base), '2026-10-26', 3, 4, true, 'b');
    const merged = mergeProfiles(a, b, null);
    expect(merged.lastSessionDate).toBe('2026-10-26');
    expect(merged.currentStreak).toBe(b.currentStreak);
    expect(merged.totalSessions).toBe(42);
  });

  it('réunit badges et drapeaux, garde la date la plus ancienne', () => {
    const base = practising();
    const a = clone(base);
    const b = clone(base);
    a.badges = [{ id: 'regulier', earnedDate: '2026-10-24', icon: '🔥' }];
    b.badges = [
      { id: 'regulier', earnedDate: '2026-10-23', icon: '🔥' },
      { id: 'machine', earnedDate: '2026-10-25', icon: '⚙️' },
    ];
    b.hasSeenRule11 = true;
    const merged = mergeProfiles(a, b, syncBaseOf(base));
    expect(merged.badges).toEqual([
      { id: 'regulier', earnedDate: '2026-10-23', icon: '🔥' },
      { id: 'machine', earnedDate: '2026-10-25', icon: '⚙️' },
    ]);
    expect(merged.hasSeenRule11).toBe(true);
  });

  it('prend une matière ouverte d’un seul côté', () => {
    const base = practising();
    const b = clone(base);
    b.conjFacts = [{ key: 'pres-1-e', box: 2, lastSeen: '2026-10-24', nextDue: '2026-10-25', history: [], introduced: true }];
    b.hasDoneConjPlacement = true;
    const merged = mergeProfiles(clone(base), b, syncBaseOf(base));
    expect(merged.conjFacts).toEqual(b.conjFacts);
    expect(merged.hasDoneConjPlacement).toBe(true);
  });

  it('arbitre un réglage changé d’un seul côté grâce à la base', () => {
    const base = practising();
    const b = clone(base);
    b.irrClassVerbs = ['go', 'be'];
    expect(mergeProfiles(clone(base), b, syncBaseOf(base)).irrClassVerbs).toEqual(['go', 'be']);
    expect(mergeProfiles(b, clone(base), syncBaseOf(base)).irrClassVerbs).toEqual(['go', 'be']);
  });

  it('garde l’image mystère déjà déposée et jette les estampilles de dépôt', () => {
    const base = practising();
    const local = clone(base);
    local.irrMysteryTheme = 'ocean';
    const remote = { ...clone(base), irrMysteryTheme: 'space' as const, appVersion: '1.2.3', syncFormat: 1 };
    const merged = mergeProfiles(local, remote, syncBaseOf(base));
    expect(merged.irrMysteryTheme).toBe('space');
    expect(merged).not.toHaveProperty('appVersion');
    expect(merged).not.toHaveProperty('syncFormat');
  });

  it('recopie les champs qu’une version plus ancienne ne connaît pas', () => {
    const base = practising();
    const remote = { ...clone(base), futureField: { x: 1 } } as UserProfile;
    expect(mergeProfiles(clone(base), remote, syncBaseOf(base))).toHaveProperty('futureField', { x: 1 });
  });

  it('tient la liste des appareils qui jouent, départs compris', () => {
    const p = withPlayer(practising(), 'tel-maman', '2026-10-24T10:00:00.000Z');
    const a = withPlayer(clone(p), 'tel-papa', '2026-10-24T11:00:00.000Z');
    const b = withoutPlayer(clone(p), 'tel-maman', '2026-10-25T09:00:00.000Z');
    const merged = mergeProfiles(a, b, syncBaseOf(p));
    expect(merged.players).toEqual({
      'tel-maman': { joined: '2026-10-24T10:00:00.000Z', left: '2026-10-25T09:00:00.000Z' },
      'tel-papa': { joined: '2026-10-24T11:00:00.000Z' },
    });
    // Revenir après être parti réactive l'appareil.
    const back = withPlayer(merged, 'tel-maman', '2026-10-26T09:00:00.000Z');
    expect(back.players!['tel-maman'].joined).toBe('2026-10-26T09:00:00.000Z');
  });
});
