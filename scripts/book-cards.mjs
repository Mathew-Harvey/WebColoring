#!/usr/bin/env node
// Draws each book's link preview card (public/books/<id>/share.jpg, 1200x630), shown when its
// page (/book/<id>) is shared on Facebook, WhatsApp, X and others: the whole cover, with a soft
// blurred copy of it filling the sides. prepare-book draws it for the book it prepares; this
// redraws them all.
//
//   npm run book-cards                 (every book on the shelf)
//   npm run book-cards -- --id <id>    (one book)
//
// The cover is books/<id>/src/cover.jpg when there is one, else the prepared cover.webp.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Writes the 1200x630 card for one cover image. */
export async function writeBookCard(cover, out) {
  const [w, h] = [1200, 630];
  const back = await sharp(cover).resize(w, h, { fit: 'cover' }).blur(24).modulate({ brightness: 0.9 }).toBuffer();
  const front = await sharp(cover).resize(w, h, { fit: 'inside' }).toBuffer();
  await sharp(back).composite([{ input: front, gravity: 'centre' }]).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--id');
  const only = i > 0 ? process.argv[i + 1] : null;
  const { books } = JSON.parse(fs.readFileSync(path.join(root, 'public/books/index.json'), 'utf8'));
  for (const { id } of books) {
    if (only && id !== only) continue;
    const cover = [path.join(root, 'books', id, 'src', 'cover.jpg'), path.join(root, 'public/books', id, 'cover.webp')].find((f) => fs.existsSync(f));
    if (!cover) {
      console.log(`${id}: no cover, skipped`);
      continue;
    }
    await writeBookCard(cover, path.join(root, 'public/books', id, 'share.jpg'));
    console.log(`${id}: public/books/${id}/share.jpg`);
  }
}
