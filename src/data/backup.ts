// "Backup my art": every saved page in one zip file, and back again.

import { strToU8, strFromU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { artKey, getPaint, listMeta, saveArt, type PageMeta } from './storage';

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

async function decodes(bytes: Uint8Array): Promise<boolean> {
  try {
    const bmp = await createImageBitmap(new Blob([bytes.slice().buffer], { type: 'image/png' }));
    bmp.close();
    return true;
  } catch {
    return false;
  }
}

/** Restores pages from a backup. Returns how many were restored. */
export async function importBackup(file: Blob): Promise<number> {
  const entries = unzipSync(await blobBytes(file));
  const raw = entries['webcoloring.json'];
  if (!raw) throw new Error('not a backup');
  const manifest = JSON.parse(strFromU8(raw)) as BackupManifest;
  if (manifest.app !== 'webcoloring' || !Array.isArray(manifest.pages)) throw new Error('not a backup');
  // Check every picture first, so a damaged file never replaces good art.
  const ok: { p: BackupManifest['pages'][number]; paint?: Uint8Array; thumb?: Uint8Array }[] = [];
  for (const p of manifest.pages) {
    if (!p || typeof p !== 'object') continue;
    if (typeof p.key !== 'string' || typeof p.bookId !== 'string' || typeof p.pageId !== 'string') continue;
    if (p.key !== artKey(p.bookId, p.pageId)) continue;
    const base = p.key.replace(/[^a-z0-9/_-]/gi, '_');
    const paint = entries[`paint/${base}.png`];
    const thumb = entries[`thumb/${base}.img`];
    if (paint && !(await decodes(paint))) continue;
    ok.push({ p, paint, thumb });
  }
  let n = 0;
  for (const { p, paint, thumb } of ok) {
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
