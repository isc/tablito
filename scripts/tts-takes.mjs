// Vérifier et retoucher une prise de synthèse vocale (cf. generate-tts.mjs). Ce
// module ne parle à aucune API : il compare une transcription au texte, aligne
// l'audio sur son texte (Vosk, scripts/align-words.py), et taille l'audio
// (ffmpeg décode et réencode le MP3).
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
//   est remplacée par un bip, posé par un alignement forcé de l'audio sur son
//   texte. Les horodatages mot à mot d'un modèle de transcription (Voxtral)
//   flottaient de 100 à 300 ms : le bip mangeait le pronom, et laissait
//   entendre l'attaque ou la terminaison de la forme.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
// Ce que Vosk rend pour un son qui n'est aucun des mots permis : un mot hors de
// son vocabulaire (« chanterai »), ou le bip. Il peut tenir la place de
// n'importe quel mot attendu.
const UNKNOWN = '[unk]';

/**
 * Aligne les mots attendus sur les mots entendus (Needleman-Wunsch, score de
 * similarité d'édition). Rend, pour chaque mot attendu, l'indice du mot
 * entendu qui lui correspond, ou null. Un alignement plutôt qu'une recherche :
 * la phrase contient souvent un mot proche de la forme (l'infinitif en tête,
 * « Chanter. … il chantera »), et seule la position les départage.
 */
export function alignWords(expected, heard) {
  const a = expected.map(normalizeWord);
  const b = heard.map((w) => (w === UNKNOWN ? w : normalizeWord(w)));
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
      sim[i][j] = b[j - 1] === UNKNOWN ? MIN_SIMILARITY : similarity(a[i - 1], b[j - 1]);
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
 * espaces) ? `words` : les mots alignés, `{ text, start, end }` en secondes.
 * Rend `{ start, end }`, ou `{ error }` quand la forme est introuvable.
 */
export function hiddenSpan(text, hide, words) {
  const j = alignWords(text.split(/\s+/), words.map((w) => w.text))[hide];
  if (j === null) return { error: 'forme introuvable à l’alignement' };
  // Un blanc entre deux mots (une pause) est couvert aussi, plutôt que de
  // risquer d'y laisser filer une attaque ou une terminaison.
  const prev = words[j - 1];
  const next = words[j + 1];
  return {
    start: prev ? Math.min(words[j].start, prev.end) : words[j].start,
    end: next ? Math.max(words[j].end, next.start) : words[j].end,
  };
}

// Marge, en secondes, autour du bip pour un son non reconnu : l'horodatage de
// la reconnaissance va par pas de 30 ms.
const REGION_TOLERANCE = 0.06;

/**
 * Ce qui cloche dans l'audio couvert, d'après les mots qu'on y reconnaît
 * (`heard`, horodatés) ; null si rien. `region` : où tombe le bip, marges
 * comprises. Deux défauts :
 * - le mot d'avant ne s'entend plus : le bip a mangé le pronom, qui porte la
 *   personne. Le mot d'après n'est pas exigé : souvent minuscule (« au »,
 *   « de »), il se reconnaît mal juste après un bip, et en perdre l'attaque ne
 *   trahit rien ;
 * - la forme s'entend encore : reconnue, ou un mot reconnu sous le bip, ou un
 *   son inconnu qui en déborde — un reste de forme que l'aligneur ne connaît
 *   pas (« chanterai » est hors de son vocabulaire).
 */
export function maskProblem(text, hide, heard, region) {
  const expected = text.split(/\s+/);
  const map = alignWords(expected, heard.map((w) => w.text));
  const before = hide > 0 ? map[hide - 1] : -1;
  if (before === null || heard[before]?.text === UNKNOWN) return 'mot précédent couvert par le bip';
  const neighbours = new Set([before, map[hide + 1]]);
  const overlaps = (w) => w.start < region.end - REGION_TOLERANCE && w.end > region.start + REGION_TOLERANCE;
  const spills = (w) => w.start < region.start - REGION_TOLERANCE || w.end > region.end + REGION_TOLERANCE;
  const leaked =
    (map[hide] !== null && heard[map[hide]].text !== UNKNOWN) ||
    heard.some((w, k) => !neighbours.has(k) && (w.text === UNKNOWN ? overlaps(w) && spills(w) : overlaps(w)));
  return leaked ? `forme audible : « ${heard.map((w) => w.text).join(' ')} »` : null;
}

