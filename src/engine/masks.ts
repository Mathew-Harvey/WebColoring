import { makeCanvas, ctx2d } from './canvas';
import type { PageData } from './page-data';

/** Frees a canvas's pixels now rather than whenever it is garbage collected (matters on iOS). */
export function release(c: HTMLCanvasElement | null | undefined) {
  if (!c) return;
  c.width = 1;
  c.height = 1;
}

export interface Mask {
  id: number;
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Builds and caches per-region alpha masks from the region map. */
export class RegionMasks {
  private cache = new Map<number, Mask>();
  private bytes = 0;
  // iOS Safari caps the memory of all canvases together, so keep this modest.
  private readonly limit = 40 * 1024 * 1024;

  constructor(private data: PageData) {}

  regionAt(x: number, y: number): number {
    const { w, h, ids } = this.data;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 0;
    return ids[yi * w + xi];
  }

  /** The region under the point, or the closest one within `radius` px (for taps on a line). */
  nearestRegion(x: number, y: number, radius: number): number {
    const hit = this.regionAt(x, y);
    if (hit) return hit;
    const { w, h, ids } = this.data;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    let best = 0;
    let bestD = Infinity;
    const r = Math.ceil(radius);
    for (let dy = -r; dy <= r; dy++) {
      const yy = cy + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -r; dx <= r; dx++) {
        const xx = cx + dx;
        if (xx < 0 || xx >= w) continue;
        const id = ids[yy * w + xx];
        if (!id) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = id;
        }
      }
    }
    return bestD <= radius * radius ? best : 0;
  }

  get(id: number): Mask {
    const hit = this.cache.get(id);
    if (hit) {
      this.cache.delete(id);
      this.cache.set(id, hit);
      return hit;
    }
    const m = this.build((r) => r === id, this.data.regions.x[id], this.data.regions.y[id], this.data.regions.w[id], this.data.regions.h[id]);
    const mask = { id, ...m };
    this.cache.set(id, mask);
    this.bytes += mask.w * mask.h * 4;
    while (this.bytes > this.limit && this.cache.size > 1) {
      const [oldId, old] = this.cache.entries().next().value as [number, Mask];
      this.cache.delete(oldId);
      this.bytes -= old.w * old.h * 4;
      release(old.canvas);
    }
    return mask;
  }

  /** Union of all regions matching `test`, cropped to their combined bounds, at 1/`step` size. */
  union(test: (id: number) => boolean, step = 1): (Omit<Mask, 'id'> & { step: number }) | null {
    const R = this.data.regions;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let id = 1; id <= R.count; id++) {
      if (!test(id)) continue;
      x0 = Math.min(x0, R.x[id]);
      y0 = Math.min(y0, R.y[id]);
      x1 = Math.max(x1, R.x[id] + R.w[id]);
      y1 = Math.max(y1, R.y[id] + R.h[id]);
    }
    if (x1 < x0) return null;
    return { ...this.build(test, x0, y0, x1 - x0, y1 - y0, step), step };
  }

  private build(test: (id: number) => boolean, bx: number, by: number, bw: number, bh: number, step = 1) {
    const { w, ids } = this.data;
    const cw = Math.ceil(bw / step);
    const ch = Math.ceil(bh / step);
    const canvas = makeCanvas(cw, ch);
    const ctx = ctx2d(canvas);
    const img = ctx.createImageData(cw, ch);
    const px = new Uint32Array(img.data.buffer);
    // Cache the last answer: neighbouring pixels are usually the same region.
    let lastId = -1;
    let lastHit = false;
    for (let y = 0; y < ch; y++) {
      const row = (by + y * step) * w + bx;
      const out = y * cw;
      for (let x = 0; x < cw; x++) {
        const id = ids[row + x * step];
        if (!id) continue;
        if (id !== lastId) {
          lastId = id;
          lastHit = test(id);
        }
        if (lastHit) px[out + x] = 0xff000000;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas, x: bx, y: by, w: bw, h: bh };
  }

  clear() {
    for (const m of this.cache.values()) release(m.canvas);
    this.cache.clear();
    this.bytes = 0;
  }
}
