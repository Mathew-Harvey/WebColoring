import { Bounds, makeCanvas, ctx2d, mulberry32, type Ctx } from './canvas';
import { hexToRgb, hslToRgb, lighten, darken, rgba, rgbToHsl, type RGB } from './colour';
import { path2d, STAMP_PATHS, STAMP_DETAIL, type StampShape } from './shapes';

export type BrushId =
  | 'crayon'
  | 'marker'
  | 'pencil'
  | 'paintbrush'
  | 'watercolour'
  | 'spray'
  | 'glitter'
  | 'rainbow'
  | 'neon'
  | 'stamp'
  | 'eraser';

export interface StrokePoint {
  x: number;
  y: number;
  p: number;
}

export interface Stroke {
  ctx: Ctx;
  colour: RGB;
  hex: string;
  /** Diameter in page px. */
  size: number;
  rand: () => number;
  /** Distance travelled along the stroke, page px. */
  dist: number;
  hue0: number;
  stamp: StampShape;
  tex: Textures;
  /** Dirty area touched since the last flush. */
  dirty: Bounds;
  /** Whole-stroke bounds. */
  total: Bounds;
  points: StrokePoint[];
  /** Last drawn position (segment brushes) or last dab (dab brushes). */
  last: StrokePoint | null;
  /** Distance left over before the next dab. */
  carry: number;
}

export interface BrushDef {
  id: BrushId;
  mode: 'dab' | 'segment' | 'path';
  /** Dab spacing as a fraction of size. */
  spacing: number;
  /** Stroke opacity when committed. */
  opacity: number;
  /** Keeps painting while the pointer is held still. */
  continuous?: boolean;
  defaultSize: number;
  dab?(s: Stroke, x: number, y: number, p: number): void;
  segment?(s: Stroke, a: StrokePoint, b: StrokePoint): void;
  path?(s: Stroke): void;
}

// ------------------------------------------------------------------ textures

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Procedural paper grain and brush sprites, cached per colour. */
export class Textures {
  private grain!: Float32Array;
  private fine!: Float32Array;
  private ready = false;
  readonly size = 256;
  private patterns = new Map<string, CanvasPattern>();
  private sprites = new Map<string, HTMLCanvasElement>();

