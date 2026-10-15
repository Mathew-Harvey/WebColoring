// Tool buttons, tool options, colour strips and the colour sheet for the colouring screen.
import { copy } from '../copy';
import type { ToolId, CbnProgress } from '../engine/engine';
import { FILL_STYLES, type FillStyle } from '../engine/fills';
import { STAMP_SHAPES, STAMP_PATHS, SYMBOL_PATHS, type StampShape } from '../engine/shapes';
import { hexToRgb, luminance } from '../engine/colour';
import { Icon, type IconName } from './icons';
import { KID_PALETTE, SKIN_TONES, swatchKey } from './palette';
import { ColourWheel } from './ColourWheel';

export const TOOLS: ToolId[] = [
  'fill', 'crayon', 'marker', 'pencil', 'paintbrush', 'watercolour', 'spray', 'glitter', 'rainbow', 'neon', 'stamp', 'eraser', 'eyedropper',
];

const SIZE_MIN = 4;
const SIZE_MAX = 220;
export const sizeToSlider = (s: number) => Math.round((Math.log(s / SIZE_MIN) / Math.log(SIZE_MAX / SIZE_MIN)) * 100);
export const sliderToSize = (v: number) => Math.round(SIZE_MIN * Math.pow(SIZE_MAX / SIZE_MIN, v / 100));

const colourName = (hex: string) => copy.paletteNames[swatchKey(hex)] ?? copy.paletteNames.custom;

export function ToolButtons({ tool, colour, onTool }: { tool: ToolId; colour: string; onTool: (t: ToolId) => void }) {
  return (
    <div class="tool-list" role="toolbar" aria-label={copy.colouring.tools}>
      {TOOLS.map((t) => (
        <button key={t} type="button" class={`tool ${tool === t ? 'on' : ''}`} aria-pressed={tool === t} aria-label={copy.tools[t]} onClick={() => onTool(t)}>
          <Icon name={t as IconName} size={34} tip={t === 'eraser' ? '#ff8fc8' : colour} />
          <span class="tiny" aria-hidden="true">
            {copy.tools[t]}
          </span>
        </button>
      ))}
    </div>
  );
}

interface OptionsProps {
  tool: ToolId;
  colour: string;
  size: number;
  opacity: number;
  fillStyle: FillStyle;
  stamp: StampShape;
  screenScale: number;
  onSize: (s: number) => void;
  onOpacity: (o: number) => void;
  onFillStyle: (s: FillStyle) => void;
  onStamp: (s: StampShape) => void;
}

function FillPreview({ style, colour }: { style: FillStyle; colour: string }) {
  const light = luminance(hexToRgb(colour)) > 0.55;
  const motif = light ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.6)';
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <defs>
        <clipPath id={`fp-clip-${style}`}>
          <rect x="1" y="1" width="28" height="28" rx="8" />
        </clipPath>
        <linearGradient id={`fp-g-${style}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" />
          <stop offset="1" stop-color={colour} />
        </linearGradient>
      </defs>
      <g clip-path={`url(#fp-clip-${style})`}>
        <rect width="30" height="30" fill={style === 'gradient' ? `url(#fp-g-${style})` : colour} />
        {style === 'dots' && [6, 18, 30].flatMap((x) => [6, 18, 30].map((y) => <circle key={`${x}${y}`} cx={x - ((y / 12) % 2) * 6} cy={y} r="3.2" fill={motif} />))}
        {style === 'stripes' && [0, 10, 20, 30, 40].map((k) => <path key={k} d={`M${k} -2 L${k - 32} 32`} stroke={motif} stroke-width="4" />)}
        {style === 'stars' && <path transform="translate(3 3)" d={STAMP_PATHS.star} fill={motif} />}
      </g>
      <rect x="1" y="1" width="28" height="28" rx="8" fill="none" stroke="#3d3550" stroke-width="2" />
    </svg>
  );
}

