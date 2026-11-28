#!/usr/bin/env node
// Rasterise public/icons/icon.svg (master 1024×1024) vers les PNG utilisés
// par la PWA et les navigateurs : icon-192, icon-512, apple-touch-icon (180).
//
// Le `-v2` des deux premiers compte : une icône redessinée change de nom de
// fichier (`-v3`, ici et partout où le nom est cité). Chrome régénère une PWA
// Android installée quand son manifeste change, mais une image remplacée à la
// même adresse ne suit pas : le Piou redessiné du 2026-09-23 n'était toujours
// pas sur le téléphone d'Ivan deux mois plus tard, mise à jour de la WebAPK du
// 4 novembre comprise (`chrome://webapks`).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, '..', 'public', 'icons');
const masterPath = join(iconsDir, 'icon.svg');

const targets = [
  { name: 'icon-192-v2.png', size: 192 },
  { name: 'icon-512-v2.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

const svg = await readFile(masterPath);

for (const { name, size } of targets) {
  const out = join(iconsDir, name);
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  const buf = await readFile(out);
  console.log(`✓ ${name} (${size}×${size}, ${(buf.length / 1024).toFixed(1)} KB)`);
}
