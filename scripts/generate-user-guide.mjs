#!/usr/bin/env node
/**
 * Generates an HTML user guide with screenshots of every screen of the app.
 *
 * Steps:
 *   1. Spawns a `vite preview` server on the built `dist/` folder.
 *   2. Drives the app with Playwright, seeding localStorage to reach the
 *      various screens, and captures a screenshot for each.
 *   3. Writes an HTML guide at `dist/guide/index.html` with the screenshots.
 *
 * Usage:
 *   npm run build
 *   npm run user-guide
 *
 * The guide is then deployed as part of the `dist/` output to GitHub Pages
 * at https://tablito.app/guide/.
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { importTs } from './import-ts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GUIDE_DIR = join(ROOT, 'dist', 'guide');

// Langues du guide. Une passe complète (captures + HTML) par langue.
// Surchargeable via GUIDE_LANGS (ex: `GUIDE_LANGS=en`). Note : le sélecteur de
// langue de l'en-tête (UI[lang].langSwitchHref) suppose la topologie actuelle
// à deux langues (fr à la racine, autre en sous-dossier) — l'étendre à 3+
// langues demanderait de revoir ces liens.
const LANGS = (process.env.GUIDE_LANGS ?? 'fr,en')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Le français reste à la racine `/guide/` (URL canonique, lien du README) ;
// les autres langues vont dans un sous-dossier `/guide/<lang>/`.
function outDirFor(lang) {
  return lang === 'fr' ? GUIDE_DIR : join(GUIDE_DIR, lang);
}

// Mutables : positionnés au début de chaque passe de langue (cf. main). Lus
// implicitement par tx()/shot()/shotHash()/seedProfile() — les passes DOIVENT
// donc rester séquentielles (boucle `for...of await` dans main).
let LANG = 'fr';
let OUT_DIR = GUIDE_DIR;
let SHOTS_DIR = join(GUIDE_DIR, 'screenshots');

const PORT = Number(process.env.GUIDE_PORT ?? 4173);
// Matches the base baked in at build time (see scripts/build.mjs). For main
// deploys this is `/`; for branch previews it's overridden via
// the `BASE` env variable.
const BASE_PATH = process.env.BASE ?? '/';
const BASE_URL = `http://localhost:${PORT}${BASE_PATH}`;

// Mobile-ish portrait viewport: the 360×760 iPhone logical frame, i.e. the
// smallest screen the app has to look right on.
const VIEWPORT = { width: 360, height: 760 };
const DEVICE_SCALE = 2;

// Textes d'UI sur lesquels les sélecteurs Playwright `:has-text(...)` s'appuient.
// Doivent rester synchronisés avec les strings i18n de l'app (src/i18n/*).
const TEXT = {
  fr: {
    greeting: 'Salut',     // src/i18n/onboarding.ts → greeting "Salut <name> !"
    myPicture: 'Mon image',
    myPictures: 'Mes images',
    rules: 'Règles',
    badges: 'Badges',
    consistency: 'Régularité', // src/i18n/badges.ts (badge streak)
    divisions: 'Divisions',
    remainders: 'Avec reste', // src/i18n/progress.ts (onglet niveau 3)
    profilesPage: 'Profils et sauvegarde', // src/i18n/parent.ts (profilesTitle)
  },
  en: {
    greeting: 'Hi',        // greeting "Hi <name> !"
    myPicture: 'My picture',
    myPictures: 'My pictures',
    rules: 'Rules',
    badges: 'Badges',
    consistency: 'Consistency',
    divisions: 'Divisions',
    remainders: 'Remainders',
    profilesPage: 'Profiles and backup',
  },
};

/** Texte d'UI localisé pour la langue de la passe courante. */
function tx(key) {
  return TEXT[LANG][key];
}

// BCP-47 par langue : aligné sur `localeFor` (src/i18n/lang.ts) pour que le
// formatage des dates côté navigateur corresponde à ce que l'app afficherait.
const LOCALE = { fr: 'fr-FR', en: 'en-GB' };

// Anchor date for seed data — single source of truth for every capture.
const SEED_TODAY = '2026-04-12';
const SEED_YESTERDAY = '2026-04-11';

// Cache-busting suffix per screenshot. GitHub Pages serves PNGs with a
// ~10 min default TTL, so without a query string a phone in UAT keeps
// showing yesterday's captures even though the new build is live.
//
// We hash the PNG content (not the build SHA) so that only screenshots
// whose pixels actually changed get a new URL — unchanged ones keep
// their cache entry, avoiding a full re-download on every deploy.
async function shotHash(name) {
  const buf = await readFile(join(SHOTS_DIR, `${name}.png`));
  return createHash('sha1').update(buf).digest('hex').slice(0, 8);
}

// --- Utilities --------------------------------------------------------------

function log(...args) {
  console.log('[user-guide]', ...args);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* server not up yet */
    }
    await sleep(300);
  }
  throw new Error(`Server never became ready at ${url}`);
}

function startPreviewServer() {
  log(`starting nobuild preview on port ${PORT}`);
  const proc = spawn(
    'node',
    ['scripts/preview.mjs'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(PORT) } },
  );
  proc.stdout.on('data', (d) => process.stdout.write(`[preview] ${d}`));
  proc.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));
  return proc;
}

// --- Seed data --------------------------------------------------------------

/** Deterministic box level from operand pair — keeps screenshots stable. */
function seededBox(a, b) {
  const s = (a * 7 + b * 13 + a * b) % 100;
  if (s < 12) return { box: 1, introduced: false };
  if (s < 25) return { box: 1, introduced: true };
  if (s < 45) return { box: 2, introduced: true };
  if (s < 65) return { box: 3, introduced: true };
  if (s < 85) return { box: 4, introduced: true };
  return { box: 5, introduced: true };
}

function buildSampleProfile({ sessionAvailable = true } = {}) {
  const today = SEED_TODAY;
  const yesterday = SEED_YESTERDAY;
  const facts = [];
  for (let a = 2; a <= 9; a++) {
    for (let b = a; b <= 9; b++) {
      const { box, introduced } = seededBox(a, b);
      facts.push({
        a,
        b,
        product: a * b,
        box,
        introduced,
        lastSeen: introduced ? yesterday : '',
        // Due today so a session is always available.
        nextDue: introduced ? today : '',
        history: introduced
          ? [
              {
                date: yesterday,
                correct: box >= 3,
                responseTimeMs: 2500,
                answeredWith: box >= 3 ? a * b : null,
              },
            ]
          : [],
      });
    }
  }

  const sessionHistory = Array.from({ length: 8 }, (_, i) => {
    const d = new Date('2026-04-04');
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      questionsCount: 13 + (i % 3),
      correctCount: 11 + (i % 3),
      averageTimeMs: 2600 - i * 80,
      newFactsIntroduced: i % 2 === 0 ? 2 : 1,
      factsPromoted: 3 + (i % 3),
    };
  });

  return {
    name: 'Léa',
    startDate: '2026-03-15',
    facts,
    totalSessions: 14,
    currentStreak: 5,
    longestStreak: 7,
    lastSessionDate: sessionAvailable ? yesterday : today,
    streakFreezes: 0,
    badges: [
      { id: 'premier-pas', name: 'Premier pas', description: 'Terminer la première séance', earnedDate: '2026-03-15', icon: '🌱' },
      { id: 'premiere-case', name: 'Première case révélée', description: 'Une multiplication presque maîtrisée', earnedDate: '2026-03-20', icon: '🖼️' },
      { id: 'machine', name: 'Machine', description: '10 bonnes réponses de suite', earnedDate: '2026-03-22', icon: '⚡' },
      { id: 'premiere-maitrise', name: 'Première multiplication maîtrisée', description: 'Une multiplication au top niveau', earnedDate: '2026-03-28', icon: '🥇' },
      { id: 'table-2', name: 'Table de 2', description: 'Maîtriser la table de 2', earnedDate: '2026-04-01', icon: '⭐' },
      { id: 'veloce', name: 'Véloce', description: '5 réponses < 2s de suite', earnedDate: '2026-04-05', icon: '🚀' },
      { id: 'exploration', name: 'Exploration', description: 'Avoir vu tous les faits', icon: '🗺️', earnedDate: '2026-04-08' },
    ],
    sessionHistory,
    // Image mystère réservée au guide : évite de spoiler market/ocean qui
    // sont tirés au sort à la création d'un vrai profil.
    mysteryTheme: 'village',
  };
}

// Profil « niveau 2 débloqué » : toutes les tables en boîte 5 → la migration
// attribue le badge Génie de la multiplication au chargement → division débloquée.
// Sert à capturer l'accueil avec le bouton division, la séance et l'image
// mystère dédiée.
function buildUnlockedDivisionProfile() {
  const profile = buildSampleProfile();
  // Multiplications toutes maîtrisées et NON dues (nextDue dans le futur) :
  // on isole la division — seul son CTA s'affiche sur l'accueil.
  const future = '2026-05-03';
  for (const f of profile.facts) {
    f.introduced = true;
    f.box = 5;
    f.lastSeen = SEED_YESTERDAY;
    f.nextDue = future;
    if (!f.history.length) {
      f.history = [{ date: SEED_YESTERDAY, correct: true, responseTimeMs: 2000, answeredWith: f.product }];
    }
  }
  // Faits de division : même distribution déterministe que les tables, pour
  // une image partiellement révélée + des faits dûs (questions) + quelques
  // faits non introduits (l'intro « pense à la multiplication »).
  const divisionFacts = [];
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      const seed = seededBox(b, a); // décalé vs tables pour varier l'image
      const introduced = seed.introduced;
      // Aucun fait INTRODUIT en boîte 1 : sinon le pacing d'introduction
      // (§11.6 / shouldIntroduceNew) bloque les nouvelles intros et la capture
      // « 16-division-intro » n'a pas lieu. Les faits non introduits restent
      // en boîte 1 (introduced=false) et éligibles pour l'intro.
      const box = introduced ? Math.max(seed.box, 2) : seed.box;
      divisionFacts.push({
        dividend: a * b,
        divisor: a,
        quotient: b,
        box,
        introduced,
        lastSeen: introduced ? SEED_YESTERDAY : '',
        nextDue: introduced ? SEED_TODAY : '',
        history: introduced
          ? [{ date: SEED_YESTERDAY, correct: box >= 3, responseTimeMs: 2500, answeredWith: box >= 3 ? b : null }]
          : [],
      });
    }
  }
  profile.divisionFacts = divisionFacts;
  profile.divisionMysteryTheme = 'village'; // même raison que mysteryTheme : pas de spoiler
  profile.hasSeenDivisionIntro = true;
  profile.lastSessionDate = SEED_YESTERDAY;
  return profile;
}

