import { BRUSHES, Textures, newStroke, strokeHold, strokeTo, type BrushDef, type BrushId, type Stroke } from './brushes';
import { ctx2d, intersect, makeCanvas, type Ctx, type Rect } from './canvas';
import { hexToRgb, rgbToHex, rgba, lighten, darken, luminance } from './colour';
import { paintFill, type FillStyle } from './fills';
import { History, type CbnChange } from './history';
import { RegionMasks, type Mask } from './masks';
import type { PageData } from './page-data';
import { path2d, SYMBOL_PATHS, type StampShape } from './shapes';
import { View } from './view';

export type ToolId = BrushId | 'fill' | 'eyedropper';

export interface Feedback {
  strokeStart(tool: BrushId): void;
  strokeMove(speed: number, pressure: number): void;
  strokeEnd(): void;
  fill(hex: string): void;
  pop(hex: string): void;
  wrong(): void;
  pick(): void;
  stamp(): void;
  numberDone(n: number): void;
  pageDone(): void;
  undo(): void;
}

export interface EngineEvents {
  /** Undo/redo availability changed. */
  history(): void;
  /** Paint layer changed (for autosave). */
  change(): void;
  /** Eyedropper picked a colour. */
  picked(hex: string): void;
  /** Colour by numbers progress or selection changed. */
  cbn(): void;
  /** A wrong colour was tried on a numbered region. */
  wrong(n: number): void;
  /** Every numbered region is filled. */
  complete(): void;
  /** View moved or zoomed. */
  view(): void;
}

export interface CbnProgress {
  total: number;
  done: number;
  numbers: { n: number; hex: string; key: string; total: number; done: number }[];
}

interface PointerInfo {
  x: number;
  y: number;
  type: string;
}

interface FillFx {
  canvas: HTMLCanvasElement;
  rect: Rect;
  cx: number;
  cy: number;
  t0: number;
  dur: number;
  maxR: number;
  cbn: CbnChange | null;
}

const DESK = '#f4ecdf';
const MAX_DPR = 2;

export class Engine {
  readonly W: number;
  readonly H: number;
  readonly view: View;
  readonly masks: RegionMasks;

  // Layers.
  private display: Ctx;
  private paint: HTMLCanvasElement;
  private paintCtx: Ctx;
  private strokeCanvas: HTMLCanvasElement;
  private strokeCtx: Ctx;
  private overlay: CanvasImageSource;
  private history: History;
  private tex = new Textures();

  // Tool state.
  tool: ToolId = 'crayon';
  colour = '#ef5a52';
  sizes: Record<string, number> = {};
  opacity = 1;
  fillStyle: FillStyle = 'solid';
  stamp: StampShape = 'star';
  stayInside = true;

  // Interaction.
  private pointers = new Map<number, PointerInfo>();
  private mode: 'idle' | 'draw' | 'tap' | 'gesture' | 'pan' | 'consumed' = 'idle';
  private drawPointer = -1;
  private drawType = 'mouse';
  private actionStart = 0;
  private tapStart: PointerInfo | null = null;
  private lastTap: { t: number; x: number; y: number; region: number } | null = null;
  private gesture: { d0: number; s0: number; px: number; py: number } | null = null;
  private panLast: PointerInfo | null = null;
  private penAt = -Infinity;
  private hover: PointerInfo | null = null;
  private spaceDown = false;

  // Stroke in progress.
  private stroke: Stroke | null = null;
  private brush: BrushDef | null = null;
  private clip: Mask | null = null;
  private smooth = { x: 0, y: 0, p: 0.7, sx: 0, sy: 0, t: 0, raw: { x: 0, y: 0 }, realPressure: false };
  private holdAt = 0;
  private stampDist = 0;
  private seed = 1;

  // Effects.
  private fx: FillFx | null = null;
  private hintRegion = 0;
  private hintUntil = 0;
  private wiggle: { id: number; t0: number } | null = null;

  // Colour by numbers.
  readonly cbnPalette: { key: string; hex: string }[];
  private cbnOn = false;
  private cbnSel = 0;
  private done: Uint8Array;
  private numbered: number[] = [];
  private totals = new Int32Array(13);
  private doneCount = new Int32Array(13);
  private highlight: { canvas: HTMLCanvasElement; ctx: Ctx; x: number; y: number; w: number; h: number; step: number } | null = null;
  private highlightFor = 0;
  private pulseUntil = 0;
  private completeFired = false;

  // Screen-sized caches: the paint layer below, and lines plus numbers on top.
  private baseCache: { canvas: HTMLCanvasElement; ctx: Ctx; key: string } | null = null;
  private topCache: { canvas: HTMLCanvasElement; ctx: Ctx; key: string } | null = null;
  private paintVersion = 0;
  private numbersVersion = 0;
  private patterns = false;

