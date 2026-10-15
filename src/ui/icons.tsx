// Chunky, friendly icons drawn as inline SVG. `tip` tints the part that shows the current colour.
import type { JSX } from 'preact';

export type IconName =
  | 'back' | 'home' | 'undo' | 'redo' | 'fit' | 'zoomIn' | 'zoomOut' | 'hint' | 'done' | 'inside' | 'numbers'
  | 'save' | 'print' | 'share' | 'lock' | 'gear' | 'soundOn' | 'soundOff' | 'star' | 'grid' | 'easy' | 'detailed'
  | 'close' | 'plus' | 'palette' | 'check' | 'trash' | 'upload' | 'download' | 'book' | 'offline' | 'wheel'
  | 'fill' | 'crayon' | 'marker' | 'pencil' | 'paintbrush' | 'watercolour' | 'spray' | 'glitter' | 'rainbow'
  | 'neon' | 'stamp' | 'eraser' | 'eyedropper';

interface Props {
  name: IconName;
  size?: number;
  tip?: string;
  class?: string;
}

const INK = '#3d3550';

function draw(name: IconName, tip: string): JSX.Element {
  const s = { stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
  switch (name) {
    case 'back':
      return <path {...s} fill="none" stroke-width={4.5} d="M28 12 16 24l12 12" />;
    case 'home':
      return (
        <g {...s}>
          <path fill="#ffd83d" d="M9 22 24 9l15 13v16a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2Z" />
          <path fill="#ef5a52" d="M20 40V29h8v11" />
        </g>
      );
    case 'undo':
      return <path {...s} fill="none" stroke-width={4} d="M17 15 10 22l7 7M10 22h17a9 9 0 0 1 0 18h-5" />;
    case 'redo':
      return <path {...s} fill="none" stroke-width={4} d="M31 15l7 7-7 7M38 22H21a9 9 0 0 0 0 18h5" />;
    case 'fit':
      return <path {...s} fill="none" stroke-width={4} d="M10 18v-8h8M30 10h8v8M38 30v8h-8M18 38h-8v-8" />;
    case 'zoomIn':
      return (
        <g {...s} fill="none" stroke-width={4}>
          <circle cx="21" cy="21" r="11" fill="#fff" />
          <path d="M29 29l9 9M21 16v10M16 21h10" />
        </g>
      );
    case 'zoomOut':
      return (
        <g {...s} fill="none" stroke-width={4}>
          <circle cx="21" cy="21" r="11" fill="#fff" />
          <path d="M29 29l9 9M16 21h10" />
        </g>
      );
    case 'hint':
      return (
        <g {...s}>
          <path fill="#ffd83d" d="M24 7a12 12 0 0 0-7 21.7V33h14v-4.3A12 12 0 0 0 24 7Z" />
          <path fill="none" d="M18 38h12M20 42h8" />
        </g>
      );
    case 'done':
    case 'check':
      return <path {...s} fill="none" stroke-width={5.5} d="M11 25l9 9 17-19" />;
    case 'inside':
      return (
        <g {...s}>
          <rect x="8" y="8" width="32" height="32" rx="9" fill="#fff" stroke-width={4} />
          <path fill="none" stroke={tip} stroke-width={6} d="M15 30c3-7 6 2 9-5s6 1 9-6" />
        </g>
      );
    case 'numbers':
      return (
        <g>
          <rect x="4" y="9" width="40" height="30" rx="10" fill="#fff" stroke={INK} stroke-width={3} />
          <text x="24" y="31" text-anchor="middle" font-family="Nunito, ui-rounded, system-ui, sans-serif" font-weight="900" font-size="17" fill={INK}>
            123
          </text>
        </g>
      );
    case 'save':
    case 'download':
      return <path {...s} fill="none" stroke-width={4} d="M24 8v20M15 20l9 9 9-9M10 34v4a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2v-4" />;
    case 'upload':
      return <path {...s} fill="none" stroke-width={4} d="M24 30V10M15 18l9-9 9 9M10 34v4a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2v-4" />;
    case 'print':
      return (
        <g {...s}>
          <path fill="#fff" d="M14 18V8h20v10" />
          <rect x="7" y="18" width="34" height="16" rx="4" fill="#7cc8f8" />
          <path fill="#fff" d="M14 28h20v12H14Z" />
        </g>
      );
    case 'share':
      return <path {...s} fill="none" stroke-width={4} d="M24 30V8M16 15l8-7 8 7M14 22h-2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V24a2 2 0 0 0-2-2h-2" />;
    case 'lock':
      return (
        <g {...s}>
          <path fill="none" d="M16 21v-5a8 8 0 0 1 16 0v5" />
          <rect x="11" y="21" width="26" height="19" rx="5" fill="#ffd83d" />
        </g>
      );
    case 'gear':
      return (
        <g {...s}>
          <path fill="#a9b2bd" d="M21 6h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2Z" />
          <circle cx="24" cy="24" r="6" fill="#fff" />
        </g>
      );
    case 'soundOn':
      return (
        <g {...s}>
          <path fill="#ffd83d" d="M8 19h7l9-8v26l-9-8H8Z" />
          <path fill="none" d="M30 18a8 8 0 0 1 0 12M34 13a15 15 0 0 1 0 22" />
        </g>
      );
    case 'soundOff':
      return (
        <g {...s}>
          <path fill="#ddd" d="M8 19h7l9-8v26l-9-8H8Z" />
          <path fill="none" d="M31 19l10 10M41 19 31 29" />
        </g>
      );
    case 'star':
      return <path {...s} fill="#ffd83d" d="M24 6l5.3 11.3 12.2 1.5-9 8.5 2.4 12.2L24 33.5l-10.9 6 2.4-12.2-9-8.5 12.2-1.5Z" />;
    case 'grid':
      return (
        <g {...s} stroke-width={3}>
          <rect x="8" y="8" width="14" height="14" rx="3" fill="#7cc8f8" />
          <rect x="26" y="8" width="14" height="14" rx="3" fill="#ffd83d" />
          <rect x="8" y="26" width="14" height="14" rx="3" fill="#7ccf5e" />
          <rect x="26" y="26" width="14" height="14" rx="3" fill="#ff8fc8" />
        </g>
      );
    case 'easy':
      return (
        <g {...s}>
          <circle cx="24" cy="24" r="16" fill="#ffd83d" />
          <path fill="none" d="M17 27c4 5 10 5 14 0" />
          <circle cx="18.5" cy="20" r="1.5" fill={INK} />
          <circle cx="29.5" cy="20" r="1.5" fill={INK} />
        </g>
      );
    case 'detailed':
      return (
        <g {...s}>
          <circle cx="21" cy="21" r="12" fill="#fff" />
          <path fill="none" stroke-width={5} d="M30 30l9 9" />
          <path fill="#ff9a3c" stroke-width={2} d="M21 14l2 4.5 4.8.4-3.7 3.1 1.2 4.7L21 24.2l-4.3 2.5 1.2-4.7-3.7-3.1 4.8-.4Z" />
        </g>
      );
    case 'close':
      return <path {...s} fill="none" stroke-width={5} d="M14 14l20 20M34 14 14 34" />;
    case 'plus':
      return <path {...s} fill="none" stroke-width={5} d="M24 11v26M11 24h26" />;
    case 'palette':
    case 'wheel':
      return (
        <g {...s}>
          <path fill="#fff" d="M24 6C13 6 6 14 6 23c0 10 8 19 18 19 3 0 4-2 3-4s0-5 3-5h4c5 0 8-4 8-9C42 14 34 6 24 6Z" />
          <circle cx="15" cy="21" r="3.2" fill="#ef5a52" stroke="none" />
          <circle cx="21" cy="13.5" r="3.2" fill="#ffd83d" stroke="none" />
          <circle cx="30" cy="14" r="3.2" fill="#7ccf5e" stroke="none" />
          <circle cx="35" cy="22" r="3.2" fill="#3e7fe0" stroke="none" />
          <circle cx="16" cy="31" r="3.2" fill="#a57de0" stroke="none" />
        </g>
      );
    case 'trash':
      return (
        <g {...s}>
          <path fill="none" d="M10 13h28M19 13V9h10v4" />
          <path fill="#ff8fc8" d="M13 13h22l-2 26a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2Z" />
        </g>
      );
    case 'book':
      return (
        <g {...s}>
          <path fill="#7cc8f8" d="M8 10h12a4 4 0 0 1 4 4v26a4 4 0 0 0-4-4H8Z" />
          <path fill="#ffd83d" d="M40 10H28a4 4 0 0 0-4 4v26a4 4 0 0 1 4-4h12Z" />
        </g>
      );
    case 'offline':
      return (
        <g {...s}>
          <path fill="#7cc8f8" d="M14 36a8 8 0 0 1-1-16 11 11 0 0 1 21-3 9 9 0 0 1 1 19Z" />
          <path fill="none" d="M24 21v10M19 27l5 5 5-5" />
        </g>
      );

    // ---------------------------------------------------------------- tools
    case 'fill':
      return (
        <g {...s}>
          <path fill="#fff" d="M9 22 22 9l15 15-13 13a3 3 0 0 1-4 0L9 26a3 3 0 0 1 0-4Z" />
          <path fill={tip} d="M9.5 24.5h26.3L24 36.4a3 3 0 0 1-4 0Z" />
          <path fill={tip} d="M38 28c0 0 4 5.5 4 8a4 4 0 0 1-8 0c0-2.5 4-8 4-8Z" />
          <path fill="none" d="M22 9 16 3" />
        </g>
      );
    case 'crayon':
      return (
        <g {...s}>
          <path fill={tip} d="M12 30 30 12l6 6-18 18-8 2Z" />
          <path fill="#fff" fill-opacity="0.45" stroke="none" d="M17 29l13-13 2 2-13 13Z" />
          <path fill="none" d="M15 27l6 6M26 16l6 6" />
          <path fill={tip} d="M10 38l2-8 6 6Z" />
        </g>
      );
    case 'marker':
      return (
        <g {...s}>
          <path fill="#fff" d="M18 26 32 12a3 3 0 0 1 4 0l0 0a3 3 0 0 1 0 4L22 30Z" />
          <path fill={tip} d="M18 26l4 4-6 3-1-1Z" />
          <path fill={tip} d="M28 16l4 4 4-4a3 3 0 0 0-4-4Z" />
          <path fill="none" stroke={tip} stroke-width={4} d="M9 40c4-2 6-2 8 0" />
        </g>
      );
    case 'pencil':
      return (
        <g {...s}>
          <path fill="#ffd83d" d="M13 29 30 12l6 6-17 17Z" />
          <path fill="#f3cf98" d="M13 29l6 6-8 3Z" />
          <path fill={tip} stroke="none" d="M10.6 36.2 12.4 33l2.6 2.6-3.4 1.4Z" />
          <path fill="#ff8fc8" d="M30 12l3-3a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3l-3 3Z" />
        </g>
      );
    case 'paintbrush':
      return (
        <g {...s}>
          <path fill="#a8714a" d="M26 22 38 10a3 3 0 0 1 4 4L30 26Z" />
          <path fill="#a9b2bd" d="M22 22l4-4 8 8-4 4Z" />
          <path fill={tip} d="M22 22c-6 0-9 4-10 9-1 4-3 6-5 7 8 2 15 0 19-4 3-3 3-7 0-8Z" />
        </g>
      );
    case 'watercolour':
      return (
        <g {...s}>
          <path fill="#a8714a" d="M28 20 39 9a3 3 0 0 1 4 4L32 24Z" />
          <path fill={tip} fill-opacity="0.6" d="M26 22c-5 0-8 3-9 7-1 3-2 5-4 6 6 1 12-1 15-4 2-3 2-6-2-9Z" />
          <path fill={tip} d="M12 12s5 6 5 9a5 5 0 0 1-10 0c0-3 5-9 5-9Z" />
        </g>
      );
    case 'spray':
      return (
        <g {...s}>
          <rect x="14" y="18" width="16" height="23" rx="4" fill={tip} />
          <path fill="#a9b2bd" d="M17 18v-5h10v5" />
          <path fill="#fff" d="M19 13V9h6v4" />
          <g fill={tip} stroke="none">
            <circle cx="34" cy="9" r="2" />
            <circle cx="39" cy="13" r="1.8" />
            <circle cx="36" cy="16" r="1.5" />
            <circle cx="41" cy="7" r="1.5" />
          </g>
        </g>
      );
    case 'glitter':
      return (
        <g {...s} stroke-width={2.5}>
          <path fill={tip} d="M20 6c1 8 4 11 12 12-8 1-11 4-12 12-1-8-4-11-12-12 8-1 11-4 12-12Z" />
          <path fill="#ffd83d" d="M35 26c.7 4.5 2.4 6.3 7 7-4.6.7-6.3 2.5-7 7-.7-4.5-2.4-6.3-7-7 4.6-.7 6.3-2.5 7-7Z" />
          <circle cx="12" cy="36" r="2.5" fill="#ff8fc8" />
        </g>
      );
    case 'rainbow':
      return (
        <g fill="none" stroke-linecap="round" stroke-width={4.5}>
          <path stroke="#ef5a52" d="M6 36a18 18 0 0 1 36 0" />
          <path stroke="#ffd83d" d="M11 36a13 13 0 0 1 26 0" />
          <path stroke="#7ccf5e" d="M16 36a8 8 0 0 1 16 0" />
          <path stroke="#3e7fe0" d="M20.5 36a3.5 3.5 0 0 1 7 0" />
        </g>
      );
    case 'neon':
      return (
        <g fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path stroke={tip} stroke-opacity="0.35" stroke-width={11} d="M8 32l9-14 8 12 8-14 7 10" />
          <path stroke={tip} stroke-width={5} d="M8 32l9-14 8 12 8-14 7 10" />
          <path stroke="#fff" stroke-width={1.8} d="M8 32l9-14 8 12 8-14 7 10" />
        </g>
      );
    case 'stamp':
      return (
        <g {...s}>
          <path fill="#a8714a" d="M18 22v-5a6 6 0 1 1 12 0v5" />
          <rect x="10" y="22" width="28" height="9" rx="3" fill="#fff" />
          <path fill={tip} d="M12 31h24v4H12Z" />
          <path fill={tip} stroke="none" d="M24 37.5l1.6 2.8 3.2.5-2.3 2.1.6 3.1-3.1-1.6-3.1 1.6.6-3.1-2.3-2.1 3.2-.5Z" />
        </g>
      );
    case 'eraser':
      return (
        <g {...s}>
          <path fill="#ff8fc8" d="M20 36 9 25a3 3 0 0 1 0-4L23 7a3 3 0 0 1 4 0l11 11a3 3 0 0 1 0 4L24 36Z" />
          <path fill="#fff" d="M9 25l7-7 13 13-5 5h-4Z" />
          <path fill="none" d="M20 38h18" />
        </g>
      );
    case 'eyedropper':
      return (
        <g {...s}>
          <path fill="#a9b2bd" d="M30 8a5 5 0 0 1 7 7l-4 4-7-7Z" />
          <path fill="#fff" d="M26 12l7 7-15 15-6 2 2-6Z" />
          <path fill={tip} stroke="none" d="M14 30l8-8 4 4-8 8-5 1Z" />
          <path fill={tip} d="M9 37s3 3.5 3 5a3 3 0 0 1-6 0c0-1.5 3-5 3-5Z" />
        </g>
      );
  }
}

export function Icon({ name, size = 28, tip = '#ef5a52', class: cls }: Props) {
  return (
    <svg class={cls ? `icon ${cls}` : 'icon'} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {draw(name, tip)}
    </svg>
  );
}
