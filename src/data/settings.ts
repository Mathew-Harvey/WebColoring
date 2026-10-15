// Small settings store kept in localStorage. Never required: everything works without it.

export interface Settings {
  sound: boolean;
  volume: number;
  haptics: boolean;
  patterns: boolean;
}

const KEY = 'webcoloring.settings';
const DEFAULTS: Settings = { sound: true, volume: 0.7, haptics: true, patterns: false };

type Listener = (s: Settings) => void;
const listeners = new Set<Listener>();

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* storage may be blocked */
  }
  return { ...DEFAULTS };
}

let current = read();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  for (const l of listeners) l(current);
}

export function onSettings(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// Small per-device conveniences.

export function getLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`webcoloring.${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function setLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(`webcoloring.${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
