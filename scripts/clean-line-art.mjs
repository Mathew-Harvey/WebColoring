#!/usr/bin/env node
// Cleans up soft or low-resolution line art before prepare-book, so the lines come out crisp.
//
//   npm run clean-art -- --src books/<id>/original --out books/<id>/src [--width 3200 --height 1800]
//
// For every pageNN*.jpg|png in --src: evens out faint and strong lines and enlarges 4x
// (mkbitmap), traces the lines into smooth vector curves (potrace), and renders them back as
// sharp, anti-aliased black on white at the book's canvas size into --out, as pageNN.png. Other
// files (cover.jpg, front.jpg) are copied across as they are. Then run prepare-book as usual.
//
// Needs potrace and mkbitmap on the PATH (apt install potrace, or brew install potrace).
//
// Options:
//   --width, --height  output size in px (match "canvas" in book.config.json)
//   --filter 16        highpass radius in source px: evens out faint lines (0 turns it off)
//   --threshold 0.45   0..1, higher keeps fainter lines but thickens all of them
//   --speck 12         specks smaller than this (px at 4x) are dropped
//   --only 1,13        just these pages

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[argv[i].slice(2)] = true;
    else out[argv[i].slice(2)] = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.src || !args.out) {
  console.error('Usage: npm run clean-art -- --src <folder> --out <folder> [--width 3200 --height 1800]');
  process.exit(1);
}
const src = path.resolve(String(args.src));
const out = path.resolve(String(args.out));
const W = Number(args.width ?? 3200);
const H = Number(args.height ?? 1800);
const filter = Number(args.filter ?? 16);
const threshold = Number(args.threshold ?? 0.45);
const speck = Number(args.speck ?? 12);
const only = args.only ? new Set(String(args.only).split(',').map((n) => parseInt(n, 10))) : null;

for (const tool of ['mkbitmap', 'potrace']) {
  if (spawnSync(tool, ['--version']).error) {
    console.error(`${tool} is not installed. Install potrace (apt install potrace, or brew install potrace).`);
    process.exit(1);
  }
}

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr || r.error}`);
}

fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-art-'));
const files = fs.readdirSync(src).sort();
let done = 0;
try {
  for (const file of files) {
    const m = file.match(/^page(\d+).*\.(jpe?g|png|webp)$/i);
    if (!m) {
      if (/\.(jpe?g|png|webp)$/i.test(file)) fs.copyFileSync(path.join(src, file), path.join(out, file));
      continue;
    }
    const n = parseInt(m[1], 10);
    if (only && !only.has(n)) continue;
    const t0 = Date.now();
    const id = `page${String(n).padStart(2, '0')}`;
    // Greyscale, as the PGM file mkbitmap reads.
    const { data, info } = await sharp(path.join(src, file)).flatten({ background: '#ffffff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const pgm = path.join(tmp, `${id}.pgm`);
    fs.writeFileSync(pgm, Buffer.concat([Buffer.from(`P5\n${info.width} ${info.height}\n255\n`), data]));
    // Even out faint lines (highpass), enlarge 4x with cubic interpolation, and threshold.
    const pbm = path.join(tmp, `${id}.pbm`);
    run('mkbitmap', [...(filter > 0 ? ['-f', String(filter)] : ['-n']), '-s', '4', '-3', '-t', String(threshold), pgm, '-o', pbm]);
    // Trace into smooth curves; keep corners fairly sharp, since these are drawn machines.
    const svg = path.join(tmp, `${id}.svg`);
    run('potrace', ['-s', '-t', String(speck), '-a', '0.9', '-O', '0.3', '-u', '10', pbm, '-o', svg]);
    // Render at the canvas size: black curves on white, anti-aliased.
    const density = (72 * W) / (info.width * 4);
    await sharp(svg, { density })
      .resize(W, H, { fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .greyscale()
      // 16 grey levels is plenty for anti-aliased black on white, and keeps the files small.
      .png({ compressionLevel: 9, palette: true, colours: 16, dither: 0 })
      .toFile(path.join(out, `${id}.png`));
    done++;
    console.log(`${id}  ${Date.now() - t0}ms`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`\nCleaned ${done} pages into ${path.relative(process.cwd(), out)}`);
