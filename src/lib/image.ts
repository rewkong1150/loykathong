// HEIC/HEIF are allowed: iPhone Safari decodes them natively. If a browser
// can't decode a file, compressImage throws BAD_IMAGE_FILE and the user sees a clear message.
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const OK_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
export const IMAGE_ERROR = 'Please upload a photo (JPG, PNG, WebP or HEIC)';

export function validateImageFile(f: { type: string; name: string }): string | null {
  if (f.type) return OK_TYPES.includes(f.type.toLowerCase()) ? null : IMAGE_ERROR;
  return OK_EXT.test(f.name) ? null : IMAGE_ERROR;
}

type Source = { el: CanvasImageSource; w: number; h: number; done: () => void };

// <img> decoding works in every browser (incl. iOS Safari) and applies EXIF orientation.
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
  return { el: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

async function decodeWithBitmap(file: Blob): Promise<Source> {
  const bm = await createImageBitmap(file);
  return { el: bm, w: bm.width, h: bm.height, done: () => bm.close() };
}

/** Resize so the long side is at most `maxSide`, re-encode as JPEG. Throws BAD_IMAGE_FILE if unreadable. */
export async function compressImage(file: Blob, maxSide = 1600): Promise<Blob> {
  let src: Source;
  try {
    src = await decodeWithImg(file);
  } catch {
    try {
      src = await decodeWithBitmap(file);
    } catch {
      throw new Error('BAD_IMAGE_FILE');
    }
  }
  if (!src.w || !src.h) { src.done(); throw new Error('BAD_IMAGE_FILE'); }
  const scale = Math.min(1, maxSide / Math.max(src.w, src.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(src.w * scale);
  canvas.height = Math.round(src.h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // transparent PNGs would otherwise turn black in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src.el, 0, 0, canvas.width, canvas.height);
  src.done();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('BAD_IMAGE_FILE'))), 'image/jpeg', 0.85),
  );
}
