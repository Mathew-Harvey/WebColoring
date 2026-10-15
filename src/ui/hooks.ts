import { useEffect, useState } from 'preact/hooks';
import { getSettings, onSettings, type Settings } from '../data/settings';

export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return match;
}

export function useSettings(): Settings {
  const [s, setS] = useState(getSettings());
  useEffect(() => onSettings(setS), []);
  return s;
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
