// Save, share and print a finished picture.

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality),
  );
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Uses the share sheet on phones and tablets when it can take files, otherwise downloads. */
export async function savePicture(blob: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], name, { type: blob.type });
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, name);
  return 'downloaded';
}

/** Prints the picture on its own, scaled to fit A4 or US Letter. */
export async function printPicture(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const root = document.createElement('div');
  root.id = 'print-root';
  const img = new Image();
  img.alt = '';
  img.src = url;
  root.appendChild(img);
  document.body.appendChild(root);
  try {
    await img.decode();
  } catch {
    /* print anyway */
  }
  const cleanup = () => {
    root.remove();
    URL.revokeObjectURL(url);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // Some browsers never fire afterprint.
  setTimeout(() => document.body.contains(root) && cleanup(), 60_000);
}
