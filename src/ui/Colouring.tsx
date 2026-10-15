import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { copy } from '../copy';
import { buzz, sound } from '../audio/sound';
import { loadBook, pageAsset, type Book, type PageInfo } from '../data/books';
import { getLocal, setLocal } from '../data/settings';
import { artKey, deleteArt, getMeta, getPaint, requestPersistence, saveArt } from '../data/storage';
import type { BrushId } from '../engine/brushes';
import { Engine, type Feedback, type ToolId } from '../engine/engine';
import type { FillStyle } from '../engine/fills';
import { loadPageData } from '../engine/page-data';
import type { StampShape } from '../engine/shapes';
import { Finished } from './Finished';
import { prefersReducedMotion, useMedia, useSettings } from './hooks';
import { Icon } from './icons';
import { getRecent, pushRecent } from './palette';
import { href, navigate } from './router';
import { canvasToBlob, printPicture, savePicture } from './share';
import { ColourSheet, ColourStrip, NumberStrip, ToolButtons, ToolOptions } from './ToolPanel';

interface Props {
  bookId: string;
  pageId: string;
  done: boolean;
  cbn: boolean;
}

interface ToolPrefs {
  tool: ToolId;
  colour: string;
  sizes: Record<string, number>;
  opacity: number;
  fillStyle: FillStyle;
  stamp: StampShape;
  stayInside: boolean;
}

const DEFAULT_PREFS: ToolPrefs = {
  tool: 'crayon',
  colour: '#ef3b36',
  sizes: {},
  opacity: 1,
  fillStyle: 'solid',
  stamp: 'star',
  stayInside: true,
};

const feedback: Feedback = {
  strokeStart: (t: BrushId) => {
    sound.strokeStart(t);
    buzz(4);
  },
  strokeMove: (speed, p) => sound.strokeMove(speed, p),
  strokeEnd: () => sound.strokeEnd(),
  fill: (hex) => {
    sound.fill(hex);
    buzz(10);
  },
  pop: (hex) => {
    sound.pop(hex);
    buzz([8, 30, 12]);
  },
  wrong: () => {
    sound.wrong();
    buzz([6, 40, 6]);
  },
  pick: () => {
    sound.pick();
    buzz(6);
  },
  stamp: () => {
    sound.stamp();
    buzz(8);
  },
  numberDone: (n) => {
    sound.numberDone(n);
    buzz([15, 40, 15]);
  },
  pageDone: () => {
    sound.pageDone();
    buzz([20, 50, 20, 50, 40]);
  },
  undo: () => sound.undo(),
};

/** A soft stand-in for the page while it loads. */
function Preview({ src }: { src: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const c = ref.current;
      if (!c) return;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')?.drawImage(img, 0, 0);
    };
    img.src = src;
    return () => {
      img.onload = null;
    };
  }, [src]);
  return <canvas ref={ref} class="stage-preview" aria-hidden="true" />;
}

