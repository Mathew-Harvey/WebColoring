// Navigation checks: from any screen, back (the in-app buttons, or the browser or phone back
// button) leads through the book's pages to the bookshelf, without loops.
//   node tests/navigation.mjs [base-url]      (BROWSER=webkit for WebKit)
import { chromium, webkit, devices } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
const ENGINE = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await (ENGINE === 'webkit' ? webkit : chromium).launch();
const errors = [];

/** The screen a page is on, as its hash route (a book's pages are at /book/<id>), or "left"
 * once back has left the site. */
const where = (p) => {
  if (!p.url().startsWith(BASE)) return 'left';
  const url = new URL(p.url());
  if (url.hash && url.hash !== '#') return url.hash;
  const book = url.pathname.match(/^\/book\/([^/]+)$/);
  return book ? `#/book/${book[1]}` : '#/';
};

async function settle(p) {
  await p.waitForTimeout(350);
  if (where(p) !== 'left') await p.waitForSelector('.screen, .finished', { timeout: 15000 });
}

/** The browser or phone back button. */
async function systemBack(p) {
  await p.goBack({ waitUntil: 'commit' }).catch(() => {});
  await settle(p);
  return where(p);
}

/** Opens a screen straight from a link, as a shared or bookmarked link would. */
async function openStraight(ctx, route) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('about:blank');
  await p.goto(BASE + route);
  await settle(p);
  return p;
}

/** Someone touches the page (a key press, which changes nothing here). Browsers only keep
 * history entries a page adds after that, so the screens above are added then. */
async function touch(p) {
  await p.keyboard.press('Tab');
  await p.waitForTimeout(150);
}

/** The back control on the current screen. */
async function backControl(p) {
  for (const sel of [
    '.finished button:has-text("Keep colouring")',
    'header.topbar a[aria-label="Back to pages"]',
    '.picker-head .round-btn',
    'a.btn:has-text("Back to the bookshelf")',
  ]) {
    const el = p.locator(sel).first();
    if ((await el.count()) && (await el.isVisible())) return el;
  }
  return null;
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });

// ------------------------------------------------------------------ opened straight from a link

// Once someone has touched the page, the browser or phone back button walks up to the
// bookshelf before leaving the site.
const straight = [
  ['a colouring page', '#/book/scaly-pals/page05', ['#/book/scaly-pals', '#/']],
  ['a page with colour by numbers on', '#/book/blocky-builders/page01?cbn=1', ['#/book/blocky-builders', '#/']],
  ['a finished picture', '?e2e#/book/scaly-pals/page05/done', ['#/book/scaly-pals/page05', '#/book/scaly-pals', '#/']],
  ['a book', '#/book/taken-apart', ['#/']],
  ['the paper books', '#/paper', ['#/']],
  ['one paper book', '#/paper/scaly-pals', ['#/']],
  ['grown-ups', '#/grown-ups', ['#/']],
  ['a missing screen', '#/no-such-screen', ['#/']],
  ['a missing book', '#/book/no-such-book', ['#/']],
  ['a missing page', '#/book/scaly-pals/page99', ['#/book/scaly-pals', '#/']],
];
for (const [name, route, chain] of straight) {
  const p = await openStraight(ctx, route);
  await touch(p);
  const seen = [];
  for (let i = 0; i <= chain.length; i++) seen.push(await systemBack(p));
  check(`opened straight to ${name}: back goes to the bookshelf, then leaves`, JSON.stringify(seen) === JSON.stringify([...chain, 'left']), seen.join(' > '));
  await p.close();
}

// Left untouched, back leaves at once: browsers ignore entries added before anyone touches a page.
{
  const p = await openStraight(ctx, '#/book/scaly-pals/page05');
  check('opened straight and left untouched: back leaves the site (as browsers require)', (await systemBack(p)) === 'left');
  await p.close();
}

// Every screen has a back button (the first thing touched here), and following it reaches the
// bookshelf. Back then leaves the
// site at once: the buttons stepped back through history rather than adding to it.
for (const [name, route, chain] of straight) {
  const p = await openStraight(ctx, route);
  const seen = [];
  let missing = false;
  for (let i = 0; i < 6 && where(p) !== '#/'; i++) {
    const back = await backControl(p);
    if (!back) {
      missing = true;
      break;
    }
    await back.click();
    await settle(p);
    seen.push(where(p));
  }
  check(`${name}: its back button leads to the bookshelf`, !missing && JSON.stringify(seen) === JSON.stringify(chain), missing ? `no back button on ${where(p)}` : seen.join(' > '));
  check(`${name}: after the back buttons, phone back leaves the site`, (await systemBack(p)) === 'left');
  await p.close();
}

// ------------------------------------------------------------------ browsing

{
  const p = await openStraight(ctx, '#/');
  await p.click('a.book-tile[href="/book/scaly-pals"]');
  await settle(p);
  await p.click('.page-tile >> nth=0');
  await p.waitForSelector('.paper');
  await p.click('header.topbar a[aria-label="Back to pages"]');
  await settle(p);
  check('back to pages, then phone back: the bookshelf, not the page again', where(p) === '#/book/scaly-pals' && (await systemBack(p)) === '#/');
  check('then phone back leaves the site (no stray entries)', (await systemBack(p)) === 'left');
  await p.close();
}

