// Screenshots of every screen at several sizes, for a visual check.
//   node tests/screens.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
const OUT = 'debug/screens';
fs.mkdirSync(OUT, { recursive: true });
const sizes = [
  ['phone', { width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['phone-land', { width: 740, height: 360, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['tablet', { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['tablet-land', { width: 1024, height: 768, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { width: 1440, height: 900, deviceScaleFactor: 1 }],
];
const browser = await chromium.launch();
for (const [name, vp] of sizes) {
  const { width, height, ...rest } = vp;
  const ctx = await browser.newContext({ viewport: { width, height }, ...rest });
  const page = await ctx.newPage();
  const ready = () => page.waitForFunction(() => window.__wc && !document.querySelector('.stage-msg'), null, { timeout: 30000 });
  await page.goto(BASE);
  await page.waitForSelector('.book-tile img');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-home.png` });
  await page.goto(`${BASE}#/book/blocky-builders`);
  await page.waitForSelector('.page-tile');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}-picker.png` });
  await page.goto(`${BASE}?e2e#/book/blocky-builders/page13`);
  await ready();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-cbn.png` });
  await page.goto(`${BASE}?e2e#/book/blocky-builders/page05`);
  await ready();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-free.png` });
  await page.click('.swatch-more');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-sheet.png` });
  await page.goto(`${BASE}#/grown-ups`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-grownups.png` });
  await page.goto(`${BASE}?e2e#/book/blocky-builders/page05/done`);
  await ready();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}-finished.png` });
  await ctx.close();
}
await browser.close();
console.log('done');
