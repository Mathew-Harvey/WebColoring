#!/usr/bin/env node
// Prepares a colouring book for WebColoring.
//
//   npm run prepare-book -- --src <folder> --id <book-id> --title "<title>"
//
// For every pageNN*.jpg|png in the source folder this writes, under
// public/books/<id>/pages/pageNN/:
//   line.png      pure black/white line layer (lossless, gaps closed)
//   overlay.png   transparent line overlay used for rendering (anti-aliased)
//   overlay-half.png  the same at half size, for zoomed-out views
//   regions.bin   region map: RLE of Uint16 region ids, zlib-compressed
//   regions.json  per-region stats (area, centroid, label point, bbox, number)
//   thumb.webp    thumbnail for the page picker (thumb-sm.webp for small screens)
// plus public/books/<id>/book.json and an updated public/books/index.json.
//
// Optional inputs in books/<id>/:
//   book.config.json   { subtitle, easy: [...], detailed: [...], cbnPalette,
//                        canvas: [width, height], closeRadius, speckArea,
//                        paperback: { ages, forGrownUps, size, singleSided } }
// and in the source folder, cover.jpg (16:9, for the shelf) and front.jpg (the real front cover).
//   cbn-overrides.json per-page colour by numbers overrides (see README)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { writeBookCard } from './book-cards.mjs';

// ---------------------------------------------------------------- args

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

if (!args.id) {
  console.error('Usage: npm run prepare-book -- --src <folder> --id <book-id> --title "<title>" [--only 01,13] [--debug]');
  process.exit(1);
}

const bookId = String(args.id);
if (!/^[a-z0-9][a-z0-9-]*$/.test(bookId)) {
  console.error('Book id must be lowercase letters, numbers and dashes.');
  process.exit(1);
}
const bookDir = path.join(root, 'books', bookId);
const srcDir = path.resolve(args.src ? String(args.src) : path.join(bookDir, 'src'));
const outDir = path.join(root, 'public', 'books', bookId);
const debugDir = args.debug ? path.join(root, 'debug', bookId) : null;

const readJson = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);
const config = readJson(path.join(bookDir, 'book.config.json'), {});
const overrides = readJson(path.join(bookDir, 'cbn-overrides.json'), {});
const prevBook = readJson(path.join(outDir, 'book.json'), null);

const title = String(args.title || config.title || prevBook?.title || bookId);

// Every page of a book shares one canvas. 2560x1440 suits landscape art; a book of round
// or portrait designs can ask for another size (an even number of px each way).
const [W, H] = config.canvas ?? [2560, 1440];

// ---------------------------------------------------------------- palette

// Kid-friendly colour by numbers palette, at most 12 colours.
const DEFAULT_CBN_PALETTE = [
  { key: 'sky', hex: '#7cc8f8' },
  { key: 'grass', hex: '#7ccf5e' },
  { key: 'leaf', hex: '#2f9e5a' },
  { key: 'yellow', hex: '#ffd83d' },
  { key: 'orange', hex: '#ff9a3c' },
  { key: 'red', hex: '#ef5a52' },
  { key: 'pink', hex: '#ff8fc8' },
  { key: 'purple', hex: '#a57de0' },
  { key: 'brown', hex: '#a8714a' },
  { key: 'sand', hex: '#f3cf98' },
  { key: 'grey', hex: '#a9b2bd' },
  { key: 'blue', hex: '#3e7fe0' },
];
const CBN_PALETTE = (config.cbnPalette || DEFAULT_CBN_PALETTE).slice(0, 12);
const pal = Object.fromEntries(CBN_PALETTE.map((c, i) => [c.key, i + 1]));
const colourNumber = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && pal[v]) return pal[v];
  throw new Error(`Unknown colour "${v}" in overrides`);
};

// ---------------------------------------------------------------- helpers

function parsePageList(list) {
  // Accepts [1, 2, "4-7", "page10"] or "1-3,8,9".
  const set = new Set();
  const items = Array.isArray(list) ? list : String(list || '').split(',');
  for (let item of items) {
    item = String(item).trim().replace(/^page/i, '');
    if (!item) continue;
    const m = item.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) for (let n = +m[1]; n <= +m[2]; n++) set.add(n);
    else set.add(parseInt(item, 10));
  }
  return set;
}

