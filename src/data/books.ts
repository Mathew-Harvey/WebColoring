// Book manifests produced by scripts/prepare-book.mjs.

export interface BookIndexEntry {
  id: string;
  title: string;
  subtitle: string | null;
  cover: string | null;
  pageCount: number;
  storeUrl: string | null;
  order: number;
}

export interface PageInfo {
  id: string;
  n: number;
  title: string | null;
  difficulty: 'easy' | 'detailed';
  cbn: boolean;
  regionCount: number;
  numbered: number;
  artRect: [number, number, number, number];
  v: string;
}

export interface PaletteEntry {
  key: string;
  hex: string;
}

export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  storeUrl: string | null;
  cover: string | null;
  coverSmall: string | null;
  width: number;
  height: number;
  cbnPalette: PaletteEntry[];
  pages: PageInfo[];
}

// The built site lives at the repository root and reads book data from public/.
declare const __PUBLIC__: string;
const BASE = `./${__PUBLIC__}books/`;

let indexPromise: Promise<BookIndexEntry[]> | null = null;
const bookCache = new Map<string, Promise<Book>>();

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

export function loadIndex(): Promise<BookIndexEntry[]> {
  if (!indexPromise) {
    indexPromise = getJson<{ books: BookIndexEntry[] }>(`${BASE}index.json`).then((d) => d.books);
    indexPromise.catch(() => (indexPromise = null));
  }
  return indexPromise;
}

export function loadBook(id: string): Promise<Book> {
  let p = bookCache.get(id);
  if (!p) {
    p = getJson<Book>(`${BASE}${encodeURIComponent(id)}/book.json`);
    bookCache.set(id, p);
    p.catch(() => bookCache.delete(id));
  }
  return p;
}

export const bookAsset = (bookId: string, file: string) => `${BASE}${bookId}/${file}`;

/** Paths in index.json are relative to the books folder. */
export const indexAsset = (path: string) => `${BASE}${path}`;

export const pageAsset = (bookId: string, page: PageInfo, file: string) =>
  `${BASE}${bookId}/pages/${page.id}/${file}?v=${page.v}`;

/** Only http(s) links are ever shown as store links. */
export function safeStoreUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}
