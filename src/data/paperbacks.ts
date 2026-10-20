// The printed books: the one place to add or change a store link, a price, or a book that is
// only on paper.
//
// Keyed by book id. For a book on the colouring shelf the id is its folder under books/, and its
// title, cover and details come from that book's data; `details` can add an author, a blurb and
// a cover for the paper cards. A book that is only on paper (no pages to colour here yet) carries
// all of its details in `book`, and shows on the paper books page and in the grown-ups area.
//
// A book with a `url` shows "Available now", its price and a "Get the paperback" button. A book
// with `url: null` shows "Coming soon" with its price (if set) and a disabled button. Links are
// plain product pages, with no affiliate or tracking parameters. After an edit, run
// `npm run build`.

export type PaperFormat = 'paperback';

/** A cover for the paper cards, a path under public/books/. Shown whole, never cropped. */
export interface PaperCoverImage {
  src: string;
  width: number;
  height: number;
  alt: string;
}

/** Extra details shown on a book's paper cards. */
export interface PaperDetails {
  author?: string;
  blurb?: string;
  cover?: PaperCoverImage;
}

/** Details for a book that is only on paper. */
export interface PaperOnlyBook extends PaperDetails {
  title: string;
  subtitle?: string;
  pictures: number;
  forGrownUps?: boolean;
  cover: PaperCoverImage;
  /** Where it sits among the paper books. */
  order: number;
}

export interface Listing {
  url: string | null;
  price?: string;
  format?: PaperFormat;
  details?: PaperDetails;
  book?: PaperOnlyBook;
}

export const PAPERBACKS: Record<string, Listing> = {
  'blocky-builders': { url: 'https://www.amazon.com/dp/B0HNHZQHBB', price: 'US$9.99', format: 'paperback' },
  'scaly-pals': { url: 'https://www.amazon.com/dp/B0HNHSR2T9', price: 'US$9.99', format: 'paperback' },
  // On Amazon from 26 October 2026.
  'still-water-mandalas': { url: null },
  // Coming soon: not on Amazon yet.
  'kart-kingdom-racers': { url: null },
  // Coming soon: on Amazon from about 27 October 2026.
  'taken-apart': {
    url: null,
    price: 'US$8.99',
    format: 'paperback',
    details: {
      author: 'Mat Harvey',
      blurb:
        'Thirty machines pulled apart piece by piece, from a 1910s car engine and a wind-up gramophone to cassette players, brick phones, drones and electric cars. Every page is a detailed exploded-view drawing to colour, made for adults who like a slow, fiddly page.',
      cover: {
        src: 'taken-apart/taken-apart-cover-1200.jpg',
        width: 1200,
        height: 675,
        alt: 'Taken Apart cover showing a gramophone, rotary phone, cassette player and smartphone in exploded view',
      },
    },
  },
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

/** The books that are only on paper, with their ids. */
export function paperOnlyBooks(): (PaperOnlyBook & { id: string })[] {
  return Object.entries(PAPERBACKS).flatMap(([id, l]) => (l.book ? [{ ...l.book, id }] : []));
}
