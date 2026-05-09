// Compare la perf entre deux git refs.
//
// - Build chaque ref dans une worktree git séparée (pour ne pas toucher
//   à l'arbre de travail courant).
// - Sert chacun sur un port différent.
// - Lighthouse mobile (3 runs, médiane) → score normalisé + métriques.
// - Playwright avec contexte persistant → mesure 1re visite (SW vide)
//   PUIS 2e visite (SW chaud) sur le même contexte.
// - Affiche un tableau side-by-side.
//
// Usage : node scripts/perf-compare.mjs <baseline-ref> [candidate-ref=HEAD]
// Ex.   : node scripts/perf-compare.mjs HEAD~1
//         node scripts/perf-compare.mjs 270fc9d 67f65c5

import { execSync, spawn } from 'node:child_process'
import { existsSync, rmSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from 'playwright'

const ROOT = path.resolve(import.meta.dirname, '..')
const baselineRef = process.argv[2]
const candidateRef = process.argv[3] || 'HEAD'
if (!baselineRef) {
  console.error('Usage: node scripts/perf-compare.mjs <baseline-ref> [candidate-ref=HEAD]')
  process.exit(1)
}

function sh(cmd, cwd = ROOT) {
  return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim()
}

function shortRef(r) { return sh(`git rev-parse --short ${r}`) }
const baselineSha = shortRef(baselineRef)
const candidateSha = shortRef(candidateRef)

const BASELINE_WT = path.join('/tmp', `mplx-perf-${baselineSha}`)
const CANDIDATE_WT = path.join('/tmp', `mplx-perf-${candidateSha}`)
const BASELINE_PORT = 5190
const CANDIDATE_PORT = 5191

function setupWorktree(wt, ref) {
  // Force-remove any prior worktree at the same path. Quiet on no-match.
  try { execSync(`git worktree remove --force ${wt}`, { cwd: ROOT, stdio: 'ignore' }) } catch {}
  if (existsSync(wt)) rmSync(wt, { recursive: true, force: true })
  sh(`git worktree add --detach ${wt} ${ref}`)
  const nm = path.join(wt, 'node_modules')
  if (!existsSync(nm)) sh(`ln -s ${path.join(ROOT, 'node_modules')} ${nm}`)
  console.log(`[setup] ${ref} (${shortRef(ref)}) → ${wt}`)
}

function build(wt) {
  console.log(`[build] ${path.basename(wt)}…`)
  execSync('npm run build', { cwd: wt, stdio: ['ignore', 'pipe', 'pipe'] })
}

function serve(wt, port) {
  const child = spawn('node', ['scripts/preview.mjs'], {
    cwd: wt,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  // Drain stdout/stderr so the buffer doesn't fill.
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  return child
}

async function waitForServer(port, timeoutMs = 5000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/`)
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Server on port ${port} did not respond in ${timeoutMs}ms`)
}

// --- Lighthouse run -------------------------------------------------------
async function runLighthouse(url) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox'],
  })
  // Le trace engine de Lighthouse 13 lance des LanternError NO_LCP en
  // stderr sur certaines runs (non-fatales — il fallback proprement).
  // On les avale pour garder l'output lisible.
  const origErr = process.stderr.write.bind(process.stderr)
  process.stderr.write = (chunk, ...a) => {
    const s = typeof chunk === 'string' ? chunk : chunk.toString()
    if (s.includes('LanternError') || s.includes('@paulirish/trace_engine')) return true
    return origErr(chunk, ...a)
  }
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75 },
      throttling: {
        rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4,
        requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0,
      },
      throttlingMethod: 'simulate',
      onlyCategories: ['performance'],
      logLevel: 'silent',
    })
    const r = JSON.parse(result.report)
    return {
      score: r.categories.performance.score,
      fcp: r.audits['first-contentful-paint'].numericValue,
      lcp: r.audits['largest-contentful-paint'].numericValue,
      tbt: r.audits['total-blocking-time'].numericValue,
      cls: r.audits['cumulative-layout-shift'].numericValue,
      si: r.audits['speed-index'].numericValue,
      tti: r.audits['interactive']?.numericValue ?? 0,
    }
  } finally {
    process.stderr.write = origErr
    await chrome.kill()
  }
}

