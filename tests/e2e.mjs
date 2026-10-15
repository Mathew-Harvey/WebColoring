// End-to-end checks for WebColoring.
//   npm run build && npx vite preview --port 4173 &
//   node tests/e2e.mjs [baseUrl]
// Runs on Chromium desktop and Chrome Android emulation (touch).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const BASE = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
const SHOTS = 'debug/e2e';
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const TOOL_LABELS = {
  fill: 'Fill', crayon: 'Crayon', marker: 'Marker', pencil: 'Pencil', paintbrush: 'Brush', watercolour: 'Water',
  spray: 'Spray', glitter: 'Glitter', rainbow: 'Rainbow', neon: 'Neon', stamp: 'Stamp', eraser: 'Eraser', eyedropper: 'Picker',
};

async function openPage(page, pageId, query = '') {
  await page.goto(`${BASE}?e2e#/book/blocky-builders/${pageId}${query}`);
  await page.waitForFunction(() => window.__wc && !document.querySelector('.stage-msg'), null, { timeout: 30000 });
  await page.waitForTimeout(300);
}

/** Screen position (page coordinates of the viewport) of a page-space point. */
async function toScreen(page, x, y) {
  return page.evaluate(([x, y]) => {
    const [sx, sy] = window.__wc.view.toScreen(x, y);
    const r = document.querySelector('.paper').getBoundingClientRect();
    return [r.left + sx, r.top + sy];
  }, [x, y]);
}

async function bigRegions(page, n = 6) {
  return page.evaluate((n) => window.__wc.cbnTargets().sort((a, b) => b.r - a.r).slice(0, n), n);
}

async function selectTool(page, tool) {
  await page.click(`.rail-tools button[aria-label="${TOOL_LABELS[tool]}"]`);
}

async function mouseStroke(page, pts) {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    for (let k = 1; k <= 6; k++) await page.mouse.move(x0 + ((x1 - x0) * k) / 6, y0 + ((y1 - y0) * k) / 6);
  }
  await page.mouse.up();
  await page.waitForTimeout(60);
}

const coverage = (page, id) => page.evaluate((id) => window.__wc.paintCoverage(id), id);

// ------------------------------------------------------------------ desktop

