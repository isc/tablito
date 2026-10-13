// @vitest-environment node
//
// Vérification et retouche des prises de synthèse vocale (scripts/tts-takes.mjs).
// Les mots reconnus ci-dessous imitent ce que rendent les modèles : homophones
// pour la transcription des récitations, mots du texte ou « [unk] » pour
// l'aligneur.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  alignWords,
  beepOver,
  confusedForms,
  decodeMp3,
  encodeMp3,
  fricativeEnd,
  hiddenSpan,
  hideWord,
  maskProblem,
  PYTHON,
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
  it('situe la forme à sa place, pas sur l’infinitif qui lui ressemble', () => {
    const text = 'Trouver. Demain, il trouvera la réponse.';
    const heard = words(
      ['trouver', 0, 0.6],
      ['demain', 0.9, 1.3],
      ['il', 1.3, 1.45],
      ['trouvera', 1.45, 1.9],
      ['la', 1.9, 2.0],
      ['réponse', 2.0, 2.5],
    );
    expect(alignWords(text.split(' '), heard.map((w) => w.text))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(hiddenSpan(text, 3, heard)).toEqual({ start: 1.45, end: 1.9 });
  });

  it('étend le bip aux pauses laissées autour de la forme', () => {
    const heard = words(['demain', 0, 0.4], ['nous', 0.5, 0.7], ['chanterons', 0.75, 1.2], ['fort', 1.3, 1.6]);
    expect(hiddenSpan('Demain, nous chanterons fort.', 2, heard)).toEqual({ start: 0.7, end: 1.3 });
  });

  it('refuse une prise où la forme est introuvable', () => {
    const heard = words(['demain', 0, 0.4], ['il', 0.4, 0.6], ['la', 0.6, 0.7], ['réponse', 0.7, 1.1]);
    expect(hiddenSpan('Demain, il trouvera la réponse.', 2, heard).error).toMatch(/introuvable/);
  });

  it('situe une forme hors du vocabulaire de l’aligneur par sa place', () => {
    // Vosk ne connaît pas « chanterai » : il rend « [unk] » à sa place.
    const heard = words(['demain', 0, 0.48], ['je', 0.84, 1.05], ['[unk]', 1.05, 1.5], ['à', 1.56, 1.62], ['la', 1.62, 1.71], ['fête', 1.71, 2.13]);
    expect(hiddenSpan('Demain, je chanterai à la fête.', 2, heard)).toEqual({ start: 1.05, end: 1.56 });
  });

  describe('contrôle de l’audio couvert', () => {
    const text = 'Demain, il trouvera la réponse.';
    // Le bip couvre 0,6–1,1 s ; « la » reprend à 1,15 s.
    const region = { start: 0.6, end: 1.1 };
    const heard = (...middle) => words(['demain', 0, 0.4], ['il', 0.4, 0.6], ...middle, ['la', 1.15, 1.25], ['réponse', 1.25, 1.7]);

    it('laisse passer un bip reconnu comme un son inconnu, ou pas reconnu du tout', () => {
      expect(maskProblem(text, 2, heard(['[unk]', 0.6, 1.1]), region)).toBeNull();
      expect(maskProblem(text, 2, heard(), region)).toBeNull();
    });

    it('entend la forme, ou un mot reconnu à sa place', () => {
      expect(maskProblem(text, 2, heard(['trouvera', 0.6, 1.1]), region)).toMatch(/audible/);
      expect(maskProblem(text, 2, heard(['la', 0.6, 0.7], ['[unk]', 0.7, 1.1]), region)).toMatch(/audible/);
    });

    it('entend un reste de forme inconnu de l’aligneur, qui déborde du bip', () => {
      expect(maskProblem(text, 2, heard(['[unk]', 0.45, 1.1]), region)).toMatch(/audible/);
    });

    it('refuse un bip qui a mangé le pronom', () => {
      const lost = words(['demain', 0, 0.4], ['[unk]', 0.4, 1.1], ['la', 1.15, 1.25], ['réponse', 1.25, 1.7]);
      expect(maskProblem(text, 2, lost, region)).toMatch(/précédent/);
    });

    it('n’exige pas le petit mot d’après, mal reconnu juste après un bip', () => {
      const noNext = words(['demain', 0, 0.4], ['il', 0.4, 0.6], ['[unk]', 0.6, 1.1], ['réponse', 1.25, 1.7]);
      expect(maskProblem(text, 2, noNext, region)).toBeNull();
    });
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

  it('trouve la fin du « j » d’un pronom élidé : du bruit aigu, puis une voyelle', () => {
    // 0,1 s de silence, 0,08 s de friction (bruit), 0,2 s de voyelle (sinusoïde grave).
    const rate = 22050;
    let seed = 1;
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.2;
    const signal = Float32Array.from({ length: Math.round(0.38 * rate) }, (_, i) => {
      const t = i / rate;
      if (t < 0.1) return 0;
      if (t < 0.18) return noise();
      return 0.3 * Math.sin(2 * Math.PI * 200 * t);
    });
    expect(fricativeEnd(signal, 0, 0.38, rate)).toBeCloseTo(0.18, 1);
    // Sans friction (une voyelle d'emblée), pas de « j » à trouver.
    expect(fricativeEnd(signal.subarray(Math.round(0.18 * rate)), 0, 0.2, rate)).toBeNull();
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

// La chaîne réelle, sur un MP3 du dépôt : seulement là où Vosk est installé
// (`VOSK_PYTHON`, cf. scripts/generate-tts.mjs) — pas dans la CI de test.
const hasVosk = hasFfmpeg && spawnSync(PYTHON, ['-c', 'import vosk']).status === 0;

describe.skipIf(!hasVosk)('bip posé par alignement forcé (Vosk)', () => {
  it('couvre la forme, et seulement elle', () => {
    const mp3 = readFileSync(new URL('../public/audio/tts/fr/conj-pres-dire-nous-0-p.mp3', import.meta.url));
    const result = hideWord(mp3, 'Aujourd’hui, nous disons merci.', 2);
    expect(result.problem).toBeNull();
    // « nous » finit vers 1,17 s, « merci » commence vers 1,56 s (enveloppe d'énergie).
    expect(result.span.start).toBeGreaterThan(1.1);
    expect(result.span.end).toBeLessThan(1.65);
  });

  it('garde le « j » d’un pronom élidé devant le bip', () => {
    // « j’étais » : le /ʒ/ finit vers 1,12 s, la voyelle suit (dérivée du signal).
    const mp3 = readFileSync(new URL('../public/audio/tts/fr/conj-imp-etre-0-p.mp3', import.meta.url));
    const result = hideWord(mp3, 'Hier, j’étais malade.', 1);
    expect(result.problem).toBeNull();
    expect(result.span.start).toBeGreaterThan(1.08);
    expect(result.span.start).toBeLessThan(1.16);
  });
});
