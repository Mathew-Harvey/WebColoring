// Quick visual smoke test: node tests/smoke.mjs [baseUrl] [outDir]
import { chromium, devices } from 'playwright';
const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'debug/shots';
import fs from 'node:fs';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
async function run(name, ctxOpts, fn) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await fn(page);
  await ctx.close();
}
await run('desktop', { viewport: { width: 1280, height: 800 } }, async (page) => {
  await page.goto(base);
  await page.waitForSelector('.book-tile');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/home-desktop.png` });
  await page.click('.book-tile');
  await page.waitForSelector('.page-tile');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/picker-desktop.png` });
  await page.click('.page-tile >> nth=0');
  await page.waitForSelector('.paper');
  await page.waitForFunction(() => !document.querySelector('.stage-msg'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/colour-desktop.png` });
});
await run('phone', { ...devices['Pixel 7'] }, async (page) => {
  await page.goto(base + '#/book/blocky-builders/page13');
  await page.waitForSelector('.paper');
  await page.waitForFunction(() => !document.querySelector('.stage-msg'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/colour-phone.png` });
  await page.goto(base + '#/');
  await page.waitForSelector('.book-tile');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/home-phone.png` });
});
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
