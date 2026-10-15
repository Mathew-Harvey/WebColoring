// Draws the social preview card (public/share.jpg, 1200x630) that Facebook, WhatsApp, X and
// others show when the site is shared. It colours real book pages with their colour by numbers
// colours, lays them out with the name and copy from src/copy.ts, and renders it in Chromium.
//
//   npm run social                     (needs Node 22.6+ and a Playwright Chromium)
//   npm run social -- --html out.html  (also writes the card as HTML, for tweaking)
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { unzlibSync } from 'fflate';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { copy } = await import(path.join(root, 'src/copy.ts'));
const { values: args } = parseArgs({ options: { html: { type: 'string' } } });

const BOOK = 'blocky-builders';
const bookDir = path.join(root, 'public/books', BOOK);
const palette = JSON.parse(fs.readFileSync(path.join(bookDir, 'book.json'), 'utf8')).cbnPalette.map((c) =>
  [1, 3, 5].map((i) => parseInt(c.hex.slice(i, i + 2), 16)),
);

/** Loads a prepared page: region ids per pixel plus the region table. */
function loadPage(page) {
  const dir = path.join(bookDir, 'pages', page);
  const buf = fs.readFileSync(path.join(dir, 'regions.bin'));
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const w = dv.getUint16(4, true);
  const h = dv.getUint16(6, true);
  const body = unzlibSync(new Uint8Array(buf.buffer, buf.byteOffset + 10, buf.byteLength - 10));
  const ids = new Uint16Array(w * h);
  let p = 0;
  let o = 0;
  const varint = () => {
    let v = 0;
    let s = 0;
    let b;
    do {
      b = body[p++];
      v |= (b & 0x7f) << s;
      s += 7;
    } while (b & 0x80);
    return v;
  };
  while (p < body.length) {
    const id = varint();
    const len = varint();
    if (id) ids.fill(id, o, o + len);
    o += len;
  }
  const json = JSON.parse(fs.readFileSync(path.join(dir, 'regions.json'), 'utf8'));
  const f = (name) => json.fields.indexOf(name);
  const regions = json.regions.map((r) => ({
    area: r[f('area')],
    cx: r[f('cx')] / w,
    cy: r[f('cy')] / h,
    lx: r[f('lx')] / w,
    ly: r[f('ly')] / h,
    lr: r[f('lr')],
    n: r[f('n')],
  }));
  return { dir, w, h, ids, regions };
}

/**
 * The page with the regions `keep` picks filled in, as a PNG data URL `width` px wide, plus
 * the biggest numbered regions left blank (for drawing their numbers on top).
 */
async function colourPage(page, width, keep = () => true) {
  const { dir, w, h, ids, regions } = loadPage(page);
  const fill = regions.map((r) => (r.n && keep(r) ? palette[r.n - 1] : null));
  const rgb = Buffer.alloc(w * h * 3, 255);
  for (let i = 0; i < ids.length; i++) {
    const c = ids[i] && fill[ids[i] - 1];
    if (c) {
      rgb[i * 3] = c[0];
      rgb[i * 3 + 1] = c[1];
      rgb[i * 3 + 2] = c[2];
    }
  }
  const png = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .composite([{ input: path.join(dir, 'overlay.png') }])
    .png()
    .toBuffer();
  const out = await sharp(png).resize(width).png().toBuffer();
  const blank = regions.filter((r) => r.n && !keep(r) && r.lr >= 28).sort((a, b) => b.lr - a.lr);
  return { src: `data:image/png;base64,${out.toString('base64')}`, blank };
}

const LOGO = ['#ef5a52', '#ff9a3c', '#f2b705', '#4fb848', '#22b3a6', '#3e7fe0', '#8457dc', '#e0559a'];
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const font = fs.readFileSync(path.join(root, 'src/assets/fonts/nunito-latin-wght.woff2')).toString('base64');

// The front page is part way through: everything left of a slanted line is filled in.
const front = await colourPage('page01', 1400, (r) => r.area > 300000 || r.cx + r.cy * 0.3 < 0.72);
const back = await colourPage('page09', 1000);

const star = (c) =>
  `<svg viewBox="0 0 24 24"><path fill="${c}" d="M12 1.8l3 6.5 7.1.8-5.3 4.8 1.5 7-6.3-3.6-6.3 3.6 1.5-7L1.9 9.1 9 8.3z"/></svg>`;
const heart = (c) =>
  `<svg viewBox="0 0 24 24"><path fill="${c}" d="M12 21.4l-1.5-1.3C5.4 15.5 2 12.4 2 8.6 2 5.5 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.5 22 8.6c0 3.8-3.4 6.9-8.5 11.5z"/></svg>`;
const dot = (c) => `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${c}"/></svg>`;

const confetti = [
  [star('#ffd83d'), 520, 34, 34, -12],
  [heart('#ff8fc8'), 404, 556, 30, 10],
  [dot('#7cc8f8'), 470, 600, 16, 0],
  [dot('#4fc74a'), 600, 168, 14, 0],
  [heart('#a57de0'), 1130, 22, 26, -8],
  [dot('#ef5a52'), 26, 30, 16, 0],
  [star('#ff9a3c'), 22, 470, 26, 14],
]
  .map(([svg, x, y, s, r]) => `<i style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;transform:rotate(${r}deg)">${svg}</i>`)
  .join('');

