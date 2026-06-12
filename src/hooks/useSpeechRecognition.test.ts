import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useSpeechRecognition } from './useSpeechRecognition';

// Double minimal de l'API SpeechRecognition. `autoEnd` rejoue le glitch iOS :
// au tout premier octroi de permission, WebKit termine la reconnaissance
// immédiatement (onend) sans jamais émettre onstart ni résultat. Le hook
// redémarre dans onend pour garder le micro ouvert toute la séance — sans
// garde-fou, on obtenait une boucle start→end→start→end qui figeait l'UI.
let startCount = 0;
let lastInstance: FakeRecognition | null = null;

class FakeRecognition {
  // true → onend immédiat à chaque start (glitch iOS) ; false → on pilote
  // onend à la main pour simuler un cycle qui a réellement duré.
  static autoEnd = true;
  lang = '';
  interimResults = false;
  continuous = false;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onresult: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onend: (() => void) | null = null;

  start(): void {
    startCount += 1;
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- le test pilote onend sur l'instance vivante
    lastInstance = this;
    if (FakeRecognition.autoEnd) {
      // onend async (comme un vrai navigateur), aussitôt, sans onstart.
      setTimeout(() => {
        this.onend?.();
      }, 0);
    }
  }

  abort(): void {}
}

describe('useSpeechRecognition — garde-fou anti-boucle iOS', () => {
  beforeEach(() => {
    startCount = 0;
    lastInstance = null;
    FakeRecognition.autoEnd = true;
    vi.useFakeTimers();
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });

  it("ne boucle pas indéfiniment quand chaque cycle se termine aussitôt (glitch iOS)", () => {
    const { result } = renderHook(() => useSpeechRecognition({ onFinal: () => {} }));

    act(() => {
      result.current.start();
    });

    // Laisse largement le temps à une boucle non bridée de partir en vrille.
    for (let i = 0; i < 10; i++) {
      act(() => {
        vi.advanceTimersByTime(500);
      });
    }

    // Le garde-fou plafonne les redémarrages à vide (MAX_RAPID_RESTARTS = 5).
    expect(startCount).toBeLessThanOrEqual(5);
    expect(startCount).toBeGreaterThan(0);
  });

  it('redémarre immédiatement après un cycle qui a réellement duré (chemin nominal)', () => {
    // Pas de glitch : on pilote onend à la main après un long délai.
    FakeRecognition.autoEnd = false;
    const { result } = renderHook(() => useSpeechRecognition({ onFinal: () => {} }));

    act(() => {
      result.current.start();
    });
    expect(startCount).toBe(1);

    // Le cycle a tourné > RAPID_RESTART_THRESHOLD_MS avant de se terminer :
    // ce n'est pas un cycle « à vide », donc redémarrage immédiat, non bridé.
    act(() => {
      vi.advanceTimersByTime(2000);
      lastInstance?.onend?.();
    });
    expect(startCount).toBe(2);
  });
});
