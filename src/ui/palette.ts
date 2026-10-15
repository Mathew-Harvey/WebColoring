// The crayon box: 24 kid colours, a row of skin tones, and recent colours.
import { getLocal, setLocal } from '../data/settings';

export interface Swatch {
  key: string;
  hex: string;
}

export const KID_PALETTE: Swatch[] = [
  { key: 'red', hex: '#ef3b36' },
  { key: 'orange', hex: '#ff7a2f' },
  { key: 'amber', hex: '#ffb020' },
  { key: 'yellow', hex: '#ffe23d' },
  { key: 'lime', hex: '#b9e23a' },
  { key: 'green', hex: '#4fc74a' },
  { key: 'forest', hex: '#1f8f52' },
  { key: 'teal', hex: '#22c3b4' },
  { key: 'sky', hex: '#5cc4f5' },
  { key: 'blue', hex: '#2f78e6' },
  { key: 'navy', hex: '#2c3c9e' },
  { key: 'purple', hex: '#8457dc' },
  { key: 'violet', hex: '#c46be8' },
  { key: 'pink', hex: '#ff6fb5' },
  { key: 'blush', hex: '#ffbcd8' },
  { key: 'berry', hex: '#d62f6c' },
  { key: 'brown', hex: '#a0643a' },
  { key: 'chocolate', hex: '#61391f' },
  { key: 'sand', hex: '#f3cf98' },
  { key: 'white', hex: '#ffffff' },
  { key: 'silver', hex: '#c9d0d8' },
  { key: 'grey', hex: '#7d8793' },
  { key: 'charcoal', hex: '#3a3d46' },
  { key: 'black', hex: '#141414' },
];

export const SKIN_TONES: Swatch[] = [
  { key: 'skin1', hex: '#ffe3cc' },
  { key: 'skin2', hex: '#f8cba4' },
  { key: 'skin3', hex: '#e9b086' },
  { key: 'skin4', hex: '#cf9064' },
  { key: 'skin5', hex: '#a86d45' },
  { key: 'skin6', hex: '#7b4b2b' },
  { key: 'skin7', hex: '#4e2f1c' },
];

const known = new Map([...KID_PALETTE, ...SKIN_TONES].map((s) => [s.hex, s.key]));

export const swatchKey = (hex: string) => known.get(hex.toLowerCase()) ?? 'custom';

export function getRecent(): string[] {
  const r = getLocal<string[]>('recent', []);
  return Array.isArray(r) ? r.filter((h) => /^#[0-9a-f]{6}$/i.test(h)).slice(0, 8) : [];
}

export function pushRecent(hex: string): string[] {
  const next = [hex.toLowerCase(), ...getRecent().filter((h) => h !== hex.toLowerCase())].slice(0, 8);
  setLocal('recent', next);
  return next;
}