{
  const p = await openStraight(ctx, '?e2e#/');
  await p.click('a.book-tile[href="/book/scaly-pals"]');
  await settle(p);
  await p.click('.page-tile >> nth=4');
  await p.waitForSelector('.paper');
  const page = where(p);
  await p.click('header.topbar a[aria-label="Done"]');
  await p.waitForSelector('.finished');
  check('phone back closes the finished picture', (await systemBack(p)) === page && (await p.locator('.finished').count()) === 0);
  await p.goForward();
  await p.waitForSelector('.finished');
  await p.click('.finished button:has-text("Keep colouring")');
  await settle(p);
  check('keep colouring: back on the page, and phone back goes to the pages', where(p) === page && (await p.locator('.finished').count()) === 0 && (await systemBack(p)) === '#/book/scaly-pals');
  await p.click('.page-tile >> nth=4');
  await p.waitForSelector('.paper');
  await p.click('header.topbar a[aria-label="Done"]');
  await p.waitForSelector('.finished');
  await p.click('.finished button:has-text("More pages")');
  await settle(p);
  check('more pages: the pages, and phone back goes to the bookshelf', where(p) === '#/book/scaly-pals' && (await systemBack(p)) === '#/');
  await p.close();
}

{
  const p = await openStraight(ctx, '#/book/scaly-pals');
  await p.locator('.paper-picker .text-link').scrollIntoViewIfNeeded();
  await p.click('.paper-picker .text-link');
  await p.waitForSelector('.paper-card');
  await p.click('.picker-head .round-btn');
  await settle(p);
  check('paper book from the pages: back returns to the pages, then the bookshelf', where(p) === '#/book/scaly-pals' && (await systemBack(p)) === '#/');
  await p.close();
}

{
  const p = await openStraight(ctx, '#/');
  await p.locator('.paper-banner .btn-paper').scrollIntoViewIfNeeded();
  await p.click('.paper-banner .btn-paper');
  await p.waitForSelector('.paper-card');
  await p.click('.picker-head .round-btn');
  await settle(p);
  check('paper books from the bookshelf: back returns to the bookshelf', where(p) === '#/' && (await systemBack(p)) === 'left');
  await p.close();
}

{
  const p = await openStraight(ctx, '#/book/still-water-mandalas/page03');
  await touch(p);
  await p.reload();
  await settle(p);
  check('after a reload, back still goes to the pages and the bookshelf', (await systemBack(p)) === '#/book/still-water-mandalas' && (await systemBack(p)) === '#/');
  await p.close();
}

// ------------------------------------------------------------------ addresses

// A book's pages are at /book/<id>, its pictures at /#/book/<id>/<page>, and moving between
// them, either way, never reloads the page.
{
  const address = (p) => new URL(p.url()).pathname + new URL(p.url()).hash;
  const p = await openStraight(ctx, '');
  await p.evaluate(() => (window.__same = 1));
  await p.click('a.book-tile[href="/book/scaly-pals"]');
  await settle(p);
  const seen = [address(p)];
  await p.click('.page-tile >> nth=2');
  await p.waitForSelector('.paper');
  seen.push(address(p));
  await p.click('header.topbar a[aria-label="Back to pages"]');
  await settle(p);
  seen.push(address(p));
  await p.goForward();
  await p.waitForSelector('.paper');
  seen.push(address(p));
  seen.push((await systemBack(p), address(p)));
  seen.push((await systemBack(p), address(p)));
  const want = ['/book/scaly-pals', '/#/book/scaly-pals/page03', '/book/scaly-pals', '/#/book/scaly-pals/page03', '/book/scaly-pals', '/'];
  check('addresses: bookshelf, book, picture, and back and forth', JSON.stringify(seen) === JSON.stringify(want), seen.join(' > '));
  check('addresses: all in one page load', await p.evaluate(() => window.__same === 1));
  await p.close();
}

{
  // Opened straight at a book's own page, then touched: back goes to the bookshelf, then leaves.
  const p = await openStraight(ctx, 'book/kart-kingdom-racers');
  await touch(p);
  const seen = [await systemBack(p), new URL(p.url()).pathname, await systemBack(p)];
  check('opened at /book/<id>: back goes to the bookshelf (/), then leaves', JSON.stringify(seen) === JSON.stringify(['#/', '/', 'left']), seen.join(' > '));
  await p.close();
}

await ctx.close();

// ------------------------------------------------------------------ phone layout, by touch

{
  const phone = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  const p = await phone.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('about:blank');
  await p.goto(BASE + '#/book/taken-apart/page02');
  await p.waitForSelector('.paper');
  await p.tap('header.topbar a[aria-label="Back to pages"]');
  await settle(p);
  await p.tap('.picker-head .round-btn');
  await settle(p);
  check('phone: back buttons from a page reach the bookshelf', where(p) === '#/' && (await systemBack(p)) === 'left');
  await phone.close();
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
