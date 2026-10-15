import { makeCanvas, ctx2d, type Ctx, type Rect } from './canvas';
import { hexToRgb, lighten, darken, rgba, luminance } from './colour';
import { path2d, STAMP_PATHS } from './shapes';

export type FillStyle = 'solid' | 'gradient' | 'dots' | 'stripes' | 'stars';

export const FILL_STYLES: FillStyle[] = ['solid', 'gradient', 'dots', 'stripes', 'stars'];

const patternCache = new Map<string, CanvasPattern>();

function motifColour(hex: string): string {
  const c = hexToRgb(hex);
  // Light colours get darker motifs, dark colours get lighter ones.
  return luminance(c) > 0.55 ? rgba(darken(c, 0.25), 1) : rgba(lighten(c, 0.55), 1);
}

function makePattern(ctx: Ctx, style: FillStyle, hex: string): CanvasPattern {
  const key = `${style}${hex}`;
  const hit = patternCache.get(key);
  if (hit) return hit;
  const size = style === 'stars' ? 96 : 64;
  // Page pixels are small on screen, so motifs are drawn big.
  const K = 2.5;
  const tile = makeCanvas(size * K, size * K);
  const t = ctx2d(tile);
  t.scale(K, K);
  t.fillStyle = hex;
  t.fillRect(0, 0, size, size);
  t.fillStyle = motifColour(hex);
  if (style === 'dots') {
    for (const [x, y] of [[16, 16], [48, 48], [48, -16], [-16, 48], [80, 48], [48, 80], [16, 80], [80, 16], [-16, 16], [16, -16]]) {
      t.beginPath();
      t.arc(x, y, 9, 0, Math.PI * 2);
      t.fill();
    }
  } else if (style === 'stripes') {
    t.lineWidth = 14;
    t.strokeStyle = t.fillStyle;
    for (let k = -size; k <= size * 2; k += 32) {
      t.beginPath();
      t.moveTo(k, -4);
      t.lineTo(k - size - 8, size + 4);
      t.stroke();
    }
  } else if (style === 'stars') {
    const star = path2d(STAMP_PATHS.star);
    for (const [x, y, s] of [[24, 24, 1.3], [72, 70, 1.1], [72, 22, 0.7], [22, 74, 0.8]]) {
      t.save();
      t.translate(x, y);
      t.scale(s, s);
      t.translate(-12, -12);
      t.fill(star);
      t.restore();
    }
  }
  const pat = ctx.createPattern(tile, 'repeat')!;
  patternCache.set(key, pat);
  return pat;
}

/**
 * Paints `style` in `hex` over the whole of `ctx`, where ctx is a canvas covering
 * page rect `rect`. Patterns are anchored to the page so neighbouring fills line up.
 */
export function paintFill(ctx: Ctx, style: FillStyle, hex: string, rect: Rect) {
  ctx.save();
  if (style === 'solid') {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, rect.w, rect.h);
  } else if (style === 'gradient') {
    const c = hexToRgb(hex);
    const g = ctx.createLinearGradient(0, 0, 0, rect.h);
    g.addColorStop(0, rgba(lighten(c, 0.6), 1));
    g.addColorStop(1, rgba(darken(c, 0.08), 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, rect.w, rect.h);
  } else {
    ctx.translate(-rect.x, -rect.y);
    ctx.fillStyle = makePattern(ctx, style, hex);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}
