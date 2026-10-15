import { useEffect, useMemo, useState } from 'preact/hooks';
import { copy } from '../copy';
import { getLocal, setLocal } from '../data/settings';
import { loadBook, pageAsset, type Book, type PageInfo } from '../data/books';
import { listMeta, type PageMeta } from '../data/storage';
import { Icon, type IconName } from './icons';
import { PromoCard } from './PromoCard';
import { href } from './router';

type Filter = 'all' | 'easy' | 'detailed' | 'cbn';

const FILTERS: { id: Filter; icon: IconName }[] = [
  { id: 'all', icon: 'grid' },
  { id: 'easy', icon: 'easy' },
  { id: 'detailed', icon: 'detailed' },
  { id: 'cbn', icon: 'numbers' },
];

export function Picker({ bookId }: { bookId: string }) {
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState(false);
  const [metas, setMetas] = useState<Map<string, PageMeta>>(new Map());
  const [filter, setFilter] = useState<Filter>(() => getLocal<Filter>(`filter.${bookId}`, 'all'));

  useEffect(() => {
    loadBook(bookId).then(setBook, () => setError(true));
    listMeta(bookId).then((list) => setMetas(new Map(list.map((m) => [m.pageId, m]))));
  }, [bookId]);

  // Object URLs for saved thumbnails.
  const thumbs = useMemo(() => {
    const m = new Map<string, string>();
    for (const [id, meta] of metas) if (meta.thumb) m.set(id, URL.createObjectURL(meta.thumb));
    return m;
  }, [metas]);
  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  const pick = (f: Filter) => {
    setFilter(f);
    setLocal(`filter.${bookId}`, f);
  };

  const pages = (book?.pages ?? []).filter((p) => {
    if (filter === 'easy') return p.difficulty === 'easy';
    if (filter === 'detailed') return p.difficulty === 'detailed';
    if (filter === 'cbn') return p.numbered > 0 && (p.cbn || metas.get(p.id)?.cbnOn);
    return true;
  });

  if (error) {
    return (
      <div class="screen picker">
        <p class="notice">{copy.misc.notFound}</p>
        <a class="btn" href={href.home()}>
          {copy.misc.goHome}
        </a>
      </div>
    );
  }

  return (
    <div class="screen picker">
      <header class="picker-head">
        <a class="round-btn" href={href.home()} aria-label={copy.picker.back}>
          <Icon name="back" size={30} />
        </a>
        <h1 class="picker-title">{book?.title ?? ''}</h1>
      </header>

      <nav class="filters" aria-label={copy.picker.filterLabel}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            class={`chip ${filter === f.id ? 'on' : ''}`}
            aria-pressed={filter === f.id}
            onClick={() => pick(f.id)}
          >
            <Icon name={f.icon} size={30} />
            <span class="tiny">{copy.picker.filters[f.id]}</span>
          </button>
        ))}
      </nav>

      <main>
        <ul class="page-grid">
          {pages.map((p: PageInfo, i) => {
            const meta = metas.get(p.id);
            const thumb = thumbs.get(p.id);
            const done = meta?.complete;
            return (
              <li key={p.id}>
                <a
                  class="page-tile"
                  href={href.page(bookId, p.id, filter === 'cbn')}
                  aria-label={`${copy.picker.page(p.n)}${done ? `, ${copy.picker.done}` : meta ? `, ${copy.picker.started}` : ''}`}
                >
                  <img
                    src={thumb ?? pageAsset(bookId, p, 'thumb.webp')}
                    srcset={thumb ? undefined : `${pageAsset(bookId, p, 'thumb-sm.webp')} 384w, ${pageAsset(bookId, p, 'thumb.webp')} 480w`}
                    sizes="(max-width: 520px) 46vw, 240px"
                    alt=""
                    width={480}
                    height={270}
                    loading={i < 6 ? 'eager' : 'lazy'}
                    fetchpriority={i < 2 ? 'high' : undefined}
                    decoding="async"
                  />
                  <span class="page-num" aria-hidden="true">
                    {p.n}
                  </span>
                  {p.cbn && p.numbered > 0 && (
                    <span class="badge badge-cbn" aria-hidden="true">
                      <Icon name="numbers" size={30} />
                    </span>
                  )}
                  {done && (
                    <span class="badge badge-done" aria-hidden="true">
                      <Icon name="star" size={22} />
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
        {book && !pages.length && <p class="notice">{copy.picker.empty}</p>}
        {book && <PromoCard storeUrl={book.storeUrl} title={book.title} variant="picker" />}
      </main>
    </div>
  );
}