  /** Builds the noise on first use (or when the browser is idle) to keep page start fast. */
  warm() {
    if (this.ready) return;
    this.ready = true;
    const n = this.size;
    const rand = mulberry32(1234);
    // Value noise (coarse) plus white noise (fine) gives a waxy paper tooth.
    const coarse = new Float32Array(n * n);
    const cell = 16;
    const g = Math.ceil(n / cell) + 1;
    const lattice = new Float32Array(g * g).map(() => rand());
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const gx = x / cell, gy = y / cell;
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        const fx = gx - x0, fy = gy - y0;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const at = (xx: number, yy: number) => lattice[(yy % (g - 1)) * g + (xx % (g - 1))];
        const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
        const bot = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
        coarse[y * n + x] = top * (1 - sy) + bot * sy;
      }
    }
    const white = new Float32Array(n * n).map(() => rand());
    // Blur the white noise so the paper tooth has a few pixels of body.
    const blur = (src: Float32Array, r: number) => {
      const tmp = new Float32Array(n * n);
      const out = new Float32Array(n * n);
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          let s = 0;
          for (let k = -r; k <= r; k++) s += src[y * n + ((x + k + n) % n)];
          tmp[y * n + x] = s / (2 * r + 1);
        }
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          let s = 0;
          for (let k = -r; k <= r; k++) s += tmp[((y + k + n) % n) * n + x];
          out[y * n + x] = s / (2 * r + 1);
        }
      // Stretch back to 0..1.
      let lo = 1, hi = 0;
      for (const v of out) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo || 1);
      return out;
    };
    const tooth = blur(white, 1);
    const fineTooth = blur(white.map(() => rand()), 1);
    // Equalise so a threshold of t covers exactly (1 - t) of the paper.
    const equalise = (v: Float32Array) => {
      const bins = 2048;
      const hist = new Uint32Array(bins + 1);
      for (const x of v) hist[Math.min(bins, Math.max(0, Math.round(x * bins)))]++;
      const cdf = new Float32Array(bins + 1);
      let acc = 0;
      for (let b = 0; b <= bins; b++) {
        cdf[b] = (acc + hist[b] / 2) / v.length;
        acc += hist[b];
      }
      const out = new Float32Array(v.length);
      for (let i = 0; i < v.length; i++) out[i] = cdf[Math.min(bins, Math.max(0, Math.round(v[i] * bins)))];
      return out;
    };
    const mixG = new Float32Array(n * n);
    const mixF = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      mixG[i] = coarse[i] * 0.45 + tooth[i] * 0.55;
      mixF[i] = coarse[i] * 0.2 + fineTooth[i] * 0.8;
    }
    this.grain = equalise(mixG);
    this.fine = equalise(mixF);
  }

  /** Colour pattern with grain: `cover` is how much of the paper gets colour (0..1). */
  grainPattern(ctx: Ctx, hex: string, cover: number, fine = false): CanvasPattern {
    const key = `${fine ? 'f' : 'g'}${hex}${cover}`;
    let pat = this.patterns.get(key);
    if (pat) return pat;
    this.warm();
    const n = this.size;
    const c = makeCanvas(n, n);
    const cx = ctx2d(c);
    const img = cx.createImageData(n, n);
    const { r, g, b } = hexToRgb(hex);
    const src = fine ? this.fine : this.grain;
    // Nearly binary: overlapping dabs then keep the paper showing through.
    const t = 1 - cover;
    for (let i = 0; i < n * n; i++) {
      const a = smooth(t - 0.035, t + 0.035, src[i]);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = a * 255;
    }
    cx.putImageData(img, 0, 0);
    pat = ctx.createPattern(c, 'repeat')!;
    // Page pixels are small on screen, so the grain is drawn a little larger.
    pat.setTransform?.(new DOMMatrix().scale(fine ? 1.2 : 1.6));
    this.patterns.set(key, pat);
    return pat;
  }

  /** Soft round watercolour dab with a slightly darker rim. */
  watercolourSprite(hex: string): HTMLCanvasElement {
    let s = this.sprites.get(hex);
    if (s) return s;
    const n = 128;
    s = makeCanvas(n, n);
    const c = ctx2d(s);
    const col = hexToRgb(hex);
    const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, rgba(col, 0.55));
    g.addColorStop(0.45, rgba(col, 0.48));
    g.addColorStop(0.78, rgba(darken(col, 0.05), 0.26));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, n, n);
    this.sprites.set(hex, s);
    return s;
  }
}

// ------------------------------------------------------------------ brushes

function round(s: Stroke, a: StrokePoint, b: StrokePoint, width: (p: number) => number, style: string | CanvasPattern) {
  const ctx = s.ctx;
  ctx.strokeStyle = style;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(len / Math.max(2, s.size * 0.15)));
  let px = a.x, py = a.y;
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const w = width(a.p + (b.p - a.p) * t);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(x, y);
    ctx.stroke();
    s.dirty.add(x, y, w / 2 + 2);
    s.dirty.add(px, py, w / 2 + 2);
    px = x;
    py = y;
  }
}

function dot(s: Stroke, x: number, y: number, r: number, style: string | CanvasPattern) {
  const ctx = s.ctx;
  ctx.fillStyle = style;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  ctx.fill();
  s.dirty.add(x, y, r + 2);
}