// Profil « niveau 3 débloqué » : tables ET divisions en boîte 5 (non dues),
// badges de déblocage posés explicitement (la migration n'attribue qu'une
// passe de checkBadges : les badges « Divisions par N » demanderaient une
// seconde passe puisqu'ils sont gatés sur les badges de table persistés).
// Sert à capturer l'intro de zone, la saisie en deux temps, la 3e image
// mystère et la page Maths de l'espace parent à trois niveaux.
function buildUnlockedRemainderProfile() {
  const profile = buildUnlockedDivisionProfile();
  const future = '2026-05-03';
  for (const f of profile.divisionFacts) {
    f.introduced = true;
    f.box = 5;
    f.lastSeen = SEED_YESTERDAY;
    f.nextDue = future;
    f.history = [{ date: SEED_YESTERDAY, correct: true, responseTimeMs: 2200, answeredWith: f.quotient }];
  }
  // Ne pousser QUE les badges « Divisions par N » : les badges de table sont
  // complétés par la migration (toutes les mult en boîte 5), et le profil
  // d'exemple contient déjà `table-2` — en re-pousser un ferait 9 badges
  // `table-*` alors que le déblocage compte strictement 8 (hasAllTableBadges).
  for (let n = 2; n <= 9; n++) {
    profile.badges.push({ id: `div-table-${n}`, earnedDate: SEED_YESTERDAY, icon: `÷${n}` });
  }
  // Zones du niveau 3 : distribution déterministe décalée (image variée), et
  // — comme pour la division — aucune zone INTRODUITE en boîte 1, sinon le
  // pacing bloque les intros et la capture « 21-remainder-intro » n'a pas lieu.
  const remainderFacts = [];
  for (let divisor = 2; divisor <= 9; divisor++) {
    for (let quotient = 2; quotient <= 9; quotient++) {
      const seed = seededBox(quotient + 1, divisor);
      const introduced = seed.introduced;
      const box = introduced ? Math.max(seed.box, 2) : seed.box;
      remainderFacts.push({
        divisor,
        quotient,
        box,
        introduced,
        lastSeen: introduced ? SEED_YESTERDAY : '',
        nextDue: introduced ? SEED_TODAY : '',
        history: introduced
          ? [{ date: SEED_YESTERDAY, correct: box >= 3, responseTimeMs: 3000, answeredWith: box >= 3 ? quotient : null }]
          : [],
      });
    }
  }
  profile.remainderFacts = remainderFacts;
  profile.remainderMysteryTheme = 'village'; // pas de spoiler, comme les deux autres
  return profile;
}

// --- Page helpers -----------------------------------------------------------

async function seedProfile(page, profile) {
  await page.addInitScript(({ p, mockTodayIso, lang }) => {
    // Deterministic Math.random so session composition / fact ordering is
    // stable across CI runs. Seeded mulberry32.
    let rngState = 0x5EED1337;
    Math.random = () => {
      rngState |= 0;
      rngState = (rngState + 0x6D2B79F5) | 0;
      let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // Freeze the wall clock to SEED_TODAY so `nextDue` / `lastSeen` / "due"
    // logic behaves identically regardless of when CI happens to run.
    const frozen = new Date(`${mockTodayIso}T09:00:00.000Z`).getTime();
    const RealDate = Date;
    Date = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) return new RealDate(frozen);
        return new RealDate(...args);
      }
      static now() { return frozen; }
      static UTC(...args) { return RealDate.UTC(...args); }
      static parse(s) { return RealDate.parse(s); }
    };

    // Repart toujours d'un stockage de profils vierge : les addInitScript
    // s'empilent au fil des captures et le DERNIER seed doit gagner — y
    // compris sur l'index multi-profils écrit par seedMultiProfile.
    localStorage.removeItem('multiplix-profiles');
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('multiplix-profile:')) localStorage.removeItem(k);
    }
    if (p === null) {
      localStorage.removeItem('multiplix-profile');
    } else {
      // On seede via la clé legacy : l'app la migre vers le schéma
      // multi-profils au boot, ce qui exerce aussi le chemin de migration.
      localStorage.setItem('multiplix-profile', JSON.stringify(p));
    }
    // Bypass the install landing : on est en headless, l'install PWA n'a
    // aucun sens, on capture les écrans de l'app directement.
    localStorage.setItem('multiplix-skip-install', '1');
    // Langue d'interface de la passe courante (cf. src/i18n/lang.ts) : fixée
    // avant le boot pour que toute l'app rende dans la bonne langue.
    localStorage.setItem('multiplix-lang', lang);
  }, { p: profile, mockTodayIso: SEED_TODAY, lang: LANG });
}

/**
 * Seeds SEVERAL profiles directly in the multi-profile schema (per-profile
 * key + index). Reuses seedProfile(null) for the seeded PRNG, frozen clock
 * and landing skip; init scripts run in order so the writes below win.
 */
async function seedMultiProfile(page, entries) {
  await seedProfile(page, null);
  await page.addInitScript((list) => {
    for (const { id, p } of list) {
      localStorage.setItem('multiplix-profile:' + id, JSON.stringify(p));
    }
    localStorage.setItem(
      'multiplix-profiles',
      JSON.stringify({
        activeId: list[0].id,
        profiles: list.map(({ id, p }) => ({ id, name: p.name })),
      }),
    );
  }, entries);
}

/** Returns the Leitner box of the currently displayed question's fact. */
async function readCurrentFactBox(page, q) {
  return page.evaluate((qq) => {
    // Post-boot, le profil vit sous le schéma multi-profils ; on garde le
    // fallback legacy au cas où l'app n'a pas encore migré.
    let raw = null;
    const idx = localStorage.getItem('multiplix-profiles');
    if (idx) {
      const { activeId } = JSON.parse(idx);
      if (activeId) raw = localStorage.getItem('multiplix-profile:' + activeId);
    }
    if (!raw) raw = localStorage.getItem('multiplix-profile');
    if (!raw) return null;
    const profile = JSON.parse(raw);
    const a = Math.min(qq.a, qq.b);
    const b = Math.max(qq.a, qq.b);
    const fact = profile.facts.find((f) => f.a === a && f.b === b);
    return fact ? fact.box : null;
  }, q);
}

/**
 * Facts that `getStrategy()` returns non-null for (see lib/strategies.ts):
 * all facts except the ×2 table and 3×3 (base facts — grid + repeated
 * addition is already the best intro).
 */
function factHasStrategy(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (lo === 2) return false;
  if (lo === 3 && hi === 3) return false;
  return true;
}

