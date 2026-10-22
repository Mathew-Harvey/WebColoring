import { useEffect, useState } from 'preact/hooks';
import { peekIndex } from '../data/books';

export type Route =
  | { name: 'home' }
  | { name: 'picker'; bookId: string }
  | { name: 'colour'; bookId: string; pageId: string; done: boolean; cbn: boolean }
  | { name: 'grownups' }
  | { name: 'paper'; bookId: string | null }
  | { name: 'notfound' };

export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'grown-ups' && parts.length === 1) return { name: 'grownups' };
  if (parts[0] === 'paper' && parts.length <= 2) return { name: 'paper', bookId: parts[1] ?? null };
  if (parts[0] === 'book' && parts.length === 2) return { name: 'picker', bookId: parts[1] };
  if (parts[0] === 'book' && (parts.length === 3 || (parts.length === 4 && parts[3] === 'done'))) {
    return { name: 'colour', bookId: parts[1], pageId: parts[2], done: parts[3] === 'done', cbn: params.get('cbn') === '1' };
  }
  return { name: 'notfound' };
}

// ------------------------------------------------------------------ addresses
//
// Every screen is named by its hash route ('#/book/scaly-pals/page05'); history records and the
// code use those names. In the address bar, a book's pages have a real path, /book/<id>, which
// the build prerenders so search engines and link previews see each book. The bookshelf is the
// site root, and every other screen is a hash route on the root ('/#/book/scaly-pals/page05').
// An old '#/book/<id>' link moves to its path when it opens.

const ROOT = import.meta.env.BASE_URL;
const BOOK_PATH = new RegExp(`^${ROOT}book/([^/]+?)(?:\\.html)?/?$`);
const HOME = '#/';
const enc = encodeURIComponent;

const screens = {
  book: (id: string) => `#/book/${enc(id)}`,
  page: (book: string, page: string, cbn = false) => `#/book/${enc(book)}/${enc(page)}${cbn ? '?cbn=1' : ''}`,
  done: (book: string, page: string) => `#/book/${enc(book)}/${enc(page)}/done`,
  grownUps: () => '#/grown-ups',
  paper: (book?: string) => (book ? `#/paper/${enc(book)}` : '#/paper'),
};

/** A book on the shelf: its pages have a path of their own. */
const onShelf = (id: string) => !!peekIndex()?.some((b) => b.id === id);

/** Links to each screen. */
export const href = {
  home: () => ROOT,
  book: (id: string) => (onShelf(id) ? `${ROOT}book/${enc(id)}` : ROOT + screens.book(id)),
  page: (book: string, page: string, cbn = false) => ROOT + screens.page(book, page, cbn),
  done: (book: string, page: string) => ROOT + screens.done(book, page),
  grownUps: () => ROOT + screens.grownUps(),
  paper: (book?: string) => ROOT + screens.paper(book),
};

const normal = (hash: string) => (hash && hash !== '#' ? hash : HOME);

/** The screen a link or address names. */
function screenOf(to: string | URL | Location): string {
  const url = typeof to === 'string' ? new URL(to, location.href) : to;
  if (url.hash && url.hash !== '#') return url.hash;
  const m = BOOK_PATH.exec(url.pathname);
  return m ? `#/book/${m[1]}` : HOME;
}

/** Where a screen shows in the address bar. The query string (?e2e, say) stays. */
function addressOf(screen: string): string {
  const r = parseRoute(screen);
  if (r.name === 'home') return ROOT + location.search;
  if (r.name === 'picker' && onShelf(r.bookId)) return `${ROOT}book/${enc(r.bookId)}${location.search}`;
  return ROOT + location.search + screen;
}

const here = () => location.pathname + location.search + location.hash;

// ------------------------------------------------------------------ going back
//
// Back always leads towards the bookshelf: a page goes back to its book's pages, those go back
// to the bookshelf, and so does every other screen. Two things keep that true for the in-app
// back buttons and the browser or phone back button alike:
//
// - Each history entry remembers the screens before it (history.state.stack). An in-app back
//   button that leads to one of those steps back through history to it, rather than adding a
//   new entry, so the phone's back gesture never jumps forward into the screen just left.
// - A link opened straight to an inner screen (a shared page, say) gets the screens above it
//   added to history, so back goes through its book's pages and the bookshelf before leaving
//   the site. Browsers ignore entries a page adds before anyone has touched it, so they are
//   added at the first tap, click or key press.
//
// New entries are made with plain hash changes, then given their address with replaceState
// (which can change the path too). pushState would do, but crashes some WebKit builds when the
// page is reloaded and then left.

interface NavState {
  wc: 1;
  /** The screens before this one, oldest first. */
  stack: string[];
  /** For a screen opened straight from a link: the screens to add above it, then itself. */
  seed?: string[];
}

/** Two names for the same screen (a ?cbn=1 setting aside). */
const sameScreen = (a: string, b: string) => normal(a).split('?')[0] === normal(b).split('?')[0];
const navState = (): NavState | null => {
  const s = history.state as NavState | null;
  return s && s.wc === 1 && Array.isArray(s.stack) ? s : null;
};