async function runLighthouseMedian(url, runs = 3) {
  const results = []
  for (let i = 0; i < runs; i++) {
    process.stdout.write(`  lighthouse run ${i + 1}/${runs}… `)
    const r = await runLighthouse(url)
    console.log(`score ${(r.score * 100).toFixed(0)}, lcp ${Math.round(r.lcp)}ms`)
    results.push(r)
  }
  // Médiane par métrique (chaque métrique indépendamment).
  const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const keys = Object.keys(results[0])
  const out = {}
  for (const k of keys) out[k] = median(results.map((r) => r[k]))
  return out
}

// --- Warm-SW (PWA installée) measurement ----------------------------------
// 1re visite → installe le SW. 2e visite → mesure (doit hit le précache).
async function runWarmSW(url, port) {
  const userDataDir = `/tmp/mplx-perf-userdata-${port}-${Date.now()}`
  mkdirSync(userDataDir, { recursive: true })
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 390, height: 844 },
  })
  try {
    const client = await ctx.newCDPSession(await ctx.newPage())
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })

    // Visit 1: install SW.
    const p1 = ctx.pages()[0]
    await p1.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    // Wait for the SW to be active.
    await p1.waitForFunction(
      () => navigator.serviceWorker?.controller != null,
      { timeout: 10000 },
    ).catch(() => {})
    await p1.close()

    // Visit 2: measure.
    const p2 = await ctx.newPage()
    const client2 = await ctx.newCDPSession(p2)
    await client2.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
    await client2.send('Emulation.setCPUThrottlingRate', { rate: 4 })

    await p2.addInitScript(() => {
      window.__vitals = { lcp: 0, cls: 0 }
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__vitals.lcp = e.startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          if (!e.hadRecentInput) window.__vitals.cls += e.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })

    const t0 = Date.now()
    await p2.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    // Laisse l'observateur LCP se résoudre (il fire au plus tard à la
    // 1re interaction ou au 1er scroll ; sinon il faut un peu de temps).
    await p2.waitForTimeout(2000)
    const wallTime = Date.now() - t0

    const nav = await p2.evaluate(() => {
      const [n] = performance.getEntriesByType('navigation')
      const paints = Object.fromEntries(
        performance.getEntriesByType('paint').map((p) => [p.name, p.startTime]),
      )
      // transferSize = bytes effectivement transmis sur le réseau
      // (= 0 pour les ressources servies par le SW depuis cache).
      const networkBytes = performance
        .getEntriesByType('resource')
        .reduce((s, r) => s + (r.transferSize || 0), 0)
      return {
        fcp: paints['first-contentful-paint'] || 0,
        domContentLoaded: n.domContentLoadedEventEnd,
        loadEvent: n.loadEventEnd,
        networkBytes,
      }
    })
    const vitals = await p2.evaluate(() => window.__vitals)

    return {
      fcp: nav.fcp,
      lcp: vitals.lcp,
      cls: vitals.cls,
      dcl: nav.domContentLoaded,
      load: nav.loadEvent,
      networkBytes: nav.networkBytes,
      wallTime,
    }
  } finally {
    await ctx.close()
    rmSync(userDataDir, { recursive: true, force: true })
  }
}

// --- Driver ---------------------------------------------------------------
setupWorktree(BASELINE_WT, baselineRef)
setupWorktree(CANDIDATE_WT, candidateRef)
build(BASELINE_WT)
build(CANDIDATE_WT)

const baselineServer = serve(BASELINE_WT, BASELINE_PORT)
const candidateServer = serve(CANDIDATE_WT, CANDIDATE_PORT)
await waitForServer(BASELINE_PORT)
await waitForServer(CANDIDATE_PORT)
console.log(`[serve] baseline on :${BASELINE_PORT}, candidate on :${CANDIDATE_PORT}`)