// Disable CSS animations everywhere. This keeps clicks from being rejected as
// "unstable" and keeps screenshots visually consistent across runs.
const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
`;

async function gotoHome(page) {
  // Quitter un écran secondaire par son bouton retour dépile l'entrée
  // d'historique du geste retour Android (cf. App.tsx) via un history.back()
  // asynchrone : un goto lancé pendant cette traversée est avorté
  // (ERR_ABORTED). On la laisse finir — borné, car on peut aussi arriver ici
  // depuis un écran qui garde légitimement son entrée.
  await page
    .waitForFunction(() => !history.state?.tablitoBack, null, { timeout: 2000 })
    .catch(() => {});
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });
}

// Démarre la séance de maths depuis l'accueil. En FR, la matière conjugaison
// est disponible : l'accueil montre deux tuiles (`.home-subject-btn`, maths en
// premier) au lieu du bouton unique `.home-start-btn` que l'EN conserve.
async function startMathsSession(page) {
  await page.waitForSelector('.home-cta-wrap');
  const tile = page.locator('.home-subjects .home-subject-btn').first();
  if (await tile.count()) {
    await tile.click();
  } else {
    await page.click('.home-start-btn');
  }
}

async function shot(page, name, locator) {
  const path = join(SHOTS_DIR, `${name}.png`);
  const target = locator ?? page;
  await target.screenshot({ path, animations: 'disabled' });
  log(`✓ ${name}.png`);
}

async function readQuestion(page) {
  await page.waitForSelector('.session-question-text');
  const txt = await page.locator('.session-question-text').innerText();
  const nums = (txt.match(/\d+/g) ?? []).map(Number);
  return { a: nums[0], b: nums[1] };
}

// The numpad auto-submits at 2 digits; single-digit answers need Enter.
async function answerWith(page, value) {
  const s = String(value);
  for (const ch of s) await page.keyboard.press(ch);
  if (s.length === 1) await page.keyboard.press('Enter');
}

async function clickAllIntroSteps(page) {
  while (await page.locator('.session-intro-btn').count()) {
    await page.click('.session-intro-btn');
    await sleep(250);
  }
}

// --- Capture sequences ------------------------------------------------------

async function captureWelcomeScreens(page) {
  await seedProfile(page, null);
  await gotoHome(page);
  await page.waitForSelector('.welcome-screen');
  await shot(page, '01-welcome-intro');

  await page.click('.welcome-btn');
  await page.waitForSelector('.welcome-input');
  await shot(page, '02-welcome-name');

  await page.fill('.welcome-input', 'Léa');
  await page.click('.welcome-btn');
  // Step 2: greeting "Salut Léa" / "Hi Léa"
  await page.waitForSelector(`.welcome-title:has-text("${tx('greeting')}")`);
  await shot(page, '03-welcome-ready');

  // Placement test
  await page.click('.welcome-btn');
  await page.waitForSelector('.welcome-test-question');
  await shot(page, '04-welcome-test');
}

async function captureHome(page) {
  await seedProfile(page, buildSampleProfile());
  await gotoHome(page);
  await page.waitForSelector('.home-screen');
  await shot(page, '05-home');
}

const NAV_SCREENS = [
  { navKey: 'myPicture', screenSel: '.progress-screen', backSel: '.progress-back-btn', shot: '10-progress' },
  { navKey: 'rules',     screenSel: '.rules-screen',    backSel: '.rules-back-btn',    shot: '12-rules'    },
];

async function captureNavScreen(page, { navKey, screenSel, backSel, shot: shotName }) {
  await page.click(`.home-nav-btn:has-text("${tx(navKey)}")`);
  await page.waitForSelector(screenSel);
  await shot(page, shotName);
  await page.click(backSel);
  await page.waitForSelector('.home-screen');
}

async function captureBadgesScreen(page) {
  await page.click(`.home-nav-btn:has-text("${tx('badges')}")`);
  await page.waitForSelector('.badges-screen');
  await shot(page, '11-badges');

  // Open the detail modal on a locked badge with progression (Régularité /
  // Consistency — streak 5/7) so the guide can showcase the explanation +
  // progress bar.
  await page.click(`.badges-grid .badge:has-text("${tx('consistency')}")`);
  await page.waitForSelector('.badge-detail-modal');
  await shot(page, '11-badges-detail');
  await page.click('.badge-detail-modal .modal-close-btn');
  await page.waitForSelector('.badge-detail-modal', { state: 'detached' });

  await page.click('.badges-back-btn');
  await page.waitForSelector('.home-screen');
}

// Ouvre une page de l'espace parent, la capture, puis revient à son accueil
// (dont le propre bouton retour ramène ensuite à l'accueil de l'enfant).
async function shootSubpage(page, opener, pageSelector, name) {
  await page.click(opener);
  await page.waitForSelector(pageSelector);
  await shot(page, name);
  await page.click('.parent-back-btn');
  await page.waitForSelector(pageSelector, { state: 'detached' });
}

// Amène une section de l'accueil de l'espace parent en haut de l'écran, puis
// la capture. Le body est le conteneur de défilement.
async function shootSection(page, selector, name) {
  await page.locator(selector).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await shot(page, name);
}

// Opens the parent area and shoots what is asked — its overview (`hubShot`),
// the week's summary (`weekShot`), the settings list at the bottom of it
// (`settingsShot`), the Maths page its subject card opens (`mathShot`), the
// "Profiles and backup" page (`profilesShot`) — then goes back home.
async function captureParentDashboard(page, { hubShot, weekShot, settingsShot, mathShot, profilesShot }) {
  // Open the parent gate (click) then solve the displayed multiplication.
  await page.click('.home-parent-btn');
  await page.waitForSelector('.parent-gate-modal');
  const [a, b] = await page.evaluate(() => {
    const nums = [...document.querySelectorAll('.parent-gate-question > span')]
      .map((n) => parseInt(n.textContent, 10))
      .filter((n) => Number.isFinite(n));
    return [nums[0], nums[1]];
  });
  await page.fill('.parent-gate-input', String(a * b));
  await page.click('.parent-gate-submit');
  await page.waitForSelector('.parent-dashboard');
  if (hubShot) await shot(page, hubShot);
  if (weekShot) await shootSection(page, '.parent-week', weekShot);
  if (settingsShot) await shootSection(page, '.parent-settings-start', settingsShot);
  if (mathShot) {
    await shootSubpage(page, '.parent-subject-card--math', '.parent-dashboard--subject', mathShot);
  }
  if (profilesShot) {
    const opener = `.parent-setting-btn:has-text("${tx('profilesPage')}")`;
    await shootSubpage(page, opener, '.parent-dashboard--settings', profilesShot);
  }
  await page.click('.parent-back-btn');
  await page.waitForSelector('.home-screen');
}

async function captureSessionScreens(page) {
  // Pre-introduce ×2 and 3×3 (no strategy → would skip the strategy step) and
  // pin the 8 due facts at box 2 (strategy hint only shows for box ≤ 2).
  // Source of truth for the no-strategy rule: src/lib/strategies.ts.
  const profile = buildSampleProfile();
  const longAgo = '2026-04-05';
  const future = '2026-04-20';
  const hasNoStrategy = (f) =>
    f.a === 2 || f.b === 2 || (f.a === 3 && f.b === 3);
  for (const f of profile.facts) {
    if (hasNoStrategy(f) && !f.introduced) {
      f.introduced = true;
      f.box = 2;
      f.lastSeen = longAgo;
      f.nextDue = future;
      f.history = [
        { date: longAgo, correct: true, responseTimeMs: 2500, answeredWith: f.product },
      ];
    }
  }
  // On veut que les questions intro apparaissent en début de séance (pour
  // capturer 06 / 06b). Pour ça, on évite deux pièges côté composeSession :
  //
  //  1. Le filtre "similar-recent" (< 2j via history[0].date) écarte les
  //     nouveaux faits qui ressemblent à un fait récemment introduit. On
  //     vieillit history[0].date à longAgo pour neutraliser ce filtre.
  //
  //  2. La migration `inferIntroductionsFromKnowns` (placement.ts) auto-
  //     introduit tout fait dominé par un fait connu correctement. Sur un
  //     profil avec beaucoup de faits hauts en box≥3, ça ré-introduit
  //     SILENCIEUSEMENT nos cibles non-introduites au load. On force
  //     correct=false sur l'history pour que la migration ait 0 evidence.
  let dueCount = 0;
  for (const f of profile.facts) {
    if (!f.introduced) continue;
    f.lastSeen = longAgo;
    if (f.history.length > 0) {
      f.history = f.history.map((h) => ({ ...h, date: longAgo, correct: false }));
    }
    if (dueCount < 8) {
      f.box = 2;
      f.nextDue = SEED_TODAY;
      dueCount++;
    } else {
      if (f.box < 2) f.box = 2;
      f.nextDue = future;
    }
  }
  let notIntroducedCount = profile.facts.filter((f) => !f.introduced).length;
  if (notIntroducedCount < 3) {
    for (const f of profile.facts) {
      if (notIntroducedCount >= 4) break;
      if (f.a + f.b >= 14 && !hasNoStrategy(f)) {
        f.introduced = false;
        f.box = 1;
        f.history = [];
        f.lastSeen = '';
        f.nextDue = '';
        notIntroducedCount++;
      }
    }
  }
  await seedProfile(page, profile);
  await gotoHome(page);
  await startMathsSession(page);
  await page.waitForSelector('.session-screen');

  if (await page.locator('.session-intro').count()) {
    // The DotGrid has a JS-driven row-by-row reveal — wait for the last row
    // to finish its 0.4s fade-in animation. The result "= N" sits outside the
    // grid in SessionIntro, but still depends on all rows being visible.
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll('.session-intro .dot-grid-row');
        if (rows.length === 0) return false;
        return Array.from(rows).every((r) => !r.classList.contains('hidden'));
      },
      { timeout: 5000 },
    ).catch(() => {
      log('WARN: DotGrid rows did not fully appear in time');
    });
    await sleep(400);
    await shot(page, '06-session-intro');

    // Walk to the strategy step (grid → commute → strategy ; squares skip commute).
    await page.click('.session-intro-btn');
    const reachedStrategy = await page
      .waitForSelector('.strategy-hint', { timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (!reachedStrategy) {
      await page.click('.session-intro-btn');
      await page.waitForSelector('.strategy-hint', { timeout: 2000 }).catch(() => {});
    }
    if (await page.locator('.strategy-hint').count()) {
      await shot(page, '06b-session-intro-strategy');
    } else {
      log('WARN: strategy step not reached — 06b-session-intro-strategy missing');
    }
    await clickAllIntroSteps(page);
  } else {
    log('WARN: no intro step found — 06-session-intro will be missing');
  }

  const q1 = await readQuestion(page);
  await shot(page, '07-session-question');

  await answerWith(page, q1.a * q1.b);
  await page.waitForSelector('.feedback-overlay.correct', { timeout: 3000 });
  await shot(page, '08-session-feedback-correct');
  await page.click('.feedback-overlay');
  await page.waitForSelector('.feedback-overlay', { state: 'detached', timeout: 3000 });

  // Walk past any intros that might follow. Then scan forward until we land
  // on a question whose fact is both in box ≤ 2 AND has a derivation strategy
  // — that guarantees the incorrect-feedback overlay shows a non-empty
  // strategy hint in the screenshot.
  await clickAllIntroSteps(page);
  const MAX_SCAN = 20;
  let q2 = null;
  for (let i = 0; i < MAX_SCAN; i++) {
    const q = await readQuestion(page);
    const box = await readCurrentFactBox(page, q);
    if (box !== null && box <= 2 && factHasStrategy(q.a, q.b)) {
      q2 = q;
      break;
    }
    // Not a good candidate — answer correctly and advance.
    await answerWith(page, q.a * q.b);
    await page.waitForSelector('.feedback-overlay.correct', { timeout: 3000 });
    await page.click('.feedback-overlay');
    await page.waitForSelector('.feedback-overlay', { state: 'detached', timeout: 3000 });
    await clickAllIntroSteps(page);
  }
  if (!q2) {
    log('WARN: no box≤2 fact with strategy found — 09-session-feedback-incorrect may miss the hint');
    q2 = await readQuestion(page);
  }

  const wrong = q2.a * q2.b === 1 ? 2 : 1;
  await answerWith(page, wrong);
  await page.waitForSelector('.feedback-overlay.incorrect', { timeout: 3000 });
  await shot(page, '09-session-feedback-incorrect');
  // Incorrect overlay only dismisses via the explicit OK button (no auto-dismiss).
  await page.click('.feedback-ok-btn');
  await page.waitForSelector('.feedback-overlay', { state: 'detached', timeout: 3000 });
}

// Conjugaison (fr-only) : un enfant déjà lancé dans la matière — placement
// fait, les 63 faits introduits, quelques-uns dus aujourd'hui — pour tomber
// directement sur une question au clavier de lettres, sans intro ni placement.
async function captureConjScreens(page) {
  const { createInitialConjFacts, conjFactDefs, resolveConjQuestion } =
    await importTs('src/lib/conjugationFacts.ts');
  const profile = buildSampleProfile();
  profile.hasDoneConjPlacement = true;
  profile.hasSeenConjIntro = true;
  profile.conjFacts = createInitialConjFacts().map((f, i) => ({
    ...f,
    introduced: true,
    box: i % 3 === 0 ? 2 : 3,
    lastSeen: SEED_YESTERDAY,
    nextDue: i % 9 === 0 ? SEED_TODAY : '2026-04-20',
    history: [{ date: SEED_YESTERDAY, correct: true, responseTimeMs: 4000 }],
  }));
  await seedProfile(page, profile);
  await gotoHome(page);
  await page.waitForSelector('.home-subjects');
  await page.locator('.home-subjects .home-subject-btn').nth(1).click();
  await page.waitForSelector('.conj-question .letterpad-display');

  // La réponse attendue n'est pas dans le DOM : on retrouve la question
  // affichée dans l'inventaire (même geste que answerCurrentConj dans
  // src/__tests__/conjIntegration.test.tsx), infinitif compris.
  const squash = (t) => t.replace(/\s+/g, '');
  const shown = await page.evaluate(() => ({
    sentence: document.querySelector('.conj-question .conj-sentence').innerText,
    verb: document.querySelector('.conj-question .conj-intro-infinitive').textContent.replace(/[()]/g, '').trim(),
  }));
  const findExpected = () => {
    for (const def of conjFactDefs()) {
      for (let i = 0; i < def.carriers.length; i++) {
        const view = resolveConjQuestion(def, i);
        const sentence = squash(shown.sentence);
        if (view.verb === shown.verb && sentence.startsWith(squash(view.lead)) && sentence.endsWith(squash(view.tail))) {
          return view.expected;
        }
      }
    }
    throw new Error(`conj: question introuvable dans l'inventaire ${JSON.stringify(shown)}`);
  };
  const expected = findExpected();

  // Frappe au clavier de l'écran (pas au clavier physique) : la capture montre
  // les touches en action.
  const tap = async (letters) => {
    for (const ch of letters) await page.click(`.letterpad-btn:text-is("${ch}")`);
  };
  // Réponse à moitié tapée : montre le clavier de lettres en action.
  const half = Math.ceil(expected.length / 2);
  await tap(expected.slice(0, half));
  await shot(page, '24-conj-question');

  await tap(expected.slice(half));
  await page.click('.letterpad-btn-ok');
  await page.waitForSelector('.conj-feedback.correct', { timeout: 3000 });
  await shot(page, '25-conj-feedback-correct');
}

