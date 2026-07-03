// Pilote le vrai Chrome Android de l'émulateur (AVD global `pixel-16`) via le
// support Android expérimental de Playwright (adb + CDP). Boot de l'émulateur,
// prérequis set-debug-app et limites : voir ~/.claude/ANDROID.md. Usage :
//
//   node scripts/android-emu-check.mjs [url]
//
// Par défaut : charge l'URL (tablito.app sinon), mesure le viewport (même
// batterie que la sonde ?layoutdebug=1), recharge, remesure. Sert de
// validation « le bug du jour se voit-il ici ? » et de squelette pour tout
// débogage Android autonome futur.

import { _android } from 'playwright';

const url = process.argv[2] ?? 'https://tablito.app/';

const [device] = await _android.devices();
if (!device) {
  console.error('Aucun appareil adb. Émulateur booté ?');
  process.exit(1);
}
console.log('device:', device.model(), device.serial());

const context = await device.launchBrowser();
const page = await context.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(2000);

const measure = () =>
  page.evaluate(() => {
    const probe = (h) => {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;height:${h};visibility:hidden`;
      document.body.append(el);
      const v = el.offsetHeight;
      el.remove();
      return v;
    };
    return {
      inner: `${window.innerWidth}x${window.innerHeight}`,
      vv: Math.round(window.visualViewport?.height ?? -1),
      doc: document.documentElement.scrollHeight,
      root: Math.round(document.getElementById('root')?.getBoundingClientRect().height ?? -1),
      y: Math.round(window.scrollY),
      dvh: probe('100dvh'),
      svh: probe('100svh'),
      lvh: probe('100lvh'),
      canScroll: document.documentElement.scrollHeight > window.innerHeight,
    };
  });

console.log('avant reload :', await measure());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2000);
console.log('après reload :', await measure());

await context.close();
await device.close();