// Python qui a Vosk : `VOSK_PYTHON`, sinon python3.
export const PYTHON = process.env.VOSK_PYTHON || 'python3';
const ALIGN_SCRIPT = fileURLToPath(new URL('./align-words.py', import.meta.url));

// Un mot tel que l'écrit Vosk : minuscules, accents et apostrophes gardés.
const voskWord = (w) => w.toLowerCase().replace(/’/g, "'").replace(/[^\p{L}'-]/gu, '');

/**
 * Les mots de l'audio, horodatés par Vosk : `{ text, start, end }`. `forced` :
 * le texte entier est la seule phrase permise, un alignement forcé. Sinon,
 * chacun de ses mots dans n'importe quel ordre — pour vérifier ce qui s'entend
 * encore, la forme couverte.
 */
function voskWords(mp3, text, { forced }) {
  const words = text.split(/\s+/).map(voskWord);
  const grammar = forced ? [words.join(' '), UNKNOWN] : [...new Set(words), UNKNOWN];
  const pcm = decode(mp3, 's16le', 16000);
  return JSON.parse(run(PYTHON, [ALIGN_SCRIPT, JSON.stringify(grammar)], pcm).toString());
}

// Les frontières d'un mot très court sont les moins sûres : « tu es » se dit
// presque d'un bloc, et l'alignement ne laisse à « es » que 30 ms, la voyelle
// restant du côté de « tu ». Avant de rejeter la prise, on élargit le bip
// d'autant de chaque côté — tant que ses voisins s'entendent encore.
const WIDEN_SECONDS = [0, 0.05, 0.1];

/**
 * Couvre d'un bip le mot n° `hide` de `text` dans `mp3`, situé par alignement
 * forcé, puis vérifie l'audio couvert (cf. maskProblem). Rend `{ audio, span,
 * problem }` : `audio` null si la prise est inutilisable — une forme encore
 * audible dicterait la réponse, pire que pas de MP3.
 */
export function hideWord(mp3, text, hide) {
  const found = hiddenSpan(text, hide, voskWords(mp3, text, { forced: true }));
  if (found.error) return { audio: null, problem: found.error };
  const samples = decodeMp3(mp3);
  let problem = null;
  for (const widen of WIDEN_SECONDS) {
    const span = { start: Math.max(0, found.start - widen), end: found.end + widen };
    const audio = encodeMp3(beepOver(samples, span));
    problem = maskProblem(text, hide, voskWords(audio, text, { forced: false }), beepRegion(span));
    if (!problem) return { audio, span, problem };
  }
  return { audio: null, problem };
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

const toneSeconds = ({ start, end }) => Math.max(end - start - 2 * BEEP_PAD_SECONDS, BEEP_MIN_SECONDS);

/** Où tombe le bip dans l'audio couvert, marges comprises. */
export function beepRegion(span) {
  return { start: span.start, end: span.start + 2 * BEEP_PAD_SECONDS + toneSeconds(span) };
}

/**
 * Remplace `[start, end]` (secondes) par un bip. Le niveau du bip suit celui de
 * la voix (RMS), un peu en dessous : ni noyé, ni criard.
 */
export function beepOver(samples, { start, end }, sampleRate = SAMPLE_RATE) {
  const s = Math.round(start * sampleRate);
  const e = Math.round(end * sampleRate);
  const fade = Math.round(FADE_SECONDS * sampleRate);
  const pad = Math.round(BEEP_PAD_SECONDS * sampleRate);
  const tone = Math.round(toneSeconds({ start, end }) * sampleRate);

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

function run(command, args, input) {
  const res = spawnSync(command, args, { input, maxBuffer: 1 << 28 });
  if (res.error) throw new Error(`${command} introuvable : ${res.error.message}`);
  if (res.status !== 0) throw new Error(`${command} : ${res.stderr.toString().trim()}`);
  return res.stdout;
}

/** PCM mono brut d'un MP3, au format et à la fréquence voulus. */
function decode(mp3, format, rate) {
  return run('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-f', format, '-ac', '1', '-ar', String(rate), 'pipe:1'], mp3);
}

export function decodeMp3(buf) {
  const pcm = decode(buf, 'f32le', SAMPLE_RATE);
  // Copie : le Buffer rendu n'est pas forcément aligné sur 4 octets.
  return new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
}

export function encodeMp3(samples) {
  const pcm = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  return run(
    'ffmpeg',
    ['-v', 'error', '-f', 'f32le', '-ac', '1', '-ar', String(SAMPLE_RATE), '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '64k', '-f', 'mp3', 'pipe:1'],
    pcm,
  );
}
