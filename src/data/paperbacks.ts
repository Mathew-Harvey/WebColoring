// The printed books: the one place to add or change a store link, a price, or a book that is
// only on paper.
//
// Keyed by book id. For a book on the colouring shelf the id is its folder under books/, and its
// title, cover and details come from that book's data; `details` can add an author, a blurb and
// a cover for the paper cards. A book that is only on paper (no pages to colour here yet) carries
// all of its details in `book`, and shows on the paper books page and in the grown-ups area.
//
// A book with an `asin` (its Amazon product id, from its amazon.com link: amazon.com/dp/<asin>)
// shows "Available now" and a "Get the paperback" button, which opens the book in the visitor's
// own Amazon store (src/data/stores.ts; the id is the same in every store). A book with
// `asin: null` shows "Coming soon" with a disabled button. `price` is the amazon.com price, shown
// to visitors shopping there. Links are plain product pages, with no affiliate or tracking
// parameters. After an edit, run `npm run build`.

// With its extension, so Node can load this file too (the tests read the listings).
import { activeStore, storeUrl, type StoreId } from './stores.ts';

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
  asin: string | null;
  /** The amazon.com price. */
  price?: string;
  format?: PaperFormat;
  details?: PaperDetails;
  book?: PaperOnlyBook;
}

export const PAPERBACKS: Record<string, Listing> = {
  'blocky-builders': { asin: 'B0HNHZQHBB', price: 'US$9.99', format: 'paperback' },
  'scaly-pals': { asin: 'B0HNHSR2T9', price: 'US$9.99', format: 'paperback' },
  // On Amazon from 26 October 2026.
  'still-water-mandalas': { asin: null },
  // Coming soon: not on Amazon yet.
  'kart-kingdom-racers': { asin: null },
  // On Amazon from 25 October 2026.
  'doodles-through-the-decades': { asin: 'B0HP76NQ53', price: 'US$9.99', format: 'paperback' },
  // Coming soon: not on Amazon yet.
  'deep-sea-friends': {
    asin: null,
    // The price goes in when the book is live on Amazon.
    format: 'paperback',
    details: {
      author: 'Mat Harvey',
      blurb:
        'A grinning anglerfish swings its little lamp through the dark water, lighting the way to a whole sea full of new friends. An octopus waves hello with every arm, and a sea turtle glides over the seagrass. Inside are 30 big, friendly pictures made for small hands, with bold outlines and roomy shapes that are easy to colour.',
      cover: {
        src: 'deep-sea-friends/deep-sea-friends-cover-1200.jpg',
        width: 1200,
        height: 927,
        alt: 'Deep Sea Friends cover showing a smiling octopus, a sea turtle, a jellyfish, an anglerfish and a seahorse on a coral reef',
      },
    },
  },
  // Coming soon: not on Amazon yet.
  'aussie-bush-buddies': {
    asin: null,
    // The price goes in when the book is live on Amazon.
    format: 'paperback',
    details: {
      author: 'Mat Harvey',
      blurb:
        "A tiny joey peeks out of its mum's pouch, a sleepy koala hugs a gum tree, and a cheeky wombat sits by his burrow to say g'day. Inside are 30 big, friendly pictures made for small hands, from echidnas and platypuses to kookaburras and quokkas, with bold outlines and roomy shapes that are easy to colour.",
      cover: {
        src: 'aussie-bush-buddies/aussie-bush-buddies-cover-1200.jpg',
        width: 1200,
        height: 927,
        alt: 'Aussie Bush Buddies cover showing a kangaroo, a wombat, an echidna and a platypus by a billabong, with a koala in a gum tree and a cockatoo',
      },
    },
  },
  // Coming soon: not on Amazon yet.
  'haybale-hill-farm': {
    asin: null,
    // The price goes in when the book is live on Amazon.
    format: 'paperback',
    details: {
      author: 'Mat Harvey',
      blurb:
        'Three piglets sit in a big mud puddle, grinning and waving their trotters. A calf drinks beside its mother at the water trough, a hen leads four chicks past the henhouse, a farmer drives a tractor full of pumpkins, and on the last page the cow, pig, sheep and hen sleep together on the hay under the moon. Thick outlines and large shapes, so children from about 3 can manage most pages.',
    },
  },
  // On Amazon from 25 October 2026.
  'taken-apart': {
    asin: 'B0HP7BYF53',
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

/** The book's listing with its product page in `store` (the visitor's, by default), or null
 * while it is not on sale. */
export function listingFor(bookId: string, store: StoreId = activeStore()): (Listing & { url: string; store: StoreId }) | null {
  const listing = PAPERBACKS[bookId];
  const url = storeUrl(listing?.asin, store);
  return listing && url ? { ...listing, url, store } : null;
}

/** The books that are only on paper, with their ids. */
export function paperOnlyBooks(): (PaperOnlyBook & { id: string })[] {
  return Object.entries(PAPERBACKS).flatMap(([id, l]) => (l.book ? [{ ...l.book, id }] : []));
}
