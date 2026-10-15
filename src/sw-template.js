/* WebColoring service worker. Built into dist/sw.js by vite.config.ts. */
const VERSION = '__VERSION__';
const SHELL = `shell-${VERSION}`;
const PAGES = 'pages-v1';
const PRECACHE = __PRECACHE__;

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
