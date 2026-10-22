import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { copy } from './src/copy';

// The site is published straight from the main branch, so `npm run build` writes the
// finished app to the repository root (index.html, assets/, sw.js, manifest.webmanifest), with
// a page for each book (book/<id>.html, served at /book/<id>), sitemap.xml and robots.txt.
// Book data, icons and other public files stay in public/ and are read from there.
const repo = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(repo, 'public');

// Files that are only fetched when a page is opened, so they are not precached.
const PAGE_ASSET = /books\/[^/]+\/pages\/[^/]+\/(line\.png|overlay\.png|overlay-half\.png|regions\.bin|regions\.json)$/;
// The social preview cards are only fetched by other sites, so they are not precached either.
const SHARE_CARD = 'public/share.jpg';
const BOOK_CARD = /^public\/books\/[^/]+\/share\.jpg$/;
// Full-size cover originals (books/<id>/<name>-cover.jpg) are kept for reference; the pages use
// their web copies (<name>-cover-1200.jpg), so the originals are not precached.
const COVER_ORIGINAL = /^public\/books\/[^/]+\/[^/]+-cover\.jpg$/;

// Social previews need absolute links, so they point at the live site (package.json "homepage").
const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
const siteUrl: string = pkg.homepage;
// The ?v= changes with the image, so sites that cache previews fetch a new card.
const shareImage = () => {
  const file = path.join(repo, SHARE_CARD);
  const v = fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 8) : '0';
  return `${siteUrl}${SHARE_CARD}?v=${v}`;
};

// Text in index.html and the web app manifest comes from src/copy.ts like the rest of the copy.
const manifest = (prefix: string) =>
  JSON.stringify(
    {
      name: copy.appName,
      short_name: copy.appName,
      description: copy.metaDescription,
      id: './',
      start_url: './',
      scope: './',
      display: 'standalone',
      orientation: 'any',
      background_color: '#fff8ef',
      theme_color: '#fff8ef',
      categories: ['kids', 'education', 'entertainment'],
      icons: [
        { src: `${prefix}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${prefix}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: `${prefix}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  );

const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// The bookshelf is written into index.html so it draws at full size straight away, without
// waiting for index.json (the app still fetches it to pick up anything newer).
const bookIndex = () => JSON.stringify(JSON.parse(fs.readFileSync(path.join(pub, 'books/index.json'), 'utf8'))).replace(/</g, '\\u003c');

function copyInHtml(build: boolean): Plugin {
  return {
    name: 'webcoloring-copy',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        html = html
          .replace(/%APP_NAME%/g, escapeHtml(copy.appName))
          .replace(/%APP_DESCRIPTION%/g, escapeHtml(copy.metaDescription))
          .replace(/%APP_NOSCRIPT%/g, escapeHtml(copy.noScript))
          .replace(/%SITE_URL%/g, escapeHtml(siteUrl))
          .replace(/%SHARE_TITLE%/g, escapeHtml(copy.share.title))
          .replace(/%SHARE_DESCRIPTION%/g, escapeHtml(copy.share.description))
          .replace(/%SHARE_IMAGE_ALT%/g, escapeHtml(copy.share.imageAlt))
          .replace(/%SHARE_IMAGE%/g, escapeHtml(shareImage()))
          .replace('%BOOK_INDEX%', () => bookIndex());
        // In the built site, icons are read from public/.
        return build ? html.replace(/"\/icons\//g, '"/public/icons/') : html;
      },
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0].endsWith('/manifest.webmanifest')) {
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(manifest(''));
        } else next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest('public/') });
    },
  };
}

// ------------------------------------------------------------------ a page for each book
//
// /book/<id> is a real page: the built index.html with the book's own title, description,
// canonical address and link preview (copy.bookPages in src/copy.ts), and the top of its pages
// (back button, heading, intro) already drawn, so search engines, link previews and visitors
// without JavaScript all see the book. The app then draws the same screen in its place.

const BOOK_PAGES = 'book';

/** Sets the content of one <meta> tag in the built page (it must be there). */
function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const tag = new RegExp(`(<meta ${attr}="${key.replace(/[.:]/g, '\\$&')}" content=")[^"]*(")`);
  if (!tag.test(html)) throw new Error(`index.html has no <meta ${attr}="${key}">`);
  return html.replace(tag, (_, a, b) => a + escapeHtml(value) + b);
}

/** The book's link preview card (npm run book-cards), or null to keep the site's card. */
function shareCard(id: string): string | null {
  const file = `public/books/${id}/share.jpg`;
  if (!fs.existsSync(path.join(repo, file))) return null;
  const v = crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex').slice(0, 8);
  return `${siteUrl}${file}?v=${v}`;
}

/** The top of a book's pages, as the app's Picker draws it. */
function bookHeading(id: string, title: string, pageCount: number, intro: string): string {
  const back =
    '<svg class="icon" width="30" height="30" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
    '<path stroke="#3d3550" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none" d="M28 12 16 24l12 12"></path></svg>';
  return (
    `<div class="screen picker">` +
    `<header class="picker-head"><a class="round-btn" href="/" aria-label="${escapeHtml(copy.picker.back)}">${back}</a>` +
    `<div class="picker-heading"><h1 class="picker-title">${escapeHtml(title)}</h1>` +
    `<p class="picker-sub">${escapeHtml(copy.home.pages(pageCount))}</p></div></header>` +
    `<p class="picker-intro">${escapeHtml(intro)}</p>` +
    `<noscript><p class="notice">${escapeHtml(copy.noScript)}</p></noscript></div>`
  );
}

