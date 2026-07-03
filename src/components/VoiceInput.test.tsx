import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/preact';
import VoiceInput from './VoiceInput';

// Pilote le retour d'isAndroid() par test : le composant coupe le micro
// pendant la TTS sur Android et le laisse ouvert ailleurs (iOS).
let onAndroid = false;
vi.mock('../lib/install', () => ({ isAndroid: () => onAndroid }));

let startCalls = 0;
let abortCalls = 0;
let lastInstance: FakeRecognition | null = null;

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
    startCalls += 1;
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- le test émet des résultats sur l'instance vivante
    lastInstance = this;
  }

  abort(): void {
    abortCalls += 1;
  }
}

function emitResult(transcript: string, isFinal: boolean): void {
  act(() => {
    lastInstance?.onresult?.({
      resultIndex: 0,
      results: [{ isFinal, 0: { transcript, confidence: 1 }, length: 1 }],
    });
  });
}

const emitFinal = (transcript: string) => emitResult(transcript, true);
const emitInterim = (transcript: string) => emitResult(transcript, false);

function renderVoiceInput(props: { isSpeaking?: boolean; onSubmit?: (v: number) => void } = {}) {
  const onSubmit = props.onSubmit ?? (() => {});
  const make = (isSpeaking: boolean) => (
    <VoiceInput
      onSubmit={onSubmit}
      isSpeaking={isSpeaking}
      questionToken="q1"
      expectedValue={12}
    />
  );
  const utils = render(make(props.isSpeaking ?? false));
  return {
    setSpeaking: (isSpeaking: boolean) => utils.rerender(make(isSpeaking)),
  };
}

describe('VoiceInput — gestion du micro selon la plateforme', () => {
  beforeEach(() => {
    startCalls = 0;
    abortCalls = 0;
    lastInstance = null;
    onAndroid = false;
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });

  afterEach(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });

  it('Android : coupe le micro pendant la TTS et le rouvre à la fin', () => {
    onAndroid = true;
    const { setSpeaking } = renderVoiceInput();
    expect(startCalls).toBeGreaterThan(0);

    const abortsBefore = abortCalls;
    setSpeaking(true);
    expect(abortCalls).toBeGreaterThan(abortsBefore);

    const startsBefore = startCalls;
    setSpeaking(false);
    expect(startCalls).toBeGreaterThan(startsBefore);
  });

  it('iOS (non-Android) : le micro reste ouvert pendant la TTS', () => {
    const { setSpeaking } = renderVoiceInput();
    const abortsBefore = abortCalls;
    setSpeaking(true);
    setSpeaking(false);
    expect(abortCalls).toBe(abortsBefore);
  });

  it("Android : une mauvaise réponse juste après la TTS n'est pas avalée par la fenêtre de grâce", () => {
    onAndroid = true;
    const onSubmit = vi.fn();
    const { setSpeaking } = renderVoiceInput({ onSubmit });
    setSpeaking(true);
    setSpeaking(false); // fin de TTS = début de la fenêtre de grâce iOS

    emitFinal('56');
    expect(onSubmit).toHaveBeenCalledWith(56);
  });

  it('iOS : un final non conforme dans la fenêtre post-TTS est jeté (écho)', () => {
    const onSubmit = vi.fn();
    const { setSpeaking } = renderVoiceInput({ onSubmit });
    setSpeaking(true);
    setSpeaking(false);

    emitFinal('56');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Android : l'abort pendant la TTS lève l'attente du final traînant du fast-path", () => {
    onAndroid = true;
    const onSubmit = vi.fn();
    const { setSpeaking } = renderVoiceInput({ onSubmit });

    // Fast-path : l'interim qui matche la réponse attendue soumet tout de
    // suite et arme expectTrailingFinal.
    emitInterim('12');
    expect(onSubmit).toHaveBeenCalledWith(12);

    // TTS de la question suivante : abort → le final traînant ne viendra
    // jamais. À la réouverture du micro, la vraie réponse suivante ne doit
    // pas être avalée par le flag.
    setSpeaking(true);
    setSpeaking(false);

    emitFinal('56');
    expect(onSubmit).toHaveBeenCalledWith(56);
  });
});
