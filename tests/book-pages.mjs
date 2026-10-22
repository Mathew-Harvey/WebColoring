// Each book's own page, /book/<id>: the server sends its prerendered page (200, not a 404 or the
// app shell) with its own title, description, canonical address, link preview, heading and intro;
// the sitemap lists them; old #/book/<id> links move to them; the app takes over without a jump.
//   node tests/book-pages.mjs [base-url]      (BROWSER=webkit for WebKit)
import { chromium, webkit } from 'playwright';
import sharp from 'sharp';

const BASE = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
const SITE = 'https://webcoloring.org/';
const ENGINE = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const get = (path) => fetch(BASE + path, { redirect: 'manual', headers: { 'cache-control': 'no-cache' } });
const shelf = (await (await get('public/books/index.json')).json()).books;
const home = await (await get('')).text();
const decode = (t) => t.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const tag = (html, re) => decode(html.match(re)?.[1] ?? '');
const meta = (html, attr, key) => tag(html, new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`));
const csp = (html) => tag(html, /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);

check('there are books on the shelf', shelf.length >= 6, `${shelf.length}`);

// ------------------------------------------------------------------ what the server sends

const pages = {};
for (const { id, title } of shelf) {
  const res = await get(`book/${id}`);
  const html = await res.text();
  pages[id] = html;
  const t = tag(html, /<title>([^<]*)<\/title>/);
  const h1 = tag(html, /<h1 class="picker-title">([^<]*)<\/h1>/);
  const intro = tag(html, /<p class="picker-intro">([^<]*)<\/p>/);
  check(`/book/${id}: 200, its own page`, res.status === 200 && /text\/html/.test(res.headers.get('content-type')) && html !== home && !!h1, `${res.status}`);
  check(`/book/${id}: title and description`, t.length > 10 && t !== 'WebColoring' && t.includes(title) && meta(html, 'name', 'description').length > 50, t);
  check(`/book/${id}: canonical and og:url are its address`, tag(html, /<link rel="canonical" href="([^"]*)"/) === `${SITE}book/${id}` && meta(html, 'property', 'og:url') === `${SITE}book/${id}`);
  check(
    `/book/${id}: og and twitter tags match`,
    meta(html, 'property', 'og:title') === t &&
      meta(html, 'name', 'twitter:title') === t &&
      meta(html, 'property', 'og:description') === meta(html, 'name', 'description') &&
      meta(html, 'name', 'twitter:description') === meta(html, 'name', 'description') &&
      meta(html, 'name', 'twitter:image') === meta(html, 'property', 'og:image') &&
      !!meta(html, 'property', 'og:image:alt'),
  );
  check(`/book/${id}: visible heading and intro`, h1.length > 0 && intro.length > 40, h1);
  check(`/book/${id}: same Content-Security-Policy as the app`, csp(html) === csp(home) && csp(html).includes("script-src 'self'"));
  // The preview image: a 1200x630 JPEG on this site.
  const img = new URL(meta(html, 'property', 'og:image'));
  const imgRes = await get(img.pathname.slice(1) + img.search);
  const info = imgRes.ok ? await sharp(Buffer.from(await imgRes.arrayBuffer())).metadata() : {};
  check(`/book/${id}: preview image is a 1200x630 JPEG`, img.origin + '/' === SITE && imgRes.status === 200 && info.format === 'jpeg' && info.width === 1200 && info.height === 630, `${imgRes.status} ${info.width}x${info.height}`);
}

const sitemap = await get('sitemap.xml');
const sitemapXml = await sitemap.text();
const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check('sitemap.xml: served', sitemap.status === 200 && /xml/.test(sitemap.headers.get('content-type')), `${sitemap.status}`);
check(`sitemap.xml: the bookshelf and all ${shelf.length} books`, locs.length === shelf.length + 1 && locs[0] === SITE && shelf.every(({ id }) => locs.includes(`${SITE}book/${id}`)), locs.join(' '));
const robots = await get('robots.txt');
check('robots.txt: served at the root, and names the sitemap', robots.status === 200 && (await robots.text()).includes(`Sitemap: ${SITE}sitemap.xml`), `${robots.status}`);

// ------------------------------------------------------------------ in a browser

const browser = await (ENGINE === 'webkit' ? webkit : chromium).launch();

// Without JavaScript: the heading and intro still show.
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  for (const { id } of shelf) {
    await p.goto(`${BASE}book/${id}`);
    const ok = (await p.locator('h1.picker-title').isVisible()) && (await p.locator('.picker-intro').isVisible());
    check(`no JavaScript: /book/${id} shows its heading and intro`, ok);
  }
  await ctx.close();
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
const errors = [];
const watch = (p) => {
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
};

for (const { id } of shelf) {
  const p = await ctx.newPage();
  watch(p);
  // Layout shifts from the moment the page starts, to see the app take over from the prerendered
  // heading without anything jumping.
  await p.addInitScript(() => {
    window.__shift = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__shift += e.value))).observe({ type: 'layout-shift', buffered: true });
  });
  await p.goto(`${BASE}book/${id}`);
  await p.waitForSelector('.page-tile img');
  await p.waitForTimeout(600);
  const html = pages[id];
  const got = await p.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1.picker-title')?.textContent,
    intro: document.querySelector('.picker-intro')?.textContent,
    tiles: document.querySelectorAll('.page-tile').length,
    headings: document.querySelectorAll('h1').length,
    path: location.pathname + location.hash,
    shift: window.__shift ?? null,
  }));
  check(
    `/book/${id}: the app shows the book, with the same title, heading and intro`,
    got.title === tag(html, /<title>([^<]*)<\/title>/) &&
      got.h1 === tag(html, /<h1 class="picker-title">([^<]*)<\/h1>/) &&
      got.intro === tag(html, /<p class="picker-intro">([^<]*)<\/p>/) &&
      got.tiles === 30 &&
      got.headings === 1 &&
      got.path === `/book/${id}`,
    `${got.tiles} pages, ${got.path}`,
  );
  if (ENGINE === 'chromium') check(`/book/${id}: no layout shift as the app takes over`, got.shift !== null && got.shift < 0.02, `${got.shift?.toFixed(4)}`);
  await p.close();
}

// Old links: #/book/<id> moves to /book/<id> (keeping a query string), without reloading.
{
  const p = await ctx.newPage();
  watch(p);
  await p.goto(`${BASE}#/book/scaly-pals`);
  await p.waitForSelector('.page-tile');
  const u = new URL(p.url());
  check('old link #/book/<id>: moves to /book/<id>', u.pathname === '/book/scaly-pals' && !u.hash, p.url());
  check('...with the book title', (await p.title()) === tag(pages['scaly-pals'], /<title>([^<]*)<\/title>/));
  await p.goto(`${BASE}?e2e#/book/taken-apart`);
  await p.waitForSelector('.page-tile');
  const q = new URL(p.url());
  check('...keeping the query string', q.pathname === '/book/taken-apart' && q.search === '?e2e' && !q.hash, p.url());
  await p.goto(`${BASE}#/book/no-such-book`);
  await p.waitForSelector('.not-found-card');
  check('a book that is not on the shelf keeps its old address', new URL(p.url()).hash === '#/book/no-such-book');
  await p.close();
}

