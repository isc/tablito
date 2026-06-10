#!/usr/bin/env node
// Génère l'image de partage (Open Graph / Twitter Card) : public/og-image.png,
// 1200×630, la dimension recommandée par Facebook/WhatsApp/iMessage/Slack.
//
// Pourquoi un navigateur headless plutôt que sharp ? L'image porte du texte
// dans l'identité visuelle du site (Fraunces pour le titre, Nunito pour le
// reste). sharp rend le SVG via librsvg, qui n'honore pas les @font-face
// (encore moins en woff2) — le texte retomberait sur une police système et
// perdrait l'identité. Chromium, lui, charge les woff2 self-hostées exactement
// comme la vraie page. On screenshot en 2× puis on réduit à 1200×630 (sharp)
// pour un texte net (supersampling).
//
// Régénérer après tout changement de titre, tagline, palette ou mascotte :
//   node scripts/generate-og-image.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const fontsDir = join(root, 'public', 'fonts');
const out = join(root, 'public', 'og-image.png');

const fontUrl = (file) => pathToFileURL(join(fontsDir, file)).href;

// Mascotte Piou. ⚠ TROISIÈME copie du SVG (les deux autres : la landing dans
// index.html et src/components/Mascot.tsx). Celle-ci inline en plus les couleurs
// qui vivent dans Mascot.css (#F0B43A, #FBD96C, #D9751F, #E8623D…) — donc un
// changement de géométrie OU de palette doit être répercuté ici à la main, sans
// outil pour détecter la dérive. Régénérer l'image après toute modif.
const mascot = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="300" height="300">
  <g fill="none" stroke="#1E1A2E" stroke-width="1.6" stroke-linecap="round">
    <path d="M40 68 L 40 94 M 36 94 L 44 94" />
    <path d="M60 68 L 60 94 M 56 94 L 64 94" />
  </g>
  <ellipse cx="50" cy="60" rx="28" ry="28" fill="#F0B43A" stroke="#1E1A2E" stroke-width="1.6" />
  <path d="M32 60 Q 50 82 68 60" fill="#FBD96C" />
  <circle cx="43" cy="54" r="3" fill="#1E1A2E" />
  <circle cx="44" cy="53" r="0.9" fill="#fff" />
  <circle cx="57" cy="54" r="3" fill="#1E1A2E" />
  <circle cx="58" cy="53" r="0.9" fill="#fff" />
  <path d="M46 63 L 54 63 L 50 68 Z" fill="#D9751F" stroke="#1E1A2E" stroke-width="1.3" stroke-linejoin="round" />
  <circle cx="38" cy="62" r="2.5" fill="#E8623D" opacity="0.35" />
  <circle cx="62" cy="62" r="2.5" fill="#E8623D" opacity="0.35" />
  <path d="M30 58 Q 26 70 36 74 Q 40 68 38 60 Z" fill="#FBD96C" stroke="#1E1A2E" stroke-width="1.6" />
  <path d="M48 34 L 50 28 L 52 34" fill="none" stroke="#1E1A2E" stroke-width="1.6" stroke-linecap="round" />
</svg>`;

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Fraunces'; font-weight: 600; src: url("${fontUrl('fraunces-normal-TeP2Xz5c.woff2')}") format('woff2'); }
  @font-face { font-family: 'Nunito'; font-weight: 400 800; src: url("${fontUrl('nunito-normal-aBTMnFcQ.woff2')}") format('woff2'); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #FBF6EC; display: flex; align-items: center;
         padding: 0 72px; gap: 36px; font-family: 'Nunito', sans-serif; -webkit-font-smoothing: antialiased; }
  .left { flex: 1; }
  .chip { display: inline-block; background: #E8E6F7; color: #2B2478; font-weight: 800;
          font-size: 24px; padding: 8px 18px; border-radius: 999px; margin-bottom: 22px; letter-spacing: 0.3px; }
  h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 132px; line-height: 0.95;
       color: #2B2478; letter-spacing: -4px; margin-bottom: 18px; }
  .tagline { font-size: 40px; line-height: 1.25; color: #52495F; font-weight: 600; max-width: 620px; margin-bottom: 34px; }
  .pills { display: flex; gap: 14px; flex-wrap: wrap; }
  .pill { background: #FFFFFF; border: 2px solid #E6DECE; color: #1E1A2E; font-weight: 800;
          font-size: 26px; padding: 12px 22px; border-radius: 999px; }
  .right { flex-shrink: 0; width: 380px; height: 380px; border-radius: 50%; background: #E8E6F7;
           display: flex; align-items: center; justify-content: center; }
  .right svg { width: 300px; height: 300px; overflow: visible; }
</style></head><body>
  <div class="left">
    <span class="chip">dès le CE1 · 7–11 ans</span>
    <h1>Tablito</h1>
    <p class="tagline">Apprendre les tables de multiplication, en douceur.</p>
    <div class="pills">
      <span class="pill">100 % gratuit</span>
      <span class="pill">Sans pub</span>
      <span class="pill">Hors-ligne</span>
    </div>
  </div>
  <div class="right">${mascot}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready.then(() => {}));
const shot = await page.screenshot({ type: 'png' });
await browser.close();

const { size } = await sharp(shot)
  .resize(1200, 630, { fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toFile(out);

console.log(`✓ public/og-image.png (1200×630, ${(size / 1024).toFixed(1)} KB)`);