let current = HOME;
let stack: string[] = [];
/** Set while this file changes the address itself, so the events that causes are left alone. */
let quiet = false;
const listeners = new Set<() => void>();

/** The screen one step back towards the bookshelf, or null on the bookshelf itself. */
function parentOf(screen: string): string | null {
  const r = parseRoute(normal(screen));
  switch (r.name) {
    case 'home':
      return null;
    case 'colour':
      return r.done ? screens.page(r.bookId, r.pageId) : screens.book(r.bookId);
    default:
      return HOME;
  }
}

/** Brings the records in line with the history entry now showing, and redraws if it changed. */
function sync() {
  if (quiet) return;
  const screen = screenOf(location);
  // A new entry (a link, or the address bar) follows the screen we were on; a known one
  // (stepped back or forward to, or replaced) keeps its record.
  const known = navState();
  const s: NavState = known ?? { wc: 1, stack: [...stack, current] };
  stack = s.stack;
  const address = addressOf(screen);
  if (!known || here() !== address) history.replaceState(s, '', address);
  if (screen === current) return;
  current = screen;
  for (const fn of listeners) fn();
}

/** Opens a screen, as a new history entry unless `replace`. */
export function navigate(to: string, replace = false) {
  const screen = screenOf(to);
  if (replace) history.replaceState(history.state, '', addressOf(screen));
  else if (screen !== current) {
    quiet = true;
    location.hash = screen;
    quiet = false;
  }
  sync();
}

/** Adds the screens above a screen opened straight from a link, once someone has touched it. */
function addScreensAbove() {
  const s = navState();
  const chain = s?.seed;
  if (!s || !chain || stack.length || !sameScreen(screenOf(location), chain[chain.length - 1])) return;
  if (document.readyState !== 'complete') return; // hash changes made while loading replace, not add
  const last = screenOf(location);
  quiet = true;
  try {
    history.replaceState({ wc: 1, stack: [] } satisfies NavState, '', addressOf(chain[0]));
    for (let i = 1; i < chain.length; i++) {
      const screen = i === chain.length - 1 ? last : chain[i];
      location.hash = screen;
      history.replaceState({ wc: 1, stack: chain.slice(0, i) } satisfies NavState, '', addressOf(screen));
    }
  } finally {
    quiet = false;
  }
  stack = chain.slice(0, -1);
  current = last;
}

/** In-app links open their screen without reloading the page. */
function followLink(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.('a[href]');
  if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
  const url = new URL(a.href);
  if (url.origin !== location.origin || (url.pathname !== ROOT && !BOOK_PATH.test(url.pathname))) return;
  e.preventDefault();
  navigate(url.href);
}

/** Sets up the history records. Call once, before the first render. */
export function startHistory() {
  current = screenOf(location);
  const saved = navState();
  if (saved) {
    // A reload: this tab already has its history.
    stack = saved.stack;
  } else {
    const chain: string[] = [];
    for (let h: string | null = current; h; h = parentOf(h)) chain.unshift(h);
    history.replaceState({ wc: 1, stack: [], ...(chain.length > 1 && { seed: chain }) } satisfies NavState, '');
  }
  // Show the screen at its own address (an old #/book/<id> link moves to /book/<id>).
  if (here() !== addressOf(current)) history.replaceState(history.state, '', addressOf(current));
  if (navState()?.seed) {
    const onTouch = () => {
      const active = (navigator as { userActivation?: { hasBeenActive: boolean } }).userActivation;
      if (active && !active.hasBeenActive) return;
      addScreensAbove();
      if (stack.length || !navState()?.seed) for (const t of TOUCH) window.removeEventListener(t, onTouch, true);
    };
    for (const t of TOUCH) window.addEventListener(t, onTouch, true);
  }
  window.addEventListener('popstate', sync);
  window.addEventListener('hashchange', sync);
  document.addEventListener('click', followLink);
}

// The events that count as someone touching the page (they carry user activation).
const TOUCH = ['pointerdown', 'pointerup', 'keydown', 'click'] as const;

/**
 * Goes back to `to`: steps back through history when `to` is a screen we came through, so the
 * browser and phone back buttons stay in step; otherwise opens it.
 */
export function goBackTo(to: string) {
  const screen = screenOf(to);
  for (let i = stack.length - 1; i >= 0; i--) {
    if (sameScreen(stack[i], screen)) {
      history.go(i - stack.length);
      return;
    }
  }
  navigate(to);
}

/** Back to wherever we came from, or to `fallback` when this screen was the first one opened. */
export function goBack(fallback: string) {
  if (stack.length) history.back();
  else navigate(fallback);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(current));
  useEffect(() => {
    let seen = current;
    const on = () => {
      if (current === seen) return;
      seen = current;
      setRoute(parseRoute(current));
    };
    listeners.add(on);
    on(); // in case the screen changed before this ran
    return () => void listeners.delete(on);
  }, []);
  return route;
}
