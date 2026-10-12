// @vitest-environment node
//
// Vérification et retouche des prises de synthèse vocale (scripts/tts-takes.mjs).
// Les transcriptions ci-dessous imitent ce que rendent les modèles : mots à
// apostrophe coupés en deux, horodatages contigus, homophones.

import { spawnSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import {
  alignWords,
  beepOver,
  confusedForms,
  decodeMp3,
  encodeMp3,
  formLeaks,
  hiddenSpan,
  mergeApostropheTokens,
} from './tts-takes.mjs';

const words = (...list) => list.map(([text, start, end]) => ({ text, start, end }));

describe('récitations des verbes irréguliers', () => {
  it('repère l’infinitif dit comme la forme suivante (« knew, knew, known »)', () => {
    expect(confusedForms(['know', 'knew', 'known'], 'New, new, known.')).toMatch(/know.*knew/);
    expect(confusedForms(['throw', 'threw', 'thrown'], 'Through, through, thrown.')).not.toBeNull();
  });

  it('laisse passer les homophones d’une transcription de mots isolés', () => {
    expect(confusedForms(['know', 'knew', 'known'], 'No, new, known.')).toBeNull();
    expect(confusedForms(['write', 'wrote', 'written'], 'Right, wrote, written.')).toBeNull();
    expect(confusedForms(['win', 'won', 'won'], 'Win, one, one.')).toBeNull();
  });

  it('rejette une récitation à laquelle il manque une forme', () => {
    expect(confusedForms(['blow', 'blew', 'blown'], 'Blown.')).toMatch(/entendu/);
  });
});

describe('énoncés à bip de la conjugaison', () => {
  it('recolle les mots à apostrophe coupés par la transcription', () => {
    const merged = mergeApostropheTokens(words(['Aujourd', 0, 0.24], ["'hui,", 0.24, 0.54], ['il', 0.54, 0.78]));
    expect(merged.map((w) => [w.text, w.start, w.end])).toEqual([
      ["Aujourd'hui,", 0, 0.54],
      ['il', 0.54, 0.78],
    ]);
  });

  it('situe la forme à sa place, pas sur l’infinitif qui lui ressemble', () => {
    const text = 'Trouver. Demain, il trouvera la réponse.';
    const heard = words(
      ['Trouver.', 0, 0.6],
      ['Demain,', 0.9, 1.3],
      ['il', 1.3, 1.45],
      ['trouvera', 1.45, 1.9],
      ['la', 1.9, 2.0],
      ['réponse.', 2.0, 2.5],
    );
    expect(alignWords(text.split(' '), heard.map((w) => w.text))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(hiddenSpan(text, 3, heard)).toEqual({ start: 1.45, end: 1.9, fused: false });
  });

  it('étend le bip aux blancs laissés autour de la forme', () => {
    const heard = words(['Demain,', 0, 0.4], ['nous', 0.5, 0.7], ['chanterons', 0.75, 1.2], ['fort.', 1.3, 1.6]);
    expect(hiddenSpan('Demain, nous chanterons fort.', 2, heard)).toEqual({ start: 0.7, end: 1.3, fused: false });
  });

  it('signale une prise où le pronom est fondu dans la forme', () => {
    // « je aime » synthétisé « j'aime » : le bip emporte le pronom avec elle.
    const heard = words(['Aimer.', 0, 0.5], ['Aujourd', 0.8, 1.0], ["'hui,", 1.0, 1.3], ["j'aime", 1.3, 1.7], ['ce', 1.7, 1.8], ['livre.', 1.8, 2.2]);
    expect(hiddenSpan('Aimer. Aujourd’hui, je aime ce livre.', 3, heard)).toEqual({ start: 1.3, end: 1.7, fused: true });
  });

  it('refuse une prise où la forme est introuvable', () => {
    const heard = words(['Demain,', 0, 0.4], ['il', 0.4, 0.6], ['la', 0.6, 0.7], ['réponse.', 0.7, 1.1]);
    expect(hiddenSpan('Demain, il trouvera la réponse.', 2, heard).error).toMatch(/introuvable/);
  });

  it('entend une terminaison qui a filé sous le bip', () => {
    const text = 'Demain, il trouvera la réponse.';
    expect(formLeaks(text, 2, 'Demain, il y aura la réponse.')).toBe(true);
    expect(formLeaks(text, 2, 'Demain, il, la réponse.')).toBe(false);
    expect(formLeaks(text, 2, 'Demain, il bip la réponse.')).toBe(false);
  });
});

describe('bip', () => {
  const rate = 1000;
  const voice = Float32Array.from({ length: 3000 }, (_, i) => 0.3 * Math.sin(i / 3));

  it('remplace l’intervalle par un bip, et garde le reste tel quel', () => {
    const out = beepOver(voice, { start: 1, end: 2 }, rate);
    // 1 s de voix, puis 1 s de bip (marges comprises), puis la dernière seconde.
    expect(out.length).toBe(3000);
    expect(Array.from(out.subarray(0, 900))).toEqual(Array.from(voice.subarray(0, 900)));
    expect(Array.from(out.subarray(2100))).toEqual(Array.from(voice.subarray(2100)));
    // Les marges autour du bip sont silencieuses.
    expect(out.subarray(1000, 1060).every((v) => v === 0)).toBe(true);
  });

  it('ne fait jamais un bip trop court pour s’entendre', () => {
    const out = beepOver(voice, { start: 1, end: 1.1 }, rate);
    expect(out.length).toBeGreaterThan(3000 - 100 + 350);
  });
});

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

describe.skipIf(!hasFfmpeg)('MP3 (ffmpeg)', () => {
  it('décode ce qu’il encode, à la même durée', () => {
    const tone = Float32Array.from({ length: 22050 }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 440 * i) / 22050));
    const samples = decodeMp3(encodeMp3(tone));
    expect(Math.abs(samples.length - tone.length)).toBeLessThan(2000);
  });
});