async function captureVoiceInput(page) {
  // Stubbe l'API Web Speech (absente en headless Chromium) pour que
  // `isSpeechRecognitionSupported()` renvoie true. start() déclenche onstart
  // au tick suivant → l'UI passe en état « listening » (ring + « Je t'écoute »)
  // pour la capture. Le stub ne reconnaît rien, on prend juste le screenshot.
  await page.addInitScript(() => {
    // Sans constructor explicite, Playwright headless instancie bien la
    // classe mais la méthode start() ci-dessous ne s'exécute pas — l'écran
    // reste bloqué sur l'état "tap pour parler" au lieu de "j'écoute". Le
    // ctor explicite débloque le binding ; cause exacte non identifiée.
    class FakeSpeechRecognition {
      constructor() {}
      start() { setTimeout(() => this.onstart && this.onstart(), 0); }
      abort() { setTimeout(() => this.onend && this.onend(), 0); }
      stop() { setTimeout(() => this.onend && this.onend(), 0); }
    }
    window.webkitSpeechRecognition = FakeSpeechRecognition;
    window.SpeechRecognition = FakeSpeechRecognition;
    localStorage.setItem('multiplix-input-mode', 'voice');
  });

  // Profil minimal : tout introduit, un fait dû pour atterrir directement
  // sur une question (pas d'intro à cliquer).
  const profile = buildSampleProfile();
  const longAgo = '2026-04-05';
  const future = '2026-04-20';
  let dueSet = false;
  for (const f of profile.facts) {
    f.introduced = true;
    if (f.box < 3) f.box = 3;
    f.lastSeen = longAgo;
    f.history = f.history.length
      ? f.history.map((h) => ({ ...h, date: longAgo, correct: true }))
      : [{ date: longAgo, correct: true, responseTimeMs: 2500, answeredWith: f.product }];
    if (!dueSet && f.a === 5 && f.b === 7) {
      f.box = 3;
      f.nextDue = SEED_TODAY;
      dueSet = true;
    } else {
      f.nextDue = future;
    }
  }
  await seedProfile(page, profile);
  await gotoHome(page);
  await startMathsSession(page);
  await page.waitForSelector('.session-screen');
  await clickAllIntroSteps(page);
  await page.waitForSelector('.voice-mic.listening', { timeout: 3000 });
  await sleep(200);
  await shot(page, '07b-session-voice');
}

async function captureRecap(page) {
  // Drive a complete (short-ish) session. We seed a profile where only a
  // handful of facts are due & introduced to keep the session short.
  const profile = buildSampleProfile();
  // Force *all* facts introduced and mostly at box 4 so there are no
  // introduction steps (keeps the drive loop simple) and few facts due.
  for (const f of profile.facts) {
    f.introduced = true;
    f.box = Math.max(2, f.box);
    f.nextDue = SEED_TODAY;
    f.lastSeen = SEED_YESTERDAY;
    if (!f.history.length) {
      f.history = [{ date: SEED_YESTERDAY, correct: true, responseTimeMs: 2500, answeredWith: f.product }];
    }
  }
  await seedProfile(page, profile);
  await gotoHome(page);
  await startMathsSession(page);

  for (let i = 0; i < 60; i++) {
    await sleep(200);

    if (await page.locator('.recap-screen').count()) break;

    if (await page.locator('.session-intro').count()) {
      await clickAllIntroSteps(page);
      continue;
    }

    if (await page.locator('.feedback-overlay').count()) {
      await page.click('.feedback-overlay');
      await sleep(200);
      continue;
    }

    if (await page.locator('.session-question-text').count()) {
      const { a, b } = await readQuestion(page);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        await answerWith(page, a * b);
        await sleep(100);
      }
    }
  }

  await page.waitForSelector('.recap-screen', { timeout: 5000 });
  // Give the confetti animation a moment to settle.
  await sleep(800);
  await shot(page, '14-recap');
}

async function captureDivisionScreens(page) {
  await seedProfile(page, buildUnlockedDivisionProfile());
  await gotoHome(page);
  await page.waitForSelector('.home-screen');
  // Niveau 2 débloqué : la tuile maths reste unique (pas d'entrée dédiée aux
  // divisions), et la tuile « Mon image » est devenue « Mes images ».
  await shot(page, '15-division-home');

  // Espace parent — version division débloquée : la carte Maths de l'accueil
  // passe aux divisions, les multiplications maîtrisées y restent cochées.
  await captureParentDashboard(page, { hubShot: '13b-parent-dashboard-division' });

  // Image mystère dédiée à la division : tuile « Mes images » puis onglet
  // « Divisions » de l'écran progression.
  await page.click(`.home-nav-btn:has-text("${tx('myPictures')}")`);
  await page.waitForSelector('.progress-screen');
  await page.click(`.progress-tab:has-text("${tx('divisions')}")`);
  await shot(page, '18-division-progress');
  await page.click('.progress-back-btn');
  await page.waitForSelector('.home-screen');

  // Séance de division : le seed n'a aucune table due → la séance du jour est
  // la division. On démarre la séance de maths (bouton unique en EN, tuile
  // maths en FR).
  await startMathsSession(page);
  await page.waitForSelector('.session-screen');
  if (await page.locator('.session-intro').count()) {
    // Attend la révélation "lots" : grille remplie → paquets séparés → compte
    // d'un lot dévoilé (= le quotient). On capture cet état final enrichi.
    await page
      .waitForSelector('.dot-grid-lot-count.visible', { timeout: 9000 })
      .catch(() => log('WARN: division lot-count reveal did not appear'));
    await sleep(300);
    await shot(page, '16-division-intro');
    await clickAllIntroSteps(page);
  } else {
    log('WARN: no division intro step — 16-division-intro will be missing');
  }
  await page.waitForSelector('.session-question-text');
  await shot(page, '17-division-question');
}

async function captureRemainderScreens(page) {
  await seedProfile(page, buildUnlockedRemainderProfile());
  await gotoHome(page);
  await page.waitForSelector('.home-screen');

  // Espace parent — version niveau 3 : la page Maths s'ouvre sur « Avec
  // reste », troisième position de son sélecteur de niveau.
  await captureParentDashboard(page, { mathShot: '13c-parent-dashboard-remainder' });

  // Image mystère du niveau 3 : « Mes images » → onglet « Avec reste ».
  await page.click(`.home-nav-btn:has-text("${tx('myPictures')}")`);
  await page.waitForSelector('.progress-screen');
  await page.click(`.progress-tab:has-text("${tx('remainders')}")`);
  await shot(page, '23-remainder-progress');
  await page.click('.progress-back-btn');
  await page.waitForSelector('.home-screen');

  // Séance : intro de zone (rangées pleines + points du reste en couleur),
  // puis la saisie en deux temps sur la question qui suit.
  await startMathsSession(page);
  await page.waitForSelector('.session-screen');
  if (await page.locator('.session-intro').count()) {
    // La rangée du reste est dans le DOM dès le montage mais reste `.hidden`
    // (opacité) tant que les rangées pleines ne sont pas toutes révélées par
    // les timers JS — on attend l'état révélé, pas la présence du nœud.
    await page
      .waitForSelector('.dot-grid-row--rest:not(.hidden)', { timeout: 9000 })
      .catch(() => log('WARN: remainder rest dots did not appear'));
    await sleep(300);
    await shot(page, '21-remainder-intro');
    await clickAllIntroSteps(page);
  } else {
    log('WARN: no remainder intro step — 21-remainder-intro will be missing');
  }
  // Étape 1 : on répond le bon quotient → l'écran passe à « Il reste combien ? »
  // (le quotient s'installe dans la formule) — c'est cet état qu'on capture.
  await page.waitForSelector('.session-question-text');
  const { a: dividend, b: divisor } = await readQuestion(page);
  await answerWith(page, Math.floor(dividend / divisor));
  await page.waitForSelector('.formula-remainder');
  await shot(page, '22-remainder-question');
}

async function captureMultiProfileScreens(page) {
  // Deux enfants sur l'appareil : Léa (le profil du reste du guide) + Max
  // (prénom choisi pour tomber sur une couleur d'avatar différente de Léa —
  // la couleur est un hash stable du prénom).
  const lea = buildSampleProfile();
  const max = buildSampleProfile();
  max.name = 'Max';
  await seedMultiProfile(page, [
    { id: 'guide-lea', p: lea },
    { id: 'guide-max', p: max },
  ]);
  await gotoHome(page);

  // Dès 2 profils, le boot passe par « Qui joue ? ».
  await page.waitForSelector('.profile-select-screen');
  await shot(page, '19-profile-select');

  // Accueil avec le bouton « changer de joueur » à côté de l'engrenage.
  await page.click('.profile-select-btn:has-text("Léa")');
  await page.waitForSelector('.home-screen');
  await page.waitForSelector('.home-switch-btn');
  await shot(page, '20-home-multi');

  // Le sélecteur d'enfant en haut de l'espace parent, puis les enfants de
  // l'appareil dans la page « Profils et sauvegarde ».
  await captureParentDashboard(page, { hubShot: '20c-parent-children', profilesShot: '20b-parent-profiles' });
}

// --- HTML guide generator ---------------------------------------------------

