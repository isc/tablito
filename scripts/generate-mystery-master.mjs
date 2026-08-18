#!/usr/bin/env node
/**
 * Génère le master d'une nouvelle image mystère, en local sur charras
 * (Z-Image-Turbo via sd-cli, le même moteur que le pipeline `beast` de ddmr —
 * réglages expliqués au §12 du SETUP.md de home-infra). Aucun service tiers.
 *
 * Usage :
 *   node scripts/generate-mystery-master.mjs <theme> "<scène>" [--seed N] [--levels]
 *
 * Exemples :
 *   node scripts/generate-mystery-master.mjs forest \
 *     "an autumn forest clearing: a winding dirt path, a small wooden cabin…"
 *   # → masters/forest.png (1024×1024)
 *
 *   node scripts/generate-mystery-master.mjs harbor "a small fishing harbor…" --levels
 *   # → masters/harbor.png + public/mystery/harbor/level-{1..5}.png
 *
 * La <scène> décrit UNIQUEMENT le contenu (lieux, personnages, animaux,
 * objets) : le style est imposé par STYLE_PREFIX/STYLE_SUFFIX ci-dessous pour
 * garder la série homogène. Ce vocabulaire est rétro-conçu depuis les masters
 * nano banana d'avril 2026 (market, ocean, village), dont le prompt d'origine
 * n'a pas été archivé. Deux leçons apprises en le calibrant (août 2026) :
 * « in the gentle style of classic European picture books » + « muted warm
 * earthy colors » tiennent le registre album jeunesse, et il ne faut PAS
 * écrire « cute round-faced » (ça bascule en kawaii, jugé trop enfantin).
 *
 * Reproductibilité : seed 7 par défaut, comme le bestiaire ddmr — mais la
 * génération GPU n'est PAS déterministe au bit près (vérifié le 17/08/2026 :
 * même prompt, même seed, détails différents). Le master commité dans
 * masters/ fait donc foi : c'est lui qu'on re-dérive, jamais une
 * re-génération. C'est aussi pour ça que ce script écrit dans masters/ —
 * le lot garden/savanna/city/space de 9f1ab89 n'a pas ses masters, ils sont
 * irrécupérables.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'charras';

const STYLE_PREFIX = 'A charming storybook illustration of';
const STYLE_SUFFIX =
  'in the gentle style of classic European picture books, ' +
  'muted warm earthy colors, soft cream sky, thin soft outlines, ' +
  'gentle grainy paper texture, many small details to discover, ' +
  'dense composition filling the whole frame, square format, no text';

function usage() {
  console.error('usage: node scripts/generate-mystery-master.mjs <theme> "<scène>" [--seed N] [--levels]');
  process.exit(1);
}

const args = process.argv.slice(2);
const theme = args.shift();
const scene = args.shift();
if (!theme || !scene || scene.startsWith('--')) usage();
let seed = 7;
let levels = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--seed') seed = Number(args[++i]);
  else if (args[i] === '--levels') levels = true;
  else usage();
}

const prompt = `${STYLE_PREFIX} ${scene}, ${STYLE_SUFFIX}`;
const remote = `~/scratch/mystery-${theme}.png`;
const master = join(ROOT, 'masters', `${theme}.png`);
mkdirSync(dirname(master), { recursive: true });

console.log(`▸ génération sur ${HOST} (seed ${seed}) — ~1 min de GPU`);
// --offload-to-cpu obligatoire : l'assistant vocal occupe déjà ~4 Go de VRAM
// (cf. beast.sh). Le prompt arrive par STDIN (`PROMPT=$(cat)`) : jamais
// interpolé dans la chaîne shell distante, donc insensible aux apostrophes.
const gen = spawnSync(
  'ssh',
  [
    HOST,
    'SD=/opt/sd; PROMPT=$(cat); LD_LIBRARY_PATH=$SD/lib "$SD/bin/sd-cli" ' +
      '--diffusion-model "$SD/models/z_image_turbo-Q8_0.gguf" ' +
      '--vae "$SD/models/ae.sft" ' +
      '--llm "$SD/models/Qwen3-4B-Instruct-2507-Q8_0.gguf" ' +
      `-p "$PROMPT" --cfg-scale 1.0 --steps 8 -H 1024 -W 1024 -s ${seed} ` +
      `--diffusion-fa --offload-to-cpu -o ${remote}`,
  ],
  { input: prompt, stdio: ['pipe', 'inherit', 'inherit'], encoding: 'utf8' },
);
if (gen.status !== 0) process.exit(gen.status ?? 1);

const copy = spawnSync('scp', ['-q', `${HOST}:${remote.replace('~/', '')}`, master], {
  stdio: 'inherit',
});
if (copy.status !== 0 || !existsSync(master)) {
  console.error('✗ master non récupéré');
  process.exit(1);
}
console.log(`✓ ${master}`);

if (levels) {
  const lv = spawnSync(
    process.execPath,
    [join(ROOT, 'scripts', 'generate-mystery-levels.mjs'), master],
    { stdio: 'inherit' },
  );
  process.exit(lv.status ?? 0);
}
