import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Writes dist/sw.js from src/sw-template.js with the list of files to precache.
// Heavy page files (line art, overlays, region maps) are cached when first opened instead.
function serviceWorker(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'webcoloring-sw',
    apply: 'build',
    configResolved(c) {
      config = c;
    },
    closeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir);
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else files.push(path.relative(outDir, full).split(path.sep).join('/'));
        }
      };
      walk(outDir);
      const precache = files
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
        .filter((f) => !/^books\/[^/]+\/pages\/[^/]+\/(line\.png|overlay\.png|overlay-half\.png|regions\.bin|regions\.json)$/.test(f))
        .filter((f) => !f.endsWith('OFL.txt'))
        .sort();
      const hash = crypto.createHash('sha256');
      for (const f of precache) hash.update(f).update(fs.readFileSync(path.join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const template = fs.readFileSync(path.resolve(config.root, 'src/sw-template.js'), 'utf8');
      const out = template
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(['./', ...precache.filter((f) => f !== 'index.html')]));
      fs.writeFileSync(path.join(outDir, 'sw.js'), out);
    },
  };
}

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 400,
  },
  plugins: [serviceWorker()],
});
