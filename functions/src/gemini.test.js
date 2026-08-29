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
const CANDIDATES = [{ id: 'cand_1', value: 'RR000000005IL', carrierCandidates: ['israel-post'] }];

describe('parseWithGemini', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  it('throws when no API key is provided, without calling the SDK', async () => {
    await expect(parseWithGemini({ mode: 'text-fallback', text: 'hi' }, '')).rejects.toThrow(/GEMINI_API_KEY/);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('fails closed without calling Gemini when no deterministic candidates are supplied', async () => {
    const result = await parseWithGemini({ mode: 'text-fallback', text: 'possibly a tracking number' }, 'key');
    expect(result).toMatchObject({ trackingNumber: '', confidence: 'none' });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('sends plain text as a single text part for text-fallback mode', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ selectedCandidateId: 'cand_1', confidence: 'high' })
    });

    await parseWithGemini({ mode: 'text-fallback', text: 'RR000000005IL arrived', candidates: CANDIDATES }, 'key');

    const call = generateContentMock.mock.calls[0][0];
    expect(call.contents[0].parts[0].text).toContain('RR000000005IL arrived');
    expect(call.contents[0].parts[0].text).toContain('cand_1');
  });

  it('strips a data: URL prefix before sending image bytes', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ selectedCandidateId: '', confidence: 'none' })
    });

    await parseWithGemini({ mode: 'image', imageBase64: 'data:image/png;base64,QUJD', candidates: CANDIDATES }, 'key');

    const call = generateContentMock.mock.calls[0][0];
    expect(call.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
  });

  it('passes through raw base64 unchanged when there is no data: URL prefix', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ selectedCandidateId: '', confidence: 'none' })
    });

    await parseWithGemini({ mode: 'image', imageBase64: 'QUJD', candidates: CANDIDATES }, 'key');

    const call = generateContentMock.mock.calls[0][0];
    expect(call.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
  });

  it('merges a partial Gemini response over the empty-result defaults', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ selectedCandidateId: 'cand_1', confidence: 'medium' })
    });

    const result = await parseWithGemini({ mode: 'text-fallback', text: 'x', candidates: CANDIDATES }, 'key');

    expect(result).toEqual({
      trackingNumber: 'RR000000005IL',
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

    const result = await parseWithGemini({ mode: 'text-fallback', text: 'x', candidates: CANDIDATES }, 'key');
    expect(result.confidence).toBe('none');
    expect(result.trackingNumber).toBe('');
  });

  it('fails closed to an empty/none result when Gemini returns malformed JSON', async () => {
    generateContentMock.mockResolvedValue({ text: 'not json{{{' });

    const result = await parseWithGemini({ mode: 'text-fallback', text: 'x', candidates: CANDIDATES }, 'key');
    expect(result.confidence).toBe('none');
    expect(result.trackingNumber).toBe('');
  });

  it('fails closed when Gemini selects an ID that was not supplied', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ selectedCandidateId: 'invented', confidence: 'high' })
    });
    const result = await parseWithGemini({ mode: 'text-fallback', text: 'x', candidates: CANDIDATES }, 'key');
    expect(result).toMatchObject({ trackingNumber: '', confidence: 'none' });
  });

  it('derives the carrier from server-side specs instead of a caller-provided hint', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ selectedCandidateId: 'cand_1', confidence: 'high' })
    });
    const result = await parseWithGemini({
      mode: 'text-fallback',
      text: 'x',
      candidates: [{ ...CANDIDATES[0], carrierCandidates: ['ups'] }]
    }, 'key');
    expect(result.carrier).toBe('israel-post');
  });

  it('rejects arbitrary formats, invalid IDs, duplicate IDs, and oversized values before model use', async () => {
    const result = await parseWithGemini({
      mode: 'text-fallback', text: 'x', candidates: [
        { id: 'not-a-candidate-id', value: 'RR000000005IL' },
        { id: 'cand_1', value: 'not-a-recognized-tracking-number' },
        { id: 'cand_1', value: 'RR000000005IL' },
        { id: 'cand_2', value: `RR${'0'.repeat(40)}IL` }
      ]
    }, 'key');
    expect(result).toMatchObject({ trackingNumber: '', confidence: 'none' });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('abstains when the serialized candidate prompt exceeds its bounded budget', async () => {
    const candidates = Array.from({ length: 10 }, (_, index) => ({
      id: `cand_${String(index).padStart(32, 'a')}`,
      value: '1Z999AA10123456784'
    }));
    const result = await parseWithGemini({ mode: 'text-fallback', text: 'x', candidates }, 'key');
    expect(result).toMatchObject({ trackingNumber: '', confidence: 'none' });
    expect(generateContentMock).not.toHaveBeenCalled();
  });
});
