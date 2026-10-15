import { useEffect, useRef, useState } from 'preact/hooks';
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from '../engine/colour';
import { copy } from '../copy';

interface Props {
  value: string;
  onPick: (hex: string, final: boolean) => void;
}

/** A big hue and shade wheel with a brightness slider. */
export function ColourWheel({ value, onPick }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const init = rgbToHsv(hexToRgb(value));
  const [hsv, setHsv] = useState({ h: init.h, s: init.s, v: Math.max(0.35, init.v) });
  const dragging = useRef(false);
  const size = 220;

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d')!;
    const n = c.width;
    const img = ctx.createImageData(n, n);
    const r = n / 2;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = x - r + 0.5;
        const dy = y - r + 0.5;
        const d = Math.hypot(dx, dy);
        const i = (y * n + x) * 4;
        if (d > r) continue;
        const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        const rgb = hsvToRgb(h, Math.min(1, d / (r - 1)), hsv.v);
        img.data[i] = rgb.r;
        img.data[i + 1] = rgb.g;
        img.data[i + 2] = rgb.b;
        img.data[i + 3] = d > r - 1 ? (r - d) * 255 : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [hsv.v]);

  const pickAt = (e: PointerEvent, final: boolean) => {
    const c = canvas.current!;
    const rect = c.getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2;
    const dy = e.clientY - rect.top - rect.height / 2;
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const s = Math.min(1, Math.hypot(dx, dy) / (rect.width / 2));
    const next = { h, s, v: hsv.v };
    setHsv(next);
    onPick(rgbToHex(hsvToRgb(next.h, next.s, next.v)), final);
  };

  const angle = (hsv.h * Math.PI) / 180;
  const knobX = size / 2 + Math.cos(angle) * hsv.s * (size / 2);
  const knobY = size / 2 + Math.sin(angle) * hsv.s * (size / 2);
  const current = rgbToHex(hsvToRgb(hsv.h, hsv.s, hsv.v));

  return (
    <div class="wheel">
      <div class="wheel-disc" style={{ width: `${size}px`, height: `${size}px` }}>
        <canvas
          ref={canvas}
          style={{ width: `${size}px`, height: `${size}px` }}
          onPointerDown={(e) => {
            dragging.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            pickAt(e as unknown as PointerEvent, false);
          }}
          onPointerMove={(e) => dragging.current && pickAt(e as unknown as PointerEvent, false)}
          onPointerUp={(e) => {
            dragging.current = false;
            pickAt(e as unknown as PointerEvent, true);
          }}
        />
        <span class="wheel-knob" style={{ left: `${knobX}px`, top: `${knobY}px`, background: current }} />
      </div>
      <label class="slider-row">
        <span class="tiny">{copy.colouring.wheel}</span>
        <input
          type="range"
          min={20}
          max={100}
          value={Math.round(hsv.v * 100)}
          aria-label={copy.colouring.wheel}
          style={{ '--track': `linear-gradient(90deg, #000, ${rgbToHex(hsvToRgb(hsv.h, hsv.s, 1))})` }}
          onInput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value) / 100;
            const next = { ...hsv, v };
            setHsv(next);
            onPick(rgbToHex(hsvToRgb(next.h, next.s, next.v)), false);
          }}
          onChange={() => onPick(current, true)}
        />
      </label>
      <label class="native-colour">
        <span class="sr-only">{copy.colouring.wheel}</span>
        <input type="color" value={current} onInput={(e) => onPick((e.currentTarget as HTMLInputElement).value, true)} />
      </label>
    </div>
  );
}