const SECTIONS_FR = [
  {
    id: 'principes',
    title: 'Les principes',
    body: `
      <p>Tablito n'est pas un simple quiz. Chaque choix de conception s'appuie
      sur la recherche en psychologie cognitive et en didactique des
      mathématiques. Cinq piliers portent l'application :</p>
      <ul class="principles">
        <li>
          <strong>Répétition espacée — les boîtes de Leitner.</strong> Chaque
          fait vit dans l'une des cinq boîtes numérotées de 1 (à peine appris)
          à 5 (bien ancré). Un fait nouveau démarre en boîte 1 : il est revu
          le jour même. Une bonne réponse le fait monter d'une boîte et
          repousse la prochaine révision : 1 jour en boîte 2, 3 jours en
          boîte 3, 7 jours en boîte 4, 21 jours en boîte 5. Une erreur le
          renvoie en boîte 1, le temps de le réancrer. L'enfant revoit ainsi
          chaque fait juste avant de l'oublier, avec des intervalles de plus
          en plus longs — bien plus durable que le bachotage en une soirée.
          <span class="cite">Kang (2016) ; Cepeda et al. (2008) ; Rea &amp; Modigliani (1985)</span>
        </li>
        <li>
          <strong>Faible interférence.</strong> Les faits qui se ressemblent
          (même opérande, résultats proches) ne sont jamais introduits la même
          semaine. Une séance contient uniquement des faits suffisamment
          dissemblables pour que l'enfant ne les confonde pas en mémoire.
          <span class="cite">Dotan &amp; Zviran-Ginat (2022)</span>
        </li>
        <li>
          <strong>Entrelacement.</strong> Les tables sont mélangées au sein
          d'une même séance plutôt que travaillées l'une après l'autre. L'enfant
          doit aller chercher la bonne opération à chaque question, ce qui
          solidifie le rappel à long terme.
          <span class="cite">Rohrer &amp; Taylor (2007) ; Rohrer, Dedrick &amp; Burgess (2014)</span>
        </li>
        <li>
          <strong>Comprendre avant de mémoriser.</strong> Chaque nouveau fait
          est d'abord présenté comme une grille de points (addition répétée),
          puis par la commutativité (3 × 5 = 5 × 3), enfin par une astuce de
          dérivation adaptée (× 9 = × 10 − n, × 4 = double-double, × 6 = × 5 + n,
          etc.). Quelques faits-repères (doubles, × 5, × 9, carrés) servent
          d'appui aux faits dérivés. L'échafaudage disparaît quand le rappel
          devient automatique.
          <span class="cite">Van de Walle via Wichita Public Schools (2014) ; Brendefur et al. (2015)</span>
        </li>
        <li>
          <strong>Feedback orienté progrès, pas performance.</strong> Pas de
          score chiffré côté enfant, pas d'étoiles calculées sur le taux de
          réussite : uniquement des encouragements constants et la mise en
          avant des faits appris. L'objectif est la motivation intrinsèque et
          la maîtrise, pas la note. Les chiffres bruts restent disponibles
          dans l'espace parent.
          <span class="cite">Butler (1988) ; Hattie &amp; Timperley (2007)</span>
        </li>
      </ul>
      <p class="principles-footer">Détails et justifications dans les
      <a href="../specs/">spécifications fonctionnelles</a>.</p>
    `,
    shots: [],
  },
  {
    id: 'welcome',
    title: 'Bienvenue',
    body: `
      <p>À la toute première ouverture, un accueil en quatre étapes :</p>
      <ul class="guide-list">
        <li><strong>La mascotte</strong> se présente.</li>
        <li><strong>Le prénom</strong> de l'enfant.</li>
        <li><strong>L'annonce</strong> du test de positionnement.</li>
        <li><strong>Le test</strong> : 15 questions bien réparties.</li>
      </ul>
      <p>Les faits déjà connus démarrent directement dans les boîtes hautes de Leitner.</p>
    `,
    shots: [
      { file: '01-welcome-intro', caption: 'La mascotte se présente à l\'enfant.' },
      { file: '02-welcome-name', caption: 'Saisie du prénom.' },
      { file: '03-welcome-ready', caption: 'Annonce du test de positionnement.' },
      { file: '04-welcome-test', caption: 'Test de positionnement (15 questions).' },
    ],
  },
  {
    id: 'home',
    title: 'Écran d\'accueil',
    body: `
      <p>Le point de départ de chaque jour.</p>
      <ul class="guide-list">
        <li><strong>La mascotte</strong> accueille l'enfant, le félicite, l'encourage après une erreur. Jamais elle ne juge.</li>
        <li><strong>La flamme</strong> compte les jours de suite.</li>
        <li><strong>Le gros bouton</strong> lance la séance du jour.</li>
        <li><strong>La barre du bas</strong> ouvre l'image mystère, les badges et les règles (×1, ×10, puis celles de la conjugaison).</li>
        <li><strong>L'engrenage</strong> ouvre l'espace parent, derrière une petite multiplication.</li>
      </ul>
      <p>Quand toutes les tables sont maîtrisées, la séance du jour passe d'elle-même à la division : pas de nouveau bouton.</p>
    `,
    shots: [
      { file: '05-home', caption: 'Accueil avec la mascotte et la série de 5 jours.' },
    ],
  },
  {
    id: 'session',
    title: 'La séance',
    body: `
      <p>12 à 15 questions, quelques minutes.</p>
      <ul class="guide-list">
        <li><strong>Un fait nouveau</strong> est d'abord présenté en trois temps : une grille de points (l'addition répétée), l'échange des facteurs (3×5 = 5×3), puis une astuce (« × 9, c'est × 10 moins une fois »).</li>
        <li><strong>Réponse</strong> au clavier ou à la voix. Un bouton sous le pavé change de mode, et le choix est retenu.</li>
        <li><strong>Bonne réponse rapide</strong> : une étoile dorée.</li>
        <li><strong>Erreur</strong> : la bonne réponse, la grille de points, l'astuce si le fait est récent. La question revient un peu plus loin.</li>
      </ul>
    `,
    shots: [
      { file: '06-session-intro', caption: 'Introduction d\'un nouveau fait — étape 1 : grille de points et addition répétée.' },
      { file: '06b-session-intro-strategy', caption: 'Introduction — étape 3 : astuce de dérivation pour mémoriser le fait.' },
      { file: '07-session-question', caption: 'Question standard et pavé numérique.' },
      { file: '07b-session-voice', caption: 'Mode micro — l\'enfant énonce sa réponse à voix haute. Bascule possible à tout moment.' },
      { file: '08-session-feedback-correct', caption: 'Bonne réponse rapide — étoile dorée.' },
      { file: '09-session-feedback-incorrect', caption: 'Réponse incorrecte — grille de points et rappel de l\'astuce.' },
    ],
  },
  {
    id: 'recap',
    title: 'Bilan de séance',
    body: `
      <p>À la fin de chaque séance :</p>
      <ul class="guide-list">
        <li><strong>Les nouveaux faits</strong> du jour, s'il y en a.</li>
        <li><strong>La progression</strong> : une barre « X faits connus sur 36 ».</li>
        <li><strong>L'image mystère</strong> à aller voir, avec une mention quand elle a changé.</li>
        <li><strong>Des confettis</strong> pour une table maîtrisée, une image complète ou un nouveau badge.</li>
      </ul>
    `,
    shots: [
      { file: '14-recap', caption: 'Bilan d\'une séance avec barre de progression.' },
    ],
  },
  {
    id: 'progress',
    title: 'Mon image mystère',
    body: `
      <p>Une grille 8×8 (tables 2 à 9) : chaque case est un morceau d'une image cachée.</p>
      <ul class="guide-list">
        <li><strong>Plus un fait est maîtrisé</strong>, plus sa case se précise : silhouette floue, aplat, couleurs, ombres, détails. Une étape par boîte de Leitner.</li>
        <li><strong>Un fait oublié</strong> se re-floute un peu, sans notion d'échec.</li>
        <li><strong>Les 36 faits maîtrisés</strong> : l'image est entièrement révélée.</li>
      </ul>
      <p>En haut, les totaux découverts / maîtrisés / total.</p>
    `,
    shots: [
      { file: '10-progress', caption: 'Image mystère qui se révèle au fur et à mesure des progrès.' },
    ],
  },
  {
    id: 'division',
    title: 'Niveau 2 — la division',
    body: `
      <p>Une fois toutes les tables maîtrisées (badge « Génie de la multiplication »), les mêmes faits reviennent à l'envers : « 56 ÷ 7 = ? ».</p>
      <ul class="guide-list">
        <li><strong>L'astuce</strong> est enseignée : pour 56 ÷ 7, on cherche « 7 fois combien font 56 ? ».</li>
        <li><strong>Petit à petit</strong> : les divisions arrivent dans le même ordre que les tables, de la plus simple à la plus dure.</li>
        <li><strong>Une seule séance</strong> : elle passe à la division, et y glisse quelques tables à entretenir.</li>
        <li><strong>Une nouvelle image mystère</strong>. « Mon image » devient « Mes images » ; celle des tables reste acquise.</li>
      </ul>
      <p>Le reste (boîtes de Leitner, encouragements) marche comme pour les tables.</p>
    `,
    shots: [
      { file: '15-division-home', caption: 'Une fois les tables maîtrisées, « Mon image » devient « Mes images » (multiplications + divisions).' },
      { file: '13b-parent-dashboard-division', caption: 'Dans l\'espace parent, la carte Maths passe aux divisions ; les multiplications, maîtrisées, y restent cochées.' },
      { file: '16-division-intro', caption: 'Introduction d\'une division : « pense à la multiplication ».' },
      { file: '17-division-question', caption: 'Question de division au pavé numérique.' },
      { file: '18-division-progress', caption: 'Une image mystère dédiée à la division, distincte de celle des tables.' },
    ],
  },
  {
    id: 'remainder',
    title: 'Niveau 3 — la division avec reste',
    body: `
      <p>Une fois toutes les divisions maîtrisées, la division qui ne tombe pas juste : « 45 ÷ 7 = 6, reste 3 ». C'est l'attendu de fin de CE2.</p>
      <ul class="guide-list">
        <li><strong>L'astuce</strong> : chercher le multiple juste en dessous, sans dépasser. Ce qui manque, c'est le reste.</li>
        <li><strong>Deux temps</strong> : « Combien de fois ? », puis « Il reste combien ? ».</li>
        <li><strong>Jamais le même calcul</strong> : le nombre à diviser change à chaque révision. Parfois le reste est zéro : à l'enfant de le voir.</li>
        <li><strong>Une troisième image mystère</strong>. Tables et divisions continuent d'être entretenues dans la même séance.</li>
      </ul>
    `,
    shots: [
      { file: '21-remainder-intro', caption: 'Introduction d\'une division avec reste : les rangées pleines, et les points qui « ne rentrent pas » — le reste.' },
      { file: '22-remainder-question', caption: 'La réponse en deux temps : le quotient validé s\'installe dans la formule, puis « Il reste combien ? ».' },
      { file: '23-remainder-progress', caption: 'Une troisième image mystère, dédiée à la division avec reste.' },
      { file: '13c-parent-dashboard-remainder', caption: 'La page Maths de l\'espace parent s\'ouvre sur le niveau en cours : « Avec reste » rejoint le sélecteur de niveau (maîtrise et grille Leitner).' },
    ],
  },
  {
    id: 'conjugaison',
    title: 'La conjugaison',
    body: `
      <p>Une seconde matière, à côté des maths : les conjugaisons du CE2.</p>
      <ul class="guide-list">
        <li><strong>Au programme</strong> : présent, imparfait et futur du 1<sup>er</sup> groupe, et des verbes être, avoir, aller, faire, dire, venir, voir.</li>
        <li><strong>Même méthode</strong> que les tables : un court test au départ, des séances de quelques minutes, une image mystère.</li>
        <li><strong>L'enfant complète une phrase</strong>, lue à voix haute, sur un clavier de lettres ou en épelant à l'oral.</li>
        <li><strong>La correction</strong> colore à part le radical et la terminaison, pour que la règle se voie.</li>
      </ul>
      <p>Chaque matière a sa séance du jour ; la série de jours est commune.</p>
    `,
    shots: [
      { file: '24-conj-question', caption: 'Une phrase à compléter, au clavier de lettres. L\'infinitif est rappelé sous la question.' },
      { file: '25-conj-feedback-correct', caption: 'Bonne réponse : la forme s\'affiche, radical et terminaison en deux couleurs.' },
    ],
  },
  {
    id: 'badges',
    title: 'Les badges',
    body: `
      <p>Des badges pour marquer le chemin parcouru.</p>
      <ul class="guide-list">
        <li><strong>Jalons</strong> : première séance, 7 jours, 30 jours.</li>
        <li><strong>Performance</strong> : 10 bonnes réponses de suite, 5 réponses en moins de 2 s.</li>
        <li><strong>Maîtrise</strong> : un badge par table, puis « Génie de la multiplication ». La division, la conjugaison ajoutent les leurs.</li>
      </ul>
      <p>Chaque badge s'ouvre sur sa condition et, s'il est encore verrouillé, sur une barre de progression.</p>
    `,
    shots: [
      { file: '11-badges', caption: 'Collection de badges — obtenus et à débloquer.' },
      { file: '11-badges-detail', caption: 'En cliquant sur un badge verrouillé, on découvre la condition et la progression.' },
    ],
  },
  {
    id: 'rules',
    title: 'Les règles ×1 et ×10',
    body: `
      <p>Deux règles données d'emblée, pour ne pas avoir à les apprendre par cœur :</p>
      <ul class="guide-list">
        <li><strong>× 1</strong> : le nombre ne change pas.</li>
        <li><strong>× 10</strong> : les chiffres glissent d'un rang vers la gauche, un 0 prend la place des unités.</li>
        <li><strong>× 11</strong>, en bonus une fois les tables de 2 à 9 maîtrisées : on répète le chiffre (3 × 11 = 33). Une pastille « Nouveau » le signale.</li>
      </ul>
      <p>Ces tables ne font donc pas partie des 36 faits à apprendre.</p>
      <p>Une fois la conjugaison commencée, ses règles s'y ajoutent, dans un onglet à part, au fur et à mesure que l'enfant aborde ce qu'elles expliquent : les marques de personne (nous → -ons, vous → -ez…), la fabrication de l'imparfait et du futur, le piège du g et du c. Elles sont montrées en images (tableau des marques, recette en étapes, temps conjugué en entier) et un bouton les lit à voix haute. Ce sont les astuces mêmes que la séance montre.</p>
    `,
    shots: [
      { file: '12-rules', caption: 'Règles pour ×1 et ×10.' },
    ],
  },
  {
    id: 'parent',
    title: 'Espace parent',
    body: `
      <p>On y entre par l'engrenage de l'accueil, après une petite
      multiplication qui vérifie qu'un adulte est derrière l'écran. De haut en
      bas :</p>
      <ul class="guide-list">
        <li><strong>La journée.</strong> La séance est-elle faite ? Les 14
        derniers jours, les séances, les séries.</li>
        <li><strong>La semaine.</strong> Jours pratiqués, réussite, rapidité,
        faits qui ont progressé, comparés à la semaine d'avant.</li>
        <li><strong>Une carte par matière.</strong> Le niveau en cours et sa
        barre de maîtrise. Un clic ouvre la page de la matière : boîtes, grille
        Leitner, évolution, historique des séances.</li>
        <li><strong>À retravailler.</strong> Les trois faits qui résistent le
        plus, avec une idée pour aider à la maison.</li>
        <li><strong>Les réglages.</strong> Suivi à distance, profils et
        sauvegarde, rappel quotidien, langue, aide.</li>
      </ul>
      <p>Une question, un souci, une idée ? Le bouton « Envoyer un avis », en
      haut à droite.</p>
    `,
    shots: [
      { file: '13-parent-dashboard', caption: 'L\'accueil de l\'espace parent commence par la journée.' },
      { file: '13e-parent-week', caption: 'Le point de la semaine, en phrases, puis une carte par matière.' },
      { file: '13a-parent-math', caption: 'La page Maths : la maîtrise du niveau boîte par boîte, la grille Leitner, puis les séances.' },
      { file: '13d-parent-settings', caption: 'Les réglages, en bas de l\'accueil : une ligne par réglage.' },
    ],
  },
  {
    id: 'profils',
    title: 'Plusieurs enfants',
    body: `
      <p>Une tablette pour toute la fratrie : chaque enfant a son profil, sa progression, ses badges, sa série et ses images.</p>
      <ul class="guide-list">
        <li><strong>Ajouter un enfant</strong> : depuis l'espace parent (« Profils et sauvegarde ») ou l'écran « Qui joue ? ».</li>
        <li><strong>Dès deux profils</strong>, l'app demande « Qui joue ? » à l'ouverture, et un bouton en haut de l'accueil change de joueur. Avec un seul, rien ne change.</li>
        <li><strong>Dans l'espace parent</strong>, une pastille par enfant, y compris ceux suivis à distance, sans changer de joueur.</li>
        <li><strong>« Profils et sauvegarde »</strong> : changer d'appareil, exporter ou importer une sauvegarde, supprimer un profil.</li>
      </ul>
    `,
    shots: [
      { file: '19-profile-select', caption: '« Qui joue ? » — l\'écran de choix affiché à l\'ouverture dès deux profils.' },
      { file: '20-home-multi', caption: 'Le bouton « changer de joueur » apparaît en haut de l\'accueil, à côté de l\'engrenage.' },
      { file: '20c-parent-children', caption: 'Dans l\'espace parent, une pastille par enfant : on regarde la progression de chacun sans changer de joueur.' },
      { file: '20b-parent-profiles', caption: 'La page « Profils et sauvegarde » de l\'espace parent : les enfants de l\'appareil, puis la sauvegarde du profil actif.' },
    ],
  },
];

