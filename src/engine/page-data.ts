import { unzlibSync } from 'fflate';
import { pageAsset, type PageInfo } from '../data/books';

export interface Regions {
  count: number;
  area: Int32Array;
  cx: Int32Array;
  cy: Int32Array;
  x: Int32Array;
  y: Int32Array;
  w: Int32Array;
  h: Int32Array;
  lx: Int32Array;
  ly: Int32Array;
  lr: Int32Array;
  n: Uint8Array;
}

export interface PageData {
  w: number;
  h: number;
  ids: Uint16Array;
  regions: Regions;
  overlay: CanvasImageSource;
  overlayHalf: CanvasImageSource;
}

/** Decodes regions.bin: "WCR1" | u16 w | u16 h | u16 count | zlib(varint pairs id,len). */
export function decodeRegionMap(buf: ArrayBuffer): { w: number; h: number; count: number; ids: Uint16Array } {
  const head = new DataView(buf, 0, 10);
  const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3));
  if (magic !== 'WCR1') throw new Error('Bad region map');
  const w = head.getUint16(4, true);
  const h = head.getUint16(6, true);
  const count = head.getUint16(8, true);
  const body = unzlibSync(new Uint8Array(buf, 10));
  const ids = new Uint16Array(w * h);
  let p = 0;
  let o = 0;
  const n = body.length;
  while (p < n) {
    let id = 0;
    let shift = 0;
    let b: number;
    do {
      b = body[p++];
      id |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    let len = 0;
    shift = 0;
    do {
      b = body[p++];
      len |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    if (id) ids.fill(id, o, o + len);
    o += len;
  }
  if (o !== w * h) throw new Error('Region map size mismatch');
  return { w, h, count, ids };
}

function parseRegions(json: { fields: string[]; regions: number[][] }, count: number): Regions {
  const mk = () => new Int32Array(count + 1);
  const r: Regions = {
    count,
    area: mk(), cx: mk(), cy: mk(), x: mk(), y: mk(), w: mk(), h: mk(), lx: mk(), ly: mk(), lr: mk(),
    n: new Uint8Array(count + 1),
  };
  const idx = (name: string) => json.fields.indexOf(name);
  const f = {
    area: idx('area'), cx: idx('cx'), cy: idx('cy'), x: idx('x'), y: idx('y'), w: idx('w'), h: idx('h'),
    lx: idx('lx'), ly: idx('ly'), lr: idx('lr'), n: idx('n'),
  };
  json.regions.forEach((row, i) => {
    const id = i + 1;
    r.area[id] = row[f.area];
    r.cx[id] = row[f.cx];
    r.cy[id] = row[f.cy];
    r.x[id] = row[f.x];
    r.y[id] = row[f.y];
    r.w[id] = row[f.w];
    r.h[id] = row[f.h];
    r.lx[id] = row[f.lx];
    r.ly[id] = row[f.ly];
    r.lr[id] = row[f.lr];
    r.n[id] = row[f.n];
  });
  return r;
}

async function loadImage(url: string): Promise<CanvasImageSource> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const blob = await res.blob();
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Fall through to <img>.
    }
  }
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await img.decode();
  return img;
}

export async function loadPageData(bookId: string, page: PageInfo): Promise<PageData> {
  const halfP = loadImage(pageAsset(bookId, page, 'overlay-half.png'));
  halfP.catch(() => {});
  const [bin, json, overlay] = await Promise.all([
    fetch(pageAsset(bookId, page, 'regions.bin')).then((r) => {
      if (!r.ok) throw new Error(`${r.status} regions.bin`);
      return r.arrayBuffer();
    }),
    fetch(pageAsset(bookId, page, 'regions.json')).then((r) => {
      if (!r.ok) throw new Error(`${r.status} regions.json`);
      return r.json();
    }),
    loadImage(pageAsset(bookId, page, 'overlay.png')),
  ]);
  const half = await halfP.catch(() => overlay);
  const map = decodeRegionMap(bin);
  return { w: map.w, h: map.h, ids: map.ids, regions: parseRegions(json, map.count), overlay, overlayHalf: half };
}
