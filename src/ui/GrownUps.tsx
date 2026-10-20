import { useEffect, useRef, useState } from 'preact/hooks';
import { copy } from '../copy';
import { hapticsSupported } from '../audio/sound';
import { exportBackup, importBackup } from '../data/backup';
import { loadBook, loadIndex, pageAsset, type BookIndexEntry } from '../data/books';
import { updateSettings } from '../data/settings';
import { clearAll } from '../data/storage';
import { useSettings } from './hooks';
import { Icon } from './icons';
import { PaperBookCard, withPaperOnly } from './Paper';
import { href } from './router';
import { BackLink } from './BackLink';
import { downloadBlob } from './share';

declare const __APP_VERSION__: string;

function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label class="toggle-row">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={value} disabled={disabled} onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)} />
      <span class="switch" aria-hidden="true" />
    </label>
  );
}

function OfflineButton({ book }: { book: BookIndexEntry }) {
  const [state, setState] = useState<{ done: number; total: number } | 'done' | 'error' | null>(null);
  const run = async () => {
    try {
      const b = await loadBook(book.id);
      const per = ['overlay.png', 'overlay-half.png', 'regions.bin', 'regions.json'];
      const files = b.pages.flatMap((p) => per.map((f) => pageAsset(b.id, p, f)));
      let n = 0;
      let failed = false;
      setState({ done: 0, total: files.length });
      // A few at a time so phones stay responsive.
      const queue = [...files];
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (queue.length) {
            const url = queue.shift()!;
            try {
              const res = await fetch(url);
              if (!res.ok) failed = true;
              await res.arrayBuffer();
            } catch {
              failed = true;
            }
            setState({ done: ++n, total: files.length });
          }
        }),
      );
      setState(failed ? 'error' : 'done');
    } catch {
      setState('error');
    }
  };
  return (
    <div class="offline-row">
      <button type="button" class="btn" onClick={run} disabled={!!state && typeof state === 'object'}>
        <Icon name="offline" size={26} /> {copy.grownUps.offlineButton(book.title)}
      </button>
      <p class="small" aria-live="polite">
        {state === 'done'
          ? copy.grownUps.offlineDone
          : state === 'error'
            ? copy.grownUps.offlineError
            : state
              ? copy.grownUps.offlineProgress(Math.floor(state.done / 4), Math.round(state.total / 4))
              : ''}
      </p>
    </div>
  );
}

export function GrownUps() {
  const settings = useSettings();
  const [books, setBooks] = useState<BookIndexEntry[]>([]);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadIndex().then(setBooks, () => {});
  }, []);

  const backup = async () => {
    const blob = await exportBackup();
    if (!blob) {
      setMsg(copy.grownUps.backupEmpty);
      return;
    }
    downloadBlob(blob, `webcoloring-backup-${new Date().toISOString().slice(0, 10)}.zip`);
  };

  const restore = async (file: File) => {
    try {
      const n = await importBackup(file);
      setMsg(copy.grownUps.backupDone(n));
    } catch {
      setMsg(copy.grownUps.backupError);
    }
  };

  const clear = async () => {
    if (!window.confirm(copy.grownUps.clearConfirm)) return;
    await clearAll();
    setMsg(copy.grownUps.clearDone);
  };

  return (
    <div class="screen grownups">
      <header class="picker-head">
        <BackLink class="round-btn" to={href.home()} label={copy.grownUps.back}>
          <Icon name="back" size={30} />
        </BackLink>
        <h1 class="picker-title">{copy.grownUps.title}</h1>
      </header>
      <main class="gu-body">
        <section class="card">
          <h2>{copy.grownUps.aboutTitle}</h2>
          {copy.grownUps.about.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>

        <section class="card">
          <h2>{copy.grownUps.privacyTitle}</h2>
          {copy.grownUps.privacy.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>

        <section class="card">
          <h2>{copy.grownUps.booksTitle}</h2>
          <div class="gu-paper">
            {withPaperOnly(books).map((b) => (
              <PaperBookCard key={b.id} book={b} gated={false} compact />
            ))}
          </div>
        </section>

        <section class="card">
          <h2>{copy.grownUps.settingsTitle}</h2>
          <Toggle label={copy.grownUps.sound} value={settings.sound} onChange={(v) => updateSettings({ sound: v })} />
          <label class="slider-row gu-volume">
            <span>{copy.grownUps.volume}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.volume * 100)}
              disabled={!settings.sound}
              onInput={(e) => updateSettings({ volume: Number((e.currentTarget as HTMLInputElement).value) / 100 })}
            />
          </label>
          <Toggle label={copy.grownUps.haptics} value={settings.haptics && hapticsSupported} disabled={!hapticsSupported} onChange={(v) => updateSettings({ haptics: v })} />
          {!hapticsSupported && <p class="small">{copy.grownUps.hapticsUnsupported}</p>}
          <Toggle label={copy.grownUps.patterns} value={settings.patterns} onChange={(v) => updateSettings({ patterns: v })} />
        </section>

        <section class="card">
          <h2>{copy.grownUps.offlineTitle}</h2>
          <p>{copy.grownUps.offlineBody}</p>
          {books.map((b) => (
            <OfflineButton key={b.id} book={b} />
          ))}
        </section>

        <section class="card">
          <h2>{copy.grownUps.backupTitle}</h2>
          <p>{copy.grownUps.backupBody}</p>
          <div class="btn-row">
            <button type="button" class="btn" onClick={backup}>
              <Icon name="download" size={26} /> {copy.grownUps.backupExport}
            </button>
            <button type="button" class="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={26} /> {copy.grownUps.backupImport}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,application/zip"
              class="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = (e.currentTarget as HTMLInputElement).files?.[0];
                if (f) restore(f);
                (e.currentTarget as HTMLInputElement).value = '';
              }}
            />
          </div>
        </section>

        <section class="card">
          <h2>{copy.grownUps.clearTitle}</h2>
          <p>{copy.grownUps.clearBody}</p>
          <button type="button" class="btn btn-danger" onClick={clear}>
            <Icon name="trash" size={26} /> {copy.grownUps.clearButton}
          </button>
        </section>

        <p class="gu-msg" aria-live="polite">
          {msg}
        </p>

        <section class="card">
          <h2>{copy.grownUps.creditsTitle}</h2>
          {copy.grownUps.credits.map((p) => (
            <p key={p} class="small">
              {p}
            </p>
          ))}
          <p class="small">{copy.grownUps.version(__APP_VERSION__)}</p>
        </section>
      </main>
    </div>
  );
}