const easySet = parsePageList(args.easy || config.easy || []);
const detailedSet = parsePageList(args.detailed || config.detailed || []);
const onlySet = args.only ? parsePageList(args.only) : null;

function pageTitleFromName(name) {
  const m = name.match(/^page\d+[-_ ]?(.*)\.(jpe?g|png|webp)$/i);
  if (!m || !m[1]) return null;
  return m[1].replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Separable square dilation (max) of a 0/1 mask. Outside counts as `edge`.
function dilate(mask, w, h, r, edge = 0) {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const xx = x + k;
        v = xx < 0 || xx >= w ? edge : mask[row + xx];
      }
      tmp[row + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const yy = y + k;
        v = yy < 0 || yy >= h ? edge : tmp[yy * w + x];
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

// Erosion via dilation of the complement.
function erode(mask, w, h, r, edge = 1) {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < inv.length; i++) inv[i] = mask[i] ? 0 : 1;
  const d = dilate(inv, w, h, r, edge ? 0 : 1);
  for (let i = 0; i < d.length; i++) d[i] = d[i] ? 0 : 1;
  return d;
}

// Morphological closing: seals gaps up to about 2r px wide.
function close(mask, w, h, r) {
  if (r <= 0) return mask;
  const d = dilate(mask, w, h, r, 0);
  return erode(d, w, h, r, 1);
}

// Label 4-connected components of pixels where mask[i] === value.
// Returns { labels: Int32Array, count, areas: number[] } with labels starting at 1.
function labelComponents(mask, w, h, value) {
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const areas = [0];
  let count = 0;
  for (let start = 0; start < w * h; start++) {
    if (mask[start] !== value || labels[start]) continue;
    count++;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = count;
    let area = 0;
    while (sp) {
      const i = stack[--sp];
      area++;
      const x = i % w;
      if (x > 0 && mask[i - 1] === value && !labels[i - 1]) { labels[i - 1] = count; stack[sp++] = i - 1; }
      if (x < w - 1 && mask[i + 1] === value && !labels[i + 1]) { labels[i + 1] = count; stack[sp++] = i + 1; }
      if (i >= w && mask[i - w] === value && !labels[i - w]) { labels[i - w] = count; stack[sp++] = i - w; }
      if (i < w * (h - 1) && mask[i + w] === value && !labels[i + w]) { labels[i + w] = count; stack[sp++] = i + w; }
    }
    areas.push(area);
  }
  return { labels, count, areas };
}

// Chamfer (3-4) distance to the nearest non-region pixel; the image border counts as boundary.
function distanceTransform(isRegion, w, h) {
  const INF = 65000;
  const d = new Uint16Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = isRegion[i] ? INF : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      const up = y > 0, left = x > 0, right = x < w - 1;
      v = Math.min(v, left ? d[i - 1] + 3 : 3);
      v = Math.min(v, up ? d[i - w] + 3 : 3);
      v = Math.min(v, up && left ? d[i - w - 1] + 4 : 4);
      v = Math.min(v, up && right ? d[i - w + 1] + 4 : 4);
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      const down = y < h - 1, left = x > 0, right = x < w - 1;
      v = Math.min(v, right ? d[i + 1] + 3 : 3);
      v = Math.min(v, down ? d[i + w] + 3 : 3);
      v = Math.min(v, down && right ? d[i + w + 1] + 4 : 4);
      v = Math.min(v, down && left ? d[i + w - 1] + 4 : 4);
      d[i] = v;
    }
  }
  return d;
}

// Zhang-Suen thinning: reduces line strokes to 1 px skeletons.
function thin(mask, w, h) {
  const img = new Uint8Array(mask);
  for (let x = 0; x < w; x++) { img[x] = 0; img[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { img[y * w] = 0; img[y * w + w - 1] = 0; }
  let list = [];
  for (let i = 0; i < img.length; i++) if (img[i]) list.push(i);
  const del = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (const i of list) {
        if (!img[i]) continue;
        const p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1];
        const p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        const a = (!p2 && p3 ? 1 : 0) + (!p3 && p4 ? 1 : 0) + (!p4 && p5 ? 1 : 0) + (!p5 && p6 ? 1 : 0) +
          (!p6 && p7 ? 1 : 0) + (!p7 && p8 ? 1 : 0) + (!p8 && p9 ? 1 : 0) + (!p9 && p2 ? 1 : 0);
        if (a !== 1) continue;
        if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
        del.push(i);
      }
      for (const i of del) img[i] = 0;
      if (del.length) changed = true;
    }
    list = list.filter((i) => img[i]);
  }
  return img;
}

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

