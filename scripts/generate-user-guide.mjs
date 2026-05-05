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
 * at https://isc.github.io/multiplix/guide/.
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'dist', 'guide');
const SHOTS_DIR = join(OUT_DIR, 'screenshots');

const PORT = Number(process.env.GUIDE_PORT ?? 4173);
// Matches the base baked in at build time (see scripts/build.mjs). For main
// deploys this is `/multiplix/`; for branch previews it's overridden via
// the `BASE` env variable.
const BASE_PATH = process.env.BASE ?? '/multiplix/';
const BASE_URL = `http://localhost:${PORT}${BASE_PATH}`;

// Mobile-ish portrait viewport. Matches the 360×760 iPhone logical frame
// the mockup (Redesign Multiplix.html) uses, so side-by-side comparisons
// line up without rescaling tricks.
const VIEWPORT = { width: 360, height: 760 };
const DEVICE_SCALE = 2;

// Anchor date for seed data — single source of truth for every capture.
const SEED_TODAY = '2026-04-12';
const SEED_YESTERDAY = '2026-04-11';

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
    badges: [
      { id: 'premier-pas', name: 'Premier pas', description: 'Terminer la première séance', earnedDate: '2026-03-15', icon: '🌱' },
      { id: 'machine', name: 'Machine', description: '10 bonnes réponses de suite', earnedDate: '2026-03-22', icon: '⚡' },
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

// --- Page helpers -----------------------------------------------------------

async function seedProfile(page, profile) {
  await page.addInitScript(({ p, mockTodayIso }) => {
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

    if (p === null) {
      localStorage.removeItem('multiplix-profile');
    } else {
      localStorage.setItem('multiplix-profile', JSON.stringify(p));
    }
    // Mute sounds to avoid anything weird in headless.
    localStorage.setItem('multiplix-muted', 'true');
    // Bypass the install landing : on est en headless, l'install PWA n'a
    // aucun sens, on capture les écrans de l'app directement.
    localStorage.setItem('multiplix-skip-install', '1');
  }, { p: profile, mockTodayIso: SEED_TODAY });
}

/** Returns the Leitner box of the currently displayed question's fact. */
async function readCurrentFactBox(page, q) {
  return page.evaluate((qq) => {
    const raw = localStorage.getItem('multiplix-profile');
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
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });
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

  await page.click('.welcome-btn-primary');
  await page.waitForSelector('.welcome-input');
  await shot(page, '02-welcome-name');

  await page.fill('.welcome-input', 'Léa');
  await page.click('.welcome-btn-primary');
  // Step 2: "Salut Léa"
  await page.waitForSelector('.welcome-title:has-text("Salut")');
  await shot(page, '03-welcome-ready');

  // Placement test
  await page.click('.welcome-btn-primary');
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
  { navText: 'Mon image', screenSel: '.progress-screen', backSel: '.progress-back-btn', shot: '10-progress' },
  { navText: 'Règles',  screenSel: '.rules-screen',    backSel: '.rules-back-btn',    shot: '12-rules'    },
];

async function captureNavScreen(page, { navText, screenSel, backSel, shot: shotName }) {
  await page.click(`.home-nav-btn:has-text("${navText}")`);
  await page.waitForSelector(screenSel);
  await shot(page, shotName);
  await page.click(backSel);
  await page.waitForSelector('.home-screen');
}

async function captureBadgesScreen(page) {
  await page.click('.home-nav-btn:has-text("Badges")');
  await page.waitForSelector('.badges-screen');
  await shot(page, '11-badges');

  // Open the detail modal on a locked badge with progression (Régularité —
  // streak 5/7) so the guide can showcase the explanation + progress bar.
  await page.click('.badges-grid .badge:has-text("Régularité")');
  await page.waitForSelector('.badge-detail-modal');
  await shot(page, '11-badges-detail');
  await page.click('.badge-detail-modal .modal-close-btn');
  await page.waitForSelector('.badge-detail-modal', { state: 'detached' });

  await page.click('.badges-back-btn');
  await page.waitForSelector('.home-screen');
}

async function captureParentDashboard(page) {
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
  await shot(page, '13-parent-dashboard');
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
  await page.waitForSelector('.home-start-btn');
  await page.click('.home-start-btn');
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
  await page.waitForSelector('.home-start-btn');
  await page.click('.home-start-btn');

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

// --- HTML guide generator ---------------------------------------------------

const SECTIONS = [
  {
    id: 'principes',
    title: 'Les principes',
    body: `
      <p>Multiplix n'est pas un simple quiz. Chaque choix de conception s'appuie
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
      <p class="principles-footer">Détails et justifications dans
      <a href="https://github.com/isc/multiplix/blob/main/specs-multiplix.md"><code>specs-multiplix.md</code></a>.</p>
    `,
    shots: [],
  },
  {
    id: 'welcome',
    title: 'Bienvenue',
    description: `À la toute première ouverture, Multiplix déroule un parcours
      d'accueil en quatre étapes : une salutation de la mascotte, la saisie du
      prénom, une présentation du test de positionnement, puis le test lui-même
      (15 questions bien réparties). Le résultat sert à placer les faits déjà
      connus directement dans les boîtes supérieures du système de Leitner.`,
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
    description: `Le hub quotidien. La mascotte est un compagnon stable —
      elle accueille l'enfant à chaque session, réagit aux bonnes réponses,
      encourage en cas d'erreur, sans jamais juger. La flamme affiche la
      série en cours. Le gros bouton lance la séance du jour, et la barre du
      bas donne accès aux progrès, aux badges et aux règles ×1 / ×10. L'icône
      engrenage ouvre l'espace parent, après une courte multiplication-gate
      pour écarter les doigts curieux.`,
    shots: [
      { file: '05-home', caption: 'Accueil avec la mascotte et la série de 5 jours.' },
    ],
  },
  {
    id: 'session',
    title: 'La séance',
    description: `Une séance contient 12 à 15 questions. Quand un fait
      nouveau apparaît, il est introduit en trois temps : une grille de points
      qui montre la multiplication comme une addition répétée, la propriété de
      commutativité (3×5 = 5×3, sauf pour les carrés), et une astuce de
      dérivation adaptée au fait (par exemple « × 9 = × 10 moins une fois »).
      Ensuite viennent les questions. Une bonne réponse rapide donne une étoile
      dorée. En cas d'erreur, la bonne réponse est affichée avec la grille de
      points et — tant que le fait est en début d'apprentissage — l'astuce de
      dérivation est rappelée. Le fait est re-posé un peu plus loin dans la
      séance.`,
    shots: [
      { file: '06-session-intro', caption: 'Introduction d\'un nouveau fait — étape 1 : grille de points et addition répétée.' },
      { file: '06b-session-intro-strategy', caption: 'Introduction — étape 3 : astuce de dérivation pour mémoriser le fait.' },
      { file: '07-session-question', caption: 'Question standard et pavé numérique.' },
      { file: '08-session-feedback-correct', caption: 'Bonne réponse rapide — étoile dorée.' },
      { file: '09-session-feedback-incorrect', caption: 'Réponse incorrecte — grille de points et rappel de l\'astuce.' },
    ],
  },
  {
    id: 'recap',
    title: 'Bilan de séance',
    description: `À la fin d'une séance, l'écran de bilan affiche les
      éventuels nouveaux faits, invite à aller voir l'image mystère (avec
      une mention spéciale quand elle a changé) et déclenche les confettis
      si une table est entièrement maîtrisée, si l'image mystère est
      complétée, ou pour un nouveau badge. La progression globale est
      affichée via une barre « X faits connus sur 36 ».`,
    shots: [
      { file: '14-recap', caption: 'Bilan d\'une séance avec barre de progression.' },
    ],
  },
  {
    id: 'progress',
    title: 'Mon image mystère',
    description: `Une grille 8×8 (tables 2 à 9) où chaque case est un
      fragment d'une image cachée. Plus l'enfant maîtrise un fait, plus
      son fragment gagne en finesse — silhouette floue, aplat, couleurs,
      ombres, détails complets, en miroir des 5 boîtes Leitner. Un fait
      oublié voit son fragment se re-flouter un peu, sans notion d'échec.
      Quand les 36 faits sont maîtrisés, l'image est entièrement révélée.
      Les totaux « découverts / maîtrisés / total » sont affichés en haut.`,
    shots: [
      { file: '10-progress', caption: 'Image mystère qui se révèle au fur et à mesure des progrès.' },
    ],
  },
  {
    id: 'badges',
    title: 'Les badges',
    description: `16 badges au total, répartis en trois familles : jalons
      (première séance, 7 jours, 30 jours), performance (10 réponses de suite,
      5 réponses < 2 s), et maîtrise (un badge par table + un badge « génie des
      maths » quand tout est en boîte 5). Chaque vignette est cliquable et
      ouvre une fiche qui explique la condition de déblocage. Pour les badges
      verrouillés, une barre de progression montre où en est l'enfant — les
      icônes seules ne sont pas auto-portantes pour qui découvre la
      gamification.`,
    shots: [
      { file: '11-badges', caption: 'Collection de badges — obtenus et à débloquer.' },
      { file: '11-badges-detail', caption: 'En cliquant sur un badge verrouillé, on découvre la condition et la progression.' },
    ],
  },
  {
    id: 'rules',
    title: 'Les règles ×1 et ×10',
    description: `Deux règles que l'app met en avant dès le début pour
      alléger la charge mnésique : multiplier par 1 (le nombre ne change pas)
      et multiplier par 10 (les chiffres glissent d'une place vers la gauche,
      un 0 prend la place des unités). Ces tables ne font donc pas partie
      des 36 faits appris.`,
    shots: [
      { file: '12-rules', caption: 'Règles pour ×1 et ×10.' },
    ],
  },
  {
    id: 'parent',
    title: 'Espace parent',
    description: `Accessible depuis l'accueil via l'engrenage, après une
      petite multiplication (un opérande entre 11 et 19, l'autre entre 3
      et 9) pour confirmer qu'un adulte est derrière l'écran. On y retrouve :
      les statistiques générales, un
      histogramme des boîtes Leitner, l'évolution du taux de réussite,
      les faits les plus difficiles,
      les temps de réponse moyens par table, l'historique des 10 dernières
      séances, et les actions export / import du profil (JSON).`,
    shots: [
      { file: '13-parent-dashboard', caption: 'Tableau de bord parent complet.' },
    ],
  },
];

function buildHtml({ generatedAt }) {
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
            <img src="screenshots/${sh.file}.png" alt="${sh.caption.replace(/"/g, '&quot;')}" width="${VIEWPORT.width}" height="${VIEWPORT.height}" loading="lazy" />
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
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Multiplix — Guide d'utilisation</title>
<link rel="icon" href="../favicon.svg" />
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
  <div class="eyebrow">Guide d'utilisation</div>
  <h1>Multiplix<em>.</em></h1>
  <a class="back-link" href="../">← Retour à l'application</a>
</header>
<main>
  <nav class="toc">
    <div class="toc-label">Sommaire</div>
    <ul>${toc}</ul>
  </nav>
  ${sectionHtml}
</main>
<footer>
  <p>
    Pour aller plus loin :
    <a href="https://github.com/isc/multiplix/blob/main/specs-multiplix.md">spécifications fonctionnelles</a> ·
    <a href="https://github.com/isc/multiplix">code source</a>
  </p>
  <p>
    Guide généré automatiquement le ${generatedAt} ·
    Régénérable en local avec <code>npm run user-guide</code>.
  </p>
</footer>
</body>
</html>`;
}

// --- Main -------------------------------------------------------------------

async function main() {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    console.error('ERROR: dist/index.html not found. Run `npm run build` first.');
    process.exit(1);
  }

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(SHOTS_DIR, { recursive: true });

  const server = startPreviewServer();
  const cleanup = () => {
    if (!server.killed) server.kill('SIGTERM');
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  try {
    await waitForUrl(BASE_URL);

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
    });
    const page = await context.newPage();

    // Fail fast on unexpected page errors.
    page.on('pageerror', (err) => log('PAGE ERROR:', err.message));

    await captureWelcomeScreens(page);
    await captureHome(page);
    await captureNavScreen(page, NAV_SCREENS[0]); // Mon image
    await captureBadgesScreen(page);
    await captureNavScreen(page, NAV_SCREENS[1]); // Règles
    await captureParentDashboard(page);
    await captureSessionScreens(page);
    await captureRecap(page);

    await browser.close();

    const html = buildHtml({
      generatedAt: new Date().toISOString().slice(0, 10),
    });
    await writeFile(join(OUT_DIR, 'index.html'), html);
    log(`wrote ${join(OUT_DIR, 'index.html')}`);
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