let baselineLh, candidateLh, baselineWarm, candidateWarm
try {
  console.log(`\n=== LIGHTHOUSE — baseline (${baselineSha}) ===`)
  baselineLh = await runLighthouseMedian(`http://localhost:${BASELINE_PORT}/`)
  console.log(`\n=== LIGHTHOUSE — candidate (${candidateSha}) ===`)
  candidateLh = await runLighthouseMedian(`http://localhost:${CANDIDATE_PORT}/`)

  console.log(`\n=== WARM-SW — baseline ===`)
  baselineWarm = await runWarmSW(`http://localhost:${BASELINE_PORT}/`, BASELINE_PORT)
  console.log(`  fcp ${Math.round(baselineWarm.fcp)}ms, lcp ${Math.round(baselineWarm.lcp)}ms, ${(baselineWarm.networkBytes / 1024).toFixed(0)}KB`)

  console.log(`\n=== WARM-SW — candidate ===`)
  candidateWarm = await runWarmSW(`http://localhost:${CANDIDATE_PORT}/`, CANDIDATE_PORT)
  console.log(`  fcp ${Math.round(candidateWarm.fcp)}ms, lcp ${Math.round(candidateWarm.lcp)}ms, ${(candidateWarm.networkBytes / 1024).toFixed(0)}KB`)
} finally {
  baselineServer.kill('SIGTERM')
  candidateServer.kill('SIGTERM')
  // Cleanup worktrees pour ne pas laisser traîner des refs détachées.
  try { execSync(`git worktree remove --force ${BASELINE_WT}`, { cwd: ROOT, stdio: 'ignore' }) } catch {}
  try { execSync(`git worktree remove --force ${CANDIDATE_WT}`, { cwd: ROOT, stdio: 'ignore' }) } catch {}
}

// --- Report ---------------------------------------------------------------
function delta(before, after, unit = 'ms', betterIs = 'lower') {
  const d = after - before
  const pct = before === 0 ? 0 : (d / before) * 100
  const sign = d > 0 ? '+' : ''
  const arrow = (betterIs === 'lower' ? d < 0 : d > 0) ? '↓✓' : (d === 0 ? '·' : '↑✗')
  return `${sign}${d.toFixed(0)}${unit} (${sign}${pct.toFixed(1)}%) ${arrow}`
}

console.log(`\n${'='.repeat(72)}`)
console.log(`PERF COMPARE — ${baselineSha} vs ${candidateSha}`)
console.log('='.repeat(72))
console.log(`\nLighthouse (mobile, simulated throttling, median of 3 runs):\n`)
const lhRows = [
  ['Score',                'score',     1,    '',     'higher'],
  ['First Contentful Paint','fcp',      0,    'ms',   'lower'],
  ['Largest Contentful Paint','lcp',    0,    'ms',   'lower'],
  ['Speed Index',          'si',        0,    'ms',   'lower'],
  ['Total Blocking Time',  'tbt',       0,    'ms',   'lower'],
  ['Time to Interactive',  'tti',       0,    'ms',   'lower'],
  ['Cumulative Layout Shift','cls',     3,    '',     'lower'],
]
for (const [label, key, dec, unit, betterIs] of lhRows) {
  let b = baselineLh[key], c = candidateLh[key]
  if (key === 'score') { b *= 100; c *= 100 }
  const bs = b.toFixed(dec) + unit
  const cs = c.toFixed(dec) + unit
  console.log(`  ${label.padEnd(28)} ${bs.padStart(9)} → ${cs.padStart(9)}  ${delta(b, c, unit, betterIs)}`)
}

console.log(`\nWarm-SW (PWA installée, 2nd cold launch sous SW):\n`)
const wsRows = [
  ['First Contentful Paint','fcp',      'ms', 'lower'],
  ['Largest Contentful Paint','lcp',    'ms', 'lower'],
  ['DOMContentLoaded',     'dcl',       'ms', 'lower'],
  ['load event',           'load',      'ms', 'lower'],
  ['Network bytes',        'networkBytes','B','lower'],
]
for (const [label, key, unit, betterIs] of wsRows) {
  const b = baselineWarm[key], c = candidateWarm[key]
  console.log(`  ${label.padEnd(28)} ${Math.round(b).toString().padStart(9)}${unit} → ${Math.round(c).toString().padStart(9)}${unit}  ${delta(b, c, unit, betterIs)}`)
}
console.log('')
