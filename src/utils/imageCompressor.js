/**
 * Client-side image downscaling for feedback screenshots.
 *
 * Feedback images ride along inside the Firestore feedback document rather
 * than a Storage bucket (Storage requires a billing-enabled project). Firestore
 * caps a document at 1MiB total, so an untouched phone screenshot — routinely
 * 2-5MB — cannot be stored as-is. Everything here exists to get a screenshot
 * comfortably under that cap while staying legible enough to diagnose a bug.
 *
 * Encoding to base64 is lossless; the size reduction comes entirely from the
 * downscale + JPEG quality steps below.
 */

/** Longest edge, in pixels, of a stored screenshot. */
export const MAX_IMAGE_DIMENSION = 1280;

/**
 * Ceiling for the encoded string. Firestore's hard limit is 1MiB for the whole
 * document, so this leaves room for the message and metadata alongside it.
 */
export const MAX_ENCODED_BYTES = 600_000;

/** Quality steps tried in order until the result fits under the ceiling. */
const QUALITY_LADDER = [0.7, 0.55, 0.4, 0.3];

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Rejects anything that is not an image we are prepared to re-encode.
 *
 * @param {File|Blob|null|undefined} file
 * @returns {boolean}
 */
export function isSupportedImage(file) {
  if (!file || typeof file.type !== 'string') return false;
  return ACCEPTED_IMAGE_TYPES.includes(file.type.toLowerCase());
}

/**
 * Scales dimensions down so the longest edge is at most `maxDimension`,
 * preserving aspect ratio. Images already small enough are returned unchanged
 * rather than upscaled.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} [maxDimension=MAX_IMAGE_DIMENSION]
 * @returns {{ width: number, height: number }}
 */
export function fitWithin(width, height, maxDimension = MAX_IMAGE_DIMENSION) {
  const safeWidth = Number(width) > 0 ? Number(width) : 0;
  const safeHeight = Number(height) > 0 ? Number(height) : 0;
  if (!safeWidth || !safeHeight) return { width: 0, height: 0 };

  const longestEdge = Math.max(safeWidth, safeHeight);
  if (longestEdge <= maxDimension) {
    return { width: Math.round(safeWidth), height: Math.round(safeHeight) };
  }

  const scale = maxDimension / longestEdge;
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale))
  };
}

/**
 * Approximate decoded byte length of a base64 data URL, without allocating a
 * buffer to measure it.
 *
 * @param {string} dataUrl
 * @returns {number}
 */
export function estimateEncodedBytes(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl) return 0;
  const commaIndex = dataUrl.indexOf(',');
  const payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

/**
 * Downscales and re-encodes an image file to a JPEG data URL that fits under
 * `MAX_ENCODED_BYTES`, stepping down quality until it does.
 *
 * @param {File|Blob} file
 * @param {{ maxDimension?: number, maxBytes?: number }} [options]
 * @returns {Promise<{ dataUrl: string, bytes: number, width: number, height: number }>}
 * @throws {Error} when the file is not a supported image, cannot be decoded, or
 *   still exceeds the ceiling at the lowest quality step.
 */
export async function compressImageFile(file, options = {}) {
  const maxDimension = options.maxDimension ?? MAX_IMAGE_DIMENSION;
  const maxBytes = options.maxBytes ?? MAX_ENCODED_BYTES;

  if (!isSupportedImage(file)) {
    throw new Error('unsupported-type');
  }

  const bitmap = await loadImage(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxDimension);
  if (!width || !height) {
    throw new Error('decode-failed');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');

  // Screenshots are typically PNG with transparency; flatten onto white so
  // JPEG re-encoding does not render transparent regions as black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  if (typeof bitmap.close === 'function') bitmap.close();

  for (const quality of QUALITY_LADDER) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const bytes = estimateEncodedBytes(dataUrl);
    if (bytes <= maxBytes) {
      return { dataUrl, bytes, width, height };
    }
  }

  throw new Error('too-large');
}

/**
 * Decodes a file into something drawable, preferring createImageBitmap and
 * falling back to an <img> for environments without it.
 *
 * @param {File|Blob} file
 * @returns {Promise<ImageBitmap|HTMLImageElement>}
 */
async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path below.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode-failed'));
    };
    img.src = url;
  });
}

/**
 * Pulls the first supported image out of a paste event's clipboard payload.
 *
 * @param {ClipboardEvent} event
 * @returns {File|null}
 */
export function extractImageFromPaste(event) {
  const items = event?.clipboardData?.items;
  if (!items) return null;
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (isSupportedImage(file)) return file;
    }
  }
  return null;
}
