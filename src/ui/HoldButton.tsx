import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface Props {
  onDone: () => void;
  label: string;
  hint: string;
  ms?: number;
  class?: string;
  children: ComponentChildren;
}

/**
 * A button that only acts when held down. Keeps little fingers out of
 * grown-up areas and links that leave the site.
 */
export function HoldButton({ onDone, label, hint, ms = 1500, class: cls, children }: Props) {
  const [progress, setProgress] = useState(0);
  const start = useRef(0);
  const raf = useRef(0);
  const holding = useRef(false);

  const stop = () => {
    holding.current = false;
    cancelAnimationFrame(raf.current);
    setProgress(0);
  };

  const tick = () => {
    if (!holding.current) return;
    const p = Math.min(1, (performance.now() - start.current) / ms);
    setProgress(p);
    if (p >= 1) {
      stop();
      onDone();
    } else raf.current = requestAnimationFrame(tick);
  };

  const begin = () => {
    if (holding.current) return;
    holding.current = true;
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <button
      type="button"
      class={`hold ${cls ?? ''}`}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        begin();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') stop();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.preventDefault()}
    >
      <span class="hold-ring" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="44" height="44">
          <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(61,53,80,0.12)" stroke-width="4" />
          <circle
            cx="24"
            cy="24"
            r={r}
            fill="none"
            stroke="#ff9a3c"
            stroke-width="4"
            stroke-linecap="round"
            stroke-dasharray={`${c * progress} ${c}`}
            transform="rotate(-90 24 24)"
          />
        </svg>
        <span class="hold-icon">{children}</span>
      </span>
      <span class="hold-text">
        <span class="hold-label">{label}</span>{' '}
        <span class="hold-hint">{hint}</span>
      </span>
    </button>
  );
}
