import { useEffect, useMemo, useState } from 'preact/hooks';
import { copy } from '../copy';
import { getLocal, setLocal } from '../data/settings';
import { bookPageCopy, loadBook, pageAsset, peekIndex, type Book, type PageInfo } from '../data/books';
import { listMeta, type PageMeta } from '../data/storage';
import { Icon, type IconName } from './icons';
import { NotFound } from './NotFound';
import { PaperPickerCard, PaperStrip } from './Paper';
import { href } from './router';
import { BackLink } from './BackLink';

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

  // Tiles take the shape of the book's pages (most are 16:9, round designs are square).
  const pageW = book?.width ?? 2560;
  const pageH = book?.height ?? 1440;
  const all = book?.pages ?? [];
  const matches = (f: Filter, p: PageInfo) => {
    if (f === 'easy') return p.difficulty === 'easy';
    if (f === 'detailed') return p.difficulty === 'detailed';
    if (f === 'cbn') return p.numbered > 0 && !!(p.cbn || metas.get(p.id)?.cbnOn);
    return true;
  };
  // Only filters that narrow the pages down are offered (a book where every page is detailed
  // has no Easy or Detailed). With none left, there is no filter bar at all.
  const counts = new Map(FILTERS.map((f) => [f.id, all.filter((p) => matches(f.id, p)).length]));
  const useful = FILTERS.filter((f) => f.id === 'all' || ((counts.get(f.id) ?? 0) > 0 && (counts.get(f.id) ?? 0) < all.length));
  const shown = useful.length > 1 ? useful : [];
  const active: Filter = shown.some((f) => f.id === filter) ? filter : 'all';
  const pages = all.filter((p) => matches(active, p));
  const started = metas.size;
  const finished = [...metas.values()].filter((m) => m.complete).length;
  // The heading draws straight away from the bookshelf built into the page, so it does not jump
  // when the book loads (on /book/<id> it matches the prerendered heading).
  const shelfEntry = peekIndex()?.find((b) => b.id === bookId);
  const intro = bookPageCopy(bookId);
  const title = intro?.h1 ?? book?.title ?? shelfEntry?.title ?? '';
  const pageCount = book ? all.length : shelfEntry?.pageCount;

  if (error) return <NotFound />;

  return (
    <div class="screen picker">
      <header class="picker-head">
        <BackLink class="round-btn" to={href.home()} label={copy.picker.back}>
          <Icon name="back" size={30} />
        </BackLink>
        <div class="picker-heading">
          <h1 class="picker-title">{title}</h1>
          {pageCount !== undefined && (
            <p class="picker-sub">
              {copy.home.pages(pageCount)}
              {started > 0 && <span class="picker-progress"> · {copy.picker.progress(started, finished)}</span>}
            </p>
          )}
        </div>
      </header>
      {intro && <p class="picker-intro">{intro.intro}</p>}
      <PaperStrip bookId={bookId} />

      {shown.length > 0 && (
        <nav class="filters" aria-label={copy.picker.filterLabel}>
          {shown.map((f) => (
            <button
              key={f.id}
              type="button"
              class={`chip ${active === f.id ? 'on' : ''}`}
              aria-pressed={active === f.id}
              onClick={() => pick(f.id)}
            >
              <Icon name={f.icon} size={30} />
              <span class="tiny">
                {copy.picker.filters[f.id]} <span class="chip-count">{counts.get(f.id)}</span>
              </span>
            </button>
          ))}
        </nav>
      )}

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
                  href={href.page(bookId, p.id, active === 'cbn')}
                  aria-label={`${copy.picker.page(p.n)}${done ? `, ${copy.picker.done}` : meta ? `, ${copy.picker.started}` : ''}`}
                >
                  <img
                    src={thumb ?? pageAsset(bookId, p, 'thumb.webp')}
                    srcset={thumb ? undefined : `${pageAsset(bookId, p, 'thumb-sm.webp')} 384w, ${pageAsset(bookId, p, 'thumb.webp')} 480w`}
                    sizes="(max-width: 520px) 46vw, 240px"
                    alt=""
                    width={480}
                    height={Math.round((480 * pageH) / pageW)}
                    style={{ aspectRatio: `${pageW} / ${pageH}` }}
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
        {book && <PaperPickerCard bookId={bookId} />}
      </main>
    </div>
  );
}
