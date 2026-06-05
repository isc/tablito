#!/usr/bin/env node

/**
 * Generates pre-recorded TTS audio files via the Mistral Voxtral TTS API.
 *
 * Usage:
 *   MISTRAL_API_KEY=... node scripts/generate-tts.mjs
 *
 * Output: public/audio/tts/*.mp3
 *
 * Skips files that already exist (delete a file to regenerate it).
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'audio', 'tts');

const MISTRAL_TTS_URL = 'https://api.mistral.ai/v1/audio/speech';
const MODEL = 'voxtral-mini-tts-2603';
// Marie - Curious (fr_fr, female)
const VOICE_ID = 'e0580ce5-e63c-4cbe-88c8-a983b80c5f1f';

const API_KEY = process.env.MISTRAL_API_KEY;
if (!API_KEY) {
  console.error('MISTRAL_API_KEY environment variable not set');
  process.exit(1);
}

async function generateAudio(text, outputPath) {
  const response = await fetch(MISTRAL_TTS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: text,
      voice_id: VOICE_ID,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`API error: ${response.status} - ${body}`);
    return false;
  }

  const data = await response.json();
  if (!data.audio_data) {
    console.error('No audio_data in response');
    return false;
  }

  await writeFile(outputPath, Buffer.from(data.audio_data, 'base64'));
  return true;
}

// Speech text for each strategy, keyed by canonical pair (a <= b).
// KEEP IN SYNC with src/lib/strategies.ts (pivots and StrategyKind).
function strategyText(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (lo === 2) return null;
  if (lo === hi && lo === 3) return null;
  const PIVOT_PRIORITY = [9, 5, 3, 4, 6, 7, 8];
  for (const pivot of PIVOT_PRIORITY) {
    if (lo === pivot || hi === pivot) {
      const n = pivot === lo ? hi : lo;
      const p = pivot * n;
      switch (pivot) {
        case 9:
          return `${n} fois 9, c'est ${n} fois 10 moins ${n}. ${n * 10} moins ${n}, égale ${p}.`;
        case 5: {
          const seq = Array.from({ length: n }, (_, i) => (i + 1) * 5).join(', ');
          return `${n} fois 5, c'est compter par 5. ${seq}. Égale ${p}.`;
        }
        case 3:
          return `${n} fois 3, c'est ${n} fois 2 plus ${n}. ${n * 2} plus ${n}, égale ${p}.`;
        case 4:
          return `${n} fois 4, c'est le double du double. ${n} fois 2 égale ${n * 2}, et ${n * 2} fois 2 égale ${p}.`;
        case 6:
          return `${n} fois 6, c'est ${n} fois 5 plus ${n}. ${n * 5} plus ${n}, égale ${p}.`;
        case 7:
          return `${n} fois 7, c'est ${n} fois 5 plus ${n} fois 2. ${n * 5} plus ${n * 2}, égale ${p}.`;
        case 8:
          return `${n} fois 8, c'est doubler trois fois. ${n} fois 2 égale ${n * 2}, fois 2 égale ${n * 4}, fois 2 égale ${p}.`;
      }
    }
  }
  return null;
}

function buildEntries() {
  const entries = [];

  // Questions: "A fois B" for all A,B in [2..9]
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      entries.push({ key: `q-${a}-${b}`, text: `${a} fois ${b}` });
    }
  }

  // Introductions: "Nouveau ! A fois B, c'est B+B+...+B, égale P" for unique facts (a <= b)
  for (let a = 2; a <= 9; a++) {
    for (let b = a; b <= 9; b++) {
      const addition = Array.from({ length: a }, () => String(b)).join(' plus ');
      entries.push({
        key: `intro-${a}-${b}`,
        text: `Nouveau ! ${a} fois ${b}, c'est ${addition}, égale ${a * b}`,
      });
    }
  }

  // Commutativity: "B fois A, c'est pareil ! C'est aussi P" for facts where a != b
  for (let a = 2; a <= 9; a++) {
    for (let b = a + 1; b <= 9; b++) {
      entries.push({
        key: `comm-${a}-${b}`,
        text: `${b} fois ${a}, c'est pareil ! C'est aussi ${a * b}`,
      });
    }
  }

  // Strategies: spoken hint when the strategy step is shown (intro or feedback ≤ box 2)
  for (let a = 2; a <= 9; a++) {
    for (let b = a; b <= 9; b++) {
      const text = strategyText(a, b);
      if (text) entries.push({ key: `strategy-${a}-${b}`, text });
    }
  }

  // Niveau 2 — division (specs §11). Pour chaque couple (a,b) ∈ [2..9]², le
  // fait « (a×b) ÷ a = b » : question (qd-), introduction (introd-) et astuce
  // « pense à la multiplication » (strategyd-). 64 faits → 192 fichiers.
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      const dividend = a * b;
      const divisor = a;
      const quotient = b;
      entries.push({
        key: `qd-${dividend}-${divisor}`,
        text: `${dividend} divisé par ${divisor}`,
      });
      entries.push({
        key: `introd-${dividend}-${divisor}`,
        text: `Nouveau ! ${dividend} divisé par ${divisor}. ${divisor} fois combien font ${dividend} ? ${divisor} fois ${quotient}, égale ${dividend}. Donc ${dividend} divisé par ${divisor}, égale ${quotient}.`,
      });
      entries.push({
        key: `strategyd-${dividend}-${divisor}`,
        text: `${divisor} fois combien font ${dividend} ? ${divisor} fois ${quotient}, égale ${dividend}. Donc ${dividend} divisé par ${divisor}, égale ${quotient}.`,
      });
    }
  }

  // Static phrases
  entries.push({
    key: 'welcome-hello',
    text: "Bonjour ! Je suis Piou, ton petit copain d'apprentissage. On va apprendre les tables de multiplication ensemble !",
  });
  entries.push({
    key: 'welcome-name',
    text: "Comment tu t'appelles ?",
  });
  entries.push({
    key: 'welcome-test',
    text: "Je vais te poser quelques questions pour voir ce que tu connais déjà. Pas de stress, il n'y a pas de piège !",
  });
  entries.push({
    key: 'placement-intro',
    text: "Réponds du mieux que tu peux. Et si tu ne sais pas, tape sur « Je ne sais pas ».",
  });
  entries.push({
    key: 'recap-done',
    text: "Séance terminée ! Bravo, tu as bien travaillé !",
  });
  entries.push({
    key: 'rules-intro-welcome',
    text: "Avant de commencer, je vais te montrer deux règles toutes simples pour multiplier par 1 et par 10. Pas besoin de les apprendre par coeur : tu vas comprendre comment elles marchent !",
  });
  entries.push({
    key: 'rules-intro-x1',
    text: "Tout nombre multiplié par 1 reste le même. Par exemple, 4 fois 1 égale 4, et 8 fois 1 égale 8. Facile, non ?",
  });
  entries.push({
    key: 'rules-intro-x10',
    text: "Pour multiplier par 10, les chiffres glissent d'une place vers la gauche, et un zéro vient prendre la place des unités. Par exemple, 3 devient 30, 7 devient 70, 12 devient 120. Astuce : tous les résultats de la table de 10 se terminent par zéro !",
  });

  return entries;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const entries = buildEntries();
  console.log(`Generating ${entries.length} audio files...\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const { key, text } of entries) {
    const filepath = join(OUTPUT_DIR, `${key}.mp3`);

    if (existsSync(filepath)) {
      skipped++;
      continue;
    }

    const preview = text.length > 60 ? text.slice(0, 57) + '...' : text;
    process.stdout.write(`${key}: "${preview}"... `);

    const ok = await generateAudio(text, filepath);
    if (ok) {
      console.log('ok');
      success++;
    } else {
      console.log('FAILED');
      failed++;
    }

    // Rate-limit API calls
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone! ${success} generated, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
