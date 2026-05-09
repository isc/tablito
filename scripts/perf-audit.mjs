// Perf audit for Multiplix — emulates a mid-tier mobile (4× CPU throttling, Slow 4G).
// Captures: navigation timing, paint timing, Web Vitals, resource breakdown,
// JS+CSS coverage (% unused).

import { chromium } from 'playwright';

const URL = process.env.TARGET || 'http://localhost:5175/';

function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}
function fmtMs(ms) { return `${Math.round(ms)} ms`; }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone 14 portrait
  deviceScaleFactor: 3,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();

// CDP: throttle CPU + network to mobile baseline.
const client = await ctx.newCDPSession(page);
await client.send('Network.emulateNetworkConditions', {
  offline: false,
  // "Slow 4G" preset used by Lighthouse Mobile
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});
await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

// Coverage (which bytes of JS/CSS were actually executed/used).
await page.coverage.startJSCoverage({ resetOnNavigation: true, reportAnonymousScripts: false });
await page.coverage.startCSSCoverage({ resetOnNavigation: true });

// Resource log via Playwright API.
await client.send('Network.enable');
const resources = [];
page.on('response', async (response) => {
  try {
    const req = response.request();
    const sizes = await response
      .request()
      .sizes()
      .catch(() => null);
    let bytes = sizes?.responseBodySize ?? 0;
    if (!bytes) {
      const buf = await response.body().catch(() => null);
      bytes = buf ? buf.length : 0;
    }
    resources.push({
      url: response.url(),
      type: req.resourceType(),
      mime: (response.headers()['content-type'] || '').split(';')[0],
      status: response.status(),
      encodedDataLength: bytes,
    });
  } catch {}
});

// Inject Web Vitals collector before any script runs.
await page.addInitScript(() => {
  window.__vitals = { lcp: 0, cls: 0, fid: 0, inp: 0, longTasks: [] };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__vitals.lcp = e.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (!e.hadRecentInput) window.__vitals.cls += e.value;
    }
  }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      window.__vitals.longTasks.push({ duration: e.duration, start: e.startTime });
    }
  }).observe({ type: 'longtask', buffered: true });
});

const t0 = Date.now();
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
// Let LCP and any deferred work settle.
await page.waitForTimeout(1500);
const wallTime = Date.now() - t0;

// Pull metrics from page.
const navTiming = await page.evaluate(() => {
  const [n] = performance.getEntriesByType('navigation');
  const paints = Object.fromEntries(
    performance.getEntriesByType('paint').map((p) => [p.name, p.startTime])
  );
  return {
    fetchStart: n.fetchStart,
    domContentLoaded: n.domContentLoadedEventEnd,
    loadEvent: n.loadEventEnd,
    transferSize: n.transferSize,
    decodedBodySize: n.decodedBodySize,
    fcp: paints['first-contentful-paint'] || 0,
    fp: paints['first-paint'] || 0,
  };
});
const vitals = await page.evaluate(() => window.__vitals);

const jsCov = await page.coverage.stopJSCoverage();
const cssCov = await page.coverage.stopCSSCoverage();

// Compute used vs total per file from coverage ranges.
function summarizeCoverage(cov) {
  return cov
    .map((entry) => {
      const text = entry.source ?? entry.text ?? '';
      const total = text.length;
      let used = 0;
      if (entry.ranges) {
        // CSS coverage: { start, end }
        for (const r of entry.ranges) used += r.end - r.start;
      } else if (entry.functions) {
        // V8 coverage: ranges are nested parent-before-child. A child with count=0
        // shadows its parent, even if the parent had count>0. So iterate in order
        // and let later (more specific) ranges overwrite.
        const flags = new Int8Array(total).fill(-1); // -1 unknown, 0 uncovered, 1 covered
        for (const fn of entry.functions) {
          for (const r of fn.ranges) {
            const v = r.count > 0 ? 1 : 0;
            const end = Math.min(r.endOffset, total);
            for (let i = r.startOffset; i < end; i++) flags[i] = v;
          }
        }
        for (let i = 0; i < total; i++) if (flags[i] === 1) used++;
      }
      return { url: entry.url, total, used, unused: Math.max(0, total - used) };
    })
    .filter((e) => e.total > 0);
}
const jsSummary = summarizeCoverage(jsCov);
const cssSummary = summarizeCoverage(cssCov);

await browser.close();