// Finds open line ends and seals them to a nearby line or to the image border.
// Returns a mask of thin "bridge" pixels. Bridges stop fills but are not drawn.
function findBridges(line, w, h, opts) {
  const skel = thin(line, w, h);
  // minPart: bridges only join pieces of line at least this big (px), so short dashes (leader
  // lines in exploded views, say) are never joined into walls that cut the background up.
  const parts = opts.minPart ? labelComponents(line, w, h, 1) : null;
  const bigEnough = (i) => !parts || parts.areas[parts.labels[i]] >= opts.minPart;
  const lineDist = distanceTransform(line, w, h);
  const seal = new Uint8Array(w * h);
  const neighbours = (i) => {
    const x = i % w, y = (i / w) | 0;
    const out = [];
    for (const [dx, dy] of N8) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx;
      if (skel[j]) out.push(j);
    }
    return out;
  };
  const adjacent = (a, b) => Math.abs((a % w) - (b % w)) <= 1 && Math.abs(((a / w) | 0) - ((b / w) | 0)) <= 1;
  let bridges = 0;
  const drawSeal = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len * 2));
    for (let k = 0; k <= steps; k++) {
      const x = x0 + ((x1 - x0) * k) / steps;
      const y = y0 + ((y1 - y0) * k) / steps;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.round(x + dx), yy = Math.round(y + dy);
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (!line[j]) seal[j] = 1;
        }
      }
    }
  };

  for (let e = 0; e < skel.length; e++) {
    if (!skel[e] || !bigEnough(e)) continue;
    const nb = neighbours(e);
    if (!(nb.length === 1 || (nb.length === 2 && adjacent(nb[0], nb[1])))) continue;
    // Walk back along the stroke to find its direction.
    const visited = new Set([e]);
    const path = [e];
    let cur = e;
    for (let k = 0; k < 14; k++) {
      let next = neighbours(cur).filter((j) => !visited.has(j));
      if (next.length === 2 && adjacent(next[0], next[1])) {
        const four = next.find((j) => Math.abs(j - cur) === 1 || Math.abs(j - cur) === w) ?? next[0];
        for (const j of next) visited.add(j);
        next = [four];
      }
      if (next.length !== 1) break;
      cur = next[0];
      visited.add(cur);
      path.push(cur);
    }
    if (path.length < 7) continue; // a thinning spur, not a real stroke end
    const ex = e % w, ey = (e / w) | 0;
    const back = path[path.length - 1];
    let dx = ex - (back % w), dy = ey - ((back / w) | 0);
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    const radius = lineDist[e] / 3;
    let best = null;
    for (let deg = -opts.cone; deg <= opts.cone; deg += 7.5) {
      const t = (deg * Math.PI) / 180;
      const rx = dx * Math.cos(t) - dy * Math.sin(t);
      const ry = dx * Math.sin(t) + dy * Math.cos(t);
      let exited = false;
      const maxS = Math.max(opts.border, opts.line + radius);
      for (let s = 1; s <= maxS; s += 1) {
        const px = Math.round(ex + rx * s), py = Math.round(ey + ry * s);
        const penalty = 1 + (0.6 * Math.abs(deg)) / opts.cone;
        if (px < 0 || py < 0 || px >= w || py >= h) {
          if (s <= opts.border && (!best || s * penalty < best.score)) {
            best = { score: s * penalty, x: Math.min(w - 1, Math.max(0, px)), y: Math.min(h - 1, Math.max(0, py)) };
          }
          break;
        }
        const ink = line[py * w + px];
        if (!exited) {
          if (!ink) exited = true;
          else if (s > radius + 4) break;
          continue;
        }
        if (ink) {
          if (s <= opts.line + radius && bigEnough(py * w + px) && (!best || s * penalty < best.score)) best = { score: s * penalty, x: px, y: py };
          break;
        }
      }
    }
    if (best) {
      drawSeal(ex, ey, best.x, best.y);
      bridges++;
    }
  }
  return { seal, bridges };
}

