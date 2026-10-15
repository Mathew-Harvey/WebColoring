// Checks for bugs found in review, so they stay fixed.
//   node tests/regressions.mjs [baseUrl]
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
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const open = async (id, q = '') => {
  await page.evaluate(() => (window.__wc = null)).catch(() => {});
  await page.goto(`${BASE}?e2e#/book/blocky-builders/${id}${q}`);
  await page.waitForFunction(() => window.__wc && !document.querySelector('.stage-msg'));
  await page.waitForTimeout(200);
};
const screen = (x, y) =>
  page.evaluate(([x, y]) => {
    const [sx, sy] = window.__wc.view.toScreen(x, y);
    const r = document.querySelector('.paper').getBoundingClientRect();
    return [r.left + sx, r.top + sy];
  }, [x, y]);
const biggest = () => page.evaluate(() => window.__wc.cbnTargets().sort((a, b) => b.r - a.r));

// Colour by numbers fills animate (the pop is not skipped).
await open('page13', '?cbn=1');
{
  const t = (await biggest())[0];
  await page.click(`.number-list button[aria-label^="Number ${t.n},"]`);
  const [x, y] = await screen(t.x, t.y);
  await page.mouse.click(x, y);
  const animating = await page.evaluate(() => window.__wc.fx !== null);
  check('cbn: the right colour fills with a pop animation', animating);
  await page.waitForTimeout(500);
  // Erase it, then fill it again with the same number.
  await page.click('.rail-tools button[aria-label="Eraser"]');
  await page.mouse.move(x - 20, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y, { steps: 4 });
  await page.mouse.up();
  const erased = await page.evaluate((id) => window.__wc.paintCoverage(id).inside, t.id);
  await page.click(`.number-list button[aria-label^="Number ${t.n},"]`);
  await page.mouse.click(x, y);
  await page.waitForTimeout(600);
  const refilled = await page.evaluate((id) => window.__wc.paintCoverage(id).inside, t.id);
  check('cbn: an erased region can be filled again', refilled > erased, `${erased} -> ${refilled}`);
}

// Leaving straight after a fill keeps it, and the picker shows it.
await open('page05');
{
  await page.click('.rail-tools button[aria-label="Fill"]');
  await page.click('.rail-colours button[aria-label="Green"]');
  const t = (await biggest())[0];
  const [x, y] = await screen(t.x, t.y);
  await page.mouse.click(x, y);
  await page.click('a[aria-label="Back to pages"]');
  await page.waitForSelector('.page-tile');
  await page.waitForTimeout(300);
  const fresh = await page.locator('a[href$="page05"] img[src^="blob:"]').count();
  check('picker: shows the new thumbnail straight after leaving', fresh === 1);
  await open('page05');
  const kept = await page.evaluate((id) => window.__wc.paintCoverage(id).inside, t.id);
  check('autosave: a fill made just before leaving is kept', kept > 1000, `${kept}`);
}

// A stroke that starts off the page still stays inside the lines.
{
  await page.evaluate(() => window.__wc.clearPaint());
  await page.click('.rail-tools button[aria-label="Marker"]');
  const t = (await biggest())[0];
  const box = await page.locator('.paper').boundingBox();
  const [x, y] = await screen(t.x, t.y);
  // The first region the stroke meets is the one at the left edge of the page.
  const first = await page.evaluate(([sy]) => {
    const e = window.__wc;
    const r = document.querySelector('.paper').getBoundingClientRect();
    for (let sx = 0; sx < r.width; sx++) {
      const id = e.regionAtScreen(sx, sy - r.top);
      if (id) return id;
    }
    return 0;
  }, [y]);
  const before = await page.evaluate((id) => window.__wc.paintCoverage(id), first);
  await page.mouse.move(box.x + 3, y);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 40 });
  await page.mouse.up();
  const after = await page.evaluate((id) => window.__wc.paintCoverage(id), first);
  const leaked = after.outside - before.outside + after.outsideOnLines - before.outsideOnLines;
  check('stay inside: a stroke started off the page is clipped to the first region', after.inside > before.inside && leaked === 0, `painted=${after.inside - before.inside} leaked=${leaked}`);
}

// A resting palm plus a pen draws, it does not pinch.
{
  const t = (await biggest())[3];
  const [x, y] = await screen(t.x, t.y);
  const s0 = await page.evaluate(() => window.__wc.view.scale);
  const h0 = await page.evaluate(() => window.__wc.historySize);
  await page.evaluate(([x, y]) => {
    const c = document.querySelector('.paper');
    const ev = (type, id, kind, px, py) =>
      c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: kind, clientX: px, clientY: py, pressure: 0.6, bubbles: true, buttons: type === 'pointerup' ? 0 : 1 }));
    ev('pointerdown', 50, 'touch', x + 300, y + 200);
    ev('pointerdown', 51, 'pen', x, y);
    for (let i = 1; i <= 10; i++) {
      ev('pointermove', 50, 'touch', x + 300 + i, y + 200);
      ev('pointermove', 51, 'pen', x + i * 4, y + i);
    }
    ev('pointerup', 51, 'pen', x + 40, y + 10);
    ev('pointerup', 50, 'touch', x + 310, y + 200);
  }, [x, y]);
  const s1 = await page.evaluate(() => window.__wc.view.scale);
  const h1 = await page.evaluate(() => window.__wc.historySize);
  check('pen: a resting palm does not turn a pen stroke into a pinch', s1 === s0 && h1 === h0 + 1, `scale ${s0.toFixed(3)}->${s1.toFixed(3)}, steps ${h0}->${h1}`);
}

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