const SECTIONS_EN = [
  {
    id: 'principes',
    title: 'The principles',
    body: `
      <p>Tablito is not just a quiz. Every design choice is grounded in
      research from cognitive psychology and mathematics education. Five
      pillars hold the app together:</p>
      <ul class="principles">
        <li>
          <strong>Spaced repetition — the Leitner boxes.</strong> Each fact
          lives in one of five boxes numbered from 1 (just learned) to 5
          (firmly anchored). A new fact starts in box 1: it is reviewed the
          same day. A correct answer moves it up one box and pushes the next
          review further out: 1 day in box 2, 3 days in box 3, 7 days in box
          4, 21 days in box 5. A mistake sends it back to box 1, long enough
          to re-anchor it. The child reviews each fact just before forgetting
          it, with longer and longer intervals — far more durable than
          cramming in a single evening.
          <span class="cite">Kang (2016) ; Cepeda et al. (2008) ; Rea &amp; Modigliani (1985)</span>
        </li>
        <li>
          <strong>Low interference.</strong> Facts that look alike (same
          operand, close answers) are never introduced in the same week. A
          session contains only facts dissimilar enough that the child won't
          confuse them in memory.
          <span class="cite">Dotan &amp; Zviran-Ginat (2022)</span>
        </li>
        <li>
          <strong>Interleaving.</strong> The tables are mixed within a single
          session rather than worked through one after another. The child has
          to reach for the right operation at every question, which solidifies
          long-term recall.
          <span class="cite">Rohrer &amp; Taylor (2007) ; Rohrer, Dedrick &amp; Burgess (2014)</span>
        </li>
        <li>
          <strong>Understand before memorizing.</strong> Each new fact is
          first shown as a grid of dots (repeated addition), then through
          commutativity (3 × 5 = 5 × 3), and finally with a derivation trick
          suited to it (× 9 = × 10 − n, × 4 = double-double, × 6 = × 5 + n,
          etc.). A few anchor facts (doubles, × 5, × 9, squares) support the
          derived ones. The scaffolding fades away once recall becomes
          automatic.
          <span class="cite">Van de Walle via Wichita Public Schools (2014) ; Brendefur et al. (2015)</span>
        </li>
        <li>
          <strong>Progress-oriented feedback, not performance.</strong> No
          numeric score on the child's side, no stars computed from a success
          rate: only steady encouragement and a spotlight on the facts
          learned. The goal is intrinsic motivation and mastery, not the
          grade. The raw numbers stay available in the parent area.
          <span class="cite">Butler (1988) ; Hattie &amp; Timperley (2007)</span>
        </li>
      </ul>
      <p class="principles-footer">Details and rationale in the
      <a href="../../specs/">functional specifications</a> (in French).</p>
    `,
    shots: [],
  },
  {
    id: 'welcome',
    title: 'Welcome',
    body: `
      <p>On the very first launch, a four-step welcome:</p>
      <ul class="guide-list">
        <li><strong>The mascot</strong> introduces itself.</li>
        <li><strong>The child's name.</strong></li>
        <li><strong>An introduction</strong> to the placement test.</li>
        <li><strong>The test</strong>: 15 well-spread questions.</li>
      </ul>
      <p>Facts already known start straight in the higher Leitner boxes.</p>
    `,
    shots: [
      { file: '01-welcome-intro', caption: 'The mascot introduces itself to the child.' },
      { file: '02-welcome-name', caption: 'Entering the name.' },
      { file: '03-welcome-ready', caption: 'Announcing the placement test.' },
      { file: '04-welcome-test', caption: 'Placement test (15 questions).' },
    ],
  },
  {
    id: 'home',
    title: 'Home screen',
    body: `
      <p>Where every day starts.</p>
      <ul class="guide-list">
        <li><strong>The mascot</strong> welcomes the child, cheers correct answers, encourages after a mistake. It never judges.</li>
        <li><strong>The flame</strong> counts days in a row.</li>
        <li><strong>The big button</strong> starts the day's session.</li>
        <li><strong>The bottom bar</strong> opens the mystery picture, the badges and the ×1 / ×10 rules.</li>
        <li><strong>The gear</strong> opens the parent area, behind a small multiplication.</li>
      </ul>
      <p>Once all the tables are mastered, the day's session moves on to division by itself: no new button.</p>
    `,
    shots: [
      { file: '05-home', caption: 'Home screen with the mascot and the 5-day streak.' },
    ],
  },
  {
    id: 'session',
    title: 'The session',
    body: `
      <p>12 to 15 questions, a few minutes.</p>
      <ul class="guide-list">
        <li><strong>A new fact</strong> is first shown in three steps: a grid of dots (repeated addition), swapping the factors (3×5 = 5×3), then a trick (“× 9 is × 10 minus one”).</li>
        <li><strong>Answers</strong> with the keypad or by voice. A button below the keypad switches mode, and the choice is remembered.</li>
        <li><strong>Quick correct answer</strong>: a golden star.</li>
        <li><strong>Mistake</strong>: the right answer, the grid of dots, the trick if the fact is recent. The question comes back a little later.</li>
      </ul>
    `,
    shots: [
      { file: '06-session-intro', caption: 'Introducing a new fact — step 1: grid of dots and repeated addition.' },
      { file: '06b-session-intro-strategy', caption: 'Introduction — step 3: a derivation trick to memorize the fact.' },
      { file: '07-session-question', caption: 'Standard question and keypad.' },
      { file: '07b-session-voice', caption: 'Voice mode — the child says their answer out loud. Switchable at any time.' },
      { file: '08-session-feedback-correct', caption: 'Quick correct answer — golden star.' },
      { file: '09-session-feedback-incorrect', caption: 'Incorrect answer — grid of dots and a reminder of the trick.' },
    ],
  },
  {
    id: 'recap',
    title: 'Session recap',
    body: `
      <p>At the end of every session:</p>
      <ul class="guide-list">
        <li><strong>The day's new facts</strong>, if any.</li>
        <li><strong>Progress</strong>: a “X facts known out of 36” bar.</li>
        <li><strong>The mystery picture</strong> to go and see, with a mention when it has changed.</li>
        <li><strong>Confetti</strong> for a mastered table, a completed picture or a new badge.</li>
      </ul>
    `,
    shots: [
      { file: '14-recap', caption: 'Recap of a session with a progress bar.' },
    ],
  },
  {
    id: 'progress',
    title: 'My mystery picture',
    body: `
      <p>An 8×8 grid (tables 2 to 9): each cell is a piece of a hidden picture.</p>
      <ul class="guide-list">
        <li><strong>The better a fact is known</strong>, the sharper its cell: blurry silhouette, flat color, colors, shadows, details. One step per Leitner box.</li>
        <li><strong>A forgotten fact</strong> blurs a little again, with no notion of failure.</li>
        <li><strong>All 36 facts mastered</strong>: the picture is fully revealed.</li>
      </ul>
      <p>At the top, the discovered / mastered / total counts.</p>
    `,
    shots: [
      { file: '10-progress', caption: 'The mystery picture revealing itself as progress is made.' },
    ],
  },
  {
    id: 'division',
    title: 'Level 2 — division',
    body: `
      <p>Once all the tables are mastered (the “Times tables genius” badge), the same facts come back the other way round: “56 ÷ 7 = ?”.</p>
      <ul class="guide-list">
        <li><strong>The trick</strong> is taught: for 56 ÷ 7, look for “7 times what makes 56?”.</li>
        <li><strong>Step by step</strong>: divisions arrive in the same order as the tables, easiest first.</li>
        <li><strong>One session</strong>: it switches to division, and slips in a few tables to maintain.</li>
        <li><strong>A new mystery picture</strong>. “My picture” becomes “My pictures”; the tables picture stays earned.</li>
      </ul>
      <p>Everything else (Leitner boxes, encouragement) works as for the tables.</p>
    `,
    shots: [
      { file: '15-division-home', caption: 'Once the tables are mastered, “My picture” becomes “My pictures” (multiplications + divisions).' },
      { file: '13b-parent-dashboard-division', caption: 'In the parent area, the Math card moves on to division; multiplication, mastered, stays checked off.' },
      { file: '16-division-intro', caption: 'Introducing a division: “think of the multiplication”.' },
      { file: '17-division-question', caption: 'Division question on the keypad.' },
      { file: '18-division-progress', caption: 'A mystery picture dedicated to division, distinct from the tables one.' },
    ],
  },
  {
    id: 'remainder',
    title: 'Level 3 — division with remainders',
    body: `
      <p>Once every division is mastered, division that doesn't come out even: “45 ÷ 7 = 6 r 3”, the skill expected at the end of grade 3.</p>
      <ul class="guide-list">
        <li><strong>The trick</strong>: find the multiple just below, without going over. What's missing is the remainder.</li>
        <li><strong>Two steps</strong>: “How many times?”, then “What's left over?”.</li>
        <li><strong>Never the same sum</strong>: the number to divide changes on every review. Sometimes the remainder is zero: up to the child to spot it.</li>
        <li><strong>A third mystery picture</strong>. Tables and divisions keep being maintained in the same session.</li>
      </ul>
    `,
    shots: [
      { file: '21-remainder-intro', caption: 'Introducing a division with remainder: the full rows, and the dots that "don\'t fit" — the remainder.' },
      { file: '22-remainder-question', caption: 'Answering in two steps: the validated quotient settles into the formula, then "What\'s left over?".' },
      { file: '23-remainder-progress', caption: 'A third mystery picture, dedicated to division with remainders.' },
      { file: '13c-parent-dashboard-remainder', caption: 'The parent area\'s Math page opens on the current level: "Remainders" joins the level selector (mastery and Leitner grid).' },
    ],
  },
  {
    id: 'badges',
    title: 'The badges',
    body: `
      <p>Badges to mark the way.</p>
      <ul class="guide-list">
        <li><strong>Milestones</strong>: first session, 7 days, 30 days.</li>
        <li><strong>Performance</strong>: 10 correct answers in a row, 5 answers under 2 s.</li>
        <li><strong>Mastery</strong>: one badge per table, then “Times tables genius”. Division adds its own.</li>
      </ul>
      <p>Each badge opens on its condition and, while still locked, a progress bar.</p>
    `,
    shots: [
      { file: '11-badges', caption: 'Badge collection — earned and still to unlock.' },
      { file: '11-badges-detail', caption: 'Tapping a locked badge reveals the condition and the progress.' },
    ],
  },
  {
    id: 'rules',
    title: 'The ×1 and ×10 rules',
    body: `
      <p>Two rules given up front, so they don't have to be learned by heart:</p>
      <ul class="guide-list">
        <li><strong>× 1</strong>: the number doesn't change.</li>
        <li><strong>× 10</strong>: the digits slide one place to the left, a 0 takes the ones place.</li>
        <li><strong>× 11</strong>, a bonus once tables 2 to 9 are mastered: repeat the digit (3 × 11 = 33). A “New” dot flags it.</li>
      </ul>
      <p>These tables are therefore not among the 36 facts to learn.</p>
    `,
    shots: [
      { file: '12-rules', caption: 'Rules for ×1 and ×10.' },
    ],
  },
  {
    id: 'parent',
    title: 'Parent area',
    body: `
      <p>Open it from the gear on the home screen, after a small
      multiplication that checks an adult is behind the screen. From top to
      bottom:</p>
      <ul class="guide-list">
        <li><strong>Today.</strong> Has the session been done? The last 14
        days, sessions, streaks.</li>
        <li><strong>The week.</strong> Days practised, accuracy, speed, facts
        that moved up, compared with the week before.</li>
        <li><strong>One card per subject.</strong> The current level and its
        mastery bar. Tap it for the subject's page: boxes, Leitner grid,
        trends, session history.</li>
        <li><strong>Needs practice.</strong> The three toughest facts right
        now, with an idea to help at home.</li>
        <li><strong>Settings.</strong> Remote follow, profiles and backup,
        daily reminder, language, help.</li>
      </ul>
      <p>A question, a problem, an idea? The “Send feedback” button, top
      right.</p>
    `,
    shots: [
      { file: '13-parent-dashboard', caption: 'The parent area overview starts with the day.' },
      { file: '13e-parent-week', caption: 'The week at a glance, in sentences, then one card per subject.' },
      { file: '13a-parent-math', caption: 'The Math page: level mastery box by box, the Leitner grid, then the sessions.' },
      { file: '13d-parent-settings', caption: 'The settings, at the bottom of the overview: one row per setting.' },
    ],
  },
  {
    id: 'profils',
    title: 'Several children',
    body: `
      <p>One tablet for the whole family: each child has their own profile, progress, badges, streak and pictures.</p>
      <ul class="guide-list">
        <li><strong>Add a child</strong>: from the parent area (“Profiles and backup”) or the “Who's playing?” screen.</li>
        <li><strong>With two or more profiles</strong>, the app asks “Who's playing?” on launch, and a button at the top of the home screen switches player. With one, nothing changes.</li>
        <li><strong>In the parent area</strong>, one chip per child, including those followed remotely, without switching player.</li>
        <li><strong>“Profiles and backup”</strong>: move to another device, export or import a backup, delete a profile.</li>
      </ul>
    `,
    shots: [
      { file: '19-profile-select', caption: '“Who\'s playing?” — the selection screen shown on launch with two or more profiles.' },
      { file: '20-home-multi', caption: 'The “switch player” button appears at the top of the home screen, next to the gear.' },
      { file: '20c-parent-children', caption: 'In the parent area, one chip per child: see each one\'s progress without switching player.' },
      { file: '20b-parent-profiles', caption: 'The “Profiles and backup” page of the parent area: the children on this device, then the active profile\'s backup.' },
    ],
  },
];

