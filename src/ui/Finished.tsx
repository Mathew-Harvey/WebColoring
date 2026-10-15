import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { copy } from '../copy';
import { Icon } from './icons';
import { PromoCard } from './PromoCard';

interface Props {
  image: HTMLCanvasElement | null;
  storeUrl: string | null;
  bookTitle: string;
  reducedMotion: boolean;
  onSave: () => Promise<void>;
  onPrint: () => Promise<void>;
  onKeepGoing: () => void;
  onMorePages: () => void;
}

const CONFETTI = ['#ef5a52', '#ff9a3c', '#ffd83d', '#7ccf5e', '#22c3b4', '#3e7fe0', '#a57de0', '#ff8fc8'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 1.8 + Math.random() * 1.4,
        size: 8 + Math.random() * 8,
        colour: CONFETTI[i % CONFETTI.length],
        round: Math.random() < 0.4,
        spin: Math.random() < 0.5 ? -1 : 1,
      })),
    [],
  );
  return (
    <div class="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * (p.round ? 1 : 0.5)}px`,
            background: p.colour,
            borderRadius: p.round ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            '--spin': p.spin,
          }}
        />
      ))}
    </div>
  );
}

export function Finished({ image, storeUrl, bookTitle, reducedMotion, onSave, onPrint, onKeepGoing, onMorePages }: Props) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const pic = useRef<HTMLDivElement>(null);

  // Show the finished picture straight from its canvas: no waiting for an image to encode.
  useEffect(() => {
    const box = pic.current;
    if (!box || !image) return;
    image.setAttribute('role', 'img');
    image.setAttribute('aria-label', copy.finished.title);
    box.replaceChildren(image);
    return () => image.remove();
  }, [image]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onKeepGoing();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKeepGoing]);

  const run = (fn: () => Promise<void>, mark = false) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (mark) setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="finished" role="dialog" aria-modal="true" aria-labelledby="finished-title">
      {!reducedMotion && <Confetti />}
      <div class="finished-card">
        <h2 id="finished-title">
          <Icon name="star" size={34} /> {copy.finished.title} <Icon name="star" size={34} />
        </h2>
        <div class="finished-pic">
          {!image && <span class="spinner" />}
          <div class="finished-canvas" ref={pic} />
        </div>
        <div class="finished-actions">
          <button type="button" class="big-btn btn-save" onClick={run(onSave, true)} disabled={busy}>
            <Icon name={saved ? 'check' : 'save'} size={34} />
            <span>{saved ? copy.finished.saved : copy.finished.save}</span>
          </button>
          <button type="button" class="big-btn btn-print" onClick={run(onPrint)} disabled={busy}>
            <Icon name="print" size={34} />
            <span>{copy.finished.print}</span>
          </button>
        </div>
        <div class="finished-nav">
          <button type="button" class="btn" onClick={onKeepGoing}>
            <Icon name="crayon" size={26} tip="#ff9a3c" /> {copy.finished.keepGoing}
          </button>
          <button type="button" class="btn" onClick={onMorePages}>
            <Icon name="grid" size={26} /> {copy.finished.morePages}
          </button>
        </div>
        <PromoCard storeUrl={storeUrl} title={bookTitle} variant="finished" />
      </div>
    </div>
  );
}
