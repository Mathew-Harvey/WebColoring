// Procedural sounds made with the Web Audio API: filtered noise and oscillators only.
// Nothing is loaded from the network. Audio starts only after the first tap or key press.

import type { BrushId } from '../engine/brushes';
import { hexToRgb, rgbToHsl } from '../engine/colour';
import { getSettings, onSettings } from '../data/settings';

type Loop = {
  tool: BrushId;
  env: GainNode;
  nodes: AudioNode[];
  sources: AudioScheduledSourceNode[];
  gain: number;
  lastPing: number;
};

const PENTATONIC = [0, 2, 4, 7, 9];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private loop: Loop | null = null;
  private unlocked = false;

  constructor() {
    onSettings(() => this.applyVolume());
    const unlock = () => {
      this.unlock();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.ctx?.suspend().catch(() => {});
      else if (this.unlocked) this.ctx?.resume().catch(() => {});
    });
  }

  private unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      // A gentle limiter keeps loud moments soft.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolume();
      this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
  }

  private applyVolume() {
    if (!this.ctx || !this.master) return;
    const s = getSettings();
    const v = s.sound ? Math.pow(s.volume, 1.5) * 0.9 : 0;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  private get ready(): AudioContext | null {
    if (!this.ctx || !getSettings().sound || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  private noiseSource(ctx: AudioContext): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random();
    return src;
  }

  private filter(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  /** Slow random wobble on a gain param: the grain of a crayon or pencil. */
  private grain(ctx: AudioContext, target: AudioParam, rate: number, depth: number, sources: AudioScheduledSourceNode[], nodes: AudioNode[]) {
    const n = this.noiseSource(ctx);
    const lp = this.filter(ctx, 'lowpass', rate, 0.5);
    const g = ctx.createGain();
    g.gain.value = depth;
    n.connect(lp).connect(g).connect(target);
    n.start();
    sources.push(n);
    nodes.push(lp, g);
  }

  // ------------------------------------------------------------ stroke loops

  strokeStart(tool: BrushId) {
    this.strokeEnd();
    const ctx = this.ready;
    if (!ctx || !this.master || tool === 'stamp') return;
    const env = ctx.createGain();
    env.gain.value = 0;
    const out = ctx.createGain();
    env.connect(out).connect(this.master);
    const nodes: AudioNode[] = [env, out];
    const sources: AudioScheduledSourceNode[] = [];
    const chain = (...list: AudioNode[]) => {
      for (let i = 0; i < list.length - 1; i++) list[i].connect(list[i + 1]);
      list[list.length - 1].connect(env);
      nodes.push(...list.slice(1));
    };
    let gain = 0.5;
    const n = this.noiseSource(ctx);
    sources.push(n);
    switch (tool) {
      case 'crayon': {
        const g = ctx.createGain();
        g.gain.value = 0.7;
        chain(n, this.filter(ctx, 'bandpass', 1500, 0.9), this.filter(ctx, 'peaking', 3200, 1), g);
        this.grain(ctx, g.gain, 35, 0.9, sources, nodes);
        gain = 0.55;
        break;
      }
      case 'pencil': {
        const g = ctx.createGain();
        g.gain.value = 0.6;
        chain(n, this.filter(ctx, 'highpass', 2600, 0.7), this.filter(ctx, 'bandpass', 5200, 0.8), g);
        this.grain(ctx, g.gain, 60, 1, sources, nodes);
        gain = 0.45;
        break;
      }
      case 'marker': {
        chain(n, this.filter(ctx, 'bandpass', 2900, 2.5));
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 1150;
        const og = ctx.createGain();
        og.gain.value = 0.05;
        osc.connect(og).connect(env);
        osc.start();
        sources.push(osc);
        nodes.push(og);
        gain = 0.42;
        break;
      }
      case 'paintbrush':
        chain(n, this.filter(ctx, 'lowpass', 1100, 0.4), this.filter(ctx, 'highpass', 180, 0.5));
        gain = 0.65;
        break;
      case 'watercolour':
        chain(n, this.filter(ctx, 'lowpass', 650, 0.5), this.filter(ctx, 'highpass', 120, 0.5));
        gain = 0.7;
        break;
      case 'spray':
        chain(n, this.filter(ctx, 'highpass', 4200, 0.6), this.filter(ctx, 'peaking', 8000, 1));
        gain = 0.32;
        break;
      case 'glitter':
      case 'rainbow':
        chain(n, this.filter(ctx, 'highpass', 6500, 0.7));
        gain = 0.12;
        break;
      case 'neon': {
        chain(n, this.filter(ctx, 'bandpass', 900, 1.5));
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 98;
        const lp = this.filter(ctx, 'lowpass', 420, 1);
        const og = ctx.createGain();
        og.gain.value = 0.35;
        osc.connect(lp).connect(og).connect(env);
        osc.start();
        sources.push(osc);
        nodes.push(lp, og);
        gain = 0.3;
        break;
      }
      case 'eraser':
        chain(n, this.filter(ctx, 'bandpass', 850, 1.6));
        gain = 0.55;
        break;
    }
    n.start();
    this.loop = { tool, env, nodes, sources, gain, lastPing: 0 };
  }

  strokeMove(speed: number, pressure: number) {
    const ctx = this.ready;
    const l = this.loop;
    if (!ctx || !l) return;
    const t = ctx.currentTime;
    const move = Math.min(1, speed / 1.1);
    const level = l.tool === 'spray' ? 0.55 + 0.45 * pressure : move * (0.45 + 0.55 * pressure);
    const g = l.env.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(level * l.gain, t, 0.025);
    // Fade out if the hand stops.
    g.setTargetAtTime(0, t + 0.1, 0.07);
    if ((l.tool === 'glitter' || l.tool === 'rainbow') && move > 0.05) {
      const gap = 0.16 / (0.3 + move);
      if (t - l.lastPing > gap) {
        l.lastPing = t;
        const step = PENTATONIC[(Math.random() * 5) | 0] + 12 * ((Math.random() * 2) | 0);
        this.ping(2093 * Math.pow(2, step / 12), 0.07 + 0.05 * pressure, 0.12);
      }
    }
  }

  strokeEnd() {
    const l = this.loop;
    this.loop = null;
    if (!l || !this.ctx) return;
    const t = this.ctx.currentTime;
    l.env.gain.cancelScheduledValues(t);
    l.env.gain.setTargetAtTime(0, t, 0.04);
    for (const s of l.sources) {
      try {
        s.stop(t + 0.3);
      } catch {
        /* already stopped */
      }
    }
    setTimeout(() => {
      for (const n of l.nodes) n.disconnect();
    }, 400);
  }

  // ------------------------------------------------------------ one-shots

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = 0) {
    const ctx = this.ready;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private ping(f: number, vol: number, dur: number, when = 0) {
    this.tone('sine', f, f, dur, vol, when);
  }

  private bell(f: number, vol: number, when = 0) {
    this.tone('sine', f, f, 0.7, vol, when);
    this.tone('sine', f * 2.01, f * 2.01, 0.35, vol * 0.3, when);
    this.tone('triangle', f * 3, f * 3, 0.15, vol * 0.08, when);
  }

  private noiseBurst(type: BiquadFilterType, f0: number, f1: number, dur: number, vol: number) {
    const ctx = this.ready;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const n = this.noiseSource(ctx);
    const f = this.filter(ctx, type, f0, 1.2);
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + dur + 0.05);
  }

  /** Fill bloop. Its pitch follows the colour. */
  fill(hex: string) {
    const { h, l } = rgbToHsl(hexToRgb(hex));
    const f = 220 * Math.pow(2, (h / 360) * 1.2 + (l - 0.5) * 0.5);
    this.tone('sine', f * 1.7, f, 0.28, 0.32);
    this.tone('sine', f * 3.4, f * 2, 0.14, 0.06, 0.01);
  }

  /** Right colour in colour by numbers: a bloop with a little sparkle. */
  pop(hex: string) {
    this.fill(hex);
    const { h } = rgbToHsl(hexToRgb(hex));
    this.ping(1400 + h * 2, 0.08, 0.18, 0.06);
  }

  /** Wrong colour: a soft boing, never harsh. */
  wrong() {
    this.tone('sine', 330, 250, 0.3, 0.16);
    this.tone('sine', 250, 300, 0.22, 0.08, 0.12);
  }

  click() {
    this.tone('sine', 1800, 1500, 0.05, 0.12);
  }

  pick() {
    this.tone('triangle', 1200, 1900, 0.08, 0.14);
  }

  stamp() {
    this.tone('sine', 190, 85, 0.12, 0.4);
    this.noiseBurst('bandpass', 2400, 900, 0.05, 0.12);
  }

  undo() {
    this.noiseBurst('bandpass', 2600, 380, 0.26, 0.28);
  }

  numberDone(n: number) {
    const base = 1046.5 * Math.pow(2, ((n % 5) * 2) / 12);
    this.bell(base, 0.16);
    this.bell(base * 1.26, 0.14, 0.09);
    this.bell(base * 1.5, 0.14, 0.18);
  }

  pageDone() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.2, i * 0.13));
    for (const f of notes) this.tone('triangle', f, f, 0.9, 0.11, 0.56);
    this.bell(2093, 0.08, 0.6);
  }
}

export const sound = new SoundEngine();

// ------------------------------------------------------------ haptics

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export const hapticsSupported = canVibrate;

export function buzz(pattern: number | number[]) {
  if (!canVibrate || !getSettings().haptics) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}
