import type { CSSProperties } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { copy } from '../copy';
import { indexAsset, loadIndex, peekIndex, type BookIndexEntry } from '../data/books';
import { listingFor, paperOnlyBooks, PAPERBACKS } from '../data/paperbacks';
import { HoldButton } from './HoldButton';
import { Icon } from './icons';
import { href } from './router';

// Everything that offers the printed books: the home banner, the picker card, the line on the
// finished screen, the grown-ups list and the "paper books" page where they can be bought.

/** The shelf entry for one book, with its paper details. index.json carries the paperback details. */
export function useBookEntry(bookId: string): PaperBook | null {
  const find = (books: BookIndexEntry[] | null) => {
    const b = books?.find((x) => x.id === bookId);
    return b ? withDetails(b) : null;
  };
  const [entry, setEntry] = useState<PaperBook | null>(() => find(peekIndex()));
  useEffect(() => {
    let live = true;
    loadIndex().then(
      (books) => live && setEntry(find(books)),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [bookId]);
  return entry;
}

/** A book as the paper pages show it: a shelf book, or one that is only on paper. */
export type PaperBook = BookIndexEntry & {
  author?: string;
  blurb?: string;
  /** A paper-only book's own cover, shown whole. */
  image?: { src: string; width: number; height: number; alt: string };
};

/** A shelf book with the author, blurb and cover from src/data/paperbacks.ts, when it has them. */
function withDetails(book: BookIndexEntry): PaperBook {
  const d = PAPERBACKS[book.id]?.details;
  return d ? { ...book, author: d.author, blurb: d.blurb, image: d.cover } : book;
}

/** The shelf books plus the books that are only on paper, in order. */
export function withPaperOnly(shelf: BookIndexEntry[]): PaperBook[] {
  const extra: PaperBook[] = paperOnlyBooks()
    .filter((b) => !shelf.some((s) => s.id === b.id))
    .map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? null,
      cover: null,
      front: null,
      paperback: { forGrownUps: b.forGrownUps },
      pageCount: b.pictures,
      order: b.order,
      author: b.author,
      blurb: b.blurb,
      image: b.cover,
    }));
  return [...shelf.map(withDetails), ...extra].sort((a, b) => a.order - b.order);
}

const isSoon = (book: BookIndexEntry) => !listingFor(book.id);

const priceText = (bookId: string) => {
  const l = PAPERBACKS[bookId];
  return l?.price ? copy.paper.price(copy.paper.formats[l.format ?? 'paperback'], l.price) : null;
};

/** A wax crayon, for decoration. */
export function Crayon({ colour, dark, class: cls }: { colour: string; dark: string; class?: string }) {
  return (
    <svg class={`crayon ${cls ?? ''}`} viewBox="0 0 300 60" aria-hidden="true">
      <path d="M4 25 Q2 30 4 35 L16 37 L16 23 Z" fill={dark} />
      <path d="M15 22 L62 6 L62 54 L15 38 Z" fill={colour} />
      <path d="M15 22 L62 6 L62 18 L15 28 Z" fill="#fff" opacity="0.35" />
      <rect x="60" y="6" width="236" height="48" rx="10" fill={colour} />
      <rect x="96" y="6" width="150" height="48" fill={dark} />
      <rect x="120" y="22" width="102" height="16" rx="8" fill="#fff" opacity="0.9" />
      <rect x="60" y="12" width="236" height="7" rx="3.5" fill="#fff" opacity="0.28" />
    </svg>
  );
}

/** The printed book: its real front cover, or the shelf art until there is one. */
export function PaperCover({
  book,
  alt = '',
  ribbon = true,
  lazy = true,
  style,
}: {
  book: PaperBook;
  alt?: string;
  ribbon?: boolean;
  lazy?: boolean;
  style?: CSSProperties;
}) {
  const image = book.image;
  const src = image ? indexAsset(image.src) : book.front ? indexAsset(book.front) : book.cover ? indexAsset(book.cover) : null;
  return (
    <span class={`paperback${book.front ? '' : ' paperback-art'}`} style={style}>
      {src && (
        <img
          src={src}
          alt={image ? image.alt : alt}
          width={image ? image.width : 480}
          height={image ? image.height : book.front ? 621 : 270}
          loading={lazy ? 'lazy' : undefined}
          decoding="async"
        />
      )}
      {ribbon && isSoon(book) && (
        <span class="soon-ribbon" aria-hidden="true">
          {copy.paper.comingSoon}
        </span>
      )}
    </span>
  );
}

