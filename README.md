# WebColoring

A free colouring website for kids aged 6 to 10, on phones, tablets and computers.
Every book by Mat Harvey sits on a bookshelf, and each one gently points to its paperback.

- Static and client-side only: no backend, accounts, ads, analytics, cookies or third-party requests.
- Installable PWA. After the first visit it works offline (pages you open are kept; grown-ups can save a whole book).
- Saved art stays in the browser (IndexedDB). Grown-ups can back it up to a single zip and restore it.

## Quick start

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # type-checks, then builds to dist/
npm run preview      # serves dist/ on http://localhost:4173
```

Node 20 or newer.

## Adding a book

Put the line art in a folder: `page01.jpg` to `pageNN.jpg` (any suffix is fine, for example
`page22-cat-sofa.jpg`) plus an optional `cover.jpg`. Then run:

```sh
npm run prepare-book -- --src <folder> --id <book-id> --title "<title>"
```

This writes everything the app needs to `public/books/<book-id>/` and adds the book to
`public/books/index.json`, which is where the app reads its bookshelf from. Commit the output.

For each page the script:

1. Scales the art onto a common 2560x1440 canvas (keeping the aspect ratio, letterboxed if needed).
2. Thresholds it to black and white and closes 1 to 2 px gaps so regions are sealed. Line ends that stop
   just short of the image edge or another line get an invisible "bridge", so fills do not leak out.
3. Saves `line.png` (lossless black and white), `overlay.png` (transparent, anti-aliased lines for drawing)
   and `overlay-half.png` (the same at half size, for zoomed-out phones).
4. Labels every enclosed white region and saves `regions.bin` (run-length coded Uint16 region ids, zlib
   compressed) and `regions.json` (area, centroid, bounding box, label point and number per region).
5. Numbers regions for colour by numbers from a 12-colour kid palette using a simple, repeatable rule
   (sky blue for big regions at the top, greens low down, neighbours get different colours). Regions below
   a minimum size are "free colour".
6. Writes WebP thumbnails and `book.json` (id, title, pages, difficulty, storeUrl and more).

Options:

| Flag | Meaning |
| --- | --- |
| `--only 1,13,28` | Only redo these pages (others keep their current output). |
| `--debug` | Also write region and colour by numbers previews to `debug/<book-id>/`. |
| `--easy "1-3,8"` / `--detailed "4-7"` | Page difficulty, if not set in `book.config.json`. |
| `--store-url <url>` | The paperback link. |

`scripts/inspect-regions.mjs` paints the biggest regions of a prepared page in strong colours, which makes
leaks easy to spot.

### Per-book settings: `books/<book-id>/book.config.json`

```json
{
  "title": "Blocky Builders",
  "subtitle": "A Block Town Coloring Book for Kids Ages 6-10",
  "storeUrl": null,
  "easy": ["1-3", 8, 9],
  "detailed": ["4-7", 10]
}
```

Pages listed as `easy` open with colour by numbers on. `detailed` pages use bigger number regions.
Without lists, busy pages are marked detailed automatically.

While `storeUrl` is `null`, every "Get the paperback" card is hidden. To add the link later, set it in
`book.config.json` and run `prepare-book` again (or edit `storeUrl` in `public/books/<id>/book.json` and
`public/books/index.json` by hand), then rebuild.

### Colour by numbers overrides: `books/<book-id>/cbn-overrides.json`

Points use 0 to 1 page coordinates (x across, y down) and snap to the nearest region.

```json
{
  "defaults": { "minAreaEasy": 2600, "minAreaDetailed": 7000 },
  "page01": {
    "set": [{ "x": 0.211, "y": 0.833, "n": "brown" }],
    "free": [{ "x": 0.5, "y": 0.1 }],
    "seal": [[0.1062, 0.8028, 0.1164, 0.8417]],
    "minArea": 3000
  }
}
```

- `set` gives a region a palette colour (by key or number).
- `free` makes a region free colour.
- `seal` draws an invisible line that stops fills leaking through a gap in the art.
- `minArea` changes the smallest numbered region for that page (px at 2560x1440).

## Where things are

| Path | What |
| --- | --- |
| `src/copy.ts` | All visible text, in one place for review. |
| `src/engine/` | Canvas engine: view and gestures, fills, brushes, undo, colour by numbers. |
| `src/audio/sound.ts` | Procedural sounds (Web Audio) and haptics. |
| `src/data/` | Book manifests, IndexedDB storage, settings and backups. |
| `src/ui/` | Screens and controls (Preact). |
| `src/sw-template.js` | Service worker, built into `dist/sw.js` with the precache list. |
| `scripts/` | `prepare-book.mjs`, `make-icons.mjs`, `inspect-regions.mjs`. |
| `tests/` | Browser checks (Playwright). |

## Tests

With the preview server running (`npm run build && npm run preview`):

```sh
npm run test:e2e                     # Chromium desktop + Android emulation
BROWSER=webkit npm run test:e2e      # WebKit desktop + iPhone emulation
npm run test:features                # sound unlock, haptics, store card, backup, print, ...
npm run test:offline                 # service worker, installability, offline use
npm run test:regressions             # checks for bugs found in code review
npm run test:screens                 # screenshots at five sizes into debug/screens
```

The tests use Playwright. Install a browser with `npx playwright install chromium` (and `webkit`) if you
do not have one.

## Deploying

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every push to `main`.
One-time setup: in the repository settings, open Pages and set Source to "GitHub Actions".
The site is fully relative, so it works at `https://<user>.github.io/<repo>/` or on any static host.

## Privacy

Nothing leaves the device. There are no accounts, cookies, analytics or third-party scripts, and the
Content Security Policy only allows the site's own files. Links to the paperback open only after a
grown-up holds the button down.
