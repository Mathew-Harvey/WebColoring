// Stamp shapes and colour-by-numbers symbols. All paths use a 24x24 box centred on (12,12),
// so they work as SVG `d` attributes and as Path2D on canvas.

export type StampShape = 'star' | 'heart' | 'block' | 'flower' | 'smile';

export const STAMP_SHAPES: StampShape[] = ['star', 'heart', 'block', 'flower', 'smile'];

function starPath(points: number, outer: number, inner: number, cx = 12, cy = 12, rot = -Math.PI / 2): string {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / points;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;
  }
  return d + 'Z';
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
}

export const STAMP_PATHS: Record<StampShape, string> = {
  star: starPath(5, 11, 4.8),
  heart: 'M12 21.2C11.6 21 2.5 15.2 2.5 8.6 2.5 5.4 5 3 8 3c1.8 0 3.2.9 4 2.3C12.8 3.9 14.2 3 16 3c3 0 5.5 2.4 5.5 5.6 0 6.6-9.1 12.4-9.5 12.6Z',
  block: 'M5.5 2.5h13a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3Z',
  flower:
    circlePath(12, 5.6, 4.2) +
    circlePath(18.1, 10, 4.2) +
    circlePath(15.8, 17.2, 4.2) +
    circlePath(8.2, 17.2, 4.2) +
    circlePath(5.9, 10, 4.2),
  smile: circlePath(12, 12, 10.5),
};

/** Extra detail drawn on top of a stamp in a darker shade. */
export const STAMP_DETAIL: Partial<Record<StampShape, string>> = {
  flower: circlePath(12, 12, 3.6),
  smile: circlePath(8.3, 9.5, 1.5) + circlePath(15.7, 9.5, 1.5) + 'M7.2 13.6c1.1 2.6 2.9 3.9 4.8 3.9s3.7-1.3 4.8-3.9c-1.5.8-3.1 1.2-4.8 1.2s-3.3-.4-4.8-1.2Z',
};

/** Shapes shown with colour by numbers for kids who find colours hard to tell apart. */
export const SYMBOL_PATHS: string[] = [
  circlePath(12, 12, 8),
  'M5 5h14v14H5Z',
  'M12 3.5 21 19.5H3Z',
  'M12 2.5 21.5 12 12 21.5 2.5 12Z',
  starPath(5, 10, 4.2),
  STAMP_PATHS.heart,
  'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
  'M5.6 3.5 12 9.9l6.4-6.4 2.1 2.1-6.4 6.4 6.4 6.4-2.1 2.1-6.4-6.4-6.4 6.4-2.1-2.1 6.4-6.4-6.4-6.4Z',
  'M7 3.3h10l5 8.7-5 8.7H7l-5-8.7Z',
  'M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Zm0 5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z',
  'M15 2.8A9.5 9.5 0 1 0 21.2 15 7.5 7.5 0 0 1 15 2.8Z',
  'M3 8h18v3H3Zm0 5h18v3H3Z',
];

const pathCache = new Map<string, Path2D>();

export function path2d(d: string): Path2D {
  let p = pathCache.get(d);
  if (!p) {
    p = new Path2D(d);
    pathCache.set(d, p);
  }
  return p;
}
