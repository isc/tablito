import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  activeMsSince,
  MAX_ANSWER_MS,
  resetHiddenTimeForTests,
  startQuestion,
} from '../lib/questionClock';

// Avis parent du 23/08/2026 : « il faudrait normaliser le temps de réponse
// moyen de la séance, parce que quand on met le téléphone en veille et qu'on
// fait 5 minutes de pause il ne faut pas prendre en compte ce temps abusif ».
// Le profil joint portait une question à 860 596 ms.

/** Passe l'onglet caché/visible comme le fait le verrouillage de l'écran. */
function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('questionClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
    resetHiddenTimeForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('compte le temps de réflexion normalement', () => {
    const start = startQuestion();
    vi.advanceTimersByTime(3_000);

    expect(activeMsSince(start)).toBe(3_000);
  });

  it('ne compte pas la mise en veille au milieu d’une question', () => {
    const start = startQuestion();
    vi.advanceTimersByTime(2_000);

    setVisibility('hidden');
    vi.advanceTimersByTime(14 * 60_000); // la pause de 14 min du profil joint
    setVisibility('visible');

    vi.advanceTimersByTime(1_500);

    expect(activeMsSince(start)).toBe(3_500);
  });

  it('retire aussi une veille encore en cours au moment de la lecture', () => {
    // La séance peut être relue (récap, historique) avant le retour au premier
    // plan : le temps caché déjà écoulé doit compter pour zéro dès maintenant.
    const start = startQuestion();
    vi.advanceTimersByTime(1_000);
    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);

    expect(activeMsSince(start)).toBe(1_000);
  });

  it('ne compte pas les veilles ANTÉRIEURES à la question', () => {
    setVisibility('hidden');
    vi.advanceTimersByTime(5 * 60_000);
    setVisibility('visible');

    const start = startQuestion();
    vi.advanceTimersByTime(4_000);

    expect(activeMsSince(start)).toBe(4_000);
  });

  it('additionne plusieurs veilles dans la même question', () => {
    const start = startQuestion();
    for (const pause of [30_000, 90_000]) {
      vi.advanceTimersByTime(1_000);
      setVisibility('hidden');
      vi.advanceTimersByTime(pause);
      setVisibility('visible');
    }

    expect(activeMsSince(start)).toBe(2_000);
  });

  it('plafonne une absence écran allumé, que la visibilité ne voit pas', () => {
    // Le seul cas que la soustraction n'attrape pas : l'enfant part sans
    // verrouiller. Borné, faute de pouvoir le distinguer d'une réflexion.
    const start = startQuestion();
    vi.advanceTimersByTime(14 * 60_000);

    expect(activeMsSince(start)).toBe(MAX_ANSWER_MS);
  });

  it('laisse passer intact le plus long temps de réponse légitime', () => {
    // ~19 s : la réponse la plus lente réellement observée dans un profil.
    const start = startQuestion();
    vi.advanceTimersByTime(19_000);

    expect(activeMsSince(start)).toBe(19_000);
  });

  it('ne renvoie jamais de durée négative si l’horloge recule', () => {
    const start = startQuestion();
    vi.setSystemTime(Date.now() - 10_000);

    expect(activeMsSince(start)).toBe(0);
  });
});