/**
 * The way to buy: a hold button for grown-ups, a plain link inside the grown-ups area, or, while
 * the book is not on sale, a Coming soon note and a disabled button (with its own badge when the
 * cover beside it has no sticker).
 */
export function BuyAction({ book, gated = true, badge = true }: { book: BookIndexEntry; gated?: boolean; badge?: boolean }) {
  const listing = listingFor(book.id);
  const cost = priceText(book.id);
  if (!listing) {
    return (
      <>
        {(badge || cost) && (
          <p class="paper-soon">
            {badge && <span class="soon-pill">{copy.paper.comingSoon}</span>}
            {cost && <strong>{cost}</strong>}
          </p>
        )}
        <button type="button" class="btn btn-buy" disabled>
          <Icon name="book" size={24} /> {copy.paper.buy}
        </button>
        <span class="small">{copy.paper.comingSoonBody}</span>
      </>
    );
  }
  const { url } = listing;
  const price = cost && (
    <p class="paper-price">
      <span class="avail-pill">{copy.paper.available}</span>
      <strong>{cost}</strong>
    </p>
  );
  if (!gated) {
    return (
      <>
        {price}
        <a class="btn btn-buy" href={url} target="_blank" rel="noopener">
          <Icon name="book" size={24} /> {copy.paper.buyLink} <span class="sr-only">{copy.paper.opensNewTab}</span>
        </a>
      </>
    );
  }
  return (
    <>
      {price}
      <HoldButton
        label={copy.paper.buy}
        hint={copy.paper.buyHint}
        href={url}
        onDone={() => window.open(url, '_blank', 'noopener')}
        class="hold-buy"
      >
        <Icon name="book" size={20} />
      </HoldButton>
    </>
  );
}

