// Offline and installability checks.
//   node tests/offline.mjs [baseUrl]
import { chromium } from 'playwright';
const BASE = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const foreign = [];
page.on('request', (r) => {
  if (!r.url().startsWith(new URL(BASE).origin) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) foreign.push(r.url());
});

await page.goto(BASE);
await page.waitForSelector('.book-tile');
const swReady = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return !!reg.active;
});
check('service worker installs', swReady);
// Wait until the precache is filled.
await page.waitForFunction(async () => {
  const keys = await caches.keys();
  for (const k of keys) if (k.startsWith('shell-')) return (await (await caches.open(k)).keys()).length > 40;
  return false;
}, null, { timeout: 30000 });

const cdp = await ctx.newCDPSession(page);
const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
check('PWA is installable', installabilityErrors.length === 0, JSON.stringify(installabilityErrors));
const manifest = await cdp.send('Page.getAppManifest');
check('manifest is valid', !manifest.errors.length, JSON.stringify(manifest.errors));

// Open one page while online so it is kept for later.
await page.goto(`${BASE}?e2e#/book/blocky-builders/page01`);
await page.waitForFunction(() => window.__wc && !document.querySelector('.stage-msg'), null, { timeout: 30000 });
await page.waitForTimeout(500);

await ctx.setOffline(true);
await page.goto(BASE);
await page.waitForSelector('.book-tile img', { timeout: 10000 });
const coverOk = await page.evaluate(() => document.querySelector('.book-tile img').naturalWidth > 0);
check('offline: home and cover load', coverOk);
await page.goto(`${BASE}#/book/blocky-builders`);
await page.waitForSelector('.page-tile img');
await page.waitForTimeout(800);
const thumbs = await page.evaluate(() => [...document.querySelectorAll('.page-tile img')].filter((i) => i.complete && i.naturalWidth > 0).length);
check('offline: picker thumbnails load', thumbs === 30, `${thumbs}/30`);
await page.goto(`${BASE}?e2e#/book/blocky-builders/page01`);
const opened = await page
  .waitForFunction(() => window.__wc && !document.querySelector('.stage-msg'), null, { timeout: 15000 })
  .then(() => true, () => false);
check('offline: a page opened before still works', opened);
await page.goto(`${BASE}#/grown-ups`);
await page.waitForSelector('.gu-body');
check('offline: grown-ups page works', true);
await ctx.setOffline(false);
check('no requests to other sites', foreign.length === 0, foreign.join(' '));
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
