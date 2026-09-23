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

// Mascotte Piou. ⚠ Copie à la main du SVG de src/components/Mascot.tsx (qui
// liste toutes les copies). Celle-ci inline en plus les couleurs qui vivent
// dans Mascot.css (#F4B63C, #FCDF84, #E07A24, #D9751F, #E8623D…) — donc un
// changement de géométrie OU de palette doit être répercuté ici à la main, sans
// outil pour détecter la dérive. Régénérer l'image après toute modif.
const mascot = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="300" height="300">
  <g fill="none" stroke="#D9751F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M42 68 L 42 94 M 42 94 L 37 97 M 42 94 L 47 97" />
    <path d="M58 68 L 58 94 M 58 94 L 53 97 M 58 94 L 63 97" />
  </g>
  <path d="M50 31 C 45 25 46 18 51 17 C 50 22 52 27 50 31 Z" fill="#F4B63C" stroke="#1E1A2E" stroke-width="1.6" stroke-linejoin="round" />
  <path d="M50 31 C 53 24 58 22 62 24 C 58 25 54 28 50 31 Z" fill="#F4B63C" stroke="#1E1A2E" stroke-width="1.6" stroke-linejoin="round" />
  <path d="M50 30 C 70 30 80 48 80 64 C 80 80 67 90 50 90 C 33 90 20 80 20 64 C 20 48 30 30 50 30 Z" fill="#F4B63C" stroke="#1E1A2E" stroke-width="1.6" stroke-linejoin="round" />
  <ellipse cx="50" cy="75" rx="18" ry="11.5" fill="#FCDF84" />
  <circle cx="41" cy="57" r="4.3" fill="#1E1A2E" />
  <circle cx="59" cy="57" r="4.3" fill="#1E1A2E" />
  <circle cx="42.5" cy="55.4" r="1.5" fill="#fff" />
  <circle cx="39.8" cy="58.8" r="0.6" fill="#fff" />
  <circle cx="60.5" cy="55.4" r="1.5" fill="#fff" />
  <circle cx="57.8" cy="58.8" r="0.6" fill="#fff" />
  <path d="M45.5 63.5 Q 50 61.5 54.5 63.5 Q 50 69.5 45.5 63.5 Z" fill="#E07A24" stroke="#1E1A2E" stroke-width="1.3" stroke-linejoin="round" />
  <ellipse cx="33.5" cy="65" rx="4" ry="2.4" fill="#E8623D" opacity="0.42" />
  <ellipse cx="66.5" cy="65" rx="4" ry="2.4" fill="#E8623D" opacity="0.42" />
  <path d="M22 60 Q 11 68 18 79 Q 25 77 27 66 Z" fill="#FCDF84" stroke="#1E1A2E" stroke-width="1.6" stroke-linejoin="round" />
  <path d="M78 60 Q 89 68 82 79 Q 75 77 73 66 Z" fill="#FCDF84" stroke="#1E1A2E" stroke-width="1.6" stroke-linejoin="round" />
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