function gaussian(rand: () => number) {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sparkle(ctx: Ctx, x: number, y: number, r: number, style: string) {
  ctx.fillStyle = style;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

export function drawStamp(ctx: Ctx, shape: StampShape, x: number, y: number, size: number, angle: number, colour: RGB) {
  const k = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(k, k);
  ctx.translate(-12, -12);
  const body = path2d(STAMP_PATHS[shape]);
  ctx.fillStyle = rgba(colour, 1);
  ctx.fill(body);
  // Soft shade on the bottom right gives the stamp a little depth.
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = rgba(darken(colour, 0.18), 0.6);
  ctx.beginPath();
  ctx.arc(22, 22, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(darken(colour, 0.35), 1);
  ctx.stroke(body);
  const detail = STAMP_DETAIL[shape];
  if (detail) {
    ctx.fillStyle = rgba(shape === 'flower' ? lighten(colour, 0.7) : darken(colour, 0.45), 1);
    ctx.fill(path2d(detail));
  }
  if (shape === 'block') {
    ctx.fillStyle = rgba(lighten(colour, 0.45), 0.9);
    ctx.fillRect(5.5, 5, 9, 2.2);
    ctx.fillRect(5, 5.5, 2.2, 9);
  }
  if (shape === 'star' || shape === 'heart') {
    ctx.fillStyle = rgba(lighten(colour, 0.65), 0.9);
    ctx.beginPath();
    ctx.ellipse(shape === 'star' ? 9.5 : 7.5, shape === 'star' ? 9.5 : 7.5, 1.8, 1.2, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export const BRUSHES: Record<BrushId, BrushDef> = {
  crayon: {
    id: 'crayon',
    mode: 'dab',
    spacing: 0.16,
    opacity: 0.96,
    defaultSize: 30,
    dab(s, x, y, p) {
      // Press harder (or go slower) and more wax fills the paper's tooth.
      const cover = p < 0.45 ? 0.56 : p < 0.72 ? 0.7 : 0.84;
      const r = (s.size / 2) * (0.8 + 0.2 * p) * (0.92 + s.rand() * 0.14);
      dot(s, x + (s.rand() - 0.5) * r * 0.12, y + (s.rand() - 0.5) * r * 0.12, r, s.tex.grainPattern(s.ctx, s.hex, cover));
    },
  },
  pencil: {
    id: 'pencil',
    mode: 'dab',
    spacing: 0.22,
    opacity: 0.92,
    defaultSize: 12,
    dab(s, x, y, p) {
      const cover = p < 0.5 ? 0.48 : 0.66;
      const r = Math.max(1.5, (s.size / 2) * (0.7 + 0.3 * p));
      dot(s, x, y, r, s.tex.grainPattern(s.ctx, s.hex, cover, true));
    },
  },
  marker: {
    id: 'marker',
    mode: 'segment',
    spacing: 0,
    opacity: 0.88,
    defaultSize: 34,
    segment(s, a, b) {
      round(s, a, b, (p) => s.size * (0.86 + 0.14 * p), s.hex);
    },
  },
  paintbrush: {
    id: 'paintbrush',
    mode: 'segment',
    spacing: 0,
    opacity: 0.96,
    defaultSize: 44,
    segment(s, a, b) {
      const width = (p: number) => s.size * (0.3 + 0.75 * p);
      round(s, a, b, width, s.hex);
      // Bristle streaks.
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) return;
      const nx = -dy / len, ny = dx / len;
      const ctx = s.ctx;
      ctx.lineCap = 'round';
      const wa = width(a.p), wb = width(b.p);
      for (let k = 0; k < 5; k++) {
        const off = (k / 4 - 0.5) * 0.7;
        ctx.strokeStyle = rgba(k % 2 ? darken(s.colour, 0.16) : lighten(s.colour, 0.18), 0.32);
        ctx.lineWidth = Math.max(1, ((wa + wb) / 2) * 0.07);
        ctx.beginPath();
        ctx.moveTo(a.x + nx * off * wa, a.y + ny * off * wa);
        ctx.lineTo(b.x + nx * off * wb, b.y + ny * off * wb);
        ctx.stroke();
      }
    },
  },
  watercolour: {
    id: 'watercolour',
    mode: 'dab',
    spacing: 0.07,
    opacity: 0.82,
    defaultSize: 80,
    dab(s, x, y, p) {
      const d = s.size * (0.75 + 0.35 * p) * (0.85 + s.rand() * 0.3);
      const ctx = s.ctx;
      // A little wander keeps the edge soft and uneven, like wet paint.
      x += (s.rand() - 0.5) * d * 0.12;
      y += (s.rand() - 0.5) * d * 0.12;
      ctx.globalAlpha = 0.11;
      ctx.drawImage(s.tex.watercolourSprite(s.hex), x - d / 2, y - d / 2, d, d);
      ctx.globalAlpha = 1;
      s.dirty.add(x, y, d / 2 + 2);
    },
  },
  spray: {
    id: 'spray',
    mode: 'dab',
    spacing: 0.12,
    opacity: 1,
    continuous: true,
    defaultSize: 100,
    dab(s, x, y, p) {
      const ctx = s.ctx;
      const r = s.size / 2;
      const count = Math.round(14 + 26 * p);
      ctx.fillStyle = s.hex;
      for (let k = 0; k < count; k++) {
        const ox = gaussian(s.rand) * r * 0.42;
        const oy = gaussian(s.rand) * r * 0.42;
        if (ox * ox + oy * oy > r * r) continue;
        const d = 1.6 + s.rand() * 2.2;
        ctx.globalAlpha = 0.55 + s.rand() * 0.45;
        ctx.fillRect(x + ox - d / 2, y + oy - d / 2, d, d);
      }
      ctx.globalAlpha = 1;
      s.dirty.add(x, y, r + 4);
    },
  },
  glitter: {
    id: 'glitter',
    mode: 'dab',
    spacing: 0.18,
    opacity: 1,
    defaultSize: 56,
    dab(s, x, y, p) {
      const ctx = s.ctx;
      const r = s.size / 2;
      const count = Math.round(12 + 14 * p);
      for (let k = 0; k < count; k++) {
        const a = s.rand() * Math.PI * 2;
        const d = Math.sqrt(s.rand()) * r;
        const t = s.rand();
        const c = t < 0.45 ? lighten(s.colour, 0.45 * s.rand()) : t < 0.85 ? darken(s.colour, 0.3 * s.rand()) : t < 0.93 ? { r: 255, g: 255, b: 255 } : { r: 255, g: 214, b: 92 };
        const size = 2.5 + s.rand() * 4.5;
        ctx.fillStyle = rgba(c, 0.75 + s.rand() * 0.25);
        ctx.save();
        ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d);
        ctx.rotate(s.rand() * Math.PI);
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      }
      if (s.rand() < 0.65) {
        const a = s.rand() * Math.PI * 2;
        const d = Math.sqrt(s.rand()) * r * 0.9;
        const sx = x + Math.cos(a) * d;
        const sy = y + Math.sin(a) * d;
        const big = 7 + s.rand() * 12;
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, big * 0.8);
        glow.addColorStop(0, 'rgba(255,255,255,0.7)');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(sx - big, sy - big, big * 2, big * 2);
        sparkle(ctx, sx, sy, big, s.rand() < 0.3 ? 'rgba(255,226,120,1)' : 'rgba(255,255,255,1)');
      }
      s.dirty.add(x, y, r + 22);
    },
  },
  rainbow: {
    id: 'rainbow',
    mode: 'segment',
    spacing: 0,
    opacity: 1,
    defaultSize: 40,
    segment(s, a, b) {
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / 6));
      let prev = a;
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const pt = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t };
        const hue = s.hue0 + (s.dist + len * t) * 0.32;
        round(s, prev, pt, (p) => s.size * (0.85 + 0.15 * p), rgba(hslToRgb(hue, 0.88, 0.58), 1));
        prev = pt;
      }
    },
  },
  neon: {
    id: 'neon',
    mode: 'path',
    spacing: 0,
    opacity: 1,
    defaultSize: 28,
    path(s) {
      const pts = s.points;
      if (!pts.length) return;
      const ctx = s.ctx;
      const trace = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 1) ctx.lineTo(pts[0].x + 0.01, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        if (pts.length > 1) ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      };
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const passes: [number, string][] = [
        [3.0, rgba(s.colour, 0.1)],
        [2.0, rgba(s.colour, 0.2)],
        [1.15, rgba(s.colour, 1)],
        [0.5, rgba(lighten(s.colour, 0.55), 1)],
        [0.18, 'rgba(255,255,255,0.9)'],
      ];
      for (const [k, style] of passes) {
        trace();
        ctx.lineWidth = s.size * k;
        ctx.strokeStyle = style;
        ctx.stroke();
      }
    },
  },
  stamp: {
    id: 'stamp',
    mode: 'dab',
    spacing: 1.3,
    opacity: 1,
    defaultSize: 80,
    dab(s, x, y) {
      const angle = (s.rand() - 0.5) * 0.5;
      drawStamp(s.ctx, s.stamp, x, y, s.size, angle, s.colour);
      s.dirty.add(x, y, s.size * 0.75 + 4);
    },
  },
  eraser: {
    id: 'eraser',
    mode: 'segment',
    spacing: 0,
    opacity: 1,
    defaultSize: 56,
    segment(s, a, b) {
      round(s, a, b, () => s.size, '#ffffff');
    },
  },
};