/** Writes book/<id>.html (and its card) for every book on the shelf. Returns the book ids. */
function writeBookPages(): string[] {
  const shell = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
  const { books } = JSON.parse(fs.readFileSync(path.join(pub, 'books/index.json'), 'utf8')) as {
    books: { id: string; title: string; pageCount: number }[];
  };
  fs.mkdirSync(path.join(repo, BOOK_PAGES), { recursive: true });
  for (const book of books) {
    const page = copy.bookPages[book.id] ?? copy.bookPageFallback(book.title, book.pageCount);
    if (!copy.bookPages[book.id]) console.warn(`\n/book/${book.id} uses the fallback copy: add its own to bookPages in src/copy.ts`);
    const url = `${siteUrl}${BOOK_PAGES}/${book.id}`;
    const image = shareCard(book.id);
    let html = shell
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title)}</title>`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/, (_, a, b) => a + escapeHtml(url) + b);
    html = setMeta(html, 'name', 'description', page.description);
    html = setMeta(html, 'property', 'og:url', url);
    for (const [attr, key] of [['property', 'og:title'], ['name', 'twitter:title']] as const) html = setMeta(html, attr, key, page.title);
    for (const [attr, key] of [['property', 'og:description'], ['name', 'twitter:description']] as const) html = setMeta(html, attr, key, page.description);
    if (image) {
      for (const [attr, key] of [['property', 'og:image'], ['name', 'twitter:image']] as const) html = setMeta(html, attr, key, image);
      for (const [attr, key] of [['property', 'og:image:alt'], ['name', 'twitter:image:alt']] as const) html = setMeta(html, attr, key, copy.bookShareAlt(book.title));
    }
    if (!html.includes('<div id="app"></div>')) throw new Error('index.html has no <div id="app"></div>');
    html = html.replace('<div id="app"></div>', `<div id="app">${bookHeading(book.id, page.h1 ?? book.title, book.pageCount, page.intro)}</div>`);
    // The "needs JavaScript" note is in the heading, where it can be seen.
    html = html.replace(/\s*<noscript>[^<]*<\/noscript>/, '');
    fs.writeFileSync(path.join(repo, BOOK_PAGES, `${book.id}.html`), html);
  }
  return books.map((b) => b.id);
}

/** sitemap.xml (the bookshelf and every book's page) and robots.txt, at the site root. */
function writeSitemap(bookIds: string[]) {
  const urls = [siteUrl, ...bookIds.map((id) => `${siteUrl}${BOOK_PAGES}/${id}`)];
  fs.writeFileSync(
    path.join(repo, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`).join('\n')}\n</urlset>\n`,
  );
  fs.writeFileSync(path.join(repo, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);
}

function walk(dir: string, base: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

// Clears the old build before each build, writes the book pages and the sitemap, then sw.js
// with the list of files to precache. Heavy page files (line art, overlays, region maps) are
// cached when first opened.
function siteBuild(): Plugin {
  return {
    name: 'webcoloring-site',
    apply: 'build',
    buildStart() {
      for (const d of ['assets', BOOK_PAGES]) fs.rmSync(path.join(repo, d), { recursive: true, force: true });
      for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'sitemap.xml', 'robots.txt']) fs.rmSync(path.join(repo, f), { force: true });
    },
    closeBundle() {
      const bookIds = writeBookPages();
      writeSitemap(bookIds);
      const built = ['index.html', 'manifest.webmanifest', ...walk(path.join(repo, 'assets'), repo)];
      const publicFiles = walk(pub, repo).filter((f) => !PAGE_ASSET.test(f) && f !== SHARE_CARD && !BOOK_CARD.test(f) && !COVER_ORIGINAL.test(f) && !f.endsWith('.txt'));
      // Book pages are kept under their address (/book/<id>), so they open offline too.
      const bookPages = bookIds.map((id) => `${BOOK_PAGES}/${id}.html`);
      const precache = [...built, ...publicFiles, ...bookPages].sort();
      const hash = crypto.createHash('sha256');
      for (const f of precache) hash.update(f).update(fs.readFileSync(path.join(repo, f)));
      const version = hash.digest('hex').slice(0, 12);
      const urls = precache.filter((f) => f !== 'index.html').map((f) => f.replace(/^(book\/[^/]+)\.html$/, '$1'));
      const template = fs.readFileSync(path.join(repo, 'src/sw-template.js'), 'utf8');
      const out = template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(['./', ...urls]));
      fs.writeFileSync(path.join(repo, 'sw.js'), out);
    },
  };
}

export default defineConfig(({ command }) => {
  const build = command === 'build';
  return {
    root: path.join(repo, 'src'),
    // From the site root, so the app works the same at / and at /book/<id>.
    base: '/',
    publicDir: pub,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __PUBLIC__: JSON.stringify(build ? 'public/' : ''),
    },
    oxc: {
      jsx: { runtime: 'automatic', importSource: 'preact' },
    },
    build: {
      outDir: repo,
      emptyOutDir: false,
      copyPublicDir: false,
      target: 'es2020',
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 400,
    },
    preview: { port: 4173 },
    plugins: [copyInHtml(build), siteBuild()],
  };
});
