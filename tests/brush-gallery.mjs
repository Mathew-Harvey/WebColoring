// Draws every brush on one page and saves a screenshot for a visual check.
//   node tests/brush-gallery.mjs [baseUrl] [scale]
import { chromium } from 'playwright';
const BASE = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
const SCALE = Number(process.argv[3] || 0.75);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 })).newPage();
await page.goto(`${BASE}?e2e#/book/blocky-builders/page10`);
await page.waitForFunction(() => window.__wc && !document.querySelector('.stage-msg'));
await page.click('button[aria-label^="Stay inside the lines"]');
await page.evaluate((s) => {
  const e = window.__wc;
  e.view.pinch(s, 0, 0, 0, 0);
  e.requestRender();
}, SCALE);
const box = await page.locator('.paper').boundingBox();
const tools = ['Crayon', 'Marker', 'Pencil', 'Brush', 'Water', 'Spray', 'Glitter', 'Rainbow', 'Neon', 'Stamp', 'Eraser'];
const colours = ['Red', 'Blue', 'Green', 'Purple', 'Orange', 'Teal', 'Pink', 'Red', 'Blue', 'Yellow', 'Red'];
for (let i = 0; i < tools.length; i++) {
  await page.click(`.rail-tools button[aria-label="${tools[i]}"]`);
  await page.click(`.rail-colours button[aria-label="${colours[i]}"]`);
  const y = box.y + 40 + i * (box.height - 80) / tools.length;
  const x0 = box.x + 40, x1 = box.x + box.width - 40;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  const steps = 60;
  for (let k = 1; k <= steps; k++) {
    const x = x0 + ((x1 - x0) * k) / steps;
    // Slow at the start, fast in the middle, so simulated pressure varies.
    await page.mouse.move(x, y + Math.sin(k / 5) * 14);
    if (k < 15) await page.waitForTimeout(12);
  }
  await page.mouse.up();
}
await page.mouse.move(box.x + 5, box.y + 5);
await page.waitForTimeout(200);
await page.screenshot({ path: `debug/e2e/gallery-${SCALE}.png`, clip: box });
await browser.close();
console.log('debug/e2e/gallery.png');
