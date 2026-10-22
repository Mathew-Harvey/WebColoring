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

// A returning visitor whose offline copy is older than the site still sees new books, and new
// pages: make the kept bookshelf and one book's details out of date, then visit again.
{
  const fs = await import('node:fs');
  const shelf = JSON.parse(fs.readFileSync(new URL('../public/books/index.json', import.meta.url), 'utf8')).books;
  await page.evaluate(async () => {
    for (const k of await caches.keys()) {
      if (!k.startsWith('shell-')) continue;
      const c = await caches.open(k);
      for (const req of await c.keys()) {
        const path = new URL(req.url).pathname;
        if (!path.endsWith('/books/index.json') && !path.endsWith('/books/blocky-builders/book.json')) continue;
        const j = await (await c.match(req)).json();
        if (j.books) j.books = j.books.slice(0, 1);
        if (j.pages) j.pages = j.pages.slice(0, 5);
        await c.put(req, new Response(JSON.stringify(j), { headers: { 'content-type': 'application/json' } }));
      }
    }
  });
  await page.goto(BASE);
  await page.waitForSelector('a.book-tile');
  await page.waitForTimeout(800);
  const tiles = await page.locator('a.book-tile').count();
  check('returning visitor with an old offline copy: every book shows', tiles === shelf.length, `${tiles} of ${shelf.length}`);
  await page.goto(`${BASE}#/book/blocky-builders`);
  await page.waitForSelector('.page-tile');
  await page.waitForTimeout(500);
  const pages = await page.locator('.page-tile').count();
  check('returning visitor with an old offline copy: a book shows all its pages', pages === 30, `${pages}/30`);
}

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
// A book's own address, opened offline: its kept page, and the app on it.
for (const id of ['scaly-pals', 'doodles-through-the-decades']) {
  await page.goto(`${BASE}book/${id}`);
  await page.waitForSelector('.page-tile img');
  await page.waitForTimeout(500);
  const { title, tiles } = await page.evaluate(() => ({ title: document.title, tiles: document.querySelectorAll('.page-tile').length }));
  check(`offline: /book/${id} opens, with its own title and pages`, tiles === 30 && title !== 'WebColoring' && new URL(page.url()).pathname === `/book/${id}`, `${tiles} pages, "${title}"`);
}
await ctx.setOffline(false);
check('no requests to other sites', foreign.length === 0, foreign.join(' '));
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
