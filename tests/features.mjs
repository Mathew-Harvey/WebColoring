// Feature checks: audio unlock, haptics, store card, hold-to-open, backup, clear, print, patterns.
//   node tests/features.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
const BOOKS = JSON.parse(fs.readFileSync(new URL('../public/books/index.json', import.meta.url), 'utf8')).books.length;
const OUT = 'debug/features';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const STORE = 'https://www.amazon.com/dp/EXAMPLE';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
await ctx.addInitScript(() => {
  window.__audio = 0;
  window.__vibrate = [];
  const AC = window.AudioContext;
  window.AudioContext = class extends AC {
    constructor(...a) {
      super(...a);
      window.__audio++;
    }
  };
  navigator.vibrate = (p) => (window.__vibrate.push(p), true);
  window.open = (url) => ((window.__opened = url), null);
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// Audio starts only after the first tap.
await page.goto(`${BASE}?e2e#/book/blocky-builders/page05`);
await page.waitForFunction(() => window.__wc && !document.querySelector('.stage-msg'));
check('audio: nothing starts before the first tap', (await page.evaluate(() => window.__audio)) === 0);
await page.click('.rail-tools button[aria-label="Fill"]');
check('audio: starts after the first tap', (await page.evaluate(() => window.__audio)) === 1);
const t = await page.evaluate(() => window.__wc.cbnTargets().sort((a, b) => b.r - a.r)[0]);
const pos = await page.evaluate(([x, y]) => {
  const [sx, sy] = window.__wc.view.toScreen(x, y);
  const r = document.querySelector('.paper').getBoundingClientRect();
  return [r.left + sx, r.top + sy];
}, [t.x, t.y]);
await page.mouse.click(pos[0], pos[1]);
await page.waitForTimeout(400);
check('haptics: a fill gives a little buzz', (await page.evaluate(() => window.__vibrate.length)) > 0);
// Every brush makes its sound without errors.
for (const tool of ['Crayon', 'Marker', 'Pencil', 'Brush', 'Water', 'Spray', 'Glitter', 'Rainbow', 'Neon', 'Stamp', 'Eraser']) {
  await page.click(`.rail-tools button[aria-label="${tool}"]`);
  await page.mouse.move(pos[0], pos[1]);
  await page.mouse.down();
  await page.mouse.move(pos[0] + 40, pos[1] + 10, { steps: 6 });
  await page.mouse.up();
}
await page.evaluate(() => window.__wc.undo());
await page.waitForTimeout(2000);
check('audio: all tool sounds run without errors', errors.length === 0, errors.join(' | '));

// Sound and haptics settings are saved.
await page.goto(`${BASE}#/grown-ups`);
await page.waitForSelector('.gu-body');
await page.click('text=Sound');
await page.reload();
await page.waitForSelector('.gu-body');
const soundOff = await page.evaluate(() => !document.querySelector('input[role=switch]').checked);
check('settings: sound toggle is remembered', soundOff);
await page.click('text=Sound');

// Colour-blind shapes.
await page.click('text=Show shapes');
await page.goto(`${BASE}?e2e#/book/blocky-builders/page13`);
await page.waitForFunction(() => window.__wc && !document.querySelector('.stage-msg'));
await page.waitForTimeout(300);
check('patterns: swatches show shapes', (await page.locator('.num-symbol').count()) > 0);
await page.evaluate(() => {
  window.__wc.zoomBy(2.2);
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/patterns.png` });
await page.goto(`${BASE}#/grown-ups`);
await page.click('text=Show shapes');

// Backup export and import, then clear.
await page.goto(`${BASE}#/grown-ups`);
await page.waitForSelector('.gu-body');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Backup my art')]);
const file = `${OUT}/backup.zip`;
await download.saveAs(file);
check('backup: downloads a zip', fs.statSync(file).size > 1000, `${fs.statSync(file).size} bytes`);
page.once('dialog', (d) => d.accept());
await page.click('text=Clear all saved art');
await page.waitForSelector('text=All saved art removed.');
const left = await page.evaluate(
  () => new Promise((res) => {
    const q = indexedDB.open('webcoloring');
    q.onsuccess = () => {
      const r = q.result.transaction('pages').objectStore('pages').count();
      r.onsuccess = () => res(r.result);
    };
  }),
);
check('clear: removes all saved art', left === 0, `${left} left`);
await page.setInputFiles('input[type=file]', file);
await page.waitForSelector('text=/Restored \\d+ picture/');
const restored = await page.textContent('.gu-msg');
check('backup: restores from the file', /Restored [1-9]/.test(restored), restored);

// Hold-to-open the grown-ups area.
await page.goto(BASE);
await page.waitForSelector('.hold');
// With several books the button can sit below the fold.
await page.locator('.home-foot .hold').scrollIntoViewIfNeeded();
const box = await page.locator('.home-foot .hold').boundingBox();
await page.mouse.move(box.x + 20, box.y + 20);
await page.mouse.down();
await page.waitForTimeout(400);
await page.mouse.up();
check('hold-to-open: a quick tap does not open', !page.url().includes('grown-ups'));
await page.mouse.down();
await page.waitForTimeout(1800);
await page.mouse.up();
await page.waitForTimeout(200);
check('hold-to-open: holding opens the grown-ups page', page.url().includes('grown-ups'));

// Store card appears only when storeUrl is set. A fresh context without the service
// worker, so the faked book data is not served from the cache.
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
await ctx2.addInitScript(() => {
  window.open = (url) => ((window.__opened = url), null);
});
const page2 = await ctx2.newPage();
page2.on('pageerror', (e) => errors.push(e.message));
await page2.route('**/books/index.json', async (route) => {
  const res = await route.fetch();
  const json = await res.json();
  json.books.forEach((b) => (b.storeUrl = STORE));
  route.fulfill({ response: res, json });
});
await page2.route('**/books/blocky-builders/book.json', async (route) => {
  const res = await route.fetch();
  const json = await res.json();
  json.storeUrl = STORE;
  route.fulfill({ response: res, json });
});
await page2.goto(`${BASE}?store#/`);
await page2.waitForSelector('.paper-banner');
// The shelf built into the page draws first; the (faked) index.json then brings the store links.
const onSale = await page2.waitForFunction(() => !document.querySelector('.paper-banner .soon-pill'), null, { timeout: 5000 }).then(() => true, () => false);
check('store: home banner drops "Coming soon" once books are on sale', onSale);
await page2.goto(`${BASE}?store#/paper`);
await page2.waitForSelector('.paper-card .hold-buy');
check('store: paper books page has a buy button per book', (await page2.locator('.paper-card .hold-buy').count()) === BOOKS);
check('store: no "Coming soon" sticker once on sale', (await page2.locator('.soon-ribbon').count()) === 0);
await page2.screenshot({ path: `${OUT}/paper-store.png`, fullPage: true });
const hold = await page2.locator('.paper-card .hold-buy').first().boundingBox();
await page2.mouse.move(hold.x + 20, hold.y + 20);
await page2.mouse.down();
await page2.waitForTimeout(300);
await page2.mouse.up();
check('store: a quick tap does not open the store', (await page2.evaluate(() => window.__opened ?? null)) === null);
await page2.mouse.down();
await page2.waitForTimeout(1800);
await page2.mouse.up();
check('store: holding the button opens the store link', (await page2.evaluate(() => window.__opened)) === STORE);
await page2.goto(`${BASE}?store#/book/blocky-builders`);
await page2.waitForSelector('.paper-picker .hold-buy');
check('store: picker shows the paperback card with a buy button', true);
await page2.goto(`${BASE}?store&e2e#/book/blocky-builders/page05/done`);
await page2.waitForSelector('.finished .paper-finished');
check('store: finished screen links to the paper book', (await page2.getAttribute('.paper-finished', 'href')) === '#/paper/blocky-builders');
await page2.screenshot({ path: `${OUT}/finished-store.png` });
await page2.goto(`${BASE}?store#/grown-ups`);
await page2.waitForSelector('.gu-paper .btn-buy');
check('store: grown-ups area links straight to the store', (await page2.locator(`.gu-paper a.btn-buy[href="${STORE}"]`).count()) === BOOKS);

// Print layout fits one landscape A4 and US Letter page.
await page.goto(`${BASE}?e2e#/book/blocky-builders/page05`);
await page.waitForFunction(() => window.__wc && !document.querySelector('.stage-msg'));
await page.evaluate(async () => {
  const c = window.__wc.composite();
  const url = c.toDataURL('image/png');
  const root = document.createElement('div');
  root.id = 'print-root';
  const img = new Image();
  img.src = url;
  root.appendChild(img);
  document.body.appendChild(root);
  await img.decode();
});
for (const format of ['A4', 'Letter']) {
  const pdf = await page.pdf({ format, printBackground: true, preferCSSPageSize: true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  fs.writeFileSync(`${OUT}/print-${format}.pdf`, pdf);
  check(`print: fits on one ${format} page`, pages === 1, `${pages} page(s)`);
}

// Reduced motion: fills land at once, no confetti, no pulsing.
const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
const page3 = await ctx3.newPage();
await page3.goto(`${BASE}?e2e#/book/blocky-builders/page05`);
await page3.waitForFunction(() => window.__wc && !document.querySelector('.stage-msg'));
await page3.click('.rail-tools button[aria-label="Fill"]');
const big = await page3.evaluate(() => window.__wc.cbnTargets().sort((a, b) => b.r - a.r)[0]);
const at = await page3.evaluate(([x, y]) => {
  const [sx, sy] = window.__wc.view.toScreen(x, y);
  const r = document.querySelector('.paper').getBoundingClientRect();
  return [r.left + sx, r.top + sy];
}, [big.x, big.y]);
await page3.mouse.click(at[0], at[1]);
const instant = await page3.evaluate((id) => window.__wc.paintCoverage(id).inside, big.id);
check('reduced motion: fill appears at once', instant > 1000, `${instant}`);
await page3.goto(`${BASE}?e2e#/book/blocky-builders/page05/done`);
await page3.waitForSelector('.finished');
check('reduced motion: no confetti', (await page3.locator('.confetti').count()) === 0);
await ctx3.close();

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
