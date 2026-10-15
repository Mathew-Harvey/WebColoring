/** Page-to-screen transform: screen = page * scale + offset (CSS px). */
export class View {
  scale = 1;
  ox = 0;
  oy = 0;
  vw = 1;
  vh = 1;
  private anim: { from: [number, number, number]; to: [number, number, number]; t0: number; dur: number } | null = null;

  constructor(
    readonly pw: number,
    readonly ph: number,
  ) {}

  get fitScale() {
    const pad = Math.min(16, Math.min(this.vw, this.vh) * 0.03);
    return Math.min((this.vw - pad * 2) / this.pw, (this.vh - pad * 2) / this.ph);
  }

  get minScale() {
    return this.fitScale * 0.85;
  }

  get maxScale() {
    return Math.max(this.fitScale * 10, 3);
  }

  get isFit() {
    return Math.abs(this.scale - this.fitScale) / this.fitScale < 0.02;
  }

  resize(vw: number, vh: number) {
    const wasFit = this.isFit || this.vw <= 1;
    // Keep the page point at the centre of the screen where it was.
    const cx = (this.vw / 2 - this.ox) / this.scale;
    const cy = (this.vh / 2 - this.oy) / this.scale;
    this.vw = Math.max(1, vw);
    this.vh = Math.max(1, vh);
    if (wasFit) this.fit();
    else {
      this.ox = this.vw / 2 - cx * this.scale;
      this.oy = this.vh / 2 - cy * this.scale;
      this.clamp();
    }
  }

  fitTarget(): [number, number, number] {
    const s = this.fitScale;
    return [s, (this.vw - this.pw * s) / 2, (this.vh - this.ph * s) / 2];
  }

  fit() {
    this.anim = null;
    [this.scale, this.ox, this.oy] = this.fitTarget();
  }

  toPage(sx: number, sy: number): [number, number] {
    return [(sx - this.ox) / this.scale, (sy - this.oy) / this.scale];
  }

  toScreen(px: number, py: number): [number, number] {
    return [px * this.scale + this.ox, py * this.scale + this.oy];
  }

  zoomAt(factor: number, sx: number, sy: number) {
    this.anim = null;
    const next = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    const [px, py] = this.toPage(sx, sy);
    this.scale = next;
    this.ox = sx - px * next;
    this.oy = sy - py * next;
    this.clamp();
  }

  /** Sets scale so page point (px,py) sits under screen point (sx,sy). */
  pinch(scale: number, px: number, py: number, sx: number, sy: number) {
    this.anim = null;
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, scale));
    this.ox = sx - px * this.scale;
    this.oy = sy - py * this.scale;
    this.clamp();
  }

  panBy(dx: number, dy: number) {
    this.anim = null;
    this.ox += dx;
    this.oy += dy;
    this.clamp();
  }

  /** Keeps some of the page on screen; centres it when it is smaller than the view. */
  clamp() {
    const w = this.pw * this.scale;
    const h = this.ph * this.scale;
    const m = Math.min(this.vw, this.vh) * 0.25;
    if (w <= this.vw) this.ox = Math.min(Math.max(this.ox, 0), this.vw - w);
    else this.ox = Math.min(m, Math.max(this.vw - w - m, this.ox));
    if (h <= this.vh) this.oy = Math.min(Math.max(this.oy, 0), this.vh - h);
    else this.oy = Math.min(m, Math.max(this.vh - h - m, this.oy));
  }

  /** Target that shows page rect (x,y,w,h) using about `share` of the screen. */
  targetFor(x: number, y: number, w: number, h: number, share = 0.45): [number, number, number] {
    const s = Math.min(this.maxScale, Math.max(this.fitScale, Math.min((this.vw * share) / w, (this.vh * share) / h)));
    const cx = x + w / 2;
    const cy = y + h / 2;
    return [s, this.vw / 2 - cx * s, this.vh / 2 - cy * s];
  }

  animateTo(target: [number, number, number], dur: number) {
    if (dur <= 0) {
      [this.scale, this.ox, this.oy] = target;
      this.clamp();
      return;
    }
    this.anim = { from: [this.scale, this.ox, this.oy], to: target, t0: performance.now(), dur };
  }

  /** Advances any animation. Returns true while still animating. */
  step(now: number): boolean {
    const a = this.anim;
    if (!a) return false;
    const t = Math.min(1, (now - a.t0) / a.dur);
    const e = 1 - Math.pow(1 - t, 3);
    // Interpolate in log scale so zooms feel even.
    const s = Math.exp(Math.log(a.from[0]) + (Math.log(a.to[0]) - Math.log(a.from[0])) * e);
    // Keep the moving centre consistent with the scale change.
    const cx0 = (this.vw / 2 - a.from[1]) / a.from[0];
    const cy0 = (this.vh / 2 - a.from[2]) / a.from[0];
    const cx1 = (this.vw / 2 - a.to[1]) / a.to[0];
    const cy1 = (this.vh / 2 - a.to[2]) / a.to[0];
    const cx = cx0 + (cx1 - cx0) * e;
    const cy = cy0 + (cy1 - cy0) * e;
    this.scale = s;
    this.ox = this.vw / 2 - cx * s;
    this.oy = this.vh / 2 - cy * s;
    if (t >= 1) {
      this.anim = null;
      [this.scale, this.ox, this.oy] = a.to;
      this.clamp();
      return false;
    }
    return true;
  }

  get animating() {
    return this.anim !== null;
  }
}
