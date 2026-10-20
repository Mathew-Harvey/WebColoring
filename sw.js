/* WebColoring service worker. Built into dist/sw.js by vite.config.ts. */
const VERSION = '04f210e8cc30';
const SHELL = `shell-${VERSION}`;
const PAGES = 'pages-v1';
const PRECACHE = ["./","assets/index-BFAAQncW.js","assets/index-DYWr_6l5.css","assets/nunito-latin-wght-BzFMHfZw.woff2","manifest.webmanifest","public/also-by/apphub.png","public/also-by/the-bodyweight-gym.png","public/books/blocky-builders/book.json","public/books/blocky-builders/cover-small.webp","public/books/blocky-builders/cover.webp","public/books/blocky-builders/pages/page01/thumb-sm.webp","public/books/blocky-builders/pages/page01/thumb.webp","public/books/blocky-builders/pages/page02/thumb-sm.webp","public/books/blocky-builders/pages/page02/thumb.webp","public/books/blocky-builders/pages/page03/thumb-sm.webp","public/books/blocky-builders/pages/page03/thumb.webp","public/books/blocky-builders/pages/page04/thumb-sm.webp","public/books/blocky-builders/pages/page04/thumb.webp","public/books/blocky-builders/pages/page05/thumb-sm.webp","public/books/blocky-builders/pages/page05/thumb.webp","public/books/blocky-builders/pages/page06/thumb-sm.webp","public/books/blocky-builders/pages/page06/thumb.webp","public/books/blocky-builders/pages/page07/thumb-sm.webp","public/books/blocky-builders/pages/page07/thumb.webp","public/books/blocky-builders/pages/page08/thumb-sm.webp","public/books/blocky-builders/pages/page08/thumb.webp","public/books/blocky-builders/pages/page09/thumb-sm.webp","public/books/blocky-builders/pages/page09/thumb.webp","public/books/blocky-builders/pages/page10/thumb-sm.webp","public/books/blocky-builders/pages/page10/thumb.webp","public/books/blocky-builders/pages/page11/thumb-sm.webp","public/books/blocky-builders/pages/page11/thumb.webp","public/books/blocky-builders/pages/page12/thumb-sm.webp","public/books/blocky-builders/pages/page12/thumb.webp","public/books/blocky-builders/pages/page13/thumb-sm.webp","public/books/blocky-builders/pages/page13/thumb.webp","public/books/blocky-builders/pages/page14/thumb-sm.webp","public/books/blocky-builders/pages/page14/thumb.webp","public/books/blocky-builders/pages/page15/thumb-sm.webp","public/books/blocky-builders/pages/page15/thumb.webp","public/books/blocky-builders/pages/page16/thumb-sm.webp","public/books/blocky-builders/pages/page16/thumb.webp","public/books/blocky-builders/pages/page17/thumb-sm.webp","public/books/blocky-builders/pages/page17/thumb.webp","public/books/blocky-builders/pages/page18/thumb-sm.webp","public/books/blocky-builders/pages/page18/thumb.webp","public/books/blocky-builders/pages/page19/thumb-sm.webp","public/books/blocky-builders/pages/page19/thumb.webp","public/books/blocky-builders/pages/page20/thumb-sm.webp","public/books/blocky-builders/pages/page20/thumb.webp","public/books/blocky-builders/pages/page21/thumb-sm.webp","public/books/blocky-builders/pages/page21/thumb.webp","public/books/blocky-builders/pages/page22/thumb-sm.webp","public/books/blocky-builders/pages/page22/thumb.webp","public/books/blocky-builders/pages/page23/thumb-sm.webp","public/books/blocky-builders/pages/page23/thumb.webp","public/books/blocky-builders/pages/page24/thumb-sm.webp","public/books/blocky-builders/pages/page24/thumb.webp","public/books/blocky-builders/pages/page25/thumb-sm.webp","public/books/blocky-builders/pages/page25/thumb.webp","public/books/blocky-builders/pages/page26/thumb-sm.webp","public/books/blocky-builders/pages/page26/thumb.webp","public/books/blocky-builders/pages/page27/thumb-sm.webp","public/books/blocky-builders/pages/page27/thumb.webp","public/books/blocky-builders/pages/page28/thumb-sm.webp","public/books/blocky-builders/pages/page28/thumb.webp","public/books/blocky-builders/pages/page29/thumb-sm.webp","public/books/blocky-builders/pages/page29/thumb.webp","public/books/blocky-builders/pages/page30/thumb-sm.webp","public/books/blocky-builders/pages/page30/thumb.webp","public/books/index.json","public/books/scaly-pals/book.json","public/books/scaly-pals/cover-small.webp","public/books/scaly-pals/cover.webp","public/books/scaly-pals/front.webp","public/books/scaly-pals/pages/page01/thumb-sm.webp","public/books/scaly-pals/pages/page01/thumb.webp","public/books/scaly-pals/pages/page02/thumb-sm.webp","public/books/scaly-pals/pages/page02/thumb.webp","public/books/scaly-pals/pages/page03/thumb-sm.webp","public/books/scaly-pals/pages/page03/thumb.webp","public/books/scaly-pals/pages/page04/thumb-sm.webp","public/books/scaly-pals/pages/page04/thumb.webp","public/books/scaly-pals/pages/page05/thumb-sm.webp","public/books/scaly-pals/pages/page05/thumb.webp","public/books/scaly-pals/pages/page06/thumb-sm.webp","public/books/scaly-pals/pages/page06/thumb.webp","public/books/scaly-pals/pages/page07/thumb-sm.webp","public/books/scaly-pals/pages/page07/thumb.webp","public/books/scaly-pals/pages/page08/thumb-sm.webp","public/books/scaly-pals/pages/page08/thumb.webp","public/books/scaly-pals/pages/page09/thumb-sm.webp","public/books/scaly-pals/pages/page09/thumb.webp","public/books/scaly-pals/pages/page10/thumb-sm.webp","public/books/scaly-pals/pages/page10/thumb.webp","public/books/scaly-pals/pages/page11/thumb-sm.webp","public/books/scaly-pals/pages/page11/thumb.webp","public/books/scaly-pals/pages/page12/thumb-sm.webp","public/books/scaly-pals/pages/page12/thumb.webp","public/books/scaly-pals/pages/page13/thumb-sm.webp","public/books/scaly-pals/pages/page13/thumb.webp","public/books/scaly-pals/pages/page14/thumb-sm.webp","public/books/scaly-pals/pages/page14/thumb.webp","public/books/scaly-pals/pages/page15/thumb-sm.webp","public/books/scaly-pals/pages/page15/thumb.webp","public/books/scaly-pals/pages/page16/thumb-sm.webp","public/books/scaly-pals/pages/page16/thumb.webp","public/books/scaly-pals/pages/page17/thumb-sm.webp","public/books/scaly-pals/pages/page17/thumb.webp","public/books/scaly-pals/pages/page18/thumb-sm.webp","public/books/scaly-pals/pages/page18/thumb.webp","public/books/scaly-pals/pages/page19/thumb-sm.webp","public/books/scaly-pals/pages/page19/thumb.webp","public/books/scaly-pals/pages/page20/thumb-sm.webp","public/books/scaly-pals/pages/page20/thumb.webp","public/books/scaly-pals/pages/page21/thumb-sm.webp","public/books/scaly-pals/pages/page21/thumb.webp","public/books/scaly-pals/pages/page22/thumb-sm.webp","public/books/scaly-pals/pages/page22/thumb.webp","public/books/scaly-pals/pages/page23/thumb-sm.webp","public/books/scaly-pals/pages/page23/thumb.webp","public/books/scaly-pals/pages/page24/thumb-sm.webp","public/books/scaly-pals/pages/page24/thumb.webp","public/books/scaly-pals/pages/page25/thumb-sm.webp","public/books/scaly-pals/pages/page25/thumb.webp","public/books/scaly-pals/pages/page26/thumb-sm.webp","public/books/scaly-pals/pages/page26/thumb.webp","public/books/scaly-pals/pages/page27/thumb-sm.webp","public/books/scaly-pals/pages/page27/thumb.webp","public/books/scaly-pals/pages/page28/thumb-sm.webp","public/books/scaly-pals/pages/page28/thumb.webp","public/books/scaly-pals/pages/page29/thumb-sm.webp","public/books/scaly-pals/pages/page29/thumb.webp","public/books/scaly-pals/pages/page30/thumb-sm.webp","public/books/scaly-pals/pages/page30/thumb.webp","public/books/still-water-mandalas/book.json","public/books/still-water-mandalas/cover-small.webp","public/books/still-water-mandalas/cover.webp","public/books/still-water-mandalas/front.webp","public/books/still-water-mandalas/pages/page01/thumb-sm.webp","public/books/still-water-mandalas/pages/page01/thumb.webp","public/books/still-water-mandalas/pages/page02/thumb-sm.webp","public/books/still-water-mandalas/pages/page02/thumb.webp","public/books/still-water-mandalas/pages/page03/thumb-sm.webp","public/books/still-water-mandalas/pages/page03/thumb.webp","public/books/still-water-mandalas/pages/page04/thumb-sm.webp","public/books/still-water-mandalas/pages/page04/thumb.webp","public/books/still-water-mandalas/pages/page05/thumb-sm.webp","public/books/still-water-mandalas/pages/page05/thumb.webp","public/books/still-water-mandalas/pages/page06/thumb-sm.webp","public/books/still-water-mandalas/pages/page06/thumb.webp","public/books/still-water-mandalas/pages/page07/thumb-sm.webp","public/books/still-water-mandalas/pages/page07/thumb.webp","public/books/still-water-mandalas/pages/page08/thumb-sm.webp","public/books/still-water-mandalas/pages/page08/thumb.webp","public/books/still-water-mandalas/pages/page09/thumb-sm.webp","public/books/still-water-mandalas/pages/page09/thumb.webp","public/books/still-water-mandalas/pages/page10/thumb-sm.webp","public/books/still-water-mandalas/pages/page10/thumb.webp","public/books/still-water-mandalas/pages/page11/thumb-sm.webp","public/books/still-water-mandalas/pages/page11/thumb.webp","public/books/still-water-mandalas/pages/page12/thumb-sm.webp","public/books/still-water-mandalas/pages/page12/thumb.webp","public/books/still-water-mandalas/pages/page13/thumb-sm.webp","public/books/still-water-mandalas/pages/page13/thumb.webp","public/books/still-water-mandalas/pages/page14/thumb-sm.webp","public/books/still-water-mandalas/pages/page14/thumb.webp","public/books/still-water-mandalas/pages/page15/thumb-sm.webp","public/books/still-water-mandalas/pages/page15/thumb.webp","public/books/still-water-mandalas/pages/page16/thumb-sm.webp","public/books/still-water-mandalas/pages/page16/thumb.webp","public/books/still-water-mandalas/pages/page17/thumb-sm.webp","public/books/still-water-mandalas/pages/page17/thumb.webp","public/books/still-water-mandalas/pages/page18/thumb-sm.webp","public/books/still-water-mandalas/pages/page18/thumb.webp","public/books/still-water-mandalas/pages/page19/thumb-sm.webp","public/books/still-water-mandalas/pages/page19/thumb.webp","public/books/still-water-mandalas/pages/page20/thumb-sm.webp","public/books/still-water-mandalas/pages/page20/thumb.webp","public/books/still-water-mandalas/pages/page21/thumb-sm.webp","public/books/still-water-mandalas/pages/page21/thumb.webp","public/books/still-water-mandalas/pages/page22/thumb-sm.webp","public/books/still-water-mandalas/pages/page22/thumb.webp","public/books/still-water-mandalas/pages/page23/thumb-sm.webp","public/books/still-water-mandalas/pages/page23/thumb.webp","public/books/still-water-mandalas/pages/page24/thumb-sm.webp","public/books/still-water-mandalas/pages/page24/thumb.webp","public/books/still-water-mandalas/pages/page25/thumb-sm.webp","public/books/still-water-mandalas/pages/page25/thumb.webp","public/books/still-water-mandalas/pages/page26/thumb-sm.webp","public/books/still-water-mandalas/pages/page26/thumb.webp","public/books/still-water-mandalas/pages/page27/thumb-sm.webp","public/books/still-water-mandalas/pages/page27/thumb.webp","public/books/still-water-mandalas/pages/page28/thumb-sm.webp","public/books/still-water-mandalas/pages/page28/thumb.webp","public/books/still-water-mandalas/pages/page29/thumb-sm.webp","public/books/still-water-mandalas/pages/page29/thumb.webp","public/books/still-water-mandalas/pages/page30/thumb-sm.webp","public/books/still-water-mandalas/pages/page30/thumb.webp","public/books/taken-apart/book.json","public/books/taken-apart/cover-small.webp","public/books/taken-apart/cover.webp","public/books/taken-apart/pages/page01/thumb-sm.webp","public/books/taken-apart/pages/page01/thumb.webp","public/books/taken-apart/pages/page02/thumb-sm.webp","public/books/taken-apart/pages/page02/thumb.webp","public/books/taken-apart/pages/page03/thumb-sm.webp","public/books/taken-apart/pages/page03/thumb.webp","public/books/taken-apart/pages/page04/thumb-sm.webp","public/books/taken-apart/pages/page04/thumb.webp","public/books/taken-apart/pages/page05/thumb-sm.webp","public/books/taken-apart/pages/page05/thumb.webp","public/books/taken-apart/pages/page06/thumb-sm.webp","public/books/taken-apart/pages/page06/thumb.webp","public/books/taken-apart/pages/page07/thumb-sm.webp","public/books/taken-apart/pages/page07/thumb.webp","public/books/taken-apart/pages/page08/thumb-sm.webp","public/books/taken-apart/pages/page08/thumb.webp","public/books/taken-apart/pages/page09/thumb-sm.webp","public/books/taken-apart/pages/page09/thumb.webp","public/books/taken-apart/pages/page10/thumb-sm.webp","public/books/taken-apart/pages/page10/thumb.webp","public/books/taken-apart/pages/page11/thumb-sm.webp","public/books/taken-apart/pages/page11/thumb.webp","public/books/taken-apart/pages/page12/thumb-sm.webp","public/books/taken-apart/pages/page12/thumb.webp","public/books/taken-apart/pages/page13/thumb-sm.webp","public/books/taken-apart/pages/page13/thumb.webp","public/books/taken-apart/pages/page14/thumb-sm.webp","public/books/taken-apart/pages/page14/thumb.webp","public/books/taken-apart/pages/page15/thumb-sm.webp","public/books/taken-apart/pages/page15/thumb.webp","public/books/taken-apart/pages/page16/thumb-sm.webp","public/books/taken-apart/pages/page16/thumb.webp","public/books/taken-apart/pages/page17/thumb-sm.webp","public/books/taken-apart/pages/page17/thumb.webp","public/books/taken-apart/pages/page18/thumb-sm.webp","public/books/taken-apart/pages/page18/thumb.webp","public/books/taken-apart/pages/page19/thumb-sm.webp","public/books/taken-apart/pages/page19/thumb.webp","public/books/taken-apart/pages/page20/thumb-sm.webp","public/books/taken-apart/pages/page20/thumb.webp","public/books/taken-apart/pages/page21/thumb-sm.webp","public/books/taken-apart/pages/page21/thumb.webp","public/books/taken-apart/pages/page22/thumb-sm.webp","public/books/taken-apart/pages/page22/thumb.webp","public/books/taken-apart/pages/page23/thumb-sm.webp","public/books/taken-apart/pages/page23/thumb.webp","public/books/taken-apart/pages/page24/thumb-sm.webp","public/books/taken-apart/pages/page24/thumb.webp","public/books/taken-apart/pages/page25/thumb-sm.webp","public/books/taken-apart/pages/page25/thumb.webp","public/books/taken-apart/pages/page26/thumb-sm.webp","public/books/taken-apart/pages/page26/thumb.webp","public/books/taken-apart/pages/page27/thumb-sm.webp","public/books/taken-apart/pages/page27/thumb.webp","public/books/taken-apart/pages/page28/thumb-sm.webp","public/books/taken-apart/pages/page28/thumb.webp","public/books/taken-apart/pages/page29/thumb-sm.webp","public/books/taken-apart/pages/page29/thumb.webp","public/books/taken-apart/pages/page30/thumb-sm.webp","public/books/taken-apart/pages/page30/thumb.webp","public/books/taken-apart/taken-apart-cover-1200.jpg","public/icons/apple-touch-icon.png","public/icons/favicon.svg","public/icons/icon-192.png","public/icons/icon-512.png","public/icons/icon-maskable-512.png"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // Skip the HTTP cache so a fresh deploy never stores yesterday's files.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

/** Removes kept page art whose version is no longer in any book. */
async function prunePages() {
  const shell = await caches.open(SHELL);
  const current = new Set();
  for (const req of await shell.keys()) {
    if (!/\/books\/[^/]+\/book\.json$/.test(new URL(req.url).pathname)) continue;
    try {
      const book = await (await shell.match(req)).json();
      for (const p of book.pages || []) current.add(p.v);
    } catch {
      return; // If a book cannot be read, keep everything.
    }
  }
  if (!current.size) return;
  const pages = await caches.open(PAGES);
  for (const req of await pages.keys()) {
    const v = new URL(req.url).searchParams.get('v');
    if (v && !current.has(v)) await pages.delete(req);
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => prunePages().catch(() => {}))
      .then(() => self.clients.claim()),
  );
});

const isPageAsset = (url) => /\/books\/[^/]+\/pages\/[^/]+\/(line\.png|overlay\.png|overlay-half\.png|regions\.bin|regions\.json)$/.test(url.pathname);
// The bookshelf and each book's details: small, and they change when a book is added.
const isBookData = (url) => /\/books\/(index\.json|[^/]+\/book\.json)$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page art: versioned by query string, so cache first and keep forever.
  if (isPageAsset(url)) {
    event.respondWith(
      caches.open(PAGES).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Book data: network first, so new books show at once; the kept copy when offline.
  if (isBookData(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (!res.ok) return caches.match(req, { ignoreSearch: true }).then((r) => r || res);
          const copy = res.clone();
          caches.open(SHELL).then((cache) => cache.put(url.pathname, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || Response.error())),
    );
    return;
  }

  // Navigations: the app shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./', { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
    );
    return;
  }

  // Everything else: cache first, then network (and keep a copy).
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(SHELL).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
