import { describe, it, expect } from 'vitest';
import {
  fitWithin,
  estimateEncodedBytes,
  isSupportedImage,
  extractImageFromPaste,
  MAX_IMAGE_DIMENSION,
  ACCEPTED_IMAGE_TYPES
} from './imageCompressor';

describe('fitWithin', () => {
  it('leaves images already within bounds untouched', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('scales down by the longest edge, preserving aspect ratio', () => {
    const { width, height } = fitWithin(4000, 2000, 1000);
    expect(width).toBe(1000);
    expect(height).toBe(500);
  });

  it('handles portrait orientation by capping height', () => {
    const { width, height } = fitWithin(2000, 4000, 1000);
    expect(height).toBe(1000);
    expect(width).toBe(500);
  });

  it('never upscales a small image', () => {
    expect(fitWithin(100, 50, MAX_IMAGE_DIMENSION)).toEqual({ width: 100, height: 50 });
  });

  it('never returns a zero edge for extreme aspect ratios', () => {
    const { width, height } = fitWithin(10000, 3, 1000);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThanOrEqual(1);
  });

  it('returns zeroes for invalid dimensions rather than NaN', () => {
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(NaN, NaN)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(-5, -5)).toEqual({ width: 0, height: 0 });
  });
});

describe('estimateEncodedBytes', () => {
  it('measures the payload after the data URL prefix', () => {
    // "AAAA" decodes to 3 bytes.
    expect(estimateEncodedBytes('data:image/png;base64,AAAA')).toBe(3);
  });

  it('accounts for padding characters', () => {
    expect(estimateEncodedBytes('data:image/png;base64,AAA=')).toBe(2);
    expect(estimateEncodedBytes('data:image/png;base64,AA==')).toBe(1);
  });

  it('handles a bare payload with no data URL prefix', () => {
    expect(estimateEncodedBytes('AAAA')).toBe(3);
  });

  it('returns 0 for empty or non-string input', () => {
    expect(estimateEncodedBytes('')).toBe(0);
    expect(estimateEncodedBytes(null)).toBe(0);
    expect(estimateEncodedBytes(undefined)).toBe(0);
    expect(estimateEncodedBytes(42)).toBe(0);
  });

  it('scales roughly 3 bytes per 4 characters', () => {
    const payload = 'A'.repeat(4000);
    expect(estimateEncodedBytes(`data:image/jpeg;base64,${payload}`)).toBe(3000);
  });
});

describe('isSupportedImage', () => {
  it('accepts every advertised image type', () => {
    for (const type of ACCEPTED_IMAGE_TYPES) {
      expect(isSupportedImage({ type })).toBe(true);
    }
  });

  it('is case-insensitive on the MIME type', () => {
    expect(isSupportedImage({ type: 'IMAGE/PNG' })).toBe(true);
  });

  it('rejects non-image and missing types', () => {
    expect(isSupportedImage({ type: 'application/pdf' })).toBe(false);
    expect(isSupportedImage({ type: 'text/html' })).toBe(false);
    expect(isSupportedImage({})).toBe(false);
    expect(isSupportedImage(null)).toBe(false);
    expect(isSupportedImage(undefined)).toBe(false);
  });
});

describe('extractImageFromPaste', () => {
  const makeEvent = (items) => ({ clipboardData: { items } });

  it('returns the first supported image file on the clipboard', () => {
    const file = { type: 'image/png' };
    const event = makeEvent([{ kind: 'file', getAsFile: () => file }]);
    expect(extractImageFromPaste(event)).toBe(file);
  });

  it('skips text entries and finds a later image', () => {
    const file = { type: 'image/jpeg' };
    const event = makeEvent([
      { kind: 'string', getAsFile: () => null },
      { kind: 'file', getAsFile: () => file }
    ]);
    expect(extractImageFromPaste(event)).toBe(file);
  });

  it('ignores files that are not supported images', () => {
    const event = makeEvent([
      { kind: 'file', getAsFile: () => ({ type: 'application/zip' }) }
    ]);
    expect(extractImageFromPaste(event)).toBeNull();
  });

  it('returns null when the clipboard has no items', () => {
    expect(extractImageFromPaste(makeEvent([]))).toBeNull();
    expect(extractImageFromPaste({ clipboardData: {} })).toBeNull();
    expect(extractImageFromPaste({})).toBeNull();
    expect(extractImageFromPaste(null)).toBeNull();
  });
});