function writeVarint(arr, v) {
  while (v >= 0x80) { arr.push((v & 0x7f) | 0x80); v >>>= 7; }
  arr.push(v);
}

// Region map file: "WCR1" | u16 width | u16 height | u16 count | zlib(varint pairs id,len)
function encodeRegionMap(ids, w, h, count) {
  const bytes = [];
  let i = 0;
  const n = w * h;
  while (i < n) {
    const id = ids[i];
    let j = i + 1;
    while (j < n && ids[j] === id) j++;
    writeVarint(bytes, id);
    writeVarint(bytes, j - i);
    i = j;
  }
  const body = zlib.deflateSync(Buffer.from(bytes), { level: 9 });
  const head = Buffer.alloc(10);
  head.write('WCR1', 0, 'ascii');
  head.writeUInt16LE(w, 4);
  head.writeUInt16LE(h, 6);
  head.writeUInt16LE(count, 8);
  return Buffer.concat([head, body]);
}

function hash32(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

// ---------------------------------------------------------------- page processing

const THRESHOLD = 168; // grey below this is line
// Fine, clean line art (mandalas) keeps more detail with a smaller closeRadius and speckArea.
const CLOSE_RADIUS = config.closeRadius ?? 2; // closes gaps up to ~4 px at 2560 (2 px at the source size)
const SPECK_AREA = config.speckArea ?? 40; // white specks smaller than this become line
const LABEL_MIN_RADIUS = 12; // a number needs this much room (px at 2560)
const BRIDGE = { line: 14, border: 44, cone: 45 }; // max bridge lengths (px at 2560)

async function processPage(file, pageNo, difficulty) {
  const id = `page${String(pageNo).padStart(2, '0')}`;
  const srcPath = path.join(srcDir, file);
  const meta = await sharp(srcPath).metadata();

  // 1. Upscale onto the common canvas, keeping aspect ratio (letterboxed).
  const scale = Math.min(W / meta.width, H / meta.height);
  const sw = Math.round(meta.width * scale);
  const sh = Math.round(meta.height * scale);
  const ox = Math.floor((W - sw) / 2);
  const oy = Math.floor((H - sh) / 2);
  const grey = await sharp(srcPath)
    .flatten({ background: '#ffffff' })
    .greyscale()
    .resize(sw, sh, { kernel: 'lanczos3' })
    .extend({ top: oy, bottom: H - sh - oy, left: ox, right: W - sw - ox, background: '#ffffff' })
    .raw()
    .toBuffer();

  const inArt = (x, y) => x >= ox && x < ox + sw && y >= oy && y < oy + sh;

  // 2. Threshold to pure black/white, then close small gaps so regions seal.
  let line = new Uint8Array(W * H);
  for (let i = 0; i < line.length; i++) line[i] = grey[i] < THRESHOLD ? 1 : 0;
  line = close(line, W, H, CLOSE_RADIUS);

  // Remove white specks (JPEG noise inside lines).
  {
    const { labels, areas } = labelComponents(line, W, H, 0);
    for (let i = 0; i < line.length; i++) {
      if (!line[i] && areas[labels[i]] < SPECK_AREA) line[i] = 1;
    }
  }

  // Letterbox area is neither line nor colourable.
  const outside = new Uint8Array(W * H);
  if (sw !== W || sh !== H) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inArt(x, y)) outside[y * W + x] = 1;
  }

  // 3. Line layer and overlay.
  const lineBuf = Buffer.alloc(W * H);
  const overlayBuf = Buffer.alloc(W * H * 2);
  for (let i = 0; i < W * H; i++) {
    lineBuf[i] = line[i] && !outside[i] ? 0 : 255;
    const g = grey[i];
    let a = (232 - g) / (232 - 96);
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    if (line[i]) a = 1;
    if (outside[i]) a = 0;
    overlayBuf[i * 2] = 0;
    overlayBuf[i * 2 + 1] = Math.round(a * 255);
  }

  // 4. Seal open line ends with invisible bridges, then label enclosed white regions.
  const ov = overrides[id] || {};
  const bridgeOpts = { ...BRIDGE, ...(config.bridge || {}), ...(ov.bridge || {}) };
  const { seal, bridges } = bridgeOpts.line || bridgeOpts.border ? findBridges(line, W, H, bridgeOpts) : { seal: new Uint8Array(W * H), bridges: 0 };
  for (const [x1, y1, x2, y2] of ov.seal || []) {
    // Manual seals from the overrides file, in 0..1 page coordinates.
    const len = Math.hypot((x2 - x1) * W, (y2 - y1) * H);
    for (let k = 0; k <= len * 2; k++) {
      const x = Math.round((x1 + ((x2 - x1) * k) / (len * 2)) * (W - 1));
      const y = Math.round((y1 + ((y2 - y1) * k) / (len * 2)) * (H - 1));
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && !line[yy * W + xx]) seal[yy * W + xx] = 1;
      }
    }
  }
  const regionMask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) regionMask[i] = !line[i] && !seal[i] && !outside[i] ? 1 : 0;
  const { labels, count: rawCount, areas: rawAreas } = labelComponents(regionMask, W, H, 1);
  // Pockets cut off by bridges that are too small to matter go back to their neighbour.
  const ids = new Uint16Array(W * H);
  const remap = new Int32Array(rawCount + 1);
  let count = 0;
  for (let r = 1; r <= rawCount; r++) remap[r] = rawAreas[r] >= SPECK_AREA ? ++count : 0;
  if (count > 65535) throw new Error(`${id}: too many regions (${count})`);
  for (let i = 0; i < ids.length; i++) {
    ids[i] = remap[labels[i]];
    if (!ids[i] && !line[i] && !outside[i]) regionMask[i] = 0;
  }

  // Adjacency: grow regions a few px into the lines and record touching pairs.
  const grown = new Uint16Array(ids);
  {
    let frontier = [];
    for (let i = 0; i < W * H; i++) if (grown[i]) frontier.push(i);
    for (let step = 0; step < 10 && frontier.length; step++) {
      const next = [];
      for (const i of frontier) {
        const r = grown[i];
        const x = i % W;
        const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W];
        for (const j of nb) {
          if (j < 0 || j >= W * H || grown[j] || outside[j]) continue;
          grown[j] = r;
          next.push(j);
        }
      }
      frontier = next;
    }
  }
  // Bridge pixels and orphan pockets join the nearest region so fills meet without gaps.
  for (let i = 0; i < W * H; i++) if (!ids[i] && !line[i] && !outside[i]) ids[i] = grown[i];

  const area = new Float64Array(count + 1);
  const sx = new Float64Array(count + 1);
  const sy = new Float64Array(count + 1);
  const minX = new Int32Array(count + 1).fill(W);
  const minY = new Int32Array(count + 1).fill(H);
  const maxX = new Int32Array(count + 1).fill(-1);
  const maxY = new Int32Array(count + 1).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = ids[y * W + x];
      if (!r) continue;
      area[r]++; sx[r] += x; sy[r] += y;
      if (x < minX[r]) minX[r] = x;
      if (x > maxX[r]) maxX[r] = x;
      if (y < minY[r]) minY[r] = y;
      if (y > maxY[r]) maxY[r] = y;
    }
  }

  // Label point: the spot deepest inside each region (always inside it).
  const dist = distanceTransform(regionMask, W, H);
  const best = new Uint16Array(count + 1);
  const bestI = new Int32Array(count + 1).fill(-1);
  for (let i = 0; i < W * H; i++) {
    const r = ids[i];
    if (r && dist[i] > best[r]) { best[r] = dist[i]; bestI[r] = i; }
  }

  const adj = new Map();
  const addAdj = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a).add(b);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = grown[i];
      if (!a) continue;
      if (x < W - 1) { const b = grown[i + 1]; if (b && b !== a) { addAdj(a, b); addAdj(b, a); } }
      if (y < H - 1) { const b = grown[i + W]; if (b && b !== a) { addAdj(a, b); addAdj(b, a); } }
    }
  }

  // 5. Colour by numbers.
  const defaults = overrides.defaults || {};
  const minArea = ov.minArea ?? (difficulty === 'detailed' ? defaults.minAreaDetailed ?? 7000 : defaults.minAreaEasy ?? 2600);
  const numberOf = new Uint8Array(count + 1);
  // freeBackground: the biggest region, when it is most of the page around separate drawings
  // (exploded views, say), is left for free colour, so the page stays white behind them.
  let background = 0;
  if (ov.freeBackground ?? defaults.freeBackground) {
    for (let r = 1; r <= count; r++) if (!background || area[r] > area[background]) background = r;
    if (area[background] < W * H * 0.3) background = 0;
  }
  const eligible = [];
  for (let r = 1; r <= count; r++) {
    if (r !== background && area[r] >= minArea && best[r] / 3 >= LABEL_MIN_RADIUS) eligible.push(r);
  }
  // Big regions first, so backgrounds claim their colours before details.
  eligible.sort((a, b) => area[b] - area[a]);

  const artH = sh;
  const artTop = oy;
  const bands = {
    top: ['yellow', 'red', 'orange', 'purple', 'blue', 'pink', 'sand', 'grey', 'brown', 'leaf', 'sky'],
    mid: ['red', 'orange', 'blue', 'yellow', 'brown', 'sand', 'purple', 'pink', 'grey', 'leaf'],
    low: ['leaf', 'brown', 'orange', 'grey', 'sand', 'red', 'blue', 'purple', 'yellow', 'pink', 'grass'],
  };
  for (const k of Object.keys(bands)) bands[k] = bands[k].filter((c) => pal[c]).map((c) => pal[c]);

  for (const r of eligible) {
    const cy = (sy[r] / area[r] - artTop) / artH;
    const touchesTop = minY[r] <= artTop + 2;
    const touchesBottom = maxY[r] >= artTop + artH - 3;
    const big = area[r] > W * H * 0.015;
    const used = new Set();
    for (const n of adj.get(r) || []) if (numberOf[n]) used.add(numberOf[n]);
    let choice = 0;
    if (pal.sky && touchesTop && cy < 0.5 && (big || area[r] > W * H * 0.004) && !used.has(pal.sky)) choice = pal.sky;
    else if (pal.grass && touchesBottom && cy > 0.62 && big && !used.has(pal.grass)) choice = pal.grass;
    if (!choice) {
      const band = cy < 0.33 ? bands.top : cy < 0.66 ? bands.mid : bands.low;
      const offset = hash32(r * 7919 + pageNo) % 3;
      for (let k = 0; k < band.length && !choice; k++) {
        const c = band[(k + offset) % band.length];
        if (!used.has(c)) choice = c;
      }
      if (!choice) choice = band[offset % band.length];
    }
    numberOf[r] = choice;
  }

  // Per-page overrides: points in 0..1 page coordinates.
  // The region under a point, or the nearest one within 16 px when it lands on a line.
  const regionAt = (p) => {
    const cx = Math.round(p.x * (W - 1));
    const cy = Math.round(p.y * (H - 1));
    let best = 0;
    let bestD = Infinity;
    for (let dy = -16; dy <= 16; dy++) {
      for (let dx = -16; dx <= 16; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const r = ids[y * W + x];
        const d = dx * dx + dy * dy;
        if (r && d < bestD) { bestD = d; best = r; }
      }
    }
    return best;
  };
  for (const p of ov.set || []) {
    const r = regionAt(p);
    if (r) numberOf[r] = colourNumber(p.n ?? p.colour ?? p.color);
    else console.warn(`  ${id}: no region near override point ${p.x},${p.y}`);
  }
  for (const p of ov.free || []) {
    const r = regionAt(p);
    if (r) numberOf[r] = 0;
  }

  const regions = [];
  let numbered = 0;
  for (let r = 1; r <= count; r++) {
    const bi = bestI[r];
    const lx = bi % W;
    const ly = (bi / W) | 0;
    if (numberOf[r]) numbered++;
    regions.push([
      area[r],
      Math.round(sx[r] / area[r]),
      Math.round(sy[r] / area[r]),
      minX[r], minY[r], maxX[r] - minX[r] + 1, maxY[r] - minY[r] + 1,
      lx, ly, Math.round(best[r] / 3),
      numberOf[r],
    ]);
  }

  // 6. Write files.
  const pageDir = path.join(outDir, 'pages', id);
  fs.mkdirSync(pageDir, { recursive: true });
  await sharp(lineBuf, { raw: { width: W, height: H, channels: 1 } })
    .png({ compressionLevel: 9, palette: true, colours: 2, dither: 0 })
    .toFile(path.join(pageDir, 'line.png'));
  await sharp(overlayBuf, { raw: { width: W, height: H, channels: 2 } })
    .png({ compressionLevel: 9, palette: true, colours: 16, dither: 0, effort: 10 })
    .toFile(path.join(pageDir, 'overlay.png'));
  // Half-size overlay: phones draw this when zoomed out, so it is smooth and cheap.
  await sharp(overlayBuf, { raw: { width: W, height: H, channels: 2 } })
    .resize(W / 2, H / 2, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9, palette: true, colours: 16, dither: 0, effort: 10 })
    .toFile(path.join(pageDir, 'overlay-half.png'));
  const regionBin = encodeRegionMap(ids, W, H, count);
  fs.writeFileSync(path.join(pageDir, 'regions.bin'), regionBin);
  fs.writeFileSync(
    path.join(pageDir, 'regions.json'),
    JSON.stringify({
      v: 1,
      w: W,
      h: H,
      fields: ['area', 'cx', 'cy', 'x', 'y', 'w', 'h', 'lx', 'ly', 'lr', 'n'],
      regions,
    }),
  );
  const thumbRgb = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) thumbRgb[i] = 255 - overlayBuf[i * 2 + 1];
  await sharp(thumbRgb, { raw: { width: W, height: H, channels: 1 } })
    .resize(480, Math.round((480 * H) / W), { kernel: 'lanczos3' })
    .webp({ quality: 82 })
    .toFile(path.join(pageDir, 'thumb.webp'));
  await sharp(thumbRgb, { raw: { width: W, height: H, channels: 1 } })
    .resize(384, Math.round((384 * H) / W), { kernel: 'lanczos3' })
    .webp({ quality: 78 })
    .toFile(path.join(pageDir, 'thumb-sm.webp'));

  if (debugDir) {
    fs.mkdirSync(debugDir, { recursive: true });
    const rgb = Buffer.alloc(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      const r = ids[i];
      if (seal[i]) { rgb[i * 3] = 255; rgb[i * 3 + 1] = 0; rgb[i * 3 + 2] = 0; continue; }
      if (!r) { rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = 0; continue; }
      const hsh = hash32(r);
      rgb[i * 3] = 80 + (hsh & 0x7f) + (area[r] > 200000 ? 40 : 0);
      rgb[i * 3 + 1] = 80 + ((hsh >> 8) & 0x7f);
      rgb[i * 3 + 2] = 80 + ((hsh >> 16) & 0x7f);
    }
    await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
      .resize(1280, 720, { kernel: 'nearest' })
      .png()
      .toFile(path.join(debugDir, `${id}-regions.png`));
    const cbn = Buffer.alloc(W * H * 3, 255);
    for (let i = 0; i < W * H; i++) {
      const r = ids[i];
      if (!r) { cbn[i * 3] = cbn[i * 3 + 1] = cbn[i * 3 + 2] = 0; continue; }
      const n = numberOf[r];
      if (!n) continue;
      const hex = CBN_PALETTE[n - 1].hex;
      cbn[i * 3] = parseInt(hex.slice(1, 3), 16);
      cbn[i * 3 + 1] = parseInt(hex.slice(3, 5), 16);
      cbn[i * 3 + 2] = parseInt(hex.slice(5, 7), 16);
    }
    await sharp(cbn, { raw: { width: W, height: H, channels: 3 } })
      .resize(1280, 720)
      .png()
      .toFile(path.join(debugDir, `${id}-cbn.png`));
  }

  // Content version: changes whenever the line art or region map changes.
  const v = crypto
    .createHash('sha256')
    .update(regionBin)
    .update(fs.readFileSync(path.join(pageDir, 'overlay.png')))
    .update(fs.readFileSync(path.join(pageDir, 'regions.json')))
    .digest('hex')
    .slice(0, 10);

  const largest = Math.max(...regions.map((r) => r[0]));
  return {
    id,
    n: pageNo,
    title: pageTitleFromName(file),
    difficulty,
    cbn: difficulty === 'easy',
    regionCount: count,
    bridges,
    v,
    numbered,
    largestShare: +(largest / (W * H)).toFixed(3),
    artRect: [ox, oy, sw, sh],
  };
}

