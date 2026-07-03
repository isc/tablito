// Sonde de diagnostic du viewport (scroll parasite Android après reload).
// Activable par ?layoutdebug=1 (cf. debugFlag) : overlay en HAUT de l'écran
// (pour ne pas masquer le bas, la zone suspecte) affichant en direct les
// hauteurs vues par le navigateur, + journal des changements horodatés et
// bouton « Copier ». Flag éteint : no-op total.
//
// Ce qu'on mesure et pourquoi :
//  - innerHeight / visualViewport : la fenêtre réellement visible ;
//  - scrollHeight de <html> et hauteur de #root : d'où vient le débordement ;
//  - 100vh/dvh/svh/lvh en px (via des divs sondes) : ce que le CSS obtient —
//    c'est l'écart entre dvh et innerHeight qui trahirait l'edge-to-edge
//    Chrome 135+ (contenu étendu sous la barre gestuelle) ;
//  - env(safe-area-inset-top/bottom) : les insets que le navigateur expose ;
//  - screen.height/availHeight + display-mode standalone : le contexte.

import { createDebugOverlay, readDebugFlag } from './debugTools';
import { isStandalone } from './install';

const enabled = readDebugFlag('layoutdebug', 'multiplix-layout-debug');
const entries: string[] = [];
const MAX_ENTRIES = 200;

function makeProbe(height: string, padding?: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText =
    `position:fixed;top:0;left:0;width:1px;height:${height};`
    + `${padding ? `padding:${padding};` : ''}visibility:hidden;pointer-events:none;`;
  document.body.append(el);
  return el;
}

export function initLayoutDebug(): void {
  if (!enabled) return;

  const probes = {
    // 100vh ≡ 100lvh sur tout moteur moderne : pas de probe vh séparée.
    dvh: makeProbe('100dvh'),
    svh: makeProbe('100svh'),
    lvh: makeProbe('100lvh'),
    safe: makeProbe('0', 'env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0'),
  };
  // Déclaration live : obtenue une fois, lue à chaque snapshot.
  const safeStyle = getComputedStyle(probes.safe);
  const standalone = isStandalone() ? 1 : 0;

  const snapshot = (): string => {
    const vv = window.visualViewport;
    const root = document.getElementById('root');
    return [
      `in=${window.innerWidth}x${window.innerHeight}`,
      `vv=${Math.round(vv?.height ?? -1)}+${Math.round(vv?.offsetTop ?? 0)}`,
      `doc=${document.documentElement.scrollHeight}`,
      `root=${Math.round(root?.getBoundingClientRect().height ?? -1)}`,
      `y=${Math.round(window.scrollY)}`,
      `dvh=${probes.dvh.offsetHeight}`,
      `svh=${probes.svh.offsetHeight}`,
      `lvh=${probes.lvh.offsetHeight}`,
      `sat=${safeStyle.paddingTop}`,
      `sab=${safeStyle.paddingBottom}`,
      `screen=${window.screen.height}/${window.screen.availHeight}`,
      `std=${standalone}`,
    ].join(' ');
  };

  const logEl = createDebugOverlay({
    copyLabel: 'Copier le journal layout',
    copyText: () => entries.join('\n'),
    position: 'top',
  });
  let last = '';
  const record = (reason: string) => {
    const snap = snapshot();
    if (snap === last) return;
    last = snap;
    const line = `${new Date().toISOString().slice(11, 23)} [${reason}] ${snap}`;
    entries.push(line);
    if (entries.length > MAX_ENTRIES) entries.shift();
    logEl.textContent = entries.slice(-8).join('\n');
  };

  // Les mesures forcent un reflow (offsetHeight/getBoundingClientRect) : sur
  // les rafales de scroll, coalescer à un snapshot par frame pour ne pas
  // perturber le défilement qu'on cherche justement à observer.
  let rafPending = false;
  const recordOnFrame = (reason: string) => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      record(reason);
    });
  };

  record('init');
  window.addEventListener('resize', () => record('resize'));
  window.addEventListener('scroll', () => recordOnFrame('scroll'), { passive: true });
  window.visualViewport?.addEventListener('resize', () => record('vv-resize'));
  window.visualViewport?.addEventListener('scroll', () => recordOnFrame('vv-scroll'));
  // Filet : certains ajustements d'insets Android n'émettent aucun événement.
  setInterval(() => {
    if (!document.hidden) record('tick');
  }, 1000);
}
