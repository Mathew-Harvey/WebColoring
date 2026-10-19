import { useEffect, useState } from 'preact/hooks';
import { copy } from '../copy';
import { AlsoBy } from './AlsoBy';
import { indexAsset, loadIndex, peekIndex, type BookIndexEntry } from '../data/books';
import { HoldButton } from './HoldButton';
import { Icon } from './icons';
import { Logo } from './Logo';
import { PaperBanner } from './Paper';
import { href, navigate } from './router';

export function Home() {
  const [books, setBooks] = useState<BookIndexEntry[] | null>(peekIndex);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadIndex().then(setBooks, () => !peekIndex() && setError(true));
  }, []);

  return (
    <div class="screen home">
      <header class="home-head">
        <h1>
          <Logo />
        </h1>
        <p class="tagline">{copy.tagline}</p>
      </header>

      <main class="shelf-wrap">
        <h2 class="sr-only">{copy.home.shelfLabel}</h2>
        {error && <p class="notice">{copy.colouring.loadError}</p>}
        <div class="shelf">
          {(books ?? []).map((b) => (
            <div class="shelf-item" key={b.id}>
              <a class="book-tile" href={href.book(b.id)} aria-label={copy.home.openBook(b.title)}>
                {b.cover ? (
                  <img src={indexAsset(b.cover)} alt="" width={480} height={270} decoding="async" />
                ) : (
                  <span class="book-blank" />
                )}
                <span class="book-title">{b.title}</span>
                <span class="book-meta">
                  <Icon name="star" size={18} /> {copy.home.pages(b.pageCount)}
                </span>
              </a>
            </div>
          ))}
          {books === null && !error && <div class="shelf-item"><div class="book-tile skeleton" /></div>}
        </div>
        <div class="shelf-board" aria-hidden="true" />
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