  private raf = 0;
  private started = false;
  private dpr = 1;
  private resizeObs: ResizeObserver;
  private destroyed = false;
  private listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private data: PageData,
    palette: { key: string; hex: string }[],
    private feedback: Feedback,
    private events: EngineEvents,
    private reducedMotion: boolean,
  ) {
    this.W = data.w;
    this.H = data.h;
    this.view = new View(this.W, this.H);
    this.masks = new RegionMasks(data);
    this.display = ctx2d(canvas, { alpha: false });
    this.paint = makeCanvas(this.W, this.H);
    // The paint layer is read back for every undo step, so keep it in memory.
    this.paintCtx = ctx2d(this.paint, { willReadFrequently: true });
    this.strokeCanvas = makeCanvas(this.W, this.H);
    this.strokeCtx = ctx2d(this.strokeCanvas);
    this.overlay = data.overlay;
    this.history = new History(this.paintCtx);
    this.cbnPalette = palette;

    const R = data.regions;
    this.done = new Uint8Array(R.count + 1);
    for (let id = 1; id <= R.count; id++) {
      if (R.n[id]) {
        this.numbered.push(id);
        this.totals[R.n[id]]++;
      }
    }

    for (const t of Object.keys(BRUSHES) as BrushId[]) this.sizes[t] = BRUSHES[t].defaultSize;

    this.on(canvas, 'pointerdown', (e) => this.onDown(e as PointerEvent));
    this.on(canvas, 'pointermove', (e) => this.onMove(e as PointerEvent));
    this.on(canvas, 'pointerup', (e) => this.onUp(e as PointerEvent));
    this.on(canvas, 'pointercancel', (e) => this.onUp(e as PointerEvent, true));
    this.on(canvas, 'pointerleave', (e) => {
      if ((e as PointerEvent).pointerType === 'mouse') {
        this.hover = null;
        this.requestRender();
      }
    });
    this.on(canvas, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    this.on(canvas, 'contextmenu', (e) => e.preventDefault());
    this.on(window, 'keydown', (e) => {
      if ((e as KeyboardEvent).code === 'Space') this.spaceDown = true;
    });
    this.on(window, 'keyup', (e) => {
      if ((e as KeyboardEvent).code === 'Space') this.spaceDown = false;
    });
    // Safari pinch gestures on trackpads.
    this.on(canvas, 'gesturestart', (e) => e.preventDefault());

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas);
    this.resize();

    // Make brush textures once things are quiet.
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => !this.destroyed && this.tex.warm(), { timeout: 4000 });
    else setTimeout(() => !this.destroyed && this.tex.warm(), 2500);
  }

  private on(t: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) {
    t.addEventListener(type, fn, opts);
    this.listeners.push([t, type, fn, opts]);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    this.masks.clear();
    this.history.clear();
    // Free GPU memory promptly (iOS is strict about canvas memory).
    for (const c of [this.paint, this.strokeCanvas, this.highlight?.canvas, this.baseCache?.canvas, this.topCache?.canvas]) {
      if (c) {
        c.width = 1;
        c.height = 1;
      }
    }
    for (const img of [this.overlay, this.data.overlayHalf]) if ('close' in img && typeof img.close === 'function') img.close();
  }

  /** Half-size line art (made by the build script): smoother and cheaper when zoomed out. */
  private get overlaySmall(): CanvasImageSource {
    return this.data.overlayHalf;
  }

  // ---------------------------------------------------------------- sizing and view

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * this.dpr));
    const h = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.view.resize(rect.width, rect.height);
    this.requestRender();
    this.events.view();
  }

  fit(animate = true) {
    this.view.animateTo(this.view.fitTarget(), animate && !this.reducedMotion ? 280 : 0);
    this.requestRender();
    this.events.view();
  }

  zoomBy(factor: number) {
    this.view.zoomAt(factor, this.view.vw / 2, this.view.vh / 2);
    this.requestRender();
    this.events.view();
  }

  get isFit() {
    return this.view.isFit;
  }

  // ---------------------------------------------------------------- tool settings

  get showPatterns() {
    return this.patterns;
  }

  set showPatterns(v: boolean) {
    if (v === this.patterns) return;
    this.patterns = v;
    this.numbersVersion++;
    this.requestRender();
  }

  get size() {
    return this.sizes[this.tool] ?? 30;
  }

  set size(v: number) {
    this.sizes[this.tool] = v;
    this.requestRender();
  }

  setTool(t: ToolId) {
    this.finishFx();
    this.tool = t;
    this.requestRender();
  }

  // ---------------------------------------------------------------- pointer input

  private local(e: PointerEvent | WheelEvent): PointerInfo {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, type: 'pointerType' in e ? e.pointerType : 'mouse' };
  }

  private onDown(e: PointerEvent) {
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const pt = this.local(e);
    if (e.pointerType === 'pen') this.penAt = performance.now();
    const palm = e.pointerType === 'touch' && performance.now() - this.penAt < 5000;
    this.pointers.set(e.pointerId, pt);

    if (this.pointers.size === 1) {
      if (palm) {
        this.mode = 'consumed';
        return;
      }
      if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || this.spaceDown)) {
        this.mode = 'pan';
        this.panLast = pt;
        return;
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Double tap on the same spot fits the page. Quick taps on different regions do not.
      const now = performance.now();
      const lt = this.lastTap;
      if (lt && now - lt.t < 320 && Math.hypot(lt.x - pt.x, lt.y - pt.y) < 20 && this.regionAtScreen(pt.x, pt.y) === lt.region && !this.view.isFit) {
        this.lastTap = null;
        this.mode = 'consumed';
        this.fit();
        return;
      }
      this.startAction(pt, e);
    } else if (this.pointers.size === 2) {
      if (this.mode === 'draw') {
        const young = performance.now() - this.actionStart < 280 && (this.stroke?.dist ?? 0) < 60;
        if (young) this.cancelStroke();
        else this.endStroke();
      }
      this.startGesture();
    }
  }

  private startAction(pt: PointerInfo, e: PointerEvent) {
    this.finishFx();
    this.actionStart = performance.now();
    if (this.tool === 'fill' || this.tool === 'eyedropper') {
      this.mode = 'tap';
      this.tapStart = pt;
      this.drawPointer = e.pointerId;
      return;
    }
    this.mode = 'draw';
    this.drawPointer = e.pointerId;
    this.drawType = e.pointerType;
    const [px, py] = this.view.toPage(pt.x, pt.y);
    this.beginStroke(px, py, e);
  }

  private onMove(e: PointerEvent) {
    const pt = this.local(e);
    if (!this.pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') {
        this.hover = pt;
        this.requestRender();
      }
      return;
    }
    const prev = this.pointers.get(e.pointerId)!;
    this.pointers.set(e.pointerId, pt);
    if (e.pointerType === 'mouse') this.hover = pt;

    switch (this.mode) {
      case 'gesture':
        this.updateGesture(e.pointerId, prev);
        break;
      case 'pan':
        if (this.panLast) {
          this.view.panBy(pt.x - this.panLast.x, pt.y - this.panLast.y);
          this.panLast = pt;
          this.requestRender();
          this.events.view();
        }
        break;
      case 'tap':
        if (this.tapStart && Math.hypot(pt.x - this.tapStart.x, pt.y - this.tapStart.y) > 12) {
          // Dragging with the fill tool moves the page instead.
          this.mode = 'pan';
          this.panLast = pt;
        }
        break;
      case 'draw':
        if (e.pointerId !== this.drawPointer || !this.stroke) break;
        {
          const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
          const events = list.length ? list : [e];
          for (const ce of events) this.addPoint(ce);
          this.flushStroke();
        }
        break;
    }
  }

  private onUp(e: PointerEvent, cancelled = false) {
    if (!this.pointers.has(e.pointerId)) return;
    const pt = this.pointers.get(e.pointerId)!;
    this.pointers.delete(e.pointerId);
    const now = performance.now();

    if (this.mode === 'draw' && e.pointerId === this.drawPointer) {
      if (cancelled && now - this.actionStart < 150) this.cancelStroke();
      else {
        const short = now - this.actionStart < 220 && (this.stroke?.dist ?? 0) < 20;
        this.endStroke();
        this.lastTap = short ? { t: now, x: pt.x, y: pt.y, region: this.regionAtScreen(pt.x, pt.y) } : null;
      }
      this.mode = 'idle';
    } else if (this.mode === 'tap' && e.pointerId === this.drawPointer) {
      if (!cancelled) {
        const [px, py] = this.view.toPage(pt.x, pt.y);
        if (this.tool === 'fill') this.tapFill(px, py);
        else this.pick(px, py);
        this.lastTap = { t: now, x: pt.x, y: pt.y, region: this.regionAtScreen(pt.x, pt.y) };
      }
      this.mode = 'idle';
    } else if (this.mode === 'gesture') {
      if (this.pointers.size === 1) {
        // Carry on panning with the finger that is left.
        const [, rest] = [...this.pointers.entries()][0];
        this.gesture = null;
        this.panLast = rest;
        this.mode = 'pan';
      } else if (this.pointers.size === 0) this.mode = 'idle';
      else this.startGesture();
    } else if (this.pointers.size === 0) {
      this.mode = 'idle';
    }
    if (this.pointers.size === 0) this.panLast = null;
  }

  private startGesture() {
    const [a, b] = [...this.pointers.values()];
    this.mode = 'gesture';
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const [px, py] = this.view.toPage(mx, my);
    this.gesture = { d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), s0: this.view.scale, px, py };
  }

  private updateGesture(_id: number, _prev: PointerInfo) {
    if (!this.gesture || this.pointers.size < 2) return;
    const [a, b] = [...this.pointers.values()];
    const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    this.view.pinch(this.gesture.s0 * (d / this.gesture.d0), this.gesture.px, this.gesture.py, mx, my);
    this.requestRender();
    this.events.view();
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const pt = this.local(e);
    const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 400 : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    if (e.ctrlKey) this.view.zoomAt(Math.exp(-dy * 0.01), pt.x, pt.y);
    else if (e.shiftKey) this.view.panBy(-dy, -dx);
    else if (Math.abs(dx) > Math.abs(dy) * 1.5) this.view.panBy(-dx, -dy);
    else this.view.zoomAt(Math.exp(-dy * 0.0016), pt.x, pt.y);
    this.requestRender();
    this.events.view();
  }

  // ---------------------------------------------------------------- strokes

  private beginStroke(px: number, py: number, e: PointerEvent) {
    const tool = this.tool as BrushId;
    const brush = BRUSHES[tool];
    this.brush = brush;
    this.stroke = newStroke(this.strokeCtx, this.colour, this.size, this.stamp, this.tex, this.seed++);
    this.clip = null;
    if (this.stayInside) {
      const r = this.masks.nearestRegion(px, py, 10 + this.size * 0.2);
      if (r) this.clip = this.masks.get(r);
    }
    const real = e.pointerType === 'pen' && e.pressure > 0;
    this.smooth = { x: px, y: py, p: real ? e.pressure : 0.75, sx: e.clientX, sy: e.clientY, t: e.timeStamp, raw: { x: px, y: py }, realPressure: real };
    strokeTo(brush, this.stroke, { x: px, y: py, p: this.smooth.p });
    this.flushStroke();
    this.holdAt = performance.now();
    this.stampDist = 0;
    this.feedback.strokeStart(tool);
    if (tool === 'stamp') this.feedback.stamp();
  }

  private addPoint(e: PointerEvent) {
    if (!this.stroke || !this.brush) return;
    const s = this.smooth;
    const r = this.canvas.getBoundingClientRect();
    const [px, py] = this.view.toPage(e.clientX - r.left, e.clientY - r.top);
    s.raw = { x: px, y: py };
    const dt = Math.max(1, e.timeStamp - s.t);
    const screenDist = Math.hypot(e.clientX - s.sx, e.clientY - s.sy);
    const speed = screenDist / dt; // css px per ms
    s.sx = e.clientX;
    s.sy = e.clientY;
    s.t = e.timeStamp;
    if (s.realPressure && e.pressure > 0) s.p += (e.pressure - s.p) * 0.5;
    else {
      // Simulated pressure: quick strokes are lighter, slow ones are heavier.
      const target = Math.min(1, Math.max(0.3, 1.15 - speed * 0.32));
      s.p += (target - s.p) * 0.18;
    }
    // Light smoothing takes the wobble out of little hands.
    const k = this.drawType === 'pen' ? 0.7 : 0.5;
    s.x += (px - s.x) * k;
    s.y += (py - s.y) * k;
    strokeTo(this.brush, this.stroke, { x: s.x, y: s.y, p: s.p });
    this.holdAt = performance.now();
    this.feedback.strokeMove(speed, s.p);
    if (this.tool === 'stamp' && this.stroke.dist - this.stampDist >= this.size * BRUSHES.stamp.spacing) {
      this.stampDist = this.stroke.dist;
      this.feedback.stamp();
    }
  }

  private flushStroke() {
    const s = this.stroke;
    if (!s) return;
    const r = s.dirty.rect(this.W, this.H, 2);
    s.dirty.reset();
    if (!r) return;
    if (this.clip) clipToMask(this.strokeCtx, r, this.clip);
    s.total.add(r.x, r.y);
    s.total.add(r.x + r.w, r.y + r.h);
    this.requestRender();
  }

  private endStroke() {
    const s = this.stroke;
    const brush = this.brush;
    if (!s || !brush) return;
    // Finish exactly where the pointer lifted.
    const { raw } = this.smooth;
    if (Math.hypot(raw.x - this.smooth.x, raw.y - this.smooth.y) > 0.5 && brush.mode !== 'dab') {
      strokeTo(brush, s, { x: raw.x, y: raw.y, p: this.smooth.p });
    }
    this.flushStroke();
    const rect = s.total.rect(this.W, this.H, 2);
    if (rect) {
      const commit = this.history.capture(rect);
      const ctx = this.paintCtx;
      ctx.save();
      const eraser = this.tool === 'eraser';
      ctx.globalAlpha = (eraser ? 1 : brush.opacity) * this.opacity;
      ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
      ctx.drawImage(this.strokeCanvas, rect.x, rect.y, rect.w, rect.h, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
      this.strokeCtx.clearRect(rect.x, rect.y, rect.w, rect.h);
      this.paintVersion++;
      commit();
      this.events.history();
      this.events.change();
    }
    this.stroke = null;
    this.brush = null;
    this.clip = null;
    this.feedback.strokeEnd();
    this.requestRender();
  }

  private cancelStroke() {
    const s = this.stroke;
    if (!s) return;
    this.flushStroke();
    const rect = s.total.rect(this.W, this.H, 4);
    if (rect) this.strokeCtx.clearRect(rect.x, rect.y, rect.w, rect.h);
    this.stroke = null;
    this.brush = null;
    this.clip = null;
    this.feedback.strokeEnd();
    this.requestRender();
  }

  // ---------------------------------------------------------------- fill and pick

  private tapFill(px: number, py: number) {
    const r = this.masks.nearestRegion(px, py, 10);
    if (!r) return;
    const R = this.data.regions;
    const n = R.n[r];
    if (this.cbnOn && n) {
      if (this.done[r]) {
        this.feedback.pick();
        return;
      }
      if (this.cbnSel !== n) {
        this.wiggle = { id: r, t0: performance.now() };
        this.feedback.wrong();
        this.events.wrong(n);
        this.requestRender();
        return;
      }
      const hex = this.cbnPalette[n - 1].hex;
      this.markDone([r], true);
      this.startFill(r, hex, 'solid', px, py, { done: [r] });
      this.feedback.pop(hex);
      this.checkNumberDone(n);
      return;
    }
    this.startFill(r, this.colour, this.fillStyle, px, py, null);
    this.feedback.fill(this.colour);
  }

  private startFill(r: number, hex: string, style: FillStyle, px: number, py: number, cbn: CbnChange | null) {
    this.finishFx();
    const mask = this.masks.get(r);
    const rect = { x: mask.x, y: mask.y, w: mask.w, h: mask.h };
    const canvas = makeCanvas(rect.w, rect.h);
    const c = ctx2d(canvas);
    c.drawImage(mask.canvas, 0, 0);
    c.globalCompositeOperation = 'source-in';
    paintFill(c, style, hex, rect);
    const corners = [
      [rect.x, rect.y],
      [rect.x + rect.w, rect.y],
      [rect.x, rect.y + rect.h],
      [rect.x + rect.w, rect.y + rect.h],
    ];
    const maxR = Math.max(...corners.map(([x, y]) => Math.hypot(x - px, y - py)));
    const dur = this.reducedMotion ? 0 : Math.min(420, 160 + Math.sqrt(rect.w * rect.h) * 0.12);
    this.fx = { canvas, rect, cx: px, cy: py, t0: performance.now(), dur, maxR, cbn };
    if (!dur) this.finishFx();
    this.requestRender();
  }

  private finishFx() {
    const fx = this.fx;
    if (!fx) return;
    this.fx = null;
    const commit = this.history.capture(fx.rect);
    this.paintCtx.drawImage(fx.canvas, fx.rect.x, fx.rect.y);
    this.paintVersion++;
    fx.canvas.width = 1;
    commit(fx.cbn);
    this.events.history();
    this.events.change();
    this.requestRender();
  }

  private pick(px: number, py: number) {
    const x = Math.max(0, Math.min(this.W - 3, Math.floor(px) - 2));
    const y = Math.max(0, Math.min(this.H - 3, Math.floor(py) - 2));
    const d = this.paintCtx.getImageData(x, y, 5, 5).data;
    // Use the strongest pixel nearby so crayon grain does not give a pale colour.
    let best = 0;
    for (let i = 4; i < d.length; i += 4) if (d[i + 3] > d[best + 3]) best = i;
    const a = d[best + 3] / 255;
    const hex = rgbToHex({
      r: d[best] * a + 255 * (1 - a),
      g: d[best + 1] * a + 255 * (1 - a),
      b: d[best + 2] * a + 255 * (1 - a),
    });
    this.feedback.pick();
    this.events.picked(hex);
  }

  // ---------------------------------------------------------------- undo / redo

  undo() {
    this.finishFx();
    if (this.stroke) this.endStroke();
    const change = this.history.undo();
    if (change === undefined) return;
    this.paintVersion++;
    if (change) this.markDone(change.done, false);
    this.feedback.undo();
    this.events.history();
    this.events.change();
    this.requestRender();
  }

  redo() {
    this.finishFx();
    const change = this.history.redo();
    if (change === undefined) return;
    this.paintVersion++;
    if (change) this.markDone(change.done, true);
    this.feedback.undo();
    this.events.history();
    this.events.change();
    this.requestRender();
  }

  get canUndo() {
    return this.history.canUndo || this.fx !== null;
  }

  get canRedo() {
    return this.history.canRedo;
  }

  // ---------------------------------------------------------------- colour by numbers

  get cbnEnabled() {
    return this.cbnOn;
  }

  get cbnSelected() {
    return this.cbnSel;
  }

  get hasNumbers() {
    return this.numbered.length > 0;
  }

  setCbnEnabled(on: boolean) {
    this.cbnOn = on && this.numbered.length > 0;
    this.numbersVersion++;
    this.events.cbn();
    this.requestRender();
  }

  /** `pulse` is for when a child picks the number; on page load it just lights up. */
  selectNumber(n: number, pulse = true) {
    this.cbnSel = n;
    this.numbersVersion++;
    this.rebuildHighlight();
    // Pulse for a moment after picking a number, then stay softly lit.
    this.pulseUntil = pulse ? performance.now() + 3600 : 0;
    this.events.cbn();
    this.requestRender();
  }

  cbnDoneList(): number[] {
    const out: number[] = [];
    for (const id of this.numbered) if (this.done[id]) out.push(id);
    return out;
  }

  loadCbnDone(ids: number[]) {
    this.numbersVersion++;
    this.done.fill(0);
    this.doneCount.fill(0);
    for (const id of ids) {
      if (id > 0 && id < this.done.length && this.data.regions.n[id] && !this.done[id]) {
        this.done[id] = 1;
        this.doneCount[this.data.regions.n[id]]++;
      }
    }
    this.completeFired = this.cbnProgress().done === this.numbered.length && this.numbered.length > 0;
    if (this.cbnSel) this.rebuildHighlight();
    this.events.cbn();
    this.requestRender();
  }

  cbnProgress(): CbnProgress {
    const numbers = [];
    let total = 0;
    let done = 0;
    for (let n = 1; n <= 12; n++) {
      if (!this.totals[n]) continue;
      numbers.push({ n, hex: this.cbnPalette[n - 1].hex, key: this.cbnPalette[n - 1].key, total: this.totals[n], done: this.doneCount[n] });
      total += this.totals[n];
      done += this.doneCount[n];
    }
    return { total, done, numbers };
  }

  private markDone(ids: number[], value: boolean) {
    const R = this.data.regions;
    this.numbersVersion++;
    for (const id of ids) {
      if (!!this.done[id] === value) continue;
      this.done[id] = value ? 1 : 0;
      this.doneCount[R.n[id]] += value ? 1 : -1;
      if (this.highlight && R.n[id] === this.highlightFor) {
        const m = this.masks.get(id);
        const h = this.highlight;
        const k = 1 / h.step;
        const dx = (m.x - h.x) * k, dy = (m.y - h.y) * k, dw = m.w * k, dh = m.h * k;
        h.ctx.save();
        h.ctx.globalCompositeOperation = value ? 'destination-out' : 'source-over';
        if (!value) {
          // Put the region back into the highlight, in the highlight colour.
          const tmp = makeCanvas(m.w, m.h);
          const t = ctx2d(tmp);
          t.drawImage(m.canvas, 0, 0);
          t.globalCompositeOperation = 'source-in';
          t.fillStyle = this.highlightColour(R.n[id]);
          t.fillRect(0, 0, m.w, m.h);
          h.ctx.drawImage(tmp, dx, dy, dw, dh);
        } else {
          // Grow the cut-out a touch so no half-pixel fringe is left at the edges.
          h.ctx.drawImage(m.canvas, dx - 0.5, dy - 0.5, dw + 1, dh + 1);
        }
        h.ctx.restore();
      }
    }
    if (!value) this.completeFired = false;
    this.events.cbn();
  }

  private checkNumberDone(n: number) {
    if (this.doneCount[n] === this.totals[n]) this.feedback.numberDone(n);
    const p = this.cbnProgress();
    if (p.done === p.total && p.total > 0 && !this.completeFired) {
      this.completeFired = true;
      this.feedback.pageDone();
      this.events.complete();
    }
  }

  private highlightColour(n: number) {
    const c = hexToRgb(this.cbnPalette[n - 1].hex);
    return rgba(luminance(c) > 0.6 ? darken(c, 0.1) : lighten(c, 0.1), 1);
  }

  private rebuildHighlight() {
    if (this.highlight) this.highlight.canvas.width = 1;
    this.highlight = null;
    this.highlightFor = 0;
    const n = this.cbnSel;
    if (!n) return;
    const R = this.data.regions;
    // Half resolution is plenty for a soft glow under the lines, and four times cheaper.
    const u = this.masks.union((id) => R.n[id] === n && !this.done[id], 2);
    if (!u) return;
    const ctx = ctx2d(u.canvas);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = this.highlightColour(n);
    ctx.fillRect(0, 0, u.canvas.width, u.canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    this.highlight = { canvas: u.canvas, ctx, x: u.x, y: u.y, w: u.w, h: u.h, step: u.step };
    this.highlightFor = n;
  }

  /** Numbered regions with their label points, for tests and hints. */
  cbnTargets(): { id: number; n: number; x: number; y: number; r: number; done: boolean }[] {
    const R = this.data.regions;
    return this.numbered.map((id) => ({ id, n: R.n[id], x: R.lx[id], y: R.ly[id], r: R.lr[id], done: !!this.done[id] }));
  }

  /** Zooms to the next unfilled region. Returns false when there is none. */
  hint(): boolean {
    if (!this.cbnOn) return false;
    const R = this.data.regions;
    const left = this.numbered.filter((id) => !this.done[id]);
    if (!left.length) return false;
    let pool = this.cbnSel ? left.filter((id) => R.n[id] === this.cbnSel) : left;
    if (!pool.length) pool = left;
    const [cx, cy] = this.view.toPage(this.view.vw / 2, this.view.vh / 2);
    let best = pool[0];
    let bestD = Infinity;
    for (const id of pool) {
      // Prefer close regions, but do not ignore bigger ones.
      const d = Math.hypot(R.lx[id] - cx, R.ly[id] - cy) / Math.sqrt(1 + R.area[id] / 20000);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    const n = R.n[best];
    if (this.cbnSel !== n) this.selectNumber(n, false);
    const target = this.view.targetFor(R.x[best], R.y[best], R.w[best], R.h[best], 0.4);
    this.view.animateTo(target, this.reducedMotion ? 0 : 450);
    this.hintRegion = best;
    this.hintUntil = performance.now() + 1800;
    this.requestRender();
    this.events.view();
    return true;
  }

  // ---------------------------------------------------------------- saving

  /** Restores a saved paint layer. */
  async loadPaint(blob: Blob) {
    const bmp = await createImageBitmap(blob);
    this.paintCtx.clearRect(0, 0, this.W, this.H);
    this.paintCtx.drawImage(bmp, 0, 0, this.W, this.H);
    bmp.close();
    this.paintVersion++;
    this.history.clear();
    this.events.history();
    this.requestRender();
  }

  clearPaint() {
    this.finishFx();
    const commit = this.history.capture({ x: 0, y: 0, w: this.W, h: this.H });
    this.paintCtx.clearRect(0, 0, this.W, this.H);
    this.paintVersion++;
    commit(null);
    this.events.history();
    this.events.change();
    this.requestRender();
  }

  paintBlob(): Promise<Blob> {
    this.finishFx();
    return new Promise((resolve, reject) => this.paint.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
  }

  /** Paint and lines together on white paper. */
  composite(width = this.W): HTMLCanvasElement {
    this.finishFx();
    const k = width / this.W;
    const c = makeCanvas(this.W * k, this.H * k);
    const ctx = ctx2d(c);
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(this.paint, 0, 0, c.width, c.height);
    ctx.drawImage(k < 0.6 ? this.overlaySmall : this.overlay, 0, 0, c.width, c.height);
    return c;
  }

  /** Painted pixel counts inside and outside a region (used by tests to check for bleed). */
  paintCoverage(region: number): { inside: number; outside: number; outsideOnLines: number } {
    this.finishFx();
    const d = this.paintCtx.getImageData(0, 0, this.W, this.H).data;
    const ids = this.data.ids;
    let inside = 0, outside = 0, outsideOnLines = 0;
    for (let i = 0, p = 3; i < ids.length; i++, p += 4) {
      if (d[p] < 8) continue;
      if (ids[i] === region) inside++;
      else if (ids[i] === 0) outsideOnLines++;
      else outside++;
    }
    return { inside, outside, outsideOnLines };
  }

  regionAtScreen(x: number, y: number): number {
    const [px, py] = this.view.toPage(x, y);
    return this.masks.regionAt(px, py);
  }

  get historySize() {
    return this.history.size;
  }

  /** True when nothing has been painted. */
  isBlank(): boolean {
    const small = makeCanvas(64, 36);
    const ctx = ctx2d(small, { willReadFrequently: true });
    ctx.drawImage(this.paint, 0, 0, 64, 36);
    const d = ctx.getImageData(0, 0, 64, 36).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return false;
    return true;
  }

  // ---------------------------------------------------------------- rendering

  /** Starts drawing. Call once the page's saved state is restored, so setup draws only once. */
  start() {
    this.started = true;
    this.requestRender();
  }

  requestRender() {
    if (this.raf || this.destroyed || !this.started) return;
    this.raf = requestAnimationFrame((t) => {
      this.raf = 0;
      this.render(t);
    });
  }

  private cache(which: 'base' | 'top') {
    const w = this.canvas.width;
    const h = this.canvas.height;
    let c = which === 'base' ? this.baseCache : this.topCache;
    if (!c || c.canvas.width !== w || c.canvas.height !== h) {
      const canvas = c?.canvas ?? makeCanvas(w, h);
      canvas.width = w;
      canvas.height = h;
      c = { canvas, ctx: ctx2d(canvas, which === 'base' ? { alpha: false } : undefined), key: '' };
      if (which === 'base') this.baseCache = c;
      else this.topCache = c;
    }
    return c;
  }

  private render(now: number) {
    if (this.destroyed) return;
    let again = this.view.step(now);
    if (again) this.events.view();
    const ctx = this.display;
    const dpr = this.dpr;
    const v = this.view;
    const s = v.scale;
    const pageTransform = (c: Ctx) => c.setTransform(dpr * s, 0, 0, dpr * s, dpr * v.ox, dpr * v.oy);
    const viewKey = `${this.canvas.width}x${this.canvas.height}|${s}|${v.ox}|${v.oy}`;

    // Paper and paint, cached until either changes.
    const base = this.cache('base');
    const baseKey = `${viewKey}|${this.paintVersion}`;
    if (base.key !== baseKey) {
      const b = base.ctx;
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.fillStyle = DESK;
      b.fillRect(0, 0, base.canvas.width, base.canvas.height);
      pageTransform(b);
      b.fillStyle = 'rgba(90,60,30,0.10)';
      b.fillRect(5 / s, 7 / s, this.W, this.H);
      b.fillStyle = '#ffffff';
      b.fillRect(0, 0, this.W, this.H);
      b.imageSmoothingEnabled = true;
      b.imageSmoothingQuality = 'medium';
      b.drawImage(this.paint, 0, 0);
      base.key = baseKey;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(base.canvas, 0, 0);

    pageTransform(ctx);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    // Fill reveal.
    const fx = this.fx;
    if (fx) {
      const t = Math.min(1, (now - fx.t0) / fx.dur);
      const e = 1 - Math.pow(1 - t, 2.4);
      ctx.save();
      ctx.beginPath();
      ctx.arc(fx.cx, fx.cy, Math.max(1, fx.maxR * e), 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(fx.canvas, fx.rect.x, fx.rect.y);
      ctx.restore();
      if (t >= 1) this.finishFx();
      else again = true;
    }

    // Stroke in progress.
    const st = this.stroke;
    if (st && this.brush) {
      const r = st.total.rect(this.W, this.H, 2);
      if (r) {
        ctx.globalAlpha = (this.tool === 'eraser' ? 1 : this.brush.opacity) * this.opacity;
        ctx.drawImage(this.strokeCanvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
        ctx.globalAlpha = 1;
      }
      if (this.brush.continuous) {
        if (now - this.holdAt > 40 && this.mode === 'draw') {
          strokeHold(this.brush, st);
          this.flushStroke();
          this.holdAt = now;
          this.feedback.strokeMove(0.3, this.smooth.p);
        }
        again = true;
      }
    }

    // Colour by numbers highlight.
    if (this.cbnOn && this.highlight) {
      const pulsing = !this.reducedMotion && now < this.pulseUntil;
      // Fade the pulse out so it settles on the resting level without a jump.
      const k = pulsing ? Math.min(1, (this.pulseUntil - now) / 800) : 0;
      ctx.globalAlpha = 0.34 + 0.16 * Math.sin((now / 1000) * Math.PI * 1.6) * k;
      const hl = this.highlight;
      ctx.drawImage(hl.canvas, hl.x, hl.y, hl.canvas.width * hl.step, hl.canvas.height * hl.step);
      ctx.globalAlpha = 1;
      if (pulsing) again = true;
    }
    if (this.hintRegion && now < this.hintUntil) {
      const m = this.masks.get(this.hintRegion);
      const k = (this.hintUntil - now) / 1800;
      ctx.globalAlpha = 0.45 * Math.abs(Math.sin(now / 160)) * k + 0.08;
      ctx.drawImage(m.canvas, m.x, m.y);
      ctx.globalAlpha = 1;
      again = true;
    } else this.hintRegion = 0;

    // Lines and numbers always on top, cached until the view or numbers change.
    const top = this.cache('top');
    const wiggling = this.cbnOn && this.wiggle !== null;
    const topKey = `${viewKey}|${this.cbnOn ? this.numbersVersion : -1}|${wiggling ? now : 0}`;
    if (top.key !== topKey) {
      const t = top.ctx;
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.clearRect(0, 0, top.canvas.width, top.canvas.height);
      pageTransform(t);
      t.imageSmoothingEnabled = true;
      t.imageSmoothingQuality = 'medium';
      t.drawImage(s * dpr < 0.55 ? this.overlaySmall : this.overlay, 0, 0, this.W, this.H);
      t.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.cbnOn && this.drawNumbers(t, now)) again = true;
      top.key = topKey;
    } else if (wiggling) again = true;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(top.canvas, 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawCursor(ctx);

    if (again) this.requestRender();
  }

  private drawNumbers(ctx: Ctx, now: number): boolean {
    const R = this.data.regions;
    const v = this.view;
    let animating = false;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    let font = 0;
    for (const id of this.numbered) {
      if (this.done[id]) continue;
      const n = R.n[id];
      // Grows with zoom up to a comfortable cap; hidden while too small to read.
      const size = Math.round(Math.min(R.lr[id] * 1.1 * v.scale, 30));
      if (size < 9) continue;
      let [x, y] = v.toScreen(R.lx[id], R.ly[id]);
      if (x < -40 || y < -40 || x > v.vw + 40 || y > v.vh + 40) continue;
      if (this.wiggle && this.wiggle.id === id) {
        const t = (now - this.wiggle.t0) / 450;
        if (t < 1) {
          x += Math.sin(t * Math.PI * 6) * 6 * (1 - t);
          animating = true;
        } else {
          this.wiggle = null;
          this.numbersVersion++;
        }
      }
      if (size !== font) {
        ctx.font = `800 ${size}px Nunito, ui-rounded, system-ui, sans-serif`;
        font = size;
      }
      const label = String(n);
      const selected = n === this.cbnSel;
      if (selected) {
        ctx.fillStyle = this.cbnPalette[n - 1].hex;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = Math.max(1.5, size * 0.08);
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      ctx.lineWidth = Math.max(2, size * 0.24);
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.strokeText(label, x, y + size * 0.04);
      ctx.fillStyle = '#3d3550';
      ctx.fillText(label, x, y + size * 0.04);
      if (this.patterns) {
        const k = (size * 0.7) / 24;
        ctx.save();
        ctx.translate(x + size * 0.55 + (label.length > 1 ? size * 0.2 : 0), y - size * 0.55);
        ctx.scale(k, k);
        ctx.translate(-12, -12);
        const p = path2d(SYMBOL_PATHS[(n - 1) % SYMBOL_PATHS.length]);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke(p);
        ctx.fillStyle = '#3d3550';
        ctx.fill(p);
        ctx.restore();
      }
    }
    return animating;
  }

  private drawCursor(ctx: Ctx) {
    const h = this.hover;
    if (!h || this.mode === 'pan' || this.mode === 'gesture') return;
    if (this.tool === 'fill' || this.tool === 'eyedropper') return;
    const r = (this.size / 2) * this.view.scale;
    if (r < 2) return;
    ctx.beginPath();
    ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(40,30,60,0.7)';
    ctx.stroke();
  }
}

/** Keeps only the pixels of `rect` that are inside `mask`. */
function clipToMask(ctx: Ctx, rect: Rect, mask: Mask) {
  const inter = intersect(rect, mask);
  if (!inter) {
    ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
    return;
  }
  const rx1 = rect.x + rect.w, ry1 = rect.y + rect.h;
  const ix1 = inter.x + inter.w, iy1 = inter.y + inter.h;
  if (inter.y > rect.y) ctx.clearRect(rect.x, rect.y, rect.w, inter.y - rect.y);
  if (iy1 < ry1) ctx.clearRect(rect.x, iy1, rect.w, ry1 - iy1);
  if (inter.x > rect.x) ctx.clearRect(rect.x, inter.y, inter.x - rect.x, inter.h);
  if (ix1 < rx1) ctx.clearRect(ix1, inter.y, rx1 - ix1, inter.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(inter.x, inter.y, inter.w, inter.h);
  ctx.clip();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask.canvas, inter.x - mask.x, inter.y - mask.y, inter.w, inter.h, inter.x, inter.y, inter.w, inter.h);
  ctx.restore();
}
