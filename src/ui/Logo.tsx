import { copy } from '../copy';

const COLOURS = ['#ef5a52', '#ff9a3c', '#f2b705', '#4fb848', '#22b3a6', '#3e7fe0', '#8457dc', '#e0559a'];

/** The WebColoring name in simple rounded type, one colour per letter. */
export function Logo({ size = 'big' }: { size?: 'big' | 'small' }) {
  const letters = copy.appName.split('');
  return (
    <span class={`logo logo-${size}`} aria-label={copy.appName} role="img">
      {letters.map((ch, i) => (
        <span key={i} aria-hidden="true" style={{ color: COLOURS[i % COLOURS.length] }}>
          {ch}
        </span>
      ))}
    </span>
  );
}
