// Where each printed book can be bought: the one place to add or change a store link.
//
// Keyed by book id (the folder name under books/). A book with a `url` shows its price and a
// "Get the paperback" button everywhere the paper books are offered; a book with `url: null`
// (or no entry) shows "Coming soon". Links are plain product pages, with no affiliate or
// tracking parameters. After an edit, run `npm run build`.

export type PaperFormat = 'paperback';

export interface Listing {
  url: string | null;
  price?: string;
  format?: PaperFormat;
}

export const PAPERBACKS: Record<string, Listing> = {
  'blocky-builders': { url: 'https://www.amazon.com/dp/B0HNHZQHBB', price: 'US$9.99', format: 'paperback' },
  'scaly-pals': { url: 'https://www.amazon.com/dp/B0HNHSR2T9', price: 'US$9.99', format: 'paperback' },
  // On Amazon from 26 October 2026.
  'still-water-mandalas': { url: null },
};

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

/** The book's store listing, or null while it is not on sale yet. */
export function listingFor(bookId: string): (Listing & { url: string }) | null {
  const listing = PAPERBACKS[bookId];
  const url = safeStoreUrl(listing?.url);
  return listing && url ? { ...listing, url } : null;
}
