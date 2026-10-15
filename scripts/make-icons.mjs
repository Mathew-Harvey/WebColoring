// Draws the WebColoring app icons (a chunky rounded W) into public/icons.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public', 'icons');
fs.mkdirSync(out, { recursive: true });

// The W is drawn in a 100x100 box. `pad` shrinks it for maskable icons.
function svg({ rounded = true, pad = 0 } = {}) {
  const k = (100 - pad * 2) / 100;
  const t = (x, y) => `${(pad + x * k).toFixed(2)} ${(pad + y * k).toFixed(2)}`;
  const pts = [
    [20, 30],
    [33, 72],
    [50, 42],
    [67, 72],
    [80, 30],
  ];
  const colours = ['#ef5a52', '#ff9a3c', '#4fb848', '#3e7fe0'];
  const w = 15 * k;
  const segs = colours
    .map((c, i) => `<path d="M${t(...pts[i])}L${t(...pts[i + 1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`)
    .join('');
  const bg = rounded ? `<rect width="100" height="100" rx="24" fill="#fff8ef"/>` : `<rect width="100" height="100" fill="#fff8ef"/>`;
  const shadow = `<g transform="translate(0 ${3 * k})" opacity="0.18">${colours
    .map((_, i) => `<path d="M${t(...pts[i])}L${t(...pts[i + 1])}" stroke="#3d3550" stroke-width="${w}" stroke-linecap="round"/>`)
    .join('')}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${bg}${shadow}${segs}</svg>`;
}

fs.writeFileSync(path.join(out, 'favicon.svg'), svg());
const render = (s, size, file) => sharp(Buffer.from(s), { density: (72 * size) / 100 }).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(out, file));
await render(svg(), 192, 'icon-192.png');
await render(svg(), 512, 'icon-512.png');
await render(svg({ rounded: false, pad: 12 }), 512, 'icon-maskable-512.png');
await render(svg({ rounded: false, pad: 6 }), 180, 'apple-touch-icon.png');
console.log('icons written');