// The bookshelf links to every book's own page; following one does not reload the page, and the
// title follows the screen.
{
  const p = await ctx.newPage();
  watch(p);
  await p.goto(BASE);
  await p.waitForSelector('a.book-tile');
  const links = await p.locator('a.book-tile').evaluateAll((els) => els.map((a) => a.getAttribute('href')));
  check('bookshelf: real links to each book page', shelf.every(({ id }) => links.includes(`/book/${id}`)), links.join(' '));
  await p.evaluate(() => (window.__same = 1));
  await p.click('a.book-tile[href="/book/still-water-mandalas"]');
  await p.waitForSelector('.page-tile');
  await p.waitForFunction(() => document.title !== 'WebColoring', null, { timeout: 3000 }).catch(() => {});
  const at = new URL(p.url()).pathname;
  const title = await p.title();
  await p.click('.picker-head .round-btn');
  await p.waitForSelector('a.book-tile');
  // The title changes just after the screen draws.
  await p.waitForFunction(() => document.title === 'WebColoring', null, { timeout: 3000 }).catch(() => {});
  check(
    'bookshelf to a book and back: /book/<id>, then /, in one page load',
    at === '/book/still-water-mandalas' && new URL(p.url()).pathname === '/' && (await p.evaluate(() => window.__same === 1)),
    `${at} then ${new URL(p.url()).pathname}`,
  );
  check('the title follows the screen', title === tag(pages['still-water-mandalas'], /<title>([^<]*)<\/title>/) && (await p.title()) === 'WebColoring', title);
  await p.close();
}

check('no page errors or blocked content', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
