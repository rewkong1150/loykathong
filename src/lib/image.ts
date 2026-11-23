// Any file the browser (or the HEIC converter) can read is accepted; it is always
// re-encoded to JPEG before upload, so the storage bucket only ever holds JPEGs.

type Source = { el: CanvasImageSource; w: number; h: number; done: () => void };

// <img> decoding works in every browser (incl. iOS Safari, which also reads HEIC)
// and applies EXIF orientation.
async function decodeWithImg(file: Blob): Promise<Source> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  if (!img.naturalWidth) { URL.revokeObjectURL(url); throw new Error('empty'); }
  return { el: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

async function decodeWithBitmap(file: Blob): Promise<Source> {
  const bm = await createImageBitmap(file);
  return { el: bm, w: bm.width, h: bm.height, done: () => bm.close() };
}

// HEIC/HEIF (iPhone photos) on Chrome, Edge, Android and Windows: convert in the browser.
// The converter is large, so it's only downloaded when such a file is picked.
async function decodeHeic(file: Blob): Promise<Source> {
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  return decodeWithImg(Array.isArray(out) ? out[0] : out);
}

async function decodeAny(file: Blob): Promise<Source> {
  for (const decode of [decodeWithImg, decodeWithBitmap, decodeHeic]) {
    try {
      return await decode(file);
    } catch {
      // try the next decoder
    }
  }
  throw new Error('BAD_IMAGE_FILE');
}

/** Resize so the long side is at most `maxSide`, re-encode as JPEG. Throws BAD_IMAGE_FILE if unreadable. */
export async function compressImage(file: Blob, maxSide = 1600): Promise<Blob> {
  const src = await decodeAny(file);
  const scale = Math.min(1, maxSide / Math.max(src.w, src.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(src.w * scale));
  canvas.height = Math.max(1, Math.round(src.h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // transparent PNG/GIF areas would otherwise turn black in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src.el, 0, 0, canvas.width, canvas.height);
  src.done();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('BAD_IMAGE_FILE'))), 'image/jpeg', 0.85),
  );
}
