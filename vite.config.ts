import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { copy } from './src/copy';

// The site is published straight from the main branch, so `npm run build` writes the
// finished app to the repository root (index.html, assets/, sw.js, manifest.webmanifest).
// Book data, icons and other public files stay in public/ and are read from there.
const repo = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(repo, 'public');

// Files that are only fetched when a page is opened, so they are not precached.
const PAGE_ASSET = /books\/[^/]+\/pages\/[^/]+\/(line\.png|overlay\.png|overlay-half\.png|regions\.bin|regions\.json)$/;
// The social preview card is only fetched by other sites, so it is not precached either.
const SHARE_CARD = 'public/share.jpg';

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
          .replace(/%SHARE_IMAGE%/g, escapeHtml(shareImage()));
        // In the built site, icons are read from public/.
        return build ? html.replace(/"\.\/icons\//g, '"./public/icons/') : html;
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

function walk(dir: string, base: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

// Clears the old build before each build, then writes sw.js with the list of files to
// precache. Heavy page files (line art, overlays, region maps) are cached when first opened.
function siteBuild(): Plugin {
  return {
    name: 'webcoloring-site',
    apply: 'build',
    buildStart() {
      fs.rmSync(path.join(repo, 'assets'), { recursive: true, force: true });
      for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) fs.rmSync(path.join(repo, f), { force: true });
    },
    closeBundle() {
      const built = ['index.html', 'manifest.webmanifest', ...walk(path.join(repo, 'assets'), repo)];
      const publicFiles = walk(pub, repo).filter((f) => !PAGE_ASSET.test(f) && f !== SHARE_CARD && !f.endsWith('.txt'));
      const precache = [...built, ...publicFiles].sort();
      const hash = crypto.createHash('sha256');
      for (const f of precache) hash.update(f).update(fs.readFileSync(path.join(repo, f)));
      const version = hash.digest('hex').slice(0, 12);
      const template = fs.readFileSync(path.join(repo, 'src/sw-template.js'), 'utf8');
      const out = template
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(['./', ...precache.filter((f) => f !== 'index.html')]));
      fs.writeFileSync(path.join(repo, 'sw.js'), out);
    },
  };
}

export default defineConfig(({ command }) => {
  const build = command === 'build';
  return {
    root: path.join(repo, 'src'),
    base: './',
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
