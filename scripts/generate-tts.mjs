#!/usr/bin/env node

/**
 * Generates pre-recorded TTS audio files via the Mistral Voxtral TTS API.
 *
 * Usage:
 *   MISTRAL_API_KEY=... node scripts/generate-tts.mjs            # toutes les langues
 *   MISTRAL_API_KEY=... TTS_LANGS=en node scripts/generate-tts.mjs  # une seule
 *
 * Output:
 *   public/audio/tts/*.mp3        (français — langue d'origine, à la racine)
 *   public/audio/tts/en/*.mp3     (anglais)
 *
 * Skips files that already exist (delete a file to regenerate it).
 *
 * Voix : la voix française par défaut est figée ci-dessous. La voix anglaise
 * est surchargeable par la variable d'env MISTRAL_VOICE_ID_EN (sinon on réutilise
 * la voix par défaut, qui sait lire l'anglais — accent près).
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TTS_ROOT = join(__dirname, '..', 'public', 'audio', 'tts');

const MISTRAL_TTS_URL = 'https://api.mistral.ai/v1/audio/speech';
const MODEL = 'voxtral-mini-tts-2603';
// Marie - Curious (fr_fr, female)
const VOICE_ID_FR = 'e0580ce5-e63c-4cbe-88c8-a983b80c5f1f';
// Voix anglaise : surchargeable par env. À défaut on réutilise la voix par
// défaut (lisible en anglais). Renseigner MISTRAL_VOICE_ID_EN pour une voix
// native anglaise une fois un id choisi dans le catalogue Voxtral.
const VOICE_ID_EN = process.env.MISTRAL_VOICE_ID_EN || VOICE_ID_FR;

const API_KEY = process.env.MISTRAL_API_KEY;
if (!API_KEY) {
  console.error('MISTRAL_API_KEY environment variable not set');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retries sur erreurs transitoires : l'API renvoie facilement 429 (rate limit)
// en rafale, et le délai fixe entre appels ne suffit pas toujours. Backoff
// exponentiel (1s, 2s, 4s, 8s) sur 429 et 5xx ; les autres 4xx sont définitives
// (texte/voix invalide) et échouent tout de suite.
const MAX_ATTEMPTS = 5;

async function generateAudio(text, voiceId, outputPath) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await fetch(MISTRAL_TTS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          input: text,
          voice_id: voiceId,
          response_format: 'mp3',
        }),
      });
    } catch (err) {
      // Erreur réseau : transitoire, on retente.
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      console.error(`Network error: ${err}`);
      return false;
    }

    if (response.ok) {
      const data = await response.json();
      if (!data.audio_data) {
        console.error('No audio_data in response');
        return false;
      }
      await writeFile(outputPath, Buffer.from(data.audio_data, 'base64'));
      return true;
    }

    const transient = response.status === 429 || response.status >= 500;
    if (transient && attempt < MAX_ATTEMPTS) {
      await sleep(1000 * 2 ** (attempt - 1));
      continue;
    }

    const body = await response.text();
    console.error(`API error: ${response.status} - ${body}`);
    return false;
  }
  return false;
}

// === Français ===
// KEEP IN SYNC avec src/lib/strategies.ts (pivots et StrategyKind).
function strategyTextFr(a, b) {
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

// === Anglais === (miroir conceptuel de strategyTextFr)
function strategyTextEn(a, b) {
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
          return `${n} times 9 is ${n} times 10 minus ${n}. ${n * 10} minus ${n} equals ${p}.`;
        case 5: {
          const seq = Array.from({ length: n }, (_, i) => (i + 1) * 5).join(', ');
          return `${n} times 5 is counting by 5. ${seq}. Equals ${p}.`;
        }
        case 3:
          return `${n} times 3 is ${n} times 2 plus ${n}. ${n * 2} plus ${n} equals ${p}.`;
        case 4:
          return `${n} times 4 is double the double. ${n} times 2 equals ${n * 2}, and ${n * 2} times 2 equals ${p}.`;
        case 6:
          return `${n} times 6 is ${n} times 5 plus ${n}. ${n * 5} plus ${n} equals ${p}.`;
        case 7:
          return `${n} times 7 is ${n} times 5 plus ${n} times 2. ${n * 5} plus ${n * 2} equals ${p}.`;
        case 8:
          return `${n} times 8 is doubling three times. ${n} times 2 equals ${n * 2}, times 2 equals ${n * 4}, times 2 equals ${p}.`;
      }
    }
  }
  return null;
}

function buildEntriesFr() {
  const entries = [];

  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      entries.push({ key: `q-${a}-${b}`, text: `${a} fois ${b}` });
    }
  }

  for (let a = 2; a <= 9; a++) {
    for (let b = a; b <= 9; b++) {
      const addition = Array.from({ length: a }, () => String(b)).join(' plus ');
      entries.push({
        key: `intro-${a}-${b}`,
        text: `Nouveau ! ${a} fois ${b}, c'est ${addition}, égale ${a * b}`,
      });
    }
  }

  for (let a = 2; a <= 9; a++) {
    for (let b = a + 1; b <= 9; b++) {
      entries.push({
        key: `comm-${a}-${b}`,
        text: `${b} fois ${a}, c'est pareil ! C'est aussi ${a * b}`,
      });
    }
  }

  for (let a = 2; a <= 9; a++) {
    for (let b = a; b <= 9; b++) {
      const text = strategyTextFr(a, b);
      if (text) entries.push({ key: `strategy-${a}-${b}`, text });
    }
  }

  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      const dividend = a * b;
      const divisor = a;
      const quotient = b;
      entries.push({ key: `qd-${dividend}-${divisor}`, text: `${dividend} divisé par ${divisor}` });
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

  entries.push({
    key: 'welcome-hello',
    text: "Bonjour ! Je suis Piou, ton petit copain d'apprentissage. On va apprendre les tables de multiplication ensemble !",
  });
  entries.push({ key: 'welcome-name', text: "Comment tu t'appelles ?" });
  entries.push({
    key: 'welcome-test',
    text: "Je vais te poser quelques questions pour voir ce que tu connais déjà. Pas de stress, il n'y a pas de piège !",
  });
  entries.push({
    key: 'placement-intro',
    text: "Réponds du mieux que tu peux. Et si tu ne sais pas, tape sur « Je ne sais pas ».",
  });
  entries.push({ key: 'recap-done', text: "Séance terminée ! Bravo, tu as bien travaillé !" });
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

function buildEntriesEn() {
  const entries = [];

  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      entries.push({ key: `q-${a}-${b}`, text: `${a} times ${b}` });
    }
  }

  for (let a = 2; a <= 9; a++) {
    for (let b = a; b <= 9; b++) {
      const addition = Array.from({ length: a }, () => String(b)).join(' plus ');
      entries.push({
        key: `intro-${a}-${b}`,
        text: `New! ${a} times ${b} is ${addition}, equals ${a * b}`,
      });
    }
  }

  for (let a = 2; a <= 9; a++) {
    for (let b = a + 1; b <= 9; b++) {
      entries.push({
        key: `comm-${a}-${b}`,
        text: `${b} times ${a} is the same! It's also ${a * b}`,
      });
    }
  }

  for (let a = 2; a <= 9; a++) {
    for (let b = a; b <= 9; b++) {
      const text = strategyTextEn(a, b);
      if (text) entries.push({ key: `strategy-${a}-${b}`, text });
    }
  }

  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      const dividend = a * b;
      const divisor = a;
      const quotient = b;
      entries.push({ key: `qd-${dividend}-${divisor}`, text: `${dividend} divided by ${divisor}` });
      entries.push({
        key: `introd-${dividend}-${divisor}`,
        text: `New! ${dividend} divided by ${divisor}. ${divisor} times what makes ${dividend}? ${divisor} times ${quotient} equals ${dividend}. So ${dividend} divided by ${divisor} equals ${quotient}.`,
      });
      entries.push({
        key: `strategyd-${dividend}-${divisor}`,
        text: `${divisor} times what makes ${dividend}? ${divisor} times ${quotient} equals ${dividend}. So ${dividend} divided by ${divisor} equals ${quotient}.`,
      });
    }
  }

  entries.push({
    key: 'welcome-hello',
    text: "Hi! I'm Piou, your little learning buddy. We're going to learn the times tables together!",
  });
  entries.push({ key: 'welcome-name', text: "What's your name?" });
  entries.push({
    key: 'welcome-test',
    text: "I'll ask you a few questions to see what you already know. No stress, there are no tricks!",
  });
  entries.push({
    key: 'placement-intro',
    text: 'Answer as best you can. And if you don\'t know, tap "I don\'t know".',
  });
  entries.push({ key: 'recap-done', text: 'Session complete! Well done, great work!' });
  entries.push({
    key: 'rules-intro-welcome',
    text: "Before we start, I'll show you two really simple rules for multiplying by 1 and by 10. No need to memorize them: you'll understand how they work!",
  });
  entries.push({
    key: 'rules-intro-x1',
    text: 'Any number times 1 stays the same. For example, 4 times 1 equals 4, and 8 times 1 equals 8. Easy, right?',
  });
  entries.push({
    key: 'rules-intro-x10',
    text: 'To multiply by 10, the digits shift one place to the left, and a zero takes the units place. For example, 3 becomes 30, 7 becomes 70, 12 becomes 120. Tip: every answer in the 10 times table ends in zero!',
  });

  return entries;
}

const LANGS = {
  fr: { dir: TTS_ROOT, voice: VOICE_ID_FR, build: buildEntriesFr },
  en: { dir: join(TTS_ROOT, 'en'), voice: VOICE_ID_EN, build: buildEntriesEn },
};

async function generateLang(lang) {
  const { dir, voice, build } = LANGS[lang];
  await mkdir(dir, { recursive: true });

  const entries = build();
  console.log(`\n[${lang}] Generating ${entries.length} audio files into ${dir}...\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const { key, text } of entries) {
    const filepath = join(dir, `${key}.mp3`);

    if (existsSync(filepath)) {
      skipped++;
      continue;
    }

    const preview = text.length > 60 ? text.slice(0, 57) + '...' : text;
    process.stdout.write(`[${lang}] ${key}: "${preview}"... `);

    const ok = await generateAudio(text, voice, filepath);
    if (ok) {
      console.log('ok');
      success++;
    } else {
      console.log('FAILED');
      failed++;
    }

    // Rate-limit API calls
    await sleep(300);
  }

  console.log(`\n[${lang}] Done! ${success} generated, ${skipped} skipped, ${failed} failed.`);
  return failed;
}

async function main() {
  // TTS_LANGS=fr,en (défaut : toutes les langues supportées).
  const requested = (process.env.TTS_LANGS || 'fr,en')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s in LANGS);

  let failed = 0;
  for (const lang of requested) {
    failed += await generateLang(lang);
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
