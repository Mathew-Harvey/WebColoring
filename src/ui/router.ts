import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'home' }
  | { name: 'picker'; bookId: string }
  | { name: 'colour'; bookId: string; pageId: string; done: boolean; cbn: boolean }
  | { name: 'grownups' }
  | { name: 'notfound' };

export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'grown-ups' && parts.length === 1) return { name: 'grownups' };
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
};

export function navigate(to: string, replace = false) {
  if (replace) {
    history.replaceState(null, '', to);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else location.hash = to;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
