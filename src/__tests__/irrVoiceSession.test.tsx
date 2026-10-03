import { act, cleanup, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SessionScreen from '../screens/SessionScreen';
import type { IrrSessionItem } from '../types';
import { createInitialIrrFacts } from '../lib/irregularVerbs';
import type { IrrVerdict } from '../lib/irregularComposer';
import { IRR_RECOGNITION_LANG } from '../components/IrrVoiceInput';
import { IRR_INPUT_MODE_STORAGE_KEY } from '../hooks/useInputMode';
import { advance } from './helpers/dom';
import { patchBufferSource, type PatchedBufferSource } from './helpers/audio';

// Réponse dite à voix haute des verbes irréguliers (specs §16.6), dans le vrai
// <SessionScreen />, avec une reconnaissance vocale simulée (cf.
// conjVoiceSession). La voix est le mode PAR DÉFAUT de la matière : aucun
// réglage à poser, contrairement à la conjugaison.

vi.mock('../lib/install', () => ({ isAndroid: () => false }));

const { spy } = vi.hoisted(() => {
  const spy = { instance: null as InstanceType<typeof Recognition> | null, lang: '' };

  class Recognition {
    lang = '';
    interimResults = false;
    continuous = false;
    maxAlternatives = 0;
    onstart: (() => void) | null = null;
    onresult: ((ev: unknown) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    onend: (() => void) | null = null;

    start(): void {
      spy.instance = this;
      spy.lang = this.lang;
      this.onstart?.();
    }

    abort(): void {}
  }

  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = Recognition;
  return { spy };
});

function emit(transcript: string, isFinal: boolean, alternatives: string[] = []): void {
  const alts = [transcript, ...alternatives];
  const result: Record<string | number, unknown> = { isFinal, length: alts.length };
  alts.forEach((a, i) => {
    result[i] = { transcript: a, confidence: 1 };
  });
  act(() => {
    spy.instance?.onresult?.({ resultIndex: 0, results: [result] });
  });
}

const say = (transcript: string, alternatives?: string[]) => emit(transcript, true, alternatives);
const saying = (transcript: string) => emit(transcript, false);

function irrItem(key: string): IrrSessionItem {
  const fact = createInitialIrrFacts().find((f) => f.key === key)!;
  return {
    kind: 'irr',
    fact: { ...fact, introduced: true, box: 2, lastSeen: '2026-09-01', nextDue: '2026-09-02' },
    isIntroduction: false,
    isRetry: false,
    isBonusReview: false,
  };
}

function renderSession(questions: IrrSessionItem[], onIrrAnswer = vi.fn()) {
  render(
    <SessionScreen
      questions={questions}
      onComplete={() => {}}
      onAnswer={() => {}}
      onConjAnswer={() => {}}
      onIrrAnswer={onIrrAnswer}
    />,
  );
  return onIrrAnswer;
}

const TTS_MS = 300;
/** L'énoncé finit d'être lu, puis la fenêtre d'écho (2 s) se referme. */
function promptEnds(): void {
  advance(TTS_MS);
  advance(2100);
}

const slots = () =>
  Array.from(document.querySelectorAll('.irr-form--slot')).map((el) => el.textContent?.trim() ?? '');

let audio: PatchedBufferSource;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  spy.instance = null;
  audio = patchBufferSource({ endAfterMs: TTS_MS });
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  audio.restore();
});

describe('Dire le verbe (specs §16.6)', () => {
  it('écoute en anglais, voix par défaut, sans aucun réglage', () => {
    expect(localStorage.getItem(IRR_INPUT_MODE_STORAGE_KEY)).toBeNull();
    renderSession([irrItem('go')]);
    expect(spy.lang).toBe(IRR_RECOGNITION_LANG);
  });

  it('la récitation complète est jugée juste, infinitif retiré', () => {
    const onIrrAnswer = renderSession([irrItem('go')]);
    promptEnds();
    say('go went gone');
    const [, verdict, , , source] = onIrrAnswer.mock.calls[0] as [unknown, IrrVerdict, boolean, number, string];
    expect(verdict).toBe('correct');
    expect(source).toBe('voice');
  });

  it('une réponse dite en deux fois attend sa seconde moitié', () => {
    const onIrrAnswer = renderSession([irrItem('go')]);
    promptEnds();
    say('go went');
    expect(onIrrAnswer).not.toHaveBeenCalled();
    expect(slots()[0]).toBe('went');
    say('gone');
    expect((onIrrAnswer.mock.calls[0] as [unknown, IrrVerdict])[1]).toBe('correct');
  });

  it('valide à la volée une réponse juste, sans attendre le silence', () => {
    const onIrrAnswer = renderSession([irrItem('eat')]);
    promptEnds();
    // « ate » transcrit « eight » : l'homophone est ramené à la forme.
    saying('eat eight eaten');
    expect((onIrrAnswer.mock.calls[0] as [unknown, IrrVerdict])[1]).toBe('correct');
  });

  it('une réponse fausse est jugée au silence, sur l’erreur reconnue', () => {
    const onIrrAnswer = renderSession([irrItem('go')]);
    promptEnds();
    say('go goed goed');
    expect((onIrrAnswer.mock.calls[0] as [unknown, IrrVerdict])[1]).toBe('regularized');
  });

  it('préfère l’alternative qui donne la bonne réponse', () => {
    const onIrrAnswer = renderSession([irrItem('win')]);
    promptEnds();
    say('win one one', ['win won won']);
    expect((onIrrAnswer.mock.calls[0] as [unknown, IrrVerdict])[1]).toBe('correct');
  });

  it('jette l’écho de l’énoncé lu par la synthèse', () => {
    const onIrrAnswer = renderSession([irrItem('put')]);
    advance(TTS_MS);
    // L'énoncé « put », réentendu par le micro juste après la lecture : ni
    // une réponse, ni le début d'une réponse.
    say('put');
    expect(onIrrAnswer).not.toHaveBeenCalled();
    expect(slots()).toEqual(['', '']);
    advance(2100);
    say('put put put');
    expect((onIrrAnswer.mock.calls[0] as [unknown, IrrVerdict])[1]).toBe('correct');
  });
});
