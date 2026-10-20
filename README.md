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
npm run build        # type-checks, then writes the finished site to the repository root
npm run preview      # serves the built site on http://localhost:4173
```

Node 20 or newer.

The source page is `src/index.html`. The files at the repository root named `index.html`, `assets/`,
`sw.js` and `manifest.webmanifest` are build output: do not edit them by hand. They are committed because
GitHub Pages publishes the main branch as it is (see Deploying).

## Adding a book

Put the line art in a folder: `page01.jpg` to `pageNN.jpg` (PNG works too, and any suffix is fine, for
example `page22-cat-sofa.jpg`), plus optionally `cover.jpg` (16:9 art for the shelf) and `front.jpg`
(the real front cover of the paperback, shown wherever the paper book is offered). Then run:

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
6. Writes WebP thumbnails and `book.json` (id, title, pages, difficulty and more).

Options:

| Flag | Meaning |
| --- | --- |
| `--only 1,13,28` | Only redo these pages (others keep their current output). |
| `--debug` | Also write region and colour by numbers previews to `debug/<book-id>/`. |
| `--easy "1-3,8"` / `--detailed "4-7"` | Page difficulty, if not set in `book.config.json`. |

`scripts/inspect-regions.mjs` paints the biggest regions of a prepared page in strong colours, which makes
leaks easy to spot.

### Per-book settings: `books/<book-id>/book.config.json`

```json
{
  "title": "Blocky Builders",
  "subtitle": "A Block Town Coloring Book for Kids Ages 6-10",
  "easy": ["1-3", 8, 9],
  "detailed": ["4-7", 10]
}
```

Pages listed as `easy` open with colour by numbers on. `detailed` pages use bigger number regions.
Without lists, busy pages are marked detailed automatically.

Optional settings for art that is not landscape scenes:

| Key | Meaning |
| --- | --- |
| `canvas` | Page size in px, default `[2560, 1440]`. Round or portrait designs suit a square canvas such as `[2400, 2400]`, which keeps fine detail that a 1440 px tall page would lose. Picker tiles follow the page shape. |
| `closeRadius` | How far line gaps are closed, default `2`. |
| `speckArea` | White specks smaller than this (px) become line, default `40`. Lower it to keep tiny cells in fine pattern work. |

### The paper books

Every book is offered as a paperback on the home screen (below the shelf), under its page picker, on
the finished screen, in the grown-ups area and on its own page (`#/paper`). That page has the covers,
the details and the way to buy.

- Store links, prices and formats live in one place, `src/data/paperbacks.ts`, keyed by book id. A book
  with a link shows "Available now", its price and a "Get the paperback" button. A book with `url: null`
  (or no entry) shows a "Coming soon" badge, its price if set, and a disabled button. Links are plain
  product pages with no affiliate or tracking parameters, and open in a new tab. Outside the grown-ups
  area the button opens Amazon only after a grown-up holds it down. After an edit, run `npm run build`.
- A book that is only on paper (no pages to colour here yet, such as Taken Apart) also lives in
  `src/data/paperbacks.ts`, with its title, subtitle, author, blurb and cover in a `book` block. It shows
  on the paper books page and in the grown-ups area, not on the shelf. Put its cover in
  `public/books/<id>/`: the original as `<id>-cover.jpg` and a web copy (at most 1200 px wide, under
  300 KB) as `<id>-cover-1200.jpg`, which is the one the page uses. Covers are shown whole, so a
  landscape cover is fine.
- `paperback` in `book.config.json` fills in the details list. Each key is optional:

```json
"paperback": { "ages": "6 to 11", "size": "8.5 x 11 in", "singleSided": true }
```

Use `"forGrownUps": true` in place of `ages` for books made for adults.

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
| `src/data/` | Book manifests, store links (`paperbacks.ts`), IndexedDB storage, settings and backups. |
| `src/ui/` | Screens and controls (Preact). |
| `src/index.html` | The page the build starts from. |
| `src/sw-template.js` | Service worker, built into `sw.js` with the precache list. |
| `scripts/` | `prepare-book.mjs`, `make-icons.mjs`, `make-social.mjs`, `inspect-regions.mjs`. |
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

GitHub Pages serves the `main` branch from the repository root (Settings, Pages, "Deploy from a branch",
`main`, `/ (root)`). To publish a change:

```sh
npm run build
git add -A && git commit -m "..." && git push
```

The built site reads book data, icons and other public files from `public/`, so they are published
without being copied. `.nojekyll` tells Pages to serve the files as they are. CI fails if the committed
build is out of date, so a forgotten `npm run build` is caught.

The site is fully relative, so the same files also work at any path on any static host. The one
exception is the social preview tags, which need absolute links and use `homepage` in `package.json`.

### Social preview

When the site is shared on Facebook, WhatsApp, X, iMessage and others, they show `public/share.jpg`
(1200x630) with the title and description from `share` in `src/copy.ts`. To redraw the card, for example
after changing that text, run `npm run social` (Node 22.6 or newer, with a Playwright Chromium), then
`npm run build`.

Sites keep their own copy of a preview for a while. After a change, paste the link into the
[Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) and press "Scrape Again".

## Privacy

Nothing leaves the device. There are no accounts, cookies, analytics or third-party scripts, and the
Content Security Policy only allows the site's own files. Links to the paperback open only after a
grown-up holds the button down.
