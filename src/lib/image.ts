const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const OK_EXT = /\.(jpe?g|png|webp)$/i;
export const IMAGE_ERROR = 'Please upload a JPG, PNG or WebP photo';

export function validateImageFile(f: { type: string; name: string }): string | null {
  if (f.type) return OK_TYPES.includes(f.type.toLowerCase()) ? null : IMAGE_ERROR;
  return OK_EXT.test(f.name) ? null : IMAGE_ERROR;
}

/** Resize so the long side is at most `maxSide`, re-encode as JPEG. */
export async function compressImage(file: File, maxSide = 1600): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('BAD_IMAGE_FILE');
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('BAD_IMAGE_FILE'))), 'image/jpeg', 0.85),
  );
}
