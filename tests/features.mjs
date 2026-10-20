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

// The paper books, with the store links from src/data/paperbacks.ts. A fresh context without
// the service worker, with window.open recorded instead of opening a tab.
const { listingFor, paperOnlyBooks, PAPERBACKS } = await import(new URL('../src/data/paperbacks.ts', import.meta.url).href);
const shelf = JSON.parse(fs.readFileSync(new URL('../public/books/index.json', import.meta.url), 'utf8')).books;
const paperOnly = paperOnlyBooks().filter((b) => !shelf.some((s) => s.id === b.id));
const paperBooks = [...shelf, ...paperOnly].sort((x, y) => x.order - y.order);
const onSale = paperBooks.filter((b) => listingFor(b.id));
const soon = paperBooks.filter((b) => !listingFor(b.id));
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
await ctx2.addInitScript(() => {
  window.open = (url) => ((window.__opened = url), null);
});
const page2 = await ctx2.newPage();
page2.on('pageerror', (e) => errors.push(e.message));
await page2.goto(`${BASE}#/`);
await page2.waitForSelector('.paper-banner');
check('store: home banner does not say "Coming soon" while books are on sale', (await page2.locator('.paper-banner .soon-pill').count()) === (onSale.length ? 0 : 1));
await page2.goto(`${BASE}#/paper`);
await page2.waitForSelector('.paper-card');
const buy = page2.locator('.paper-card a.hold-buy');
check('store: a buy button for each book on sale', onSale.length > 0 && (await buy.count()) === onSale.length, `${await buy.count()} of ${onSale.length}`);
const links = await buy.evaluateAll((els) => els.map((a) => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]));
check(
  'store: buy buttons link to each product page in a new tab',
  JSON.stringify(links) === JSON.stringify(onSale.map((b) => [listingFor(b.id).url, '_blank', 'noopener'])),
  JSON.stringify(links),
);
check('store: no tracking or affiliate parameters', links.every(([href]) => !new URL(href).search && !new URL(href).hash));
const prices = await page2.locator('.paper-card .paper-price').allTextContents();
check('store: price and format shown for each book on sale', prices.length === onSale.length && onSale.every((b, i) => prices[i].includes(listingFor(b.id).price)), prices.join(' | '));
check(
  'store: books not on sale say "Coming soon", with the buy button disabled',
  (await page2.locator('.paper-card .soon-ribbon').count()) === soon.length &&
    (await page2.locator('.paper-card button.btn-buy:disabled').count()) === soon.length,
);

