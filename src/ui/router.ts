import { useEffect, useState } from 'preact/hooks';

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

export const href = {
  home: () => '#/',
  book: (id: string) => `#/book/${encodeURIComponent(id)}`,
  page: (book: string, page: string, cbn = false) => `#/book/${encodeURIComponent(book)}/${encodeURIComponent(page)}${cbn ? '?cbn=1' : ''}`,
  done: (book: string, page: string) => `#/book/${encodeURIComponent(book)}/${encodeURIComponent(page)}/done`,
  grownUps: () => '#/grown-ups',
  paper: (book?: string) => (book ? `#/paper/${encodeURIComponent(book)}` : '#/paper'),
};

export function navigate(to: string, replace = false) {
  if (replace) {
    // Keep the entry's record of where it came from (see below).
    history.replaceState(history.state, '', to);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else location.hash = to;
}

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
//   added at the first tap, click or key press. They are made with plain hash changes:
//   pushState would do, but crashes some WebKit builds when the page is reloaded and then left.

interface NavState {
  wc: 1;
  /** The screens before this one, oldest first. */
  stack: string[];
  /** For a screen opened straight from a link: the screens to add above it, then itself. */
  seed?: string[];
}

const HOME = href.home();
const normal = (hash: string) => (hash && hash !== '#' ? hash : HOME);
/** Two hashes name the same screen (a ?cbn=1 setting aside). */
const sameScreen = (a: string, b: string) => normal(a).split('?')[0] === normal(b).split('?')[0];
const navState = (): NavState | null => {
  const s = history.state as NavState | null;
  return s && s.wc === 1 && Array.isArray(s.stack) ? s : null;
};

let current = HOME;
let stack: string[] = [];

/** The screen one step back towards the bookshelf, or null on the bookshelf itself. */
export function parentOf(hash: string): string | null {
  const r = parseRoute(normal(hash));
  switch (r.name) {
    case 'home':
      return null;
    case 'colour':
      return r.done ? href.page(r.bookId, r.pageId) : href.book(r.bookId);
    default:
      return HOME;
  }
}

/** Adds the screens above a screen opened straight from a link, once someone has touched it. */
function addScreensAbove() {
  const s = navState();
  const chain = s?.seed;
  if (!s || !chain || stack.length || !sameScreen(location.hash, chain[chain.length - 1])) return;
  if (document.readyState !== 'complete') return; // hash changes made while loading replace, not add
  const here = normal(location.hash);
  history.replaceState({ wc: 1, stack: [] } satisfies NavState, '', chain[0]);
  for (let i = 1; i < chain.length; i++) {
    location.hash = i === chain.length - 1 ? here : chain[i];
    history.replaceState({ wc: 1, stack: chain.slice(0, i) } satisfies NavState, '');
  }
  stack = chain.slice(0, -1);
  current = here;
}

/** Sets up the history records. Call once, before the first render. */
export function startHistory() {
  current = normal(location.hash);
  const saved = navState();
  if (saved) {
    // A reload: this tab already has its history.
    stack = saved.stack;
  } else {
    const chain: string[] = [];
    for (let h: string | null = current; h; h = parentOf(h)) chain.unshift(h);
    history.replaceState({ wc: 1, stack: [], ...(chain.length > 1 && { seed: chain }) } satisfies NavState, '');
  }
  if (navState()?.seed) {
    const onTouch = () => {
      const active = (navigator as { userActivation?: { hasBeenActive: boolean } }).userActivation;
      if (active && !active.hasBeenActive) return;
      addScreensAbove();
      if (stack.length || !navState()?.seed) for (const t of TOUCH) window.removeEventListener(t, onTouch, true);
    };
    for (const t of TOUCH) window.addEventListener(t, onTouch, true);
  }
  window.addEventListener('hashchange', () => {
    const next = normal(location.hash);
    const s = navState();
    if (s) stack = s.stack; // stepped back or forward to a known entry, or replaced one
    else {
      // A new entry (a link, or the address bar): it follows the screen we were on.
      stack = [...stack, current];
      history.replaceState({ wc: 1, stack } satisfies NavState, '');
    }
    current = next;
  });
}

// The events that count as someone touching the page (they carry user activation).
const TOUCH = ['pointerdown', 'pointerup', 'keydown', 'click'] as const;

/**
 * Goes back to `to`: steps back through history when `to` is a screen we came through, so the
 * browser and phone back buttons stay in step; otherwise opens it.
 */
export function goBackTo(to: string) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (sameScreen(stack[i], to)) {
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
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    let seen = location.hash;
    const on = () => {
      if (location.hash === seen) return; // the same screen (entries being added above it)
      seen = location.hash;
      setRoute(parseRoute(location.hash));
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
