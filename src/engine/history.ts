import type { Ctx, Rect } from './canvas';

/** A rectangle of pixels, run-length packed when that saves space. */
interface Packed {
  rect: Rect;
  rle: boolean;
  data: Uint32Array;
}

export interface CbnChange {
  /** Regions marked done by this step. */
  done: number[];
}

interface Entry {
  rect: Rect;
  before: Packed;
  after: Packed | null;
  cbn: CbnChange | null;
}

function pack(img: ImageData, rect: Rect): Packed {
  const src = new Uint32Array(img.data.buffer, img.data.byteOffset, img.data.byteLength >> 2);
  const n = src.length;
  // Count runs first so we only allocate once.
  let runs = 0;
  for (let i = 0; i < n; ) {
    const v = src[i];
    let j = i + 1;
    while (j < n && src[j] === v) j++;
    runs++;
    i = j;
    if (runs * 2 > n) break;
  }
  if (runs * 2 > n) return { rect, rle: false, data: src.slice() };
  const out = new Uint32Array(runs * 2);
  let k = 0;
  for (let i = 0; i < n; ) {
    const v = src[i];
    let j = i + 1;
    while (j < n && src[j] === v) j++;
    out[k++] = v;
    out[k++] = j - i;
    i = j;
  }
  return { rect, rle: true, data: out };
}

function unpack(p: Packed): ImageData {
  const { w, h } = p.rect;
  const img = new ImageData(w, h);
  const dst = new Uint32Array(img.data.buffer);
  if (!p.rle) dst.set(p.data);
  else {
    let o = 0;
    for (let k = 0; k < p.data.length; k += 2) {
      const v = p.data[k];
      const len = p.data[k + 1];
      if (v) dst.fill(v, o, o + len);
      o += len;
    }
  }
  return img;
}

const bytesOf = (e: Entry) => e.before.data.byteLength + (e.after ? e.after.data.byteLength : 0);

/** Undo/redo using dirty-rect pixel patches of the paint layer. */
export class History {
  private undoStack: Entry[] = [];
  private redoStack: Entry[] = [];
  private bytes = 0;
  readonly minSteps = 50;
  readonly maxSteps = 80;
  readonly budget = 320 * 1024 * 1024;

  constructor(private ctx: Ctx) {}

  /** Call before changing pixels in `rect`. Returns a commit function to call after. */
  capture(rect: Rect): (cbn?: CbnChange | null) => void {
    const before = pack(this.ctx.getImageData(rect.x, rect.y, rect.w, rect.h), rect);
    return (cbn = null) => {
      const e: Entry = { rect, before, after: null, cbn };
      this.undoStack.push(e);
      this.bytes += bytesOf(e);
      for (const r of this.redoStack) this.bytes -= bytesOf(r);
      this.redoStack = [];
      this.trim();
    };
  }

  private trim() {
    while (
      this.undoStack.length > this.maxSteps ||
      (this.bytes > this.budget && this.undoStack.length > this.minSteps)
    ) {
      const e = this.undoStack.shift()!;
      this.bytes -= bytesOf(e);
    }
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  get size() {
    return this.undoStack.length;
  }

  undo(): CbnChange | null | undefined {
    const e = this.undoStack.pop();
    if (!e) return undefined;
    const { x, y, w, h } = e.rect;
    if (!e.after) {
      e.after = pack(this.ctx.getImageData(x, y, w, h), e.rect);
      this.bytes += e.after.data.byteLength;
    }
    this.ctx.putImageData(unpack(e.before), x, y);
    this.redoStack.push(e);
    return e.cbn;
  }

  redo(): CbnChange | null | undefined {
    const e = this.redoStack.pop();
    if (!e || !e.after) return undefined;
    this.ctx.putImageData(unpack(e.after), e.rect.x, e.rect.y);
    this.undoStack.push(e);
    return e.cbn;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
  }
}