// --- Report -----------------------------------------------------------------
const groupBy = (arr, fn) => arr.reduce((m, x) => ((m[fn(x)] ||= []).push(x), m), {});
const sum = (arr, fn) => arr.reduce((a, x) => a + fn(x), 0);

const byType = groupBy(resources, (r) => r.type);
console.log('\n=== RESOURCE BREAKDOWN (encoded transfer) ===');
const types = Object.keys(byType).sort(
  (a, b) => sum(byType[b], (r) => r.encodedDataLength) - sum(byType[a], (r) => r.encodedDataLength)
);
for (const t of types) {
  const arr = byType[t];
  const tot = sum(arr, (r) => r.encodedDataLength);
  console.log(`  ${t.padEnd(12)} ${String(arr.length).padStart(3)} req  ${fmtBytes(tot).padStart(10)}`);
}
const grandTotal = sum(resources, (r) => r.encodedDataLength);
console.log(`  ${'TOTAL'.padEnd(12)} ${String(resources.length).padStart(3)} req  ${fmtBytes(grandTotal).padStart(10)}`);

console.log('\n=== TOP 15 RESOURCES BY SIZE ===');
const top = [...resources].sort((a, b) => b.encodedDataLength - a.encodedDataLength).slice(0, 15);
for (const r of top) {
  console.log(`  ${fmtBytes(r.encodedDataLength).padStart(10)}  ${r.type.padEnd(10)}  ${r.url.replace(URL, '/')}`);
}

console.log('\n=== TIMING (cold load, Slow 4G + 4× CPU throttle) ===');
console.log(`  First Paint:               ${fmtMs(navTiming.fp)}`);
console.log(`  First Contentful Paint:    ${fmtMs(navTiming.fcp)}`);
console.log(`  Largest Contentful Paint:  ${fmtMs(vitals.lcp)}`);
console.log(`  DOMContentLoaded:          ${fmtMs(navTiming.domContentLoaded)}`);
console.log(`  load event:                ${fmtMs(navTiming.loadEvent)}`);
console.log(`  Cumulative Layout Shift:   ${vitals.cls.toFixed(3)}`);
console.log(`  Long tasks (>50ms):        ${vitals.longTasks.length} (total ${fmtMs(vitals.longTasks.reduce((a, t) => a + t.duration, 0))})`);
console.log(`  Wall time to networkidle:  ${fmtMs(wallTime)}`);

console.log('\n=== JS COVERAGE (used vs unused at idle on home screen) ===');
const jsTotal = sum(jsSummary, (e) => e.total);
const jsUsed = sum(jsSummary, (e) => e.used);
console.log(`  Total JS loaded:           ${fmtBytes(jsTotal)}`);
console.log(`  Used:                      ${fmtBytes(jsUsed)}  (${((jsUsed / jsTotal) * 100).toFixed(1)}%)`);
console.log(`  Unused:                    ${fmtBytes(jsTotal - jsUsed)}  (${(((jsTotal - jsUsed) / jsTotal) * 100).toFixed(1)}%)`);
console.log('\n  Top 10 JS files with most unused bytes:');
const worstJs = [...jsSummary].sort((a, b) => b.unused - a.unused).slice(0, 10);
for (const e of worstJs) {
  const pct = e.total ? ((e.unused / e.total) * 100).toFixed(0) : 0;
  console.log(`    ${fmtBytes(e.unused).padStart(10)}  unused (${pct}%)  ${e.url.replace(URL, '/')}`);
}

console.log('\n=== CSS COVERAGE ===');
const cssTotal = sum(cssSummary, (e) => e.total);
const cssUsed = sum(cssSummary, (e) => e.used);
console.log(`  Total CSS loaded:          ${fmtBytes(cssTotal)}`);
console.log(`  Used:                      ${fmtBytes(cssUsed)}  (${((cssUsed / cssTotal) * 100).toFixed(1)}%)`);
console.log(`  Unused:                    ${fmtBytes(cssTotal - cssUsed)}  (${(((cssTotal - cssUsed) / cssTotal) * 100).toFixed(1)}%)`);
console.log('\n  Top 10 CSS files with most unused bytes:');
const worstCss = [...cssSummary].sort((a, b) => b.unused - a.unused).slice(0, 10);
for (const e of worstCss) {
  const pct = e.total ? ((e.unused / e.total) * 100).toFixed(0) : 0;
  console.log(`    ${fmtBytes(e.unused).padStart(10)}  unused (${pct}%)  ${e.url.replace(URL, '/')}`);
}
