// "Backup my art": every saved page in one zip file, and back again.

import { strToU8, strFromU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { getPaint, listMeta, saveArt, type PageMeta } from './storage';

interface BackupManifest {
  app: 'webcoloring';
  format: 1;
  exported: string;
  pages: Omit<PageMeta, 'thumb'>[];
}

const blobBytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

export async function exportBackup(): Promise<Blob | null> {
  const metas = await listMeta();
  if (!metas.length) return null;
  const files: Zippable = {};
  const pages: BackupManifest['pages'] = [];
  for (const m of metas) {
    const paint = await getPaint(m.key);
    const { thumb, ...rest } = m;
    pages.push(rest);
    const base = m.key.replace(/[^a-z0-9/_-]/gi, '_');
    if (paint) files[`paint/${base}.png`] = [await blobBytes(paint), { level: 0 }];
    if (thumb) files[`thumb/${base}.img`] = [await blobBytes(thumb), { level: 0 }];
  }
  const manifest: BackupManifest = { app: 'webcoloring', format: 1, exported: new Date().toISOString(), pages };
  files['webcoloring.json'] = strToU8(JSON.stringify(manifest, null, 1));
  const zip = zipSync(files);
  return new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' });
}

/** Restores pages from a backup. Returns how many were restored. */
export async function importBackup(file: Blob): Promise<number> {
  const entries = unzipSync(await blobBytes(file));
  const raw = entries['webcoloring.json'];
  if (!raw) throw new Error('not a backup');
  const manifest = JSON.parse(strFromU8(raw)) as BackupManifest;
  if (manifest.app !== 'webcoloring' || !Array.isArray(manifest.pages)) throw new Error('not a backup');
  let n = 0;
  for (const p of manifest.pages) {
    if (typeof p.key !== 'string' || typeof p.bookId !== 'string' || typeof p.pageId !== 'string') continue;
    const base = p.key.replace(/[^a-z0-9/_-]/gi, '_');
    const paint = entries[`paint/${base}.png`];
    const thumb = entries[`thumb/${base}.img`];
    const meta: PageMeta = {
      key: p.key,
      bookId: p.bookId,
      pageId: p.pageId,
      v: String(p.v ?? ''),
      cbnDone: Array.isArray(p.cbnDone) ? p.cbnDone.filter((x) => Number.isInteger(x)) : [],
      cbnOn: !!p.cbnOn,
      complete: !!p.complete,
      updated: Number(p.updated) || Date.now(),
      thumb: thumb ? new Blob([thumb.slice().buffer], { type: 'image/webp' }) : null,
    };
    await saveArt(meta, paint ? new Blob([paint.slice().buffer], { type: 'image/png' }) : null);
    n++;
  }
  return n;
}
