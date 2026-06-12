import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useSpeechRecognition } from './useSpeechRecognition';

// Reproduit le glitch iOS : au tout premier octroi de permission, WebKit
// termine la reconnaissance immédiatement (onend) sans jamais émettre onstart
// ni résultat. Le hook redémarre dans onend pour garder le micro ouvert toute
// la séance — sans garde-fou, on obtenait une boucle start→end→start→end qui
// figeait l'UI. Ce double simule ce comportement et compte les start().
let startCount = 0;

class FakeRecognition {
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
    // onend async (comme un vrai navigateur), aussitôt, sans onstart : glitch.
    setTimeout(() => {
      this.onend?.();
    }, 0);
  }

  abort(): void {}
}

describe('useSpeechRecognition — garde-fou anti-boucle iOS', () => {
  beforeEach(() => {
    startCount = 0;
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
    for (let i = 0; i < 100; i++) {
      act(() => {
        vi.advanceTimersByTime(500);
      });
    }

    // Le garde-fou plafonne les redémarrages à vide (MAX_RAPID_RESTARTS = 5).
    expect(startCount).toBeLessThanOrEqual(5);
    expect(startCount).toBeGreaterThan(0);
  });
});
