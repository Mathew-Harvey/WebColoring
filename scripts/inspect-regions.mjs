// QA helper: paints the N largest regions of a prepared page in strong colours to spot leaks.
// node scripts/inspect-regions.mjs public/books/<id>/pages/page01 out.png 6
import fs from 'node:fs';
import zlib from 'node:zlib';
import sharp from 'sharp';
const [,, dir, out, nArg] = process.argv;
const buf = fs.readFileSync(dir + '/regions.bin');
const w = buf.readUInt16LE(4), h = buf.readUInt16LE(6);
const body = zlib.inflateSync(buf.subarray(10));
const ids = new Uint16Array(w * h);
let p = 0, o = 0;
const rv = () => { let v = 0, s = 0, b; do { b = body[p++]; v |= (b & 0x7f) << s; s += 7; } while (b & 0x80); return v; };
while (p < body.length) { const id = rv(), len = rv(); ids.fill(id, o, o + len); o += len; }
const meta = JSON.parse(fs.readFileSync(dir + '/regions.json'));
const order = meta.regions.map((r, i) => [r[0], i + 1]).sort((a, b) => b[0] - a[0]).slice(0, +(nArg || 6));
const cols = [[230,40,40],[40,160,230],[60,200,60],[240,180,0],[180,60,220],[0,200,180],[255,120,180],[120,80,40]];
const cmap = new Map(order.map(([, id], k) => [id, cols[k % cols.length]]));
const rgb = Buffer.alloc(w * h * 3, 255);
for (let i = 0; i < w * h; i++) {
  const id = ids[i];
  if (!id) { rgb[i*3]=rgb[i*3+1]=rgb[i*3+2]=0; continue; }
  const c = cmap.get(id); if (c) { rgb[i*3]=c[0]; rgb[i*3+1]=c[1]; rgb[i*3+2]=c[2]; }
}
await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).resize(1280, 720).png().toFile(out);
console.log(order.map(([a, id]) => `${id}:${(a / (w*h) * 100).toFixed(1)}%`).join(' '));
