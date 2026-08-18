import { cleanup, render, act } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionScreen from '../screens/SessionScreen';
import { useInputMode } from '../hooks/useInputMode';
import type { SessionItem, RemainderFact } from '../types';
import { useEffect } from 'react';

// Division avec reste en mode VOCAL (specs §12.5) : la question se répond en
// deux temps sur le même écran (quotient, puis reste). Entre les deux, l'app
// lit « Et il reste combien ? » — et sur Android le micro est coupé pendant la
// synthèse puis rouvert à la fin. C'est ce ré-armement du micro pour l'étape 2
// qu'on vérifie ici : sans lui, l'enfant reste bloqué face à un micro mort.

// Android : micro coupé pendant la TTS (cf. commentaire de tête de VoiceInput).
vi.mock('../lib/install', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/install')>()),
  isAndroid: () => true,
}));

let startCalls = 0;
let abortCalls = 0;
let live: FakeRecognition | null = null;

class FakeRecognition {
  lang = '';
  interimResults = false;
  continuous = false;
  maxAlternatives = 0;
  running = false;
  onstart: (() => void) | null = null;
  onresult: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onend: (() => void) | null = null;

  start(): void {
    // Le vrai recognizer lève InvalidStateError si on redémarre une session
    // déjà en cours — le hook l'attrape et compte sur onend pour relancer.
    if (this.running) throw new Error('InvalidStateError');
    startCalls += 1;
    this.running = true;
    live = this;
    this.onstart?.();
  }

  abort(): void {
    abortCalls += 1;
    if (!this.running) return;
    // Le vrai abort() est ASYNCHRONE : la session reste ouverte jusqu'à onend,
    // et tout start() lancé dans cet intervalle lève. Modéliser l'abort comme
    // synchrone masquerait précisément les blocages qu'on cherche ici.
    if (!FakeRecognition.asyncAbort) {
      this.running = false;
      this.onend?.();
      return;
    }
    setTimeout(() => {
      if (!this.running) return;
      this.running = false;
      this.onend?.();
    }, 0);
  }

  static asyncAbort = false;
}

// Les sources audio de la TTS : le fake du setup ne déclenche jamais `onended`
// tout seul (il n'y a pas de vraie lecture), donc le test décide quand la voix
// se termine.
let pendingSources: { onended: (() => void) | null }[] = [];
function endSpeech(): void {
  const sources = pendingSources;
  pendingSources = [];
  act(() => {
    for (const s of sources) s.onended?.();
  });
}

function emit(transcript: string, isFinal: boolean): void {
  act(() => {
    live?.onresult?.({
      resultIndex: 0,
      results: [{ isFinal, 0: { transcript, confidence: 1 }, length: 1 }],
    });
  });
}

// 13 ÷ 2 = 6, reste 1.
function remainderQuestion(): SessionItem {
  const fact: RemainderFact = {
    divisor: 2, quotient: 6, box: 3, lastSeen: '', nextDue: '', history: [], introduced: true,
  };
  return { kind: 'rem', fact, remainder: 1, isIntroduction: false, isRetry: false, isBonusReview: false };
}

function VoiceMode() {
  const { setInputMode } = useInputMode();
  useEffect(() => setInputMode('voice'), [setInputMode]);
  return null;
}

let origCreateBufferSource: () => AudioBufferSourceNode;

beforeEach(() => {
  FakeRecognition.asyncAbort = false;
  startCalls = 0;
  abortCalls = 0;
  live = null;
  pendingSources = [];

  (globalThis as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;

  const proto = (globalThis.AudioContext as unknown as {
    prototype: { createBufferSource: () => AudioBufferSourceNode };
  }).prototype;
  origCreateBufferSource = proto.createBufferSource;
  proto.createBufferSource = function (this: AudioContext) {
    const node = origCreateBufferSource.call(this) as unknown as { onended: (() => void) | null };
    pendingSources.push(node);
    return node as unknown as AudioBufferSourceNode;
  };
});

afterEach(() => {
  const proto = (globalThis.AudioContext as unknown as {
    prototype: { createBufferSource: () => AudioBufferSourceNode };
  }).prototype;
  proto.createBufferSource = origCreateBufferSource;
  delete (globalThis as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  cleanup();
});

const flush = () => act(async () => { await Promise.resolve(); });
// Laisse aussi passer les macrotasks : l'abort asynchrone du recognizer et le
// backoff de relance du hook vivent sur des timers, pas des microtasks.
const settle = async () => {
  for (let i = 0; i < 12; i++) await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
};

const stepLabel = () => document.querySelector('.session-rem-step')?.textContent?.trim() ?? '';

describe('Division avec reste en vocal', () => {
  it('rouvre le micro pour l’étape « il reste combien ? »', async () => {
    render(<VoiceMode />);
    const onAnswer = vi.fn();
    render(
      <SessionScreen
        questions={[remainderQuestion()]}
        onComplete={() => {}}
        onAnswer={onAnswer}
        onConjAnswer={() => {}}
      />,
    );
    await flush();

    // Lecture de la question : micro coupé pendant la synthèse, rouvert après.
    endSpeech();
    await flush();
    const startsAfterQuestion = startCalls;
    expect(startsAfterQuestion).toBeGreaterThan(0);

    // L'enfant dit le quotient : validé par le chemin rapide sur l'interim.
    emit('six', false);
    await flush();
    expect(stepLabel()).not.toBe('');

    // Le final traînant du MÊME énoncé ne doit pas être pris pour le reste.
    emit('six', true);
    await flush();
    expect(onAnswer).not.toHaveBeenCalled();

    // Fin de « Et il reste combien ? » → le micro doit se rouvrir.
    endSpeech();
    await flush();
    expect(startCalls).toBeGreaterThan(startsAfterQuestion);

    // Et il doit accepter le reste.
    emit('un', false);
    await flush();
    expect(onAnswer).toHaveBeenCalled();
  });

  it('rouvre le micro même quand l’abort du recognizer est asynchrone', async () => {
    FakeRecognition.asyncAbort = true;
    render(<VoiceMode />);
    const onAnswer = vi.fn();
    render(
      <SessionScreen
        questions={[remainderQuestion()]}
        onComplete={() => {}}
        onAnswer={onAnswer}
        onConjAnswer={() => {}}
      />,
    );
    await flush();

    endSpeech();
    await settle();
    const startsAfterQuestion = startCalls;
    expect(startsAfterQuestion).toBeGreaterThan(0);

    emit('six', false);
    await settle();

    // Fin de « Et il reste combien ? » : le micro doit finir par se rouvrir,
    // même si le start() tenté pendant l'abort en vol a levé.
    endSpeech();
    await settle();
    expect(live?.running).toBe(true);
    expect(startCalls).toBeGreaterThan(startsAfterQuestion);
  });
});