async function desktop(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));

  await page.goto(BASE);
  await page.waitForSelector('.book-tile');
  check('desktop: home shows the bookshelf', (await page.locator('.book-tile').count()) === 1);
  check('desktop: promo card hidden while storeUrl is null', (await page.locator('.promo').count()) === 0);

  // Free colouring on a detailed page (colour by numbers off by default).
  await openPage(page, 'page05');
  const cbnOff = await page.evaluate(() => !window.__wc.cbnEnabled);
  check('desktop: detailed page opens with colour by numbers off', cbnOff);

  const regions = await bigRegions(page, 14);
  // Fill.
  await selectTool(page, 'fill');
  await page.click('.rail-colours button[aria-label="Red"]');
  const r0 = regions[0];
  const [fx, fy] = await toScreen(page, r0.x, r0.y);
  await page.mouse.click(fx, fy);
  await page.waitForTimeout(600);
  let cov = await coverage(page, r0.id);
  check('fill: colours the tapped region', cov.inside > 1000, `inside=${cov.inside}`);
  check('fill: no bleed into other regions or lines', cov.outside === 0 && cov.outsideOnLines === 0, JSON.stringify(cov));
  const hex = await page.evaluate(([x, y]) => {
    const c = window.__wc.composite();
    const d = c.getContext('2d').getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2]];
  }, [r0.x, r0.y]);
  check('fill: uses the chosen colour', Math.abs(hex[0] - 0xef) < 3 && Math.abs(hex[1] - 0x3b) < 3, hex.join(','));

  // Pattern fills.
  for (const style of ['Fade', 'Dots', 'Stripes', 'Stars']) {
    await page.click(`.rail-colours button[aria-label="${style}"]`);
    const r = regions[1];
    const before = await coverage(page, r.id);
    const [x, y] = await toScreen(page, r.x, r.y);
    await page.mouse.click(x, y);
    await page.waitForTimeout(500);
    const c = await coverage(page, r.id);
    check(`fill: ${style} pattern stays in its region`, c.inside > 500 && c.outside === before.outside && c.outsideOnLines === before.outsideOnLines, `inside=${c.inside}`);
    await page.evaluate(() => window.__wc.undo());
  }
  await page.click('.rail-colours button[aria-label="Plain"]');
  await page.evaluate(() => window.__wc.undo());
  cov = await coverage(page, r0.id);
  check('undo: removes the fill', cov.inside === 0, `inside=${cov.inside}`);
  await page.evaluate(() => window.__wc.redo());
  cov = await coverage(page, r0.id);
  check('redo: brings the fill back', cov.inside > 1000);
  await page.evaluate(() => window.__wc.undo());

  // Every brush, with stay inside the lines on (default).
  const brushes = ['crayon', 'marker', 'pencil', 'paintbrush', 'watercolour', 'spray', 'glitter', 'rainbow', 'neon', 'stamp'];
  let k = 2;
  for (const tool of brushes) {
    const r = regions[k++ % regions.length];
    await selectTool(page, tool);
    await page.click('.rail-colours button[aria-label="Blue"]');
    // Start at the label point (inside the region), then scribble well past its edges.
    const pts = [await toScreen(page, r.x, r.y)];
    const span = r.r * 3.2;
    for (let i = 0; i <= 6; i++) pts.push(await toScreen(page, r.x - span + (i * 2 * span) / 6, r.y + (i % 2 ? -1 : 1) * r.r * 0.8));
    const before = await page.evaluate(() => window.__wc.historySize);
    const cov0 = await coverage(page, r.id);
    await mouseStroke(page, pts);
    const c = await coverage(page, r.id);
    const after = await page.evaluate(() => window.__wc.historySize);
    const leaked = c.outside - cov0.outside + (c.outsideOnLines - cov0.outsideOnLines);
    check(`brush ${tool}: paints and stays inside the lines`, c.inside - cov0.inside > 50 && leaked === 0, `painted=${c.inside - cov0.inside} leaked=${leaked}`);
    check(`brush ${tool}: adds one undo step`, after === before + 1, `${before}->${after}`);
    await page.screenshot({ path: `${SHOTS}/brush-${tool}.png`, clip: { x: pts[0][0] - 60, y: pts[0][1] - 80, width: 260, height: 160 } }).catch(() => {});
  }

  // Stay inside the lines off: strokes cross lines.
  await page.click('button[aria-label^="Stay inside the lines"]');
  await selectTool(page, 'marker');
  {
    const r = regions[3];
    const c0 = await coverage(page, r.id);
    const pts = [await toScreen(page, r.x, r.y), await toScreen(page, r.x + r.r * 6, r.y)];
    await mouseStroke(page, pts);
    const c = await coverage(page, r.id);
    check('stay inside off: stroke crosses the lines', c.outside + c.outsideOnLines > c0.outside + c0.outsideOnLines, JSON.stringify(c));
  }
  await page.click('button[aria-label^="Stay inside the lines"]');

  // Eraser (clipped to the region it starts in).
  {
    const r = regions[2];
    const before = await coverage(page, r.id);
    await selectTool(page, 'eraser');
    const pts = [await toScreen(page, r.x, r.y)];
    for (let i = 0; i <= 8; i++) pts.push(await toScreen(page, r.x - r.r * 3 + (i * r.r * 6) / 8, r.y + (i % 2 ? -1 : 1) * r.r * 0.6));
    await mouseStroke(page, pts);
    const after = await coverage(page, r.id);
    check('eraser: removes paint', after.inside < before.inside, `${before.inside}->${after.inside}`);
    check('eraser: stays inside the lines', after.outside === before.outside, `${before.outside}->${after.outside}`);
  }

  // Eyedropper picks the fill colour back.
  {
    await selectTool(page, 'fill');
    await page.click('.rail-colours button[aria-label="Purple"]');
    const r = regions[5];
    const [x, y] = await toScreen(page, r.x, r.y);
    await page.mouse.click(x, y);
    await page.waitForTimeout(500);
    await page.click('.rail-colours button[aria-label="Yellow"]');
    await selectTool(page, 'eyedropper');
    await page.mouse.click(x, y);
    await page.waitForTimeout(200);
    const picked = await page.evaluate(() => window.__wc.colour);
    check('eyedropper: picks the colour under the finger', picked.toLowerCase() === '#8457dc', picked);
  }

  // 50+ undo steps.
  {
    await selectTool(page, 'marker');
    const r = regions[4];
    for (let i = 0; i < 55; i++) {
      const a = await toScreen(page, r.x - r.r, r.y - r.r * 0.5 + (i % 5) * r.r * 0.2);
      const b = await toScreen(page, r.x + r.r, r.y - r.r * 0.5 + (i % 5) * r.r * 0.2);
      await page.mouse.move(a[0], a[1]);
      await page.mouse.down();
      await page.mouse.move(b[0], b[1], { steps: 3 });
      await page.mouse.up();
    }
    const size = await page.evaluate(() => window.__wc.historySize);
    let undone = 0;
    for (let i = 0; i < 50; i++) {
      const ok = await page.evaluate(() => {
        if (!window.__wc.canUndo) return false;
        window.__wc.undo();
        return true;
      });
      if (ok) undone++;
    }
    check('undo: at least 50 steps', size >= 50 && undone === 50, `history=${size} undone=${undone}`);
    for (let i = 0; i < 50; i++) await page.evaluate(() => window.__wc.redo());
    const back = await page.evaluate(() => window.__wc.historySize);
    check('redo: 50 steps come back', back === size, `${back}`);
  }

  // Zoom and pan.
  {
    const s0 = await page.evaluate(() => window.__wc.view.scale);
    const box = await page.locator('.paper').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -200);
    await page.waitForTimeout(100);
    const s1 = await page.evaluate(() => window.__wc.view.scale);
    check('mouse wheel zooms in', s1 > s0 * 1.5, `${s0.toFixed(3)} -> ${s1.toFixed(3)}`);
    // Drag with the fill tool pans.
    await selectTool(page, 'fill');
    const o0 = await page.evaluate(() => [window.__wc.view.ox, window.__wc.view.oy]);
    await page.mouse.move(box.x + 300, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 250, { steps: 8 });
    await page.mouse.up();
    const o1 = await page.evaluate(() => [window.__wc.view.ox, window.__wc.view.oy]);
    check('drag with fill tool pans the page', Math.abs(o1[0] - o0[0]) > 50, `${o0.map(Math.round)} -> ${o1.map(Math.round)}`);
    // Double tap to fit.
    await selectTool(page, 'crayon');
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(450);
    const fit = await page.evaluate(() => window.__wc.isFit);
    check('double tap fits the page', fit);
  }

  // Autosave and restore.
  {
    await page.waitForTimeout(2200);
    const before = await coverage(page, regions[5].id);
    await page.reload();
    await page.waitForFunction(() => window.__wc && !document.querySelector('.stage-msg'));
    await page.waitForTimeout(400);
    const after = await coverage(page, regions[5].id);
    check('autosave: colours come back after reload', after.inside > 0 && Math.abs(after.inside - before.inside) < before.inside * 0.02, `${before.inside} vs ${after.inside}`);
  }

  await page.screenshot({ path: `${SHOTS}/desktop-free.png` });

  // Picker shows the saved thumbnail.
  await page.goto(`${BASE}#/book/blocky-builders`);
  await page.waitForSelector('.page-tile');
  await page.waitForTimeout(500);
  const blobThumb = await page.locator('.page-tile img[src^="blob:"]').count();
  check('picker: shows the saved colours as a thumbnail', blobThumb >= 1, `${blobThumb}`);
  for (const f of ['Easy', 'Detailed', 'Colour by numbers', 'All']) {
    await page.click(`.chip:has-text("${f}")`);
    const n = await page.locator('.page-tile').count();
    check(`picker: filter ${f}`, f === 'Easy' ? n === 18 : f === 'Detailed' ? n === 12 : f === 'All' ? n === 30 : n >= 18, `${n} pages`);
  }

  // Colour by numbers can be completed.
  for (const pid of ['page01', 'page13', 'page28']) {
    await completeCbn(page, pid);
  }

  // No third-party requests.
  const origin = new URL(BASE).origin;
  const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:'));
  check('desktop: no requests to other sites', foreign.length === 0, foreign.slice(0, 3).join(' '));
  check('desktop: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

async function completeCbn(page, pid) {
  await openPage(page, pid, '?cbn=1');
  const enabled = await page.evaluate(() => window.__wc.cbnEnabled);
  const targets = await page.evaluate(() => window.__wc.cbnTargets().filter((t) => !t.done));
  let wrong = 0;
  // Try one wrong colour first: it should wiggle, not fill.
  if (targets.length > 1) {
    const t = targets[0];
    const other = targets.find((x) => x.n !== t.n);
    if (other) {
      await page.click(`.number-list button[aria-label^="Number ${other.n},"]`);
      const [x, y] = await toScreen(page, t.x, t.y);
      await page.mouse.click(x, y);
      await page.waitForTimeout(80);
      const done = await page.evaluate((id) => window.__wc.cbnTargets().find((q) => q.id === id).done, t.id);
      if (!done) wrong++;
    }
  }
  check(`cbn ${pid}: wrong colour does not fill`, wrong === 1);
  let current = 0;
  for (const t of targets.sort((a, b) => a.n - b.n)) {
    if (t.n !== current) {
      await page.click(`.number-list button[aria-label^="Number ${t.n},"]`);
      current = t.n;
    }
    // Small regions are easier to hit when zoomed in a little.
    if (t.r < 30) {
      await page.evaluate(([x, y]) => {
        const v = window.__wc.view;
        v.animateTo(v.targetFor(x - 150, y - 100, 300, 200, 0.6), 0);
        window.__wc.requestRender();
      }, [t.x, t.y]);
    } else {
      await page.evaluate(() => window.__wc.fit(false));
    }
    const [x, y] = await toScreen(page, t.x, t.y);
    await page.mouse.click(x, y);
  }
  await page.waitForTimeout(200);
  const prog = await page.evaluate(() => window.__wc.cbnProgress());
  check(`cbn ${pid}: every numbered region filled`, enabled && prog.done === prog.total && prog.total > 0, `${prog.done}/${prog.total}`);
  await page.waitForSelector('.finished', { timeout: 5000 }).catch(() => {});
  const finished = await page.locator('.finished').count();
  check(`cbn ${pid}: finished screen appears`, finished === 1);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/finished-${pid}.png` });
}

// ------------------------------------------------------------------ Android emulation (touch)

async function android(browser) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openPage(page, 'page05');
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });

  const regions = await bigRegions(page, 6);
  // One-finger draw.
  await page.click('.rail-tools button[aria-label="Crayon"]');
  const r = regions[1];
  const a = await toScreen(page, r.x - r.r * 0.6, r.y);
  const b = await toScreen(page, r.x + r.r * 0.6, r.y);
  await touch('touchStart', [a]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[a[0] + ((b[0] - a[0]) * i) / 10, a[1] + ((b[1] - a[1]) * i) / 10]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(100);
  const c = await coverage(page, r.id);
  check('android: one-finger drawing works', c.inside > 50 && c.outside === 0, `inside=${c.inside}`);

  // Pinch zoom.
  const box = await page.locator('.paper').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const s0 = await page.evaluate(() => window.__wc.view.scale);
  const h0 = await page.evaluate(() => window.__wc.historySize);
  await touch('touchStart', [[cx - 30, cy], [cx + 30, cy]]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[cx - 30 - i * 12, cy], [cx + 30 + i * 12, cy]]);
  await touch('touchEnd', []);
  const s1 = await page.evaluate(() => window.__wc.view.scale);
  const h1 = await page.evaluate(() => window.__wc.historySize);
  check('android: pinch zooms in', s1 > s0 * 2.5, `${s0.toFixed(3)} -> ${s1.toFixed(3)}`);
  check('android: pinch does not leave a stroke', h1 === h0, `${h0}->${h1}`);

  // Two-finger pan.
  const o0 = await page.evaluate(() => window.__wc.view.ox);
  await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[cx - 40 - i * 8, cy], [cx + 40 - i * 8, cy]]);
  await touch('touchEnd', []);
  const o1 = await page.evaluate(() => window.__wc.view.ox);
  check('android: two-finger pan moves the page', o1 < o0 - 40, `${Math.round(o0)} -> ${Math.round(o1)}`);

  // Double tap to fit.
  await touch('touchStart', [[cx, cy]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(60);
  await touch('touchStart', [[cx, cy]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(450);
  check('android: double tap fits the page', await page.evaluate(() => window.__wc.isFit));

  // Tap to fill.
  await page.click('.rail-tools button[aria-label="Fill"]');
  const r2 = regions[0];
  const [tx, ty] = await toScreen(page, r2.x, r2.y);
  const c1 = await coverage(page, r2.id);
  await page.touchscreen.tap(tx, ty);
  await page.waitForTimeout(600);
  const c2 = await coverage(page, r2.id);
  check('android: tap to fill works', c2.inside > 1000 && c2.outside === c1.outside, `inside=${c2.inside}`);
  await page.screenshot({ path: `${SHOTS}/android.png` });

  // Colour by numbers by touch on page 13.
  await openPage(page, 'page13');
  const targets = await page.evaluate(() => window.__wc.cbnTargets().sort((a, b) => b.r - a.r).slice(0, 3));
  for (const t of targets) {
    await page.click(`.number-list button[aria-label^="Number ${t.n},"]`);
    const [x, y] = await toScreen(page, t.x, t.y);
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(350);
  }
  const done = await page.evaluate(() => window.__wc.cbnProgress().done);
  check('android: colour by numbers by touch', done >= 3, `${done}`);
  await page.screenshot({ path: `${SHOTS}/android-cbn.png` });
  check('android: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

const browser = await chromium.launch();
try {
  await desktop(browser);
  await android(browser);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
