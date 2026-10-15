export type Ctx = CanvasRenderingContext2D;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement, opts?: CanvasRenderingContext2DSettings): Ctx {
  const ctx = c.getContext('2d', opts);
  if (!ctx) throw new Error('Canvas 2D is not available');
  return ctx;
}

/** Bounding-box accumulator. */
export class Bounds {
  x0 = Infinity;
  y0 = Infinity;
  x1 = -Infinity;
  y1 = -Infinity;

  add(x: number, y: number, r = 0) {
    if (x - r < this.x0) this.x0 = x - r;
    if (y - r < this.y0) this.y0 = y - r;
    if (x + r > this.x1) this.x1 = x + r;
    if (y + r > this.y1) this.y1 = y + r;
  }

  get empty() {
    return this.x1 < this.x0;
  }

  reset() {
    this.x0 = this.y0 = Infinity;
    this.x1 = this.y1 = -Infinity;
  }

  /** Integer rect clipped to the page. */
  rect(w: number, h: number, pad = 2): Rect | null {
    if (this.empty) return null;
    const x = Math.max(0, Math.floor(this.x0 - pad));
    const y = Math.max(0, Math.floor(this.y0 - pad));
    const x1 = Math.min(w, Math.ceil(this.x1 + pad));
    const y1 = Math.min(h, Math.ceil(this.y1 + pad));
    if (x1 <= x || y1 <= y) return null;
    return { x, y, w: x1 - x, h: y1 - y };
  }
}

export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  if (x1 <= x || y1 <= y) return null;
  return { x, y, w: x1 - x, h: y1 - y };
}

export function union(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Small seeded PRNG so textures look the same every time. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