// Colour by numbers: some of the blank regions show their numbers, like in the app. The
// crayon tip rests on the bush at (0.6, 0.84), so that one is left without a number.
const near = (a, b, d) => Math.hypot((a.lx - b.lx) * 16, (a.ly - b.ly) * 9) < d;
const numbers = [];
for (const r of front.blank) {
  if (numbers.length >= 10) break;
  if (r.lx > 0.97 || r.ly > 0.94 || r.ly < 0.06 || near(r, { lx: 0.6, ly: 0.84 }, 1.8)) continue;
  if (numbers.some((q) => near(q, r, 1.25))) continue;
  numbers.push(r);
}
const labels = numbers
  .map((r) => `<em style="left:${(r.lx * 100).toFixed(2)}%;top:${(r.ly * 100).toFixed(2)}%">${r.n}</em>`)
  .join('');

// A wax crayon, tip on the left. Drawn here rather than taken from the art.
const crayon = `
<svg class="crayon" viewBox="0 0 300 60">
  <path d="M4 25 Q2 30 4 35 L16 37 L16 23 Z" fill="#e07b1f"/>
  <path d="M15 22 L62 6 L62 54 L15 38 Z" fill="#ff9a3c"/>
  <path d="M15 22 L62 6 L62 18 L15 28 Z" fill="#ffc27f"/>
  <rect x="60" y="6" width="236" height="48" rx="10" fill="#ff9a3c"/>
  <path d="M96 6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 V54 l-6 -6 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 Z" fill="#d9731c"/>
  <rect x="120" y="22" width="102" height="16" rx="8" fill="#fff" opacity="0.9"/>
  <rect x="60" y="12" width="236" height="7" rx="3.5" fill="#fff" opacity="0.28"/>
</svg>`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Nunito'; font-weight: 200 1000; src: url(data:font/woff2;base64,${font}) format('woff2'); }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
body {
  position: relative; font-family: 'Nunito', sans-serif; color: #3d3550;
  background:
    radial-gradient(circle at 92% 8%, rgba(255, 216, 61, 0.35) 0 160px, transparent 161px),
    radial-gradient(circle at 103% 96%, rgba(124, 200, 248, 0.32) 0 230px, transparent 231px),
    radial-gradient(circle at -4% 104%, rgba(255, 143, 200, 0.22) 0 190px, transparent 191px),
    #fff8ef;
}
i { position: absolute; display: block; }
i svg { width: 100%; height: 100%; display: block; }
.text { position: absolute; left: 64px; top: 70px; width: 520px; }
.logo { display: flex; font-size: 86px; font-weight: 1000; letter-spacing: -0.01em; line-height: 1; }
.logo span { display: inline-block; text-shadow: 0 4px 0 rgba(61, 53, 80, 0.16); }
.logo span:nth-child(odd) { transform: translateY(-3px) rotate(-3deg); }
.logo span:nth-child(even) { transform: translateY(3px) rotate(3deg); }
h1 { margin-top: 30px; font-size: 54px; line-height: 1.08; font-weight: 900; letter-spacing: -0.01em; }
ul { list-style: none; display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }
li {
  display: flex; align-items: center; gap: 10px; padding: 10px 20px 10px 10px; border-radius: 999px;
  background: #fff; font-size: 25px; font-weight: 800; white-space: nowrap;
  box-shadow: 0 3px 0 rgba(61, 53, 80, 0.1), 0 8px 22px rgba(61, 53, 80, 0.08);
}
li b { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; }
li b svg { width: 20px; height: 20px; }
.url { position: absolute; left: 64px; bottom: 52px; font-size: 28px; font-weight: 900; color: #625a76; letter-spacing: 0.01em; }
.card {
  position: absolute; background: #fff; padding: 12px; border-radius: 22px;
  box-shadow: 0 4px 0 rgba(61, 53, 80, 0.1), 0 22px 48px rgba(61, 53, 80, 0.2);
}
.card img { display: block; width: 100%; border-radius: 12px; }
.art { position: relative; }
em {
  position: absolute; transform: translate(-50%, -50%); font-style: normal; font-size: 21px; font-weight: 900; line-height: 1;
  color: #3d3550; text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff;
}
.back { left: 742px; top: 40px; width: 470px; transform: rotate(8deg); }
.front { left: 556px; top: 214px; width: 640px; transform: rotate(-4deg); }
.crayon { position: absolute; left: 948px; top: 470px; width: 300px; transform: rotate(34deg); transform-origin: 0 50%;
  filter: drop-shadow(0 10px 12px rgba(61, 53, 80, 0.3)); }
</style></head><body>
${confetti}
<div class="text">
  <div class="logo">${[...copy.appName].map((ch, i) => `<span style="color:${LOGO[i % LOGO.length]}">${esc(ch)}</span>`).join('')}</div>
  <h1>${esc(copy.share.headline)}</h1>
  <ul>${copy.share.points
    .map(
      (t, i) =>
        `<li><b style="background:${['#4fc74a', '#3e7fe0', '#ff9a3c'][i % 3]}"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg></b>${esc(t)}</li>`,
    )
    .join('')}</ul>
</div>
<div class="url">webcoloring.org</div>
<div class="card back"><img src="${back.src}"></div>
<div class="card front"><div class="art"><img src="${front.src}">${labels}</div></div>
${crayon}
</body></html>`;

if (args.html) fs.writeFileSync(args.html, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const shot = await page.screenshot({ type: 'png' });
await browser.close();

const out = path.join(root, 'public/share.jpg');
await sharp(shot).resize(1200, 630, { kernel: 'lanczos3' }).jpeg({ quality: 88, mozjpeg: true }).toFile(out);
console.log(`wrote ${path.relative(root, out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
