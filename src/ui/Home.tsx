import { useEffect, useMemo, useState } from 'preact/hooks';
import { copy } from '../copy';
import { AlsoBy } from './AlsoBy';
import { indexAsset, loadIndex, peekIndex, type BookIndexEntry } from '../data/books';
import { listMeta, type PageMeta } from '../data/storage';
import { HoldButton } from './HoldButton';
import { Icon } from './icons';
import { Logo } from './Logo';
import { PaperBanner } from './Paper';
import { href, navigate } from './router';

const isForGrownUps = (b: BookIndexEntry) => !!b.paperback?.forGrownUps;

/** How many pages to offer in "Keep colouring". */
const KEEP_GOING = 4;

function BookTile({ book, started }: { book: BookIndexEntry; started: number }) {
  const audience = isForGrownUps(book) ? copy.home.forGrownUps : book.paperback?.ages ? copy.home.ages(book.paperback.ages) : null;
  return (
    <a class="book-tile" href={href.book(book.id)} aria-label={copy.home.openBook(book.title)}>
      {book.cover ? (
        <img src={indexAsset(book.cover)} alt="" width={480} height={270} decoding="async" />
      ) : (
        <span class="book-blank" />
      )}
      <span class="book-title">{book.title}</span>
      <span class="book-meta">
        <span>{copy.home.pages(book.pageCount)}</span>
        {audience && <span class="book-tag">{audience}</span>}
        {started > 0 && (
          <span class="book-started">
            <Icon name="crayon" size={16} tip="#ff9a3c" /> {copy.home.started(started)}
          </span>
        )}
      </span>
    </a>
  );
}

function Shelf({ id, title, books, started }: { id: string; title: string | null; books: BookIndexEntry[]; started: Map<string, number> }) {
  if (!books.length) return null;
  return (
    <section class="shelf-group" aria-labelledby={title ? `shelf-${id}` : undefined}>
      {title && (
        <h2 class="shelf-title" id={`shelf-${id}`}>
          {title}
        </h2>
      )}
      <div class="shelf">
        {books.map((b) => (
          <div class="shelf-item" key={b.id}>
            <BookTile book={b} started={started.get(b.id) ?? 0} />
          </div>
        ))}
      </div>
      <div class="shelf-board" aria-hidden="true" />
    </section>
  );
}

/** The pages coloured most recently, to pick up where you left off. */
function KeepGoing({ metas, books }: { metas: PageMeta[]; books: BookIndexEntry[] }) {
  const recent = useMemo(
    () =>
      metas
        .filter((m) => m.thumb && !m.complete && books.some((b) => b.id === m.bookId))
        .sort((a, b) => b.updated - a.updated)
        .slice(0, KEEP_GOING),
    [metas, books],
  );
  const urls = useMemo(() => recent.map((m) => URL.createObjectURL(m.thumb!)), [recent]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  if (!recent.length) return null;
  return (
    <section class="keep-going" aria-labelledby="keep-going-title">
      <h2 class="shelf-title" id="keep-going-title">
        <Icon name="crayon" size={26} tip="#ff9a3c" /> {copy.home.keepGoingTitle}
      </h2>
      <ul class="keep-row">
        {recent.map((m, i) => {
          const book = books.find((b) => b.id === m.bookId)!;
          const n = parseInt(m.pageId.replace(/\D/g, ''), 10) || 0;
          const label = copy.home.keepGoingPage(book.title, n);
          return (
            <li key={m.key}>
              <a class="keep-tile" href={href.page(m.bookId, m.pageId, m.cbnOn)} aria-label={label}>
                <img src={urls[i]} alt="" decoding="async" />
                <span class="keep-label" aria-hidden="true">
                  {label}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Home() {
  const [books, setBooks] = useState<BookIndexEntry[] | null>(peekIndex);
  const [error, setError] = useState(false);
  const [metas, setMetas] = useState<PageMeta[]>([]);

  useEffect(() => {
    loadIndex().then(setBooks, () => !peekIndex() && setError(true));
    listMeta().then(setMetas, () => {});
  }, []);

  const started = useMemo(() => {
    const m = new Map<string, number>();
    for (const meta of metas) m.set(meta.bookId, (m.get(meta.bookId) ?? 0) + 1);
    return m;
  }, [metas]);

  const kids = (books ?? []).filter((b) => !isForGrownUps(b));
  const grownUps = (books ?? []).filter(isForGrownUps);
  // One shelf needs no heading.
  const grouped = kids.length > 0 && grownUps.length > 0;

  return (
    <div class="screen home">
      <header class="home-head">
        <h1>
          <Logo />
        </h1>
        <p class="tagline">{copy.tagline}</p>
        <ul class="promises" aria-label={copy.appName}>
          {copy.home.promises.map((p) => (
            <li key={p}>
              <Icon name="check" size={18} /> {p}
            </li>
          ))}
        </ul>
      </header>

      <main class="shelf-wrap">
        {books && <KeepGoing metas={metas} books={books} />}
        <h2 class="sr-only">{copy.home.shelfLabel}</h2>
        {error && <p class="notice">{copy.colouring.loadError}</p>}
        {books === null && !error && (
          <div class="shelves">
            <section class="shelf-group">
              <div class="shelf">
                <div class="shelf-item">
                  <div class="book-tile skeleton" />
                </div>
              </div>
            </section>
          </div>
        )}
        {books && (
          <div class={`shelves${grouped ? ' is-grouped' : ''}`}>
            <Shelf id="kids" title={grouped ? copy.home.kidsShelf : null} books={kids} started={started} />
            <Shelf id="grown-ups" title={grouped ? copy.home.grownUpsShelf : null} books={grownUps} started={started} />
          </div>
        )}
        {books && <PaperBanner books={books} />}
      </main>

      <footer class="home-foot">
        <HoldButton label={copy.grownUps.open} hint={copy.grownUps.holdHint} onDone={() => navigate(href.grownUps())}>
          <Icon name="lock" size={20} />
        </HoldButton>
        <AlsoBy />
      </footer>
    </div>
  );
}
