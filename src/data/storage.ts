// Saved art lives in IndexedDB on this device only.

export interface PageMeta {
  key: string;
  bookId: string;
  pageId: string;
  /** Page content version the CBN progress belongs to. */
  v: string;
  thumb: Blob | null;
  cbnDone: number[];
  cbnOn: boolean;
  complete: boolean;
  updated: number;
}

// Images are stored as ArrayBuffers, not Blobs: Safari in private mode cannot store Blobs.
interface Stored {
  type: string;
  buf: ArrayBuffer;
}

type StoredMeta = Omit<PageMeta, 'thumb'> & { thumb: Stored | null };

const toStored = async (b: Blob | null): Promise<Stored | null> => (b ? { type: b.type, buf: await b.arrayBuffer() } : null);
const fromStored = (s: Stored | Blob | null | undefined): Blob | null =>
  !s ? null : s instanceof Blob ? s : new Blob([s.buf], { type: s.type });
const fromStoredMeta = (m: StoredMeta): PageMeta => ({ ...m, thumb: fromStored(m.thumb) });

const DB_NAME = 'webcoloring';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('pages')) db.createObjectStore('pages', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('paint')) db.createObjectStore('paint');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(stores, mode);
        let result: T;
        const req = fn(t);
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export const artKey = (bookId: string, pageId: string) => `${bookId}/${pageId}`;

export async function getMeta(key: string): Promise<PageMeta | undefined> {
  try {
    const m = await tx<StoredMeta | undefined>(['pages'], 'readonly', (t) => t.objectStore('pages').get(key));
    return m ? fromStoredMeta(m) : undefined;
  } catch {
    return undefined;
  }
}

export async function getPaint(key: string): Promise<Blob | undefined> {
  try {
    const s = await tx<Stored | undefined>(['paint'], 'readonly', (t) => t.objectStore('paint').get(key));
    return fromStored(s) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function listMeta(bookId?: string): Promise<PageMeta[]> {
  try {
    const all = await tx<StoredMeta[]>(['pages'], 'readonly', (t) => t.objectStore('pages').getAll());
    return (bookId ? all.filter((m) => m.bookId === bookId) : all).map(fromStoredMeta);
  } catch {
    return [];
  }
}

export async function saveArt(meta: PageMeta, paint: Blob | null): Promise<void> {
  // Read the images first: a transaction closes if it waits on anything else.
  const [thumb, paintData] = await Promise.all([toStored(meta.thumb), toStored(paint)]);
  const stored: StoredMeta = { ...meta, thumb };
  await tx(['pages', 'paint'], 'readwrite', (t) => {
    t.objectStore('pages').put(stored);
    if (paintData) t.objectStore('paint').put(paintData, meta.key);
    else t.objectStore('paint').delete(meta.key);
  });
}

export async function deleteArt(key: string): Promise<void> {
  await tx(['pages', 'paint'], 'readwrite', (t) => {
    t.objectStore('pages').delete(key);
    t.objectStore('paint').delete(key);
  });
}

export async function clearAll(): Promise<void> {
  await tx(['pages', 'paint'], 'readwrite', (t) => {
    t.objectStore('pages').clear();
    t.objectStore('paint').clear();
  });
}

/** Ask the browser not to evict saved art when space runs low. */
export function requestPersistence() {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* ignore */
  }
}