// ---------------------------------------------------------------- main

async function main() {
  if (!fs.existsSync(srcDir)) {
    console.error(`Source folder not found: ${srcDir}`);
    process.exit(1);
  }
  const files = fs.readdirSync(srcDir).filter((f) => /^page\d+.*\.(jpe?g|png|webp)$/i.test(f));
  files.sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));
  const seen = new Set();
  fs.mkdirSync(outDir, { recursive: true });

  const prevPages = new Map((prevBook?.pages || []).map((p) => [p.id, p]));
  const pages = [];
  for (const file of files) {
    const pageNo = parseInt(file.slice(4), 10);
    if (seen.has(pageNo)) {
      console.warn(`Skipping ${file}: page ${pageNo} already seen`);
      continue;
    }
    seen.add(pageNo);
    const id = `page${String(pageNo).padStart(2, '0')}`;
    if (onlySet && !onlySet.has(pageNo)) {
      if (prevPages.has(id)) pages.push(prevPages.get(id));
      continue;
    }
    let difficulty = easySet.has(pageNo) ? 'easy' : detailedSet.has(pageNo) ? 'detailed' : null;
    const t0 = Date.now();
    let info = await processPage(file, pageNo, difficulty || 'easy');
    if (!difficulty) {
      // No list given: busy pages count as detailed.
      difficulty = info.regionCount > 900 ? 'detailed' : 'easy';
      if (difficulty === 'detailed') info = await processPage(file, pageNo, difficulty);
    }
    pages.push(info);
    console.log(
      `${info.id}  ${difficulty.padEnd(8)} regions ${String(info.regionCount).padStart(5)}  numbered ${String(info.numbered).padStart(4)}  bridges ${String(info.bridges).padStart(4)}  largest ${(info.largestShare * 100).toFixed(1)}%  ${Date.now() - t0}ms`,
    );
  }

  // Cover.
  const coverFile = fs.readdirSync(srcDir).find((f) => /^cover\.(jpe?g|png|webp)$/i.test(f));
  if (coverFile) {
    await sharp(path.join(srcDir, coverFile)).resize(960).webp({ quality: 80 }).toFile(path.join(outDir, 'cover.webp'));
    await sharp(path.join(srcDir, coverFile)).resize(480).webp({ quality: 78 }).toFile(path.join(outDir, 'cover-small.webp'));
    // The link preview card for the book's own page (/book/<id>).
    await writeBookCard(path.join(srcDir, coverFile), path.join(outDir, 'share.jpg'));
  }
  // The real front cover of the paperback, shown where the paper book is offered.
  const frontFile = fs.readdirSync(srcDir).find((f) => /^front\.(jpe?g|png|webp)$/i.test(f));
  if (frontFile) {
    await sharp(path.join(srcDir, frontFile)).resize(480).webp({ quality: 80 }).toFile(path.join(outDir, 'front.webp'));
  }

  const book = {
    id: bookId,
    title,
    subtitle: config.subtitle ?? prevBook?.subtitle ?? null,
    cover: coverFile ? 'cover.webp' : null,
    coverSmall: coverFile ? 'cover-small.webp' : null,
    front: frontFile ? 'front.webp' : null,
    paperback: config.paperback ?? null,
    width: W,
    height: H,
    cbnPalette: CBN_PALETTE,
    pages: pages.map((p) => ({
      id: p.id,
      n: p.n,
      title: p.title,
      difficulty: p.difficulty,
      cbn: p.cbn,
      regionCount: p.regionCount,
      numbered: p.numbered,
      artRect: p.artRect,
      v: p.v,
    })),
  };
  fs.writeFileSync(path.join(outDir, 'book.json'), JSON.stringify(book, null, 1));

  const indexPath = path.join(root, 'public', 'books', 'index.json');
  const index = readJson(indexPath, { books: [] });
  const entry = {
    id: bookId,
    title,
    subtitle: book.subtitle,
    cover: book.coverSmall ? `${bookId}/${book.coverSmall}` : null,
    front: book.front ? `${bookId}/${book.front}` : null,
    paperback: book.paperback,
    pageCount: pages.length,
    order: config.order ?? index.books.find((b) => b.id === bookId)?.order ?? index.books.length,
  };
  index.books = index.books.filter((b) => b.id !== bookId).concat(entry).sort((a, b) => a.order - b.order);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 1));
  console.log(`\nWrote ${pages.length} pages to ${path.relative(root, outDir)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
