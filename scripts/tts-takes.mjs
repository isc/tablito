// Vérifier et retoucher une prise de synthèse vocale, d'après sa transcription
// (cf. generate-tts.mjs). Ce module ne parle à aucune API : il compare une
// transcription au texte, et taille l'audio (ffmpeg décode et réencode le MP3).
//
// Deux usages :
// - les récitations des verbes irréguliers (entrées `forms`) : la synthèse
//   remplace parfois l'infinitif par la forme suivante, « knew, knew, known »
//   pour know (avis parent du 11/10/2026) ;
// - les énoncés de conjugaison (entrées `hide`), qui ne doivent jamais dire la
//   forme conjuguée, sinon ils dictent la réponse. Synthétiser la phrase avec
//   un trou (« Demain, je… à la fête ») donnait une diction hachée, et un
//   silence si court que le trou s'entendait à peine (même soir). La phrase
//   est donc synthétisée EN ENTIER, avec sa prosodie naturelle, puis la forme
//   est remplacée par un bip : la transcription horodatée mot à mot dit où
//   elle tombe.

import { spawnSync } from 'node:child_process';

/** Mot ramené à ses lettres : minuscules, sans accents ni ponctuation. */
export function normalizeWord(word) {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/’/g, "'")
    .replace(/[^a-z']/g, '')
    .replace(/^'+|'+$/g, '');
}

/**
 * Deux formes différentes de la récitation entendues pareil ? Rend le défaut en
 * clair, ou null. La transcription d'un mot isolé est approximative (« write »
 * revient « right », « win » revient « one ») : on ne compare donc pas ce qui
 * est entendu à ce qui est écrit, seulement les formes ENTRE ELLES.
 */
export function confusedForms(forms, transcript) {
  const heard = transcript.split(/[\s,.;:!?]+/).map(normalizeWord).filter(Boolean);
  if (heard.length !== forms.length) return `entendu « ${transcript.trim()} »`;
  for (let i = 0; i < forms.length; i++) {
    for (let j = i + 1; j < forms.length; j++) {
      if (forms[i] !== forms[j] && heard[i] === heard[j]) {
        return `« ${forms[i]} » et « ${forms[j]} » entendus « ${heard[i]} »`;
      }
    }
  }
  return null;
}

/**
 * Recolle les morceaux d'un mot à apostrophe que la transcription rend en deux
 * (« Aujourd » + « 'hui, ») : le texte, lui, n'en fait qu'un mot.
 */
export function mergeApostropheTokens(words) {
  const merged = [];
  for (const w of words) {
    const prev = merged[merged.length - 1];
    if (prev && /^['’]/.test(w.text.trim())) {
      merged[merged.length - 1] = { text: prev.text + w.text.trim(), start: prev.start, end: w.end };
    } else {
      merged.push({ ...w, text: w.text.trim() });
    }
  }
  return merged.filter((w) => normalizeWord(w.text) !== '');
}

function similarity(a, b) {
  if (a === b) return 1;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length, 1);
}

// En dessous, deux mots ne sont pas « le même mot mal transcrit ».
const MIN_SIMILARITY = 0.5;
const GAP = -0.5;

/**
 * Aligne les mots attendus sur les mots entendus (Needleman-Wunsch, score de
 * similarité d'édition). Rend, pour chaque mot attendu, l'indice du mot
 * entendu qui lui correspond, ou null. Un alignement plutôt qu'une recherche :
 * la phrase contient souvent un mot proche de la forme (l'infinitif en tête,
 * « Chanter. … il chantera »), et seule la position les départage.
 */
export function alignWords(expected, heard) {
  const a = expected.map(normalizeWord);
  const b = heard.map(normalizeWord);
  const grid = (fill) => Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(fill));
  const score = grid(0);
  // Le pas retenu dans chaque case : 'd' (apparier), 'u' (mot attendu sauté),
  // 'l' (mot entendu sauté), et la similarité de l'appariement.
  const step = grid('');
  const sim = grid(0);
  for (let i = 1; i <= a.length; i++) [score[i][0], step[i][0]] = [i * GAP, 'u'];
  for (let j = 1; j <= b.length; j++) [score[0][j], step[0][j]] = [j * GAP, 'l'];
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      sim[i][j] = similarity(a[i - 1], b[j - 1]);
      const options = [
        [score[i - 1][j - 1] + 2 * sim[i][j] - 1, 'd'],
        [score[i - 1][j] + GAP, 'u'],
        [score[i][j - 1] + GAP, 'l'],
      ];
      [score[i][j], step[i][j]] = options.reduce((best, o) => (o[0] > best[0] ? o : best));
    }
  }
  const map = new Array(a.length).fill(null);
  for (let i = a.length, j = b.length; i > 0 && j > 0; ) {
    if (step[i][j] === 'd') {
      if (sim[i][j] >= MIN_SIMILARITY) map[i - 1] = j - 1;
      i--;
      j--;
    } else if (step[i][j] === 'u') {
      i--;
    } else {
      j--;
    }
  }
  return map;
}