function Details({ book }: { book: BookIndexEntry }) {
  const p = book.paperback ?? {};
  const items = [copy.paper.pictures(book.pageCount)];
  if (p.forGrownUps) items.push(copy.paper.forGrownUps);
  else if (p.ages) items.push(copy.paper.ages(p.ages));
  if (p.size) items.push(copy.paper.size(p.size));
  if (p.singleSided) items.push(copy.paper.singleSided);
  return (
    <ul class="paper-details">
      {items.map((t) => (
        <li key={t}>
          <Icon name="check" size={20} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/** One book with its cover, what it is like and how to get it. `compact` drops the cover sticker. */
export function PaperBookCard({
  book,
  gated = true,
  highlight = false,
  compact = false,
}: {
  book: PaperBook;
  gated?: boolean;
  highlight?: boolean;
  compact?: boolean;
}) {
  const H = compact ? 'h3' : 'h2';
  return (
    <article class={`paper-card${highlight ? ' is-highlight' : ''}`} id={`paper-${book.id}`} aria-labelledby={`paper-title-${book.id}`}>
      <PaperCover book={book} alt={copy.paper.coverAlt(book.title)} ribbon={!compact} />
      <div class="paper-info">
        <H class="paper-title" id={`paper-title-${book.id}`}>
          {book.title}
        </H>
        {book.subtitle && <p class="paper-sub">{book.subtitle}</p>}
        {book.author && <p class="paper-by">{copy.paper.by(book.author)}</p>}
        {book.blurb && <p class="paper-blurb">{book.blurb}</p>}
        <Details book={book} />
        <BuyAction book={book} gated={gated} badge={compact} />
      </div>
    </article>
  );
}

// Where the covers sit in the home fan: [left px, turn deg, lift px]. Books without a real
// front cover show their 16:9 art, tucked in behind.
const FAN: Record<number, [number, number, number][]> = {
  1: [[92, -3, 0]],
  2: [[40, -8, 0], [150, 7, 0]],
  3: [[4, -9, 0], [92, -1, 10], [178, 8, 0]],
};

/** Below the shelf: the books on paper, with a way to the paper books page. */
export function PaperBanner({ books }: { books: BookIndexEntry[] }) {
  if (!books.length) return null;
  const shown = books.slice(0, 3);
  const covers = shown.filter((b) => b.front);
  const art = shown.filter((b) => !b.front);
  return (
    <section class="paper-banner" aria-labelledby="paper-banner-title">
      <div class="paper-fan" aria-hidden="true">
        {art.map((b, i) => (
          <PaperCover key={b.id} book={b} ribbon={false} style={{ left: `${56 + i * 34}px`, transform: `rotate(${-4 + i * 6}deg)` }} />
        ))}
        {covers.map((b, i) => {
          const [left, turn, lift] = FAN[covers.length][i];
          return (
            <PaperCover
              key={b.id}
              book={b}
              ribbon={false}
              style={{ left: `${left}px`, zIndex: lift ? 1 : undefined, transform: `rotate(${turn}deg) translateY(${-lift}px)` }}
            />
          );
        })}
        <Crayon colour="#ff9a3c" dark="#d9731c" class="crayon-a" />
        <Crayon colour="#3e7fe0" dark="#2c5fae" class="crayon-b" />
      </div>
      <div class="paper-banner-text">
        <h2 id="paper-banner-title">{copy.paper.bannerTitle}</h2>
        <p>{copy.paper.bannerBody}</p>
        <div class="paper-banner-actions">
          <a class="btn btn-paper" href={href.paper()}>
            <Icon name="book" size={26} /> {copy.paper.bannerButton}
          </a>
          {books.every(isSoon) && <span class="soon-pill">{copy.paper.comingSoon}</span>}
        </div>
      </div>
    </section>
  );
}

/** Under the page grid: this book on paper. */
export function PaperPickerCard({ bookId }: { bookId: string }) {
  const book = useBookEntry(bookId);
  if (!book) return null;
  return (
    <aside class="paper-picker" aria-labelledby="paper-picker-title">
      <PaperCover book={book} />
      <div class="paper-info">
        <h2 class="paper-title" id="paper-picker-title">
          {copy.paper.pickerTitle(book.title)}
        </h2>
        <p class="paper-sub">{copy.paper.pickerBody}</p>
        <BuyAction book={book} badge={false} />
        <a class="text-link" href={href.paper(book.id)}>
          {copy.paper.seeBook}
        </a>
      </div>
    </aside>
  );
}

/** A quiet line on the finished screen. */
export function PaperFinished({ bookId }: { bookId: string }) {
  const book = useBookEntry(bookId);
  if (!book) return null;
  return (
    <a class="paper-finished" href={href.paper(book.id)}>
      <PaperCover book={book} ribbon={false} lazy={false} />
      <span class="paper-finished-text">
        <strong>{copy.paper.finished}</strong>
        <span class="small">{isSoon(book) ? copy.paper.comingSoon : copy.paper.seeBook}</span>
      </span>
    </a>
  );
}

/** The paper books page: every book, all its details and the way to buy it. */
export function PaperPage({ bookId }: { bookId: string | null }) {
  const [shelf, setShelf] = useState<BookIndexEntry[] | null>(peekIndex);
  const [error, setError] = useState(false);
  const books = shelf && withPaperOnly(shelf);

  useEffect(() => {
    loadIndex().then(setShelf, () => !peekIndex() && setError(true));
  }, []);

  useEffect(() => {
    if (shelf && bookId) document.getElementById(`paper-${bookId}`)?.scrollIntoView({ block: 'center' });
  }, [shelf, bookId]);

  // Back to the book's pages, or home for a book that is only on paper.
  const onShelf = !!bookId && !!shelf?.some((b) => b.id === bookId);

  return (
    <div class="screen paper-page">
      <header class="picker-head">
        <a class="round-btn" href={onShelf && bookId ? href.book(bookId) : href.home()} aria-label={copy.picker.back}>
          <Icon name="back" size={30} />
        </a>
        <h1 class="picker-title">{copy.paper.pageTitle}</h1>
      </header>
      <main class="paper-body">
        <section class="paper-hero">
          <div class="paper-hero-text">
            {copy.paper.pageIntro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <div class="paper-hero-art" aria-hidden="true">
            <Crayon colour="#ef5a52" dark="#c43c36" class="crayon-1" />
            <Crayon colour="#ffd83d" dark="#e0b400" class="crayon-2" />
            <Crayon colour="#4fc74a" dark="#2f9e5a" class="crayon-3" />
          </div>
        </section>
        {error && <p class="notice">{copy.colouring.loadError}</p>}
        <div class="paper-list">
          {(books ?? []).map((b) => (
            <PaperBookCard key={b.id} book={b} highlight={b.id === bookId} />
          ))}
        </div>
      </main>
    </div>
  );
}
