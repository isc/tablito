import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import SessionScreen from '../screens/SessionScreen';
import type { SessionItem, MultiFact, DivisionFact } from '../types';

// Régression : la lecture TTS de la question ne doit jamais être perdue parce
// que l'enfant répond avant la fin du décodage du MP3. Le SessionScreen
// précharge l'audio de la séance à l'ouverture ; `speak` démarre alors par un
// chemin synchrone (buffer en cache), increvable par le stop() de la réponse.
// Sans le préchargement, une réponse rapide annulait une lecture jamais
// démarrée — symptôme observé en séance mixte (on entendait les divisions,
// plus lentes à répondre, mais pas les tables connues répondues au quart de
// tour). On modélise une latence de premier décodage et un enfant qui répond
// plus vite que cette latence, puis on vérifie que chaque question est bien lue.

function mult(a: number, b: number): SessionItem {
  const fact: MultiFact = {
    a, b, product: a * b, box: 3, lastSeen: '', nextDue: '', history: [], introduced: true,
  };
  return { kind: 'mult', fact, displayA: a, displayB: b, isIntroduction: false, isRetry: false, isBonusReview: false };
}
function div(dividend: number, divisor: number): SessionItem {
  const fact: DivisionFact = {
    dividend, divisor, quotient: dividend / divisor, box: 3, lastSeen: '', nextDue: '', history: [], introduced: true,
  };
  return { kind: 'div', fact, isIntroduction: false, isRetry: false, isBonusReview: false };
}

function typeAnswer(value: number): void {
  const digits = value.toString();
  for (const d of digits) {
    const btn = document.querySelector<HTMLButtonElement>(`.numpad-btn[aria-label="${d}"]`);
    if (!btn) throw new Error(`NumPad ${d} introuvable`);
    fireEvent.click(btn);
  }
  if (digits.length === 1) {
    const ok = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'OK');
    fireEvent.click(ok!);
  }
}
function dismissFeedback(): void {
  const overlay = document.querySelector<HTMLElement>('[class*="feedback"]');
  if (overlay) fireEvent.click(overlay);
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => cleanup());

describe('Séance mixte — lecture audio des questions', () => {
  it('un enfant qui répond vite ne perd pas la lecture audio des questions', async () => {
    // Simulate realistic first-load latency on the TTS fetch.
    const origFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/audio/tts/')) {
        return wait(25).then(() => new Response(new ArrayBuffer(0), { status: 200 }));
      }
      return origFetch(input as RequestInfo, init);
    }) as typeof fetch;

    let startCount = 0;
    const AC = globalThis.AudioContext as unknown as { prototype: { createBufferSource: () => AudioBufferSourceNode } };
    const origCBS = AC.prototype.createBufferSource;
    AC.prototype.createBufferSource = function (this: AudioContext) {
      const node = origCBS.call(this);
      const origStart = node.start.bind(node);
      node.start = (...args: Parameters<AudioBufferSourceNode['start']>) => {
        startCount++;
        return origStart(...args);
      };
      return node;
    };

    const questions: SessionItem[] = [
      mult(2, 2), div(8, 2), mult(5, 3), div(15, 3), mult(8, 8), div(64, 8), mult(6, 9),
    ];
    render(<SessionScreen questions={questions} onComplete={() => {}} onAnswer={() => {}} />);

    // Brief settle while the session preloads its audio (a child can't answer
    // the very first question in <25ms anyway).
    await wait(60);

    // Child who already knows the facts: answers ~10ms after each question
    // appears — faster than the 25ms first-load of its audio.
    for (const q of questions) {
      await wait(10);
      const answer =
        q.kind === 'div' ? q.fact.quotient : q.kind === 'mult' ? q.fact.product : q.fact.quotient;
      typeAnswer(answer);
      dismissFeedback();
    }
    await wait(40);

    AC.prototype.createBufferSource = origCBS;
    globalThis.fetch = origFetch;

    expect(startCount).toBe(questions.length);
  });
});