/**
 * Où tombe, dans l'audio, le mot n° `hide` de `text` (mots séparés par des
 * espaces) ? `words` : la transcription horodatée, `{ text, start, end }` en
 * secondes. Rend `{ start, end, fused }`, ou `{ error }` quand la forme est
 * introuvable (synthèse qui a dit autre chose, mot avalé). `fused` : le mot
 * d'avant n'est pas entendu à part, la synthèse a fondu le pronom dans la forme
 * (« je aime » dit « j'aime ») et le bip l'emporte avec elle.
 */
export function hiddenSpan(text, hide, words) {
  const heard = mergeApostropheTokens(words);
  const map = alignWords(text.split(/\s+/), heard.map((w) => w.text));
  const j = map[hide];
  if (j === null) return { error: 'forme introuvable dans la transcription' };
  // Les horodatages laissent parfois un blanc entre deux mots : le bip le
  // couvre aussi, plutôt que de risquer d'y laisser filer une terminaison.
  const prev = heard[j - 1];
  const next = heard[j + 1];
  return {
    start: prev ? Math.min(heard[j].start, prev.end) : heard[j].start,
    end: next ? Math.max(heard[j].end, next.start) : heard[j].end,
    fused: hide > 0 && map[hide - 1] !== j - 1,
  };
}

/**
 * La forme s'entend-elle malgré le bip ? Contrôle a posteriori, sur la
 * transcription (texte seul) de l'audio couvert : un horodatage trop court
 * laisserait filer une terminaison — justement ce que la question teste. Un
 * reste de forme se transcrit rarement en mot proche (« trouvera » couvert à
 * moitié revient « il y aura ») : on exige donc qu'entre le mot d'avant et le
 * mot d'après, rien ne soit entendu, sinon le bip lui-même.
 */
export function formLeaks(text, hide, transcript) {
  const expected = text.split(/\s+/);
  const heard = transcript.split(/\s+/).filter((w) => normalizeWord(w) !== '');
  const map = alignWords(expected, heard);
  if (map[hide] !== null) return true;
  const before = hide > 0 ? map[hide - 1] : -1;
  const after = hide + 1 < expected.length ? map[hide + 1] : heard.length;
  // Transcription trop brouillée pour situer le trou : rien à en conclure.
  if (before === null || after === null) return false;
  return heard.slice(before + 1, after).some((w) => !/^b[ie]+p/.test(normalizeWord(w)));
}

// Le format des MP3 de la synthèse (mono, 22 050 Hz) : le fichier couvert reste
// homogène avec les autres.
const SAMPLE_RATE = 22050;

// Le bip : une sinusoïde douce, ni plus longue ni plus courte que le mot qu'elle
// remplace (le rythme de la phrase reste celui de la synthèse), entourée d'un
// court silence pour qu'elle ne colle pas aux mots voisins.
const BEEP_HZ = 660;
const BEEP_MIN_SECONDS = 0.35;
const BEEP_PAD_SECONDS = 0.06;
const FADE_SECONDS = 0.015;

/**
 * Remplace `[start, end]` (secondes) par un bip. Le niveau du bip suit celui de
 * la voix (RMS), un peu en dessous : ni noyé, ni criard.
 */
export function beepOver(samples, { start, end }, sampleRate = SAMPLE_RATE) {
  const s = Math.round(start * sampleRate);
  const e = Math.round(end * sampleRate);
  const fade = Math.round(FADE_SECONDS * sampleRate);
  const pad = Math.round(BEEP_PAD_SECONDS * sampleRate);
  const tone = Math.round(Math.max(end - start - 2 * BEEP_PAD_SECONDS, BEEP_MIN_SECONDS) * sampleRate);

  let sum = 0;
  for (const v of samples) sum += v * v;
  const amplitude = Math.min(0.5, Math.sqrt(sum / samples.length) * Math.SQRT2 * 0.7);

  const out = new Float32Array(s + pad + tone + pad + (samples.length - e));
  out.set(samples.subarray(0, s), 0);
  // Fondus aux coupes : une coupe franche dans la voix claque.
  for (let i = 0; i < fade && s - 1 - i >= 0; i++) out[s - 1 - i] *= i / fade;
  for (let i = 0; i < tone; i++) {
    const env = Math.min(1, i / fade, (tone - 1 - i) / fade);
    out[s + pad + i] = amplitude * env * Math.sin((2 * Math.PI * BEEP_HZ * i) / sampleRate);
  }
  const tail = s + pad + tone + pad;
  out.set(samples.subarray(e), tail);
  for (let i = 0; i < fade && tail + i < out.length; i++) out[tail + i] *= i / fade;
  return out;
}

function ffmpeg(args, input) {
  const res = spawnSync('ffmpeg', ['-v', 'error', ...args], { input, maxBuffer: 1 << 28 });
  if (res.error) throw new Error(`ffmpeg introuvable : ${res.error.message}`);
  if (res.status !== 0) throw new Error(`ffmpeg : ${res.stderr.toString().trim()}`);
  return res.stdout;
}

export function decodeMp3(buf) {
  const pcm = ffmpeg(['-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', String(SAMPLE_RATE), 'pipe:1'], buf);
  // Copie : le Buffer rendu n'est pas forcément aligné sur 4 octets.
  return new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
}

export function encodeMp3(samples) {
  const pcm = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  return ffmpeg(
    ['-f', 'f32le', '-ac', '1', '-ar', String(SAMPLE_RATE), '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '64k', '-f', 'mp3', 'pipe:1'],
    pcm,
  );
}