// Taken Apart: only on paper, coming soon, with its own landscape cover shown whole.
const ta = PAPERBACKS['taken-apart'];
const taCard = page2.locator('#paper-taken-apart');
const taShelf = shelf.find((b) => b.id === 'taken-apart');
check('taken apart: card on the paper books page', (await taCard.count()) === 1 && (await taCard.locator('.paper-title').textContent()) === 'Taken Apart');
check(
  'taken apart: subtitle, author and blurb',
  (await taCard.locator('.paper-sub').textContent()) === 'Exploded View Coloring Book for Adults: 30 Machines and Gadgets Through Time' &&
    taShelf.subtitle === (await taCard.locator('.paper-sub').textContent()) &&
    (await taCard.locator('.paper-by').textContent()) === 'By Mat Harvey' &&
    (await taCard.locator('.paper-blurb').textContent()) === ta.details.blurb,
);
check('taken apart: price shown as coming soon', (await taCard.locator('.paper-soon').textContent()).includes('Paperback, US$8.99') && (await taCard.locator('.soon-ribbon').count()) === 1);
check('taken apart: buy button disabled and no store link', (await taCard.locator('button.btn-buy').isDisabled()) && (await taCard.locator('a').count()) === 0);
await taCard.locator('img').scrollIntoViewIfNeeded();
await page2.waitForFunction(() => document.querySelector('#paper-taken-apart img').complete && document.querySelector('#paper-taken-apart img').naturalWidth > 0);
const cover = await taCard.locator('img').evaluate((img) => {
  const r = img.getBoundingClientRect();
  return { alt: img.alt, fit: getComputedStyle(img).objectFit, nw: img.naturalWidth, nh: img.naturalHeight, w: r.width, h: r.height, src: img.getAttribute('src') };
});
check('taken apart: cover alt text', cover.alt === ta.details.cover.alt);
check('taken apart: cover shown whole (contain, not cropped)', cover.fit === 'contain' && Math.abs(cover.w / cover.h - cover.nw / cover.nh) < 0.02, `${Math.round(cover.w)}x${Math.round(cover.h)} of ${cover.nw}x${cover.nh}`);
const webCopy = fs.statSync(new URL('../public/books/taken-apart/taken-apart-cover-1200.jpg', import.meta.url)).size;
check('taken apart: page uses the web copy (max 1200 px wide, under 300 KB)', cover.src.endsWith('taken-apart-cover-1200.jpg') && cover.nw <= 1200 && webCopy < 300 * 1024, `${cover.nw} px, ${Math.round(webCopy / 1024)} KB`);
check('taken apart: original kept as taken-apart-cover.jpg', fs.existsSync(new URL('../public/books/taken-apart/taken-apart-cover.jpg', import.meta.url)));
await page2.goto(`${BASE}#/paper/taken-apart`);
await page2.waitForSelector('#paper-taken-apart.is-highlight');
check('taken apart: back from its card goes to its pages', (await page2.getAttribute('.paper-page .round-btn', 'href')) === '#/book/taken-apart');
await page2.goto(`${BASE}#/`);
await page2.waitForSelector('a.book-tile');
const tiles = await page2.locator('a.book-tile').evaluateAll((els) => els.map((a) => a.getAttribute('href')));
check('taken apart: on the shelf, beside Still Water Mandalas', tiles.indexOf('#/book/taken-apart') === tiles.indexOf('#/book/still-water-mandalas') + 1, tiles.join(' '));
const pair = await page2.evaluate(() => ['still-water-mandalas', 'taken-apart'].map((id) => Math.round(document.querySelector(`a.book-tile[href="#/book/${id}"]`).getBoundingClientRect().top)));
check('taken apart: same row as Still Water Mandalas on a wide screen', pair[0] === pair[1], pair.join(' '));
await page2.goto(`${BASE}#/book/taken-apart`);
await page2.waitForSelector('.page-tile img');
check('taken apart: picker lists 30 pages', (await page2.locator('.page-tile').count()) === 30);
check('taken apart: picker card offers the paperback as coming soon', (await page2.locator('.paper-picker button.btn-buy:disabled').count()) === 1 && (await page2.getAttribute('.paper-picker img', 'alt')) === ta.details.cover.alt);
await page2.goto(`${BASE}#/paper`);
await page2.waitForSelector('.paper-card a.hold-buy');
await page2.screenshot({ path: `${OUT}/paper-store.png`, fullPage: true });
await buy.first().scrollIntoViewIfNeeded();
const hold = await buy.first().boundingBox();
await page2.mouse.move(hold.x + 20, hold.y + 20);
await page2.mouse.down();
await page2.waitForTimeout(300);
await page2.mouse.up();
await page2.waitForTimeout(300);
check('store: a quick tap does not open the store', (await page2.evaluate(() => window.__opened ?? null)) === null && ctx2.pages().length === 1);
await page2.mouse.down();
await page2.waitForTimeout(1800);
await page2.mouse.up();
check('store: holding the button opens the product page', (await page2.evaluate(() => window.__opened)) === listingFor(onSale[0].id).url);
await page2.goto(`${BASE}#/book/${onSale[0].id}`);
await page2.waitForSelector('.paper-picker a.hold-buy');
check('store: picker card links to the product page', (await page2.getAttribute('.paper-picker a.hold-buy', 'href')) === listingFor(onSale[0].id).url);
const soonOnShelf = soon.find((b) => shelf.some((s) => s.id === b.id));
if (soonOnShelf) {
  await page2.goto(`${BASE}#/book/${soonOnShelf.id}`);
  await page2.waitForSelector('.paper-picker button.btn-buy:disabled');
  check('store: a book not on sale has a disabled buy button in the picker', (await page2.locator('.paper-picker .hold-buy, .paper-picker a.btn-buy').count()) === 0);
}
await page2.goto(`${BASE}?e2e#/book/${onSale[0].id}/page05/done`);
await page2.waitForSelector('.finished .paper-finished');
check('store: finished screen links to the paper book', (await page2.getAttribute('.paper-finished', 'href')) === `#/paper/${onSale[0].id}`);
await page2.screenshot({ path: `${OUT}/finished-store.png` });
await page2.goto(`${BASE}#/grown-ups`);
await page2.waitForSelector('.gu-paper .paper-card');
const direct = await page2.locator('.gu-paper a.btn-buy').evaluateAll((els) => els.map((a) => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]));
check('taken apart: listed in the grown-ups area, buy button disabled', (await page2.locator('.gu-paper #paper-taken-apart button.btn-buy:disabled').count()) === 1);
check(
  'store: grown-ups area links straight to each product page',
  JSON.stringify(direct) === JSON.stringify(onSale.map((b) => [listingFor(b.id).url, '_blank', 'noopener'])),
  JSON.stringify(direct),
);

// Also by Mat Harvey: the other sites, behind a hold like every link that leaves the site.
await page2.goto(`${BASE}#/`);
await page2.waitForSelector('.also-link img');
check('also by: footer shows the other sites', (await page2.locator('.also-link').count()) === 3);
await page2.evaluate(() => (window.__opened = null));
await page2.locator('.also-link').first().scrollIntoViewIfNeeded();
const also = await page2.locator('.also-link').first().boundingBox();
await page2.mouse.click(also.x + 20, also.y + 10);
await page2.waitForTimeout(300);
check('also by: a tap does not leave the site', (await page2.evaluate(() => window.__opened)) === null && page2.url().startsWith(BASE));
await page2.mouse.move(also.x + 20, also.y + 10);
await page2.mouse.down();
await page2.waitForTimeout(1800);
await page2.mouse.up();
check('also by: holding opens the site', (await page2.evaluate(() => window.__opened)) === 'https://thebodyweightgym.org/');

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