export function newStroke(ctx: Ctx, hex: string, size: number, stamp: StampShape, tex: Textures, seed: number): Stroke {
  const colour = hexToRgb(hex);
  return {
    ctx,
    colour,
    hex,
    size,
    rand: mulberry32(seed),
    dist: 0,
    hue0: rgbToHsl(colour).h,
    stamp,
    tex,
    dirty: new Bounds(),
    total: new Bounds(),
    points: [],
    last: null,
    carry: 0,
  };
}

/** Feeds one new point into the stroke, drawing as needed. */
export function strokeTo(brush: BrushDef, s: Stroke, pt: StrokePoint) {
  if (brush.mode === 'path') {
    // Path brushes draw the whole stroke as one path (so see-through glows stay even),
    // but only the area around the newest segment is cleared and repainted.
    if (s.last) s.dist += Math.hypot(pt.x - s.last.x, pt.y - s.last.y);
    s.points.push(pt);
    s.last = pt;
    const pad = s.size * 1.6 + 4;
    const area = new Bounds();
    for (const q of s.points.slice(-3)) area.add(q.x, q.y, pad);
    const r = area.rect(s.ctx.canvas.width, s.ctx.canvas.height, 2);
    if (!r) return;
    const ctx = s.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.clearRect(r.x, r.y, r.w, r.h);
    brush.path!(s);
    ctx.restore();
    s.dirty.add(r.x, r.y);
    s.dirty.add(r.x + r.w, r.y + r.h);
  } else if (brush.mode === 'segment') {
    const a = s.last ?? pt;
    brush.segment!(s, a, pt);
    s.dist += Math.hypot(pt.x - a.x, pt.y - a.y);
    s.last = pt;
  } else {
    const step = Math.max(1, s.size * brush.spacing);
    if (!s.last) {
      brush.dab!(s, pt.x, pt.y, pt.p);
      s.last = pt;
      return;
    }
    const a = s.last;
    const len = Math.hypot(pt.x - a.x, pt.y - a.y);
    let d = step - s.carry;
    while (d <= len) {
      const t = d / len;
      brush.dab!(s, a.x + (pt.x - a.x) * t, a.y + (pt.y - a.y) * t, a.p + (pt.p - a.p) * t);
      d += step;
    }
    s.carry = len - (d - step);
    s.dist += len;
    s.last = pt;
  }
}

/** Continuous brushes (spray) keep depositing while held still. */
export function strokeHold(brush: BrushDef, s: Stroke) {
  if (!brush.continuous || !s.last) return;
  brush.dab!(s, s.last.x, s.last.y, s.last.p);
}