export function ToolOptions(p: OptionsProps) {
  if (p.tool === 'eyedropper') return <div class="options" />;
  if (p.tool === 'fill') {
    return (
      <div class="options" role="group" aria-label={copy.colouring.fillStyle}>
        {FILL_STYLES.map((s) => (
          <button key={s} type="button" class={`opt ${p.fillStyle === s ? 'on' : ''}`} aria-pressed={p.fillStyle === s} aria-label={copy.fills[s]} onClick={() => p.onFillStyle(s)}>
            <FillPreview style={s} colour={p.colour} />
            <span class="tiny" aria-hidden="true">
              {copy.fills[s]}
            </span>
          </button>
        ))}
      </div>
    );
  }
  const dot = Math.max(4, Math.min(52, p.size * p.screenScale));
  return (
    <div class="options">
      {p.tool === 'stamp' && (
        <div class="stamp-shapes" role="group" aria-label={copy.colouring.stampShape}>
          {STAMP_SHAPES.map((s) => (
            <button key={s} type="button" class={`opt opt-small ${p.stamp === s ? 'on' : ''}`} aria-pressed={p.stamp === s} aria-label={copy.stamps[s]} onClick={() => p.onStamp(s)}>
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                <path d={STAMP_PATHS[s]} fill={p.colour} stroke="#3d3550" stroke-width="1.5" stroke-linejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      )}
      <label class="slider-row size-row">
        <span class="size-dot-box" aria-hidden="true">
          <span class="size-dot" style={{ width: `${dot}px`, height: `${dot}px`, background: p.tool === 'eraser' ? '#fff' : p.colour }} />
        </span>
        <span class="sr-only">{copy.colouring.size}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={sizeToSlider(p.size)}
          aria-label={copy.colouring.size}
          onInput={(e) => p.onSize(sliderToSize(Number((e.currentTarget as HTMLInputElement).value)))}
        />
      </label>
      {p.tool !== 'stamp' && (
        <label class="slider-row opacity-row">
          <span class="opacity-icon" aria-hidden="true" style={{ background: p.tool === 'eraser' ? '#ccc' : p.colour, opacity: p.opacity }} />
          <span class="sr-only">{copy.colouring.opacity}</span>
          <input
            type="range"
            min={15}
            max={100}
            value={Math.round(p.opacity * 100)}
            aria-label={copy.colouring.opacity}
            onInput={(e) => p.onOpacity(Number((e.currentTarget as HTMLInputElement).value) / 100)}
          />
        </label>
      )}
    </div>
  );
}

export function Swatch({ hex, selected, onPick, label }: { hex: string; selected: boolean; onPick: (hex: string) => void; label?: string }) {
  return (
    <button
      type="button"
      class={`swatch ${selected ? 'on' : ''} ${hex === '#ffffff' ? 'swatch-white' : ''}`}
      style={{ '--c': hex }}
      aria-label={label ?? colourName(hex)}
      aria-pressed={selected}
      onClick={() => onPick(hex)}
    />
  );
}

export function ColourStrip({ colour, recent, onPick, onMore }: { colour: string; recent: string[]; onPick: (hex: string) => void; onMore: () => void }) {
  const recentOnly = recent.filter((h) => !KID_PALETTE.some((s) => s.hex === h)).slice(0, 4);
  return (
    <div class="colour-list" role="group" aria-label={copy.colouring.colours}>
      <button type="button" class="swatch-more" aria-label={copy.colouring.moreColours} onClick={onMore}>
        <Icon name="palette" size={34} />
        <span class="tiny" aria-hidden="true">
          {copy.colouring.moreColours}
        </span>
      </button>
      {recentOnly.map((h) => (
        <Swatch key={`r${h}`} hex={h} selected={colour === h} onPick={onPick} />
      ))}
      {KID_PALETTE.map((s) => (
        <Swatch key={s.key} hex={s.hex} selected={colour === s.hex} onPick={onPick} />
      ))}
    </div>
  );
}

export function NumberStrip({
  progress,
  selected,
  wrongKey,
  patterns,
  onSelect,
  onHint,
}: {
  progress: CbnProgress;
  selected: number;
  wrongKey: number;
  patterns: boolean;
  onSelect: (n: number) => void;
  onHint: () => void;
}) {
  const r = 25;
  const c = 2 * Math.PI * r;
  return (
    <div class="colour-list number-list" role="group" aria-label={copy.colouring.cbnOn}>
      <button type="button" class="swatch-more hint-btn" aria-label={copy.colouring.hint} onClick={onHint}>
        <Icon name="hint" size={34} />
        <span class="tiny" aria-hidden="true">
          {copy.colouring.hint}
        </span>
      </button>
      {progress.numbers.map((nb) => {
        const complete = nb.done === nb.total;
        const dark = luminance(hexToRgb(nb.hex)) < 0.35;
        return (
          <button
            key={`${nb.n}-${nb.n === selected ? wrongKey : 0}`}
            type="button"
            class={`num-swatch ${nb.n === selected ? 'on' : ''} ${complete ? 'complete' : ''} ${nb.n === selected && wrongKey ? 'wiggle' : ''}`}
            style={{ '--c': nb.hex }}
            aria-pressed={nb.n === selected}
            aria-label={copy.colouring.numberSwatch(nb.n, nb.done, nb.total)}
            onClick={() => onSelect(nb.n)}
          >
            <svg class="num-ring" viewBox="0 0 60 60" aria-hidden="true">
              <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(61,53,80,0.12)" stroke-width="5" />
              <circle
                cx="30"
                cy="30"
                r={r}
                fill="none"
                stroke="#3d3550"
                stroke-width="5"
                stroke-linecap="round"
                stroke-dasharray={`${(c * nb.done) / nb.total} ${c}`}
                transform="rotate(-90 30 30)"
              />
            </svg>
            <span class="num-fill" aria-hidden="true" style={{ color: dark ? '#fff' : '#3d3550' }}>
              {complete ? <Icon name="check" size={26} /> : nb.n}
            </span>
            {patterns && (
              <svg class="num-symbol" viewBox="0 0 24 24" aria-hidden="true">
                <path d={SYMBOL_PATHS[(nb.n - 1) % SYMBOL_PATHS.length]} fill="#3d3550" stroke="#fff" stroke-width="2.5" paint-order="stroke" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ColourSheet({
  colour,
  recent,
  onPick,
  onClose,
}: {
  colour: string;
  recent: string[];
  /** `close` shuts the sheet; `final` means the child has settled on the colour. */
  onPick: (hex: string, close: boolean, final: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={copy.colouring.moreColours}>
        <div class="sheet-head">
          <span class="sheet-current" style={{ background: colour }} aria-hidden="true" />
          <button type="button" class="round-btn" aria-label={copy.colouring.close} onClick={onClose}>
            <Icon name="close" size={28} />
          </button>
        </div>
        <div class="sheet-body">
          <section>
            <h3 class="tiny-head">
              <Icon name="palette" size={22} /> {copy.colouring.colours}
            </h3>
            <div class="swatch-grid">
              {KID_PALETTE.map((s) => (
                <Swatch key={s.key} hex={s.hex} selected={colour === s.hex} onPick={(h) => onPick(h, true, true)} />
              ))}
            </div>
          </section>
          <section>
            <h3 class="tiny-head">{copy.colouring.skin}</h3>
            <div class="swatch-grid">
              {SKIN_TONES.map((s) => (
                <Swatch key={s.key} hex={s.hex} selected={colour === s.hex} onPick={(h) => onPick(h, true, true)} />
              ))}
            </div>
          </section>
          {recent.length > 0 && (
            <section>
              <h3 class="tiny-head">{copy.colouring.recent}</h3>
              <div class="swatch-grid">
                {recent.map((h) => (
                  <Swatch key={h} hex={h} selected={colour === h} onPick={(x) => onPick(x, true, true)} />
                ))}
              </div>
            </section>
          )}
          <section>
            <h3 class="tiny-head">
              <Icon name="wheel" size={22} /> {copy.colouring.wheel}
            </h3>
            <ColourWheel value={colour} onPick={(h, final) => onPick(h, false, final)} />
          </section>
        </div>
      </div>
    </div>
  );
}