const SECTIONS_BY_LANG = { fr: SECTIONS_FR, en: SECTIONS_EN };

// Chrome de la page (en-tête, sommaire, pied) par langue.
const UI = {
  fr: {
    htmlLang: 'fr',
    pageTitle: "Tablito — Guide d'utilisation",
    eyebrow: "Guide d'utilisation",
    backToApp: "← Retour à l'application",
    tocLabel: 'Sommaire',
    footerMoreLabel: 'Pour aller plus loin :',
    footerSpecs: 'spécifications fonctionnelles',
    footerSource: 'code source',
    footerGenerated: (date) => `Guide généré automatiquement le ${date}.`,
    langSwitchHref: 'en/',
    langSwitchLabel: 'English',
    // Chemins relatifs depuis /guide/ vers la racine du site.
    rootPrefix: '../',
  },
  en: {
    htmlLang: 'en',
    pageTitle: 'Tablito — User guide',
    eyebrow: 'User guide',
    backToApp: '← Back to the app',
    tocLabel: 'Contents',
    footerMoreLabel: 'Going further:',
    footerSpecs: 'functional specifications',
    footerSource: 'source code',
    footerGenerated: (date) => `Guide generated automatically on ${date}.`,
    langSwitchHref: '../',
    langSwitchLabel: 'Français',
    // Chemins relatifs depuis /guide/en/ vers la racine du site.
    rootPrefix: '../../',
  },
};

