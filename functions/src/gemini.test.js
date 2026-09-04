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
      confidence: 'medium',
      isGroundedCandidate: true
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

  describe('image mode OCR & two-stage grounding', () => {
    it('returns empty result when imageBase64 is empty or whitespace', async () => {
      const result = await parseWithGemini({ mode: 'image', imageBase64: '   ' }, 'key');
      expect(result).toMatchObject({ trackingNumber: '', confidence: 'none' });
      expect(generateContentMock).not.toHaveBeenCalled();
    });

    it('parses an image screenshot and grounds valid carrier tracking and pickup details', async () => {
      generateContentMock.mockResolvedValue({
        text: JSON.stringify({
          transcribedText: 'Israel Post Notice: Your parcel RR000000005IL is ready for pickup at Dizengoff Center Post Office Tel Aviv. Locker Code: 9876. Hours: 08:00-19:00',
          trackingNumber: 'RR000000005IL',
          carrier: 'israel-post',
          title: 'Israel Post Package',
          pickupLocation: 'Dizengoff Center Post Office',
          confidence: 'high'
        })
      });

      const result = await parseWithGemini({
        mode: 'image',
        imageBase64: 'data:image/jpeg;base64,QUJDREVGR0g='
      }, 'key');

      expect(result).toMatchObject({
        trackingNumber: 'RR000000005IL',
        carrier: 'israel-post',
        title: 'Israel Post Package',
        confidence: 'high',
        isGroundedCandidate: true
      });
      expect(result.pickupLocation).toBeTruthy();
    });

    it('rejects hallucinated tracking numbers that fail checksum policy in image OCR', async () => {
      generateContentMock.mockResolvedValue({
        text: JSON.stringify({
          transcribedText: 'Your order was delivered with tracking number RR000000001IL to front door',
          trackingNumber: 'RR000000001IL', // Check digit for 00000000 is 5, not 1 — fails UPU S10!
          carrier: 'israel-post',
          confidence: 'high'
        })
      });

      const result = await parseWithGemini({
        mode: 'image',
        imageBase64: 'QUJD'
      }, 'key');

      expect(result.trackingNumber).toBe('');
      expect(result.confidence).toBe('none');
      expect(result.isGroundedCandidate).toBe(false);
    });

    it('rejects tracking numbers not grounded in transcribed image text', async () => {
      generateContentMock.mockResolvedValue({
        text: JSON.stringify({
          transcribedText: 'Payment receipt for your online purchase. Thank you!',
          trackingNumber: 'RR000000005IL', // Valid checksum, but absent from transcribedText!
          carrier: 'israel-post',
          confidence: 'high'
        })
      });

      const result = await parseWithGemini({
        mode: 'image',
        imageBase64: 'QUJD'
      }, 'key');

      expect(result.trackingNumber).toBe('');
      expect(result.confidence).toBe('none');
      expect(result.isGroundedCandidate).toBe(false);
    });

    it('falls back to deterministic candidate extraction from transcribedText when model tracking is blank', async () => {
      generateContentMock.mockResolvedValue({
        text: JSON.stringify({
          transcribedText: 'Delivery confirmation: 1Z999AA10123456784 was handed to courier',
          trackingNumber: '',
          carrier: 'other',
          confidence: 'medium'
        })
      });

      const result = await parseWithGemini({
        mode: 'image',
        imageBase64: 'QUJD'
      }, 'key');

      expect(result.trackingNumber).toBe('1Z999AA10123456784');
      expect(result.carrier).toBe('ups');
      expect(result.isGroundedCandidate).toBe(true);
    });

    it('normalizes OCR tracking numbers containing spaces and hyphens', async () => {
      generateContentMock.mockResolvedValue({
        text: JSON.stringify({
          transcribedText: 'Package label: RR 000 000 005 IL delivered to locker',
          trackingNumber: 'RR 000 000 005 IL',
          carrier: 'israel-post',
          title: 'Israel Post Package',
          confidence: 'high'
        })
      });

      const result = await parseWithGemini({
        mode: 'image',
        imageBase64: 'QUJD'
      }, 'key');

      expect(result.trackingNumber).toBe('RR000000005IL');
      expect(result.carrier).toBe('israel-post');
      expect(result.isGroundedCandidate).toBe(true);
    });

    it('rejects candidate numbers with no recognized carrier even if extracted from text', async () => {
      generateContentMock.mockResolvedValue({
        text: JSON.stringify({
          transcribedText: 'Your invoice order number is INV-998877665544',
          trackingNumber: '',
          carrier: 'other',
          confidence: 'medium'
        })
      });

      const result = await parseWithGemini({
        mode: 'image',
        imageBase64: 'QUJD'
      }, 'key');

      expect(result.trackingNumber).toBe('');
      expect(result.confidence).toBe('none');
      expect(result.isGroundedCandidate).toBe(false);
    });
  });
});
