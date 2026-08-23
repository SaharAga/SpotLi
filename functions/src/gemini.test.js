import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  // Arrow functions can't be `new`-ed, so the mock needs a real constructor
  // (named lowercase so oxlint's React heuristics don't mistake it for a
  // component just because it uses `this`).
  GoogleGenAI: vi.fn().mockImplementation(function fakeGenAiCtor() {
    this.models = { generateContent: generateContentMock };
  }),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING' }
}));

const { parseWithGemini } = await import('./gemini.js');

describe('parseWithGemini', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  it('throws when no API key is provided, without calling the SDK', async () => {
    await expect(parseWithGemini({ mode: 'text-fallback', text: 'hi' }, '')).rejects.toThrow(/GEMINI_API_KEY/);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('sends plain text as a single text part for text-fallback mode', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ trackingNumber: 'RS1IL', carrier: 'israel-post', confidence: 'high' })
    });

    await parseWithGemini({ mode: 'text-fallback', text: 'RS1IL arrived' }, 'key');

    const call = generateContentMock.mock.calls[0][0];
    expect(call.contents[0].parts).toEqual([{ text: 'RS1IL arrived' }]);
  });

  it('strips a data: URL prefix before sending image bytes', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ trackingNumber: '', carrier: 'other', confidence: 'none' })
    });

    await parseWithGemini({ mode: 'image', imageBase64: 'data:image/png;base64,QUJD' }, 'key');

    const call = generateContentMock.mock.calls[0][0];
    expect(call.contents[0].parts).toEqual([{ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } }]);
  });

  it('passes through raw base64 unchanged when there is no data: URL prefix', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ trackingNumber: '', carrier: 'other', confidence: 'none' })
    });

    await parseWithGemini({ mode: 'image', imageBase64: 'QUJD' }, 'key');

    const call = generateContentMock.mock.calls[0][0];
    expect(call.contents[0].parts).toEqual([{ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } }]);
  });

  it('merges a partial Gemini response over the empty-result defaults', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ trackingNumber: 'RS1IL', carrier: 'israel-post', confidence: 'medium' })
    });

    const result = await parseWithGemini({ mode: 'text-fallback', text: 'x' }, 'key');

    expect(result).toEqual({
      trackingNumber: 'RS1IL',
      carrier: 'israel-post',
      title: '',
      pickupLocation: '',
      origin: '',
      notes: '',
      confidence: 'medium'
    });
  });

  it('fails closed to an empty/none result when Gemini returns no text', async () => {
    generateContentMock.mockResolvedValue({ text: undefined });

    const result = await parseWithGemini({ mode: 'text-fallback', text: 'x' }, 'key');
    expect(result.confidence).toBe('none');
    expect(result.trackingNumber).toBe('');
  });

  it('fails closed to an empty/none result when Gemini returns malformed JSON', async () => {
    generateContentMock.mockResolvedValue({ text: 'not json{{{' });

    const result = await parseWithGemini({ mode: 'text-fallback', text: 'x' }, 'key');
    expect(result.confidence).toBe('none');
    expect(result.trackingNumber).toBe('');
  });
});