async function buildHtml({ generatedAt, lang }) {
  const SECTIONS = SECTIONS_BY_LANG[lang];
  const ui = UI[lang];
  const allShotFiles = [...new Set(SECTIONS.flatMap((s) => s.shots.map((sh) => sh.file)))];
  const hashEntries = await Promise.all(allShotFiles.map(async (f) => [f, await shotHash(f)]));
  const hashByFile = new Map(hashEntries);

  const sectionHtml = SECTIONS.map((s) => {
    const textContent = s.body
      ? s.body.trim()
      : `<p>${s.description.trim().replace(/\s+/g, ' ')}</p>`;
    if (!s.shots.length) {
      return `
      <section id="${s.id}" class="section section-full">
        <div class="section-text">
          <h2>${s.title}</h2>
          ${textContent}
        </div>
      </section>`;
    }
    const shots = s.shots
      .map(
        // width/height attributes match the capture viewport (CSS pixels).
        // The browser uses them to reserve space before the image loads,
        // preventing layout shift while scrolling through the guide.
        (sh) => `
          <figure class="shot">
            <img src="screenshots/${sh.file}.png?v=${hashByFile.get(sh.file)}" alt="${sh.caption.replace(/"/g, '&quot;')}" width="${VIEWPORT.width}" height="${VIEWPORT.height}" loading="lazy" />
            <figcaption>${sh.caption}</figcaption>
          </figure>`,
      )
      .join('\n');
    const shotsClass = `shots shots-${s.shots.length}`;
    return `
      <section id="${s.id}" class="section">
        <div class="section-text">
          <h2>${s.title}</h2>
          ${textContent}
        </div>
        <div class="${shotsClass}">
          ${shots}
        </div>
      </section>`;
  }).join('\n');

  const toc = SECTIONS.map((s) => `<li><a href="#${s.id}">${s.title}</a></li>`).join('');

  return `<!DOCTYPE html>
<html lang="${ui.htmlLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${ui.pageTitle}</title>
<link rel="icon" href="${ui.rootPrefix}favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..600&family=Nunito:wght@400;600;700;800&display=swap" />
<style>
  :root {
    --cream: #FBF6EC;
    --cream-deep: #F3EADB;
    --paper: #FFFFFF;
    --ink: #1E1A2E;
    --ink-soft: #52495F;
    --ink-muted: #8A8295;
    --line: #E6DECE;
    --line-soft: #EFE7D6;
    --indigo: #4F46BA;
    --indigo-soft: #E8E6F7;
    --indigo-ink: #2B2478;
    --coral: #E8623D;
    --honey: #D99A1F;
    --honey-soft: #F7E9C4;
    --sage: #3F9B7A;
    --sage-soft: #D9EDE2;
    --serif: 'Fraunces', 'Iowan Old Style', Georgia, serif;
    --sans: 'Nunito', 'SF Pro Text', system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: var(--sans);
    background: var(--cream);
    color: var(--ink);
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  header {
    background: var(--cream);
    color: var(--ink);
    padding: 56px 24px 40px;
    text-align: center;
    border-bottom: 1px solid var(--line);
  }
  header .eyebrow {
    font-size: 12px;
    font-weight: 800;
    color: var(--ink-muted);
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  header h1 {
    margin: 0 0 10px;
    font-family: var(--serif);
    font-size: 44px;
    font-weight: 600;
    letter-spacing: -1px;
    color: var(--ink);
  }
  header h1 em {
    color: var(--indigo);
    font-style: italic;
  }
  header p {
    margin: 0;
    color: var(--ink-soft);
    font-size: 16px;
  }
  header .back-link {
    display: inline-block;
    margin-top: 18px;
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 700;
    color: var(--indigo);
    text-decoration: none;
    padding: 8px 16px;
    border-radius: 999px;
    border: 1.5px solid var(--line);
    background: var(--paper);
    transition: background 0.15s;
  }
  header .back-link:hover { background: var(--cream-deep); }
  header .header-links {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 18px;
  }
  header .header-links .back-link { margin-top: 0; }
  header .lang-switch { color: var(--ink-soft); }
  main { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
  nav.toc {
    background: var(--paper);
    border: 1.5px solid var(--line);
    border-radius: 22px;
    padding: 20px 24px;
    margin-bottom: 40px;
  }
  nav.toc .toc-label {
    font-size: 11px;
    font-weight: 800;
    color: var(--ink-muted);
    letter-spacing: 0.6px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  nav.toc ul {
    margin: 0;
    padding: 0 0 0 4px;
    columns: 2;
    list-style: none;
  }
  nav.toc li {
    margin: 6px 0;
    break-inside: avoid;
    padding-left: 18px;
    position: relative;
  }
  nav.toc li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.7em;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--honey);
  }
  nav.toc a {
    font-family: var(--serif);
    font-size: 16px;
    font-weight: 500;
    color: var(--ink);
    text-decoration: none;
    letter-spacing: -0.2px;
  }
  nav.toc a:hover { color: var(--indigo); }
  section.section {
    background: var(--paper);
    border: 1.5px solid var(--line);
    border-radius: 22px;
    padding: 36px;
    margin-bottom: 20px;
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    gap: 40px;
    align-items: start;
  }
  .section-text { max-width: 55ch; }
  .section-text h2 {
    margin: 0 0 14px;
    font-family: var(--serif);
    color: var(--ink);
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.5px;
    line-height: 1.2;
  }
  .section-text p {
    color: var(--ink-soft);
    margin: 0 0 12px;
    font-size: 15px;
  }
  .section-text p:last-child { margin-bottom: 0; }
  .section.section-full {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .section-full .section-text { max-width: 72ch; margin: 0 auto; }
  ul.principles {
    list-style: none;
    padding: 0;
    margin: 0 0 16px;
    display: grid;
    gap: 12px;
  }
  ul.principles li {
    color: var(--ink);
    background: var(--cream);
    border: 1.5px solid var(--line);
    border-radius: 14px;
    padding: 14px 18px;
    font-size: 14px;
    line-height: 1.5;
  }
  ul.principles li strong {
    color: var(--indigo);
    font-weight: 700;
  }
  ul.principles .cite {
    display: block;
    margin-top: 6px;
    color: var(--ink-muted);
    font-size: 12px;
    font-style: italic;
  }
  ul.guide-list {
    list-style: none;
    padding: 0;
    margin: 0 0 12px;
    color: var(--ink-soft);
    font-size: 15px;
  }
  ul.guide-list li { padding: 8px 0; border-top: 1px solid var(--line); }
  ul.guide-list li:first-child { border-top: 0; }
  ul.guide-list strong { color: var(--ink); }
  .principles-footer {
    font-size: 14px;
    color: var(--ink-soft);
  }
  .principles-footer a { color: var(--indigo); text-decoration: none; font-weight: 700; }
  .principles-footer a:hover { text-decoration: underline; }
  .principles-footer code {
    background: var(--cream);
    border: 1px solid var(--line);
    padding: 1px 6px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.85em;
  }
  .shots {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    justify-items: center;
  }
  .shots-1 { grid-template-columns: minmax(0, 320px); justify-content: center; }
  figure.shot {
    margin: 0;
    background: var(--cream);
    border: 1.5px solid var(--line);
    border-radius: 18px;
    padding: 12px;
    text-align: center;
    width: 100%;
    max-width: 320px;
  }
  figure.shot img {
    display: block;
    width: 100%;
    height: auto;
    margin: 0 auto;
    border-radius: 12px;
    background: var(--paper);
  }
  figure.shot figcaption {
    margin-top: 10px;
    font-size: 13px;
    color: var(--ink-soft);
    font-weight: 600;
  }
  footer {
    text-align: center;
    color: var(--ink-muted);
    padding: 32px 24px;
    font-size: 13px;
    border-top: 1px solid var(--line);
    margin-top: 24px;
  }
  footer p { margin: 0 0 8px; }
  footer p:last-child { margin-bottom: 0; font-size: 12px; color: var(--ink-soft); }
  footer a { color: var(--indigo); text-decoration: none; font-weight: 700; }
  footer a:hover { text-decoration: underline; }
  footer code {
    background: var(--paper);
    border: 1px solid var(--line);
    padding: 2px 8px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.9em;
  }
  @media (max-width: 800px) {
    section.section { grid-template-columns: 1fr; gap: 24px; padding: 24px; }
    .shots-1 { justify-self: center; }
  }
  @media (max-width: 640px) {
    nav.toc ul { columns: 1; }
    header { padding: 36px 20px 28px; }
    header h1 { font-size: 32px; }
    main { padding: 20px 16px; }
    section.section { padding: 20px; border-radius: 18px; }
    .shots { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<header>
  <div class="eyebrow">${ui.eyebrow}</div>
  <h1>Tablito<em>.</em></h1>
  <div class="header-links">
    <a class="back-link" href="${ui.rootPrefix}">${ui.backToApp}</a>
    <a class="back-link lang-switch" href="${ui.langSwitchHref}">${ui.langSwitchLabel}</a>
  </div>
</header>
<main>
  <nav class="toc">
    <div class="toc-label">${ui.tocLabel}</div>
    <ul>${toc}</ul>
  </nav>
  ${sectionHtml}
</main>
<footer>
  <p>
    ${ui.footerMoreLabel}
    <a href="${ui.rootPrefix}specs/">${ui.footerSpecs}</a> ·
    <a href="https://github.com/isc/tablito">${ui.footerSource}</a>
  </p>
  <p>
    ${ui.footerGenerated(generatedAt)}
  </p>
</footer>
</body>
</html>`;
}

// --- Main -------------------------------------------------------------------

// One full pass for a language: drive the app (in that language), capture every
// screenshot into OUT_DIR/screenshots, then write the localized HTML.
async function generateForLang(browser, lang) {
  LANG = lang;
  OUT_DIR = outDirFor(lang);
  SHOTS_DIR = join(OUT_DIR, 'screenshots');
  await mkdir(SHOTS_DIR, { recursive: true });
  log(`=== generating ${lang} guide → ${OUT_DIR}`);

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    locale: LOCALE[lang],
    timezoneId: 'Europe/Paris',
  });
  const page = await context.newPage();

  // Fail fast on unexpected page errors.
  page.on('pageerror', (err) => log('PAGE ERROR:', err.message));

  await captureWelcomeScreens(page);
  await captureHome(page);
  await captureNavScreen(page, NAV_SCREENS[0]); // My picture
  await captureBadgesScreen(page);
  await captureNavScreen(page, NAV_SCREENS[1]); // Rules
  await captureParentDashboard(page, {
    hubShot: '13-parent-dashboard',
    weekShot: '13e-parent-week',
    settingsShot: '13d-parent-settings',
    mathShot: '13a-parent-math',
  });
  await captureSessionScreens(page);
  await captureRecap(page);
  await captureDivisionScreens(page);
  await captureRemainderScreens(page);
  await captureMultiProfileScreens(page);
  // Matière fr-only : invisible en anglais, rien à capturer.
  if (lang === 'fr') await captureConjScreens(page);
  // Voice capture runs LAST: it injects a SpeechRecognition stub and sets
  // the input mode to 'voice' via addInitScript, both of which would
  // pollute any subsequent capture (especially captureRecap which drives
  // a full session via keyboard).
  await captureVoiceInput(page);

  await context.close();

  const html = await buildHtml({
    generatedAt: new Date().toISOString().slice(0, 10),
    lang,
  });
  await writeFile(join(OUT_DIR, 'index.html'), html);
  log(`wrote ${join(OUT_DIR, 'index.html')}`);
}

async function main() {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    console.error('ERROR: dist/index.html not found. Run `npm run build` first.');
    process.exit(1);
  }

  // Wipe the whole guide tree once, before any language pass — non-fr langs
  // live in subdirs of GUIDE_DIR, so per-pass rm would clobber siblings.
  await rm(GUIDE_DIR, { recursive: true, force: true });

  const server = startPreviewServer();
  const cleanup = () => {
    if (!server.killed) server.kill('SIGTERM');
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  try {
    await waitForUrl(BASE_URL);

    const browser = await chromium.launch();
    for (const lang of LANGS) {
      await generateForLang(browser, lang);
    }
    await browser.close();
  } finally {
    cleanup();
  }

  log('done ✔︎');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