export function Colouring({ bookId, pageId, done, cbn }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const pageRef = useRef<PageInfo | null>(null);
  const completeRef = useRef(false);
  const dirty = useRef(false);
  const saveTimer = useRef(0);
  const [book, setBook] = useState<Book | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const [prefs, setPrefs] = useState<ToolPrefs>(() => ({ ...DEFAULT_PREFS, ...getLocal<Partial<ToolPrefs>>('tools', {}) }));
  const prevTool = useRef<ToolId>('crayon');
  const [recent, setRecent] = useState(getRecent);
  const [sheet, setSheet] = useState(false);
  const [wrongKey, setWrongKey] = useState(0);
  const [screenScale, setScreenScale] = useState(0.4);
  const [isFit, setIsFit] = useState(true);
  const [finishedImg, setFinishedImg] = useState<HTMLCanvasElement | null>(null);
  const settings = useSettings();
  const side = useMedia('(orientation: landscape) and (min-width: 640px) and (min-height: 300px)');
  const reducedMotion = prefersReducedMotion();
  const key = artKey(bookId, pageId);

  const prefsRef = useRef(prefs);
  const updatePrefs = (patch: Partial<ToolPrefs>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setLocal('tools', next);
    setPrefs(next);
    // Apply straight away so a quick tap after switching tools uses the new tool.
    syncEngine(next);
  };

  // ------------------------------------------------------------ saving

  const saveNow = useCallback((): Promise<void> => {
    const e = engineRef.current;
    const page = pageRef.current;
    if (!e || !page || !dirty.current) return Promise.resolve();
    dirty.current = false;
    clearTimeout(saveTimer.current);
    const cbnDone = e.cbnDoneList();
    if (e.isBlank() && !cbnDone.length) return deleteArt(key).catch(() => {});
    const p = e.cbnProgress();
    const meta = {
      key,
      bookId,
      pageId,
      v: page.v,
      cbnDone,
      cbnOn: e.cbnEnabled,
      complete: completeRef.current || (p.total > 0 && p.done === p.total),
      updated: Date.now(),
    };
    // Both canvases are read right now, so this is safe to call just before the engine goes away.
    const paint = e.paintBlob();
    const thumb = canvasToBlob(e.composite(480), 'image/webp', 0.8);
    return Promise.all([paint, thumb])
      .then(([paintBlob, thumbBlob]) => saveArt({ ...meta, thumb: thumbBlob }, paintBlob))
      .then(() => requestPersistence())
      .catch(() => {
        dirty.current = true;
      });
  }, [key, bookId, pageId]);

  const scheduleSave = useCallback(() => {
    dirty.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(saveNow, 1500);
  }, [saveNow]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', saveNow);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', saveNow);
    };
  }, [saveNow]);

  // ------------------------------------------------------------ loading

  useEffect(() => {
    let cancelled = false;
    let engine: Engine | null = null;
    setStatus('loading');
    completeRef.current = false;
    dirty.current = false;

    (async () => {
      const b = await loadBook(bookId);
      const page = b.pages.find((p) => p.id === pageId);
      if (!page) throw new Error('no page');
      pageRef.current = page;
      if (!cancelled) setBook(b);
      // Let the toolbar paint before the big page downloads start.
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      if (cancelled) return;
      const [data, meta, paint] = await Promise.all([loadPageData(bookId, page), getMeta(key), getPaint(key)]);
      // Short breaks between the heavy steps keep the page responsive while it opens.
      const breathe = () => new Promise((r) => setTimeout(r, 0));
      await breathe();
      if (cancelled || !canvasRef.current) return;
      engine = new Engine(
        canvasRef.current,
        data,
        b.cbnPalette,
        feedback,
        {
          history: bump,
          change: scheduleSave,
          picked: (hex) => {
            setRecent(pushRecent(hex));
            const back = prevTool.current === 'eyedropper' ? 'crayon' : prevTool.current;
            updatePrefs({ colour: hex, tool: back });
          },
          cbn: bump,
          wrong: () => setWrongKey((k) => k + 1),
          complete: () => {
            completeRef.current = true;
            dirty.current = true;
            saveNow();
            setTimeout(() => navigate(href.done(bookId, pageId)), reducedMotion ? 300 : 1100);
          },
          view: () => {
            const e = engineRef.current;
            if (!e) return;
            setScreenScale(e.view.scale);
            setIsFit(e.isFit);
          },
        },
        reducedMotion,
      );
      engineRef.current = engine;
      await breathe();
      if (cancelled) return;
      if (location.search.includes('e2e')) (window as unknown as { __wc: Engine }).__wc = engine;
      if (paint) await engine.loadPaint(paint).catch(() => {});
      if (meta) completeRef.current = meta.complete;
      if (meta && meta.v === page.v) engine.loadCbnDone(meta.cbnDone);
      await breathe();
      if (cancelled) return;
      const wantCbn = (cbn || (meta ? meta.cbnOn : page.cbn)) && engine.hasNumbers;
      engine.setCbnEnabled(wantCbn);
      if (wantCbn) {
        const next = engine.cbnProgress().numbers.find((n) => n.done < n.total);
        if (next) engine.selectNumber(next.n, false);
        updatePrefs({ tool: 'fill', fillStyle: 'solid' });
      }
      engine.start();
      if (!cancelled) setStatus('ready');
    })().catch(() => !cancelled && setStatus('error'));

    return () => {
      cancelled = true;
      saveNow();
      engine?.destroy();
      engineRef.current = null;
    };
  }, [bookId, pageId, attempt]);

  // Push tool settings into the engine before the next frame.
  const engine = engineRef.current;
  const syncEngine = (p: ToolPrefs) => {
    const e = engineRef.current;
    if (!e) return;
    const cbnFill = e.cbnEnabled;
    e.setTool(p.tool);
    e.colour = cbnFill && e.cbnSelected ? e.cbnPalette[e.cbnSelected - 1].hex : p.colour;
    for (const [t, s] of Object.entries(p.sizes)) e.sizes[t] = s;
    e.opacity = p.opacity;
    e.fillStyle = p.fillStyle;
    e.stamp = p.stamp;
    e.stayInside = p.stayInside;
    e.showPatterns = settings.patterns;
    e.requestRender();
  };
  useLayoutEffect(() => syncEngine(prefs));

  // ------------------------------------------------------------ finished screen

  useEffect(() => {
    if (!done || status !== 'ready') {
      setFinishedImg(null);
      return;
    }
    const e = engineRef.current;
    if (!e) return;
    setFinishedImg(e.composite(1280));
    completeRef.current = true;
    dirty.current = true;
    saveNow();
  }, [done, status]);

  const fileName = `webcoloring-${bookId}-${pageId}.png`;
  const fullPicture = () => canvasToBlob(engineRef.current!.composite(), 'image/png');

  // ------------------------------------------------------------ actions

  const setTool = (t: ToolId) => {
    sound.click();
    if (t === 'eyedropper') prevTool.current = prefs.tool;
    updatePrefs({ tool: t });
  };

  const pickColour = (hex: string, final = true) => {
    if (final) setRecent(pushRecent(hex));
    const patch: Partial<ToolPrefs> = { colour: hex };
    if (prefs.tool === 'eraser' || prefs.tool === 'eyedropper') patch.tool = prevTool.current === 'eyedropper' ? 'crayon' : prefs.tool === 'eraser' ? 'crayon' : prevTool.current;
    updatePrefs(patch);
    if (final) sound.click();
  };

  const toggleCbn = () => {
    const e = engineRef.current;
    if (!e) return;
    const on = !e.cbnEnabled;
    e.setCbnEnabled(on);
    if (on) {
      const next = e.cbnProgress().numbers.find((n) => n.done < n.total);
      e.selectNumber(next ? next.n : 0);
      updatePrefs({ tool: 'fill', fillStyle: 'solid' });
    }
    sound.click();
    scheduleSave();
    bump();
  };

  const selectNumber = (n: number) => {
    const e = engineRef.current;
    if (!e) return;
    e.selectNumber(n);
    if (prefs.tool !== 'fill') updatePrefs({ tool: 'fill' });
    sound.click();
    buzz(5);
    bump();
  };

  const hint = () => {
    const e = engineRef.current;
    if (e?.hint()) sound.pick();
    bump();
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const e = engineRef.current;
      if (!e || sheet) return;
      const target = ev.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const mod = ev.ctrlKey || ev.metaKey;
      if (mod && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) e.redo();
        else e.undo();
      } else if (mod && ev.key.toLowerCase() === 'y') {
        ev.preventDefault();
        e.redo();
      } else if (!mod && (ev.key === '+' || ev.key === '=')) e.zoomBy(1.25);
      else if (!mod && ev.key === '-') e.zoomBy(0.8);
      else if (!mod && ev.key === '0') e.fit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  // ------------------------------------------------------------ render

  const e = engine;
  const cbnOn = !!e?.cbnEnabled;
  const progress = e?.cbnProgress();
  const selectedHex = cbnOn && e?.cbnSelected ? e.cbnPalette[e.cbnSelected - 1].hex : prefs.colour;
  const size = prefs.sizes[prefs.tool] ?? e?.sizes[prefs.tool] ?? 30;
  const page = pageRef.current;

  return (
    <div class={`screen colouring ${side ? 'layout-side' : 'layout-bottom'}`}>
      <header class="topbar">
        <a class="icon-btn" href={href.book(bookId)} aria-label={copy.colouring.back}>
          <Icon name="back" size={30} />
        </a>
        <button type="button" class="icon-btn" aria-label={copy.colouring.undo} disabled={!e?.canUndo} onClick={() => e?.undo()}>
          <Icon name="undo" size={30} />
        </button>
        <button type="button" class="icon-btn" aria-label={copy.colouring.redo} disabled={!e?.canRedo} onClick={() => e?.redo()}>
          <Icon name="redo" size={30} />
        </button>
        <span class="topbar-gap" />
        {(e ? e.hasNumbers : !!page?.numbered) && (
          <button type="button" class={`icon-btn toggle ${cbnOn ? 'on' : ''}`} aria-pressed={cbnOn} aria-label={cbnOn ? copy.colouring.cbnOn : copy.colouring.cbnOff} onClick={toggleCbn}>
            <Icon name="numbers" size={34} />
            <span class="tiny" aria-hidden="true">
              {copy.colouring.cbn}
            </span>
          </button>
        )}
        <button
          type="button"
          class={`icon-btn toggle ${prefs.stayInside ? 'on' : ''}`}
          aria-pressed={prefs.stayInside}
          aria-label={prefs.stayInside ? copy.colouring.stayInsideOn : copy.colouring.stayInsideOff}
          onClick={() => {
            sound.click();
            updatePrefs({ stayInside: !prefs.stayInside });
          }}
        >
          <Icon name="inside" size={30} tip={prefs.stayInside ? '#4fc74a' : '#c9d0d8'} />
          <span class="tiny" aria-hidden="true">
            {copy.colouring.stayInside}
          </span>
        </button>
        {side && (
          <>
            <button type="button" class="icon-btn" aria-label={copy.colouring.zoomOut} onClick={() => e?.zoomBy(0.8)}>
              <Icon name="zoomOut" size={30} />
            </button>
            <button type="button" class="icon-btn" aria-label={copy.colouring.zoomIn} onClick={() => e?.zoomBy(1.25)}>
              <Icon name="zoomIn" size={30} />
            </button>
          </>
        )}
        {(!isFit || side) && (
          <button type="button" class="icon-btn" aria-label={copy.colouring.fit} disabled={isFit} onClick={() => e?.fit()}>
            <Icon name="fit" size={30} />
          </button>
        )}
        <span class="topbar-gap" />
        <a class="icon-btn done-btn" href={href.done(bookId, pageId)} aria-label={copy.colouring.done}>
          <Icon name="done" size={32} />
        </a>
      </header>

      {cbnOn && progress && (
        <div
          class="cbn-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          aria-label={copy.colouring.progress(progress.done, progress.total)}
        >
          <span class="cbn-bar" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          <Icon name="star" size={22} />
        </div>
      )}

      <main class="stage">
        <canvas
          ref={canvasRef}
          class={`paper ${status === 'ready' ? 'ready' : ''}`}
          role="img"
          aria-label={copy.colouring.canvasLabel(page?.n ?? 0)}
        />
        {status !== 'ready' && page && (
          <Preview src={pageAsset(bookId, page, 'thumb-sm.webp')} />
        )}
        {status === 'loading' && (
          <div class="stage-msg">
            <span class="spinner" aria-hidden="true" />
            <span class="sr-only">{copy.colouring.loading}</span>
          </div>
        )}
        {status === 'error' && (
          <div class="stage-msg">
            <p>{copy.colouring.loadError}</p>
            <button type="button" class="btn" onClick={() => setAttempt((a) => a + 1)}>
              {copy.colouring.tryAgain}
            </button>
          </div>
        )}
      </main>

      <aside class="rail rail-tools">
        <ToolButtons tool={prefs.tool} colour={selectedHex} onTool={setTool} />
      </aside>

      <aside class="rail rail-colours">
        <ToolOptions
          tool={prefs.tool}
          colour={selectedHex}
          size={size}
          opacity={prefs.opacity}
          fillStyle={prefs.fillStyle}
          stamp={prefs.stamp}
          screenScale={screenScale}
          onSize={(s) => updatePrefs({ sizes: { ...prefs.sizes, [prefs.tool]: s } })}
          onOpacity={(o) => updatePrefs({ opacity: o })}
          onFillStyle={(s) => {
            sound.click();
            updatePrefs({ fillStyle: s });
          }}
          onStamp={(s) => {
            sound.click();
            updatePrefs({ stamp: s });
          }}
        />
        {cbnOn && progress ? (
          <NumberStrip progress={progress} selected={e!.cbnSelected} wrongKey={wrongKey} patterns={settings.patterns} onSelect={selectNumber} onHint={hint} />
        ) : (
          <ColourStrip colour={prefs.colour} recent={recent} onPick={(h) => pickColour(h)} onMore={() => setSheet(true)} />
        )}
      </aside>

      {sheet && (
        <ColourSheet
          colour={prefs.colour}
          recent={recent}
          onPick={(h, close, final) => {
            pickColour(h, final);
            if (close) setSheet(false);
          }}
          onClose={() => setSheet(false)}
        />
      )}

      {done && status === 'ready' && (
        <Finished
          image={finishedImg}
          storeUrl={book?.storeUrl ?? null}
          bookTitle={book?.title ?? ''}
          reducedMotion={reducedMotion}
          onSave={async () => {
            await savePicture(await fullPicture(), fileName);
          }}
          onPrint={async () => {
            await printPicture(await fullPicture());
          }}
          onKeepGoing={() => navigate(href.page(bookId, pageId), true)}
          onMorePages={() => navigate(href.book(bookId))}
        />
      )}
    </div>
  );
}
