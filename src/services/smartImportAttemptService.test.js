import { describe, it, expect, vi, beforeEach } from 'vitest';

const addDocMock = vi.fn();
const collectionMock = vi.fn((db, name) => ({ db, name }));

vi.mock('firebase/firestore', () => ({
  collection: (...args) => collectionMock(...args),
  addDoc: (...args) => addDocMock(...args),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn((...args) => args),
  orderBy: vi.fn((...args) => args),
  limit: vi.fn((...args) => args)
}));

vi.mock('./firebase', () => ({
  db: { fake: 'db' },
  isFirebaseConfigured: true
}));

const { recordSmartImportAttempt, computeSmartImportMissRateStats, _enableTestAttemptReporting } = await import('./smartImportAttemptService');

describe('recordSmartImportAttempt', () => {
  beforeEach(() => {
    addDocMock.mockReset();
    collectionMock.mockClear();
    _enableTestAttemptReporting(true);
  });

  it('no-ops in test mode when not explicitly enabled', async () => {
    _enableTestAttemptReporting(false);
    await recordSmartImportAttempt({ source: 'regex', confidence: 'high', carrier: 'ups', corrected: false });
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('writes an uncorrected attempt', async () => {
    addDocMock.mockResolvedValue({ id: 'doc1' });

    await recordSmartImportAttempt({ source: 'regex', confidence: 'high', carrier: 'ups', corrected: false });

    expect(collectionMock).toHaveBeenCalledWith({ fake: 'db' }, 'smartImportAttempts');
    const [, payload] = addDocMock.mock.calls[0];
    expect(payload).toEqual({
      source: 'regex',
      confidence: 'high',
      carrier: 'ups',
      corrected: false,
      timestamp: expect.any(String)
    });
  });

  it('writes a corrected attempt', async () => {
    addDocMock.mockResolvedValue({ id: 'doc1' });
    await recordSmartImportAttempt({ source: 'ai', confidence: 'medium', carrier: 'israel-post', corrected: true });

    const [, payload] = addDocMock.mock.calls[0];
    expect(payload.corrected).toBe(true);
  });

  it('defaults source to "regex", carrier to "other", and confidence to null', async () => {
    addDocMock.mockResolvedValue({ id: 'doc1' });
    await recordSmartImportAttempt({ corrected: false });

    const [, payload] = addDocMock.mock.calls[0];
    expect(payload.source).toBe('regex');
    expect(payload.carrier).toBe('other');
    expect(payload.confidence).toBeNull();
  });

  it('never throws when the write fails', async () => {
    addDocMock.mockRejectedValue(new Error('offline'));
    await expect(
      recordSmartImportAttempt({ source: 'ai', confidence: 'low', carrier: 'fedex', corrected: true })
    ).resolves.toBeUndefined();
  });

  it('never writes a tracking number or any value beyond the documented fields', async () => {
    addDocMock.mockResolvedValue({ id: 'doc1' });
    await recordSmartImportAttempt({ source: 'regex', confidence: 'high', carrier: 'ups', corrected: false });

    const [, payload] = addDocMock.mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual(['carrier', 'confidence', 'corrected', 'source', 'timestamp']);
  });
});

describe('recordSmartImportAttempt when Firebase is not configured', () => {
  it('does nothing and never touches Firestore', async () => {
    addDocMock.mockClear();
    vi.resetModules();
    vi.doMock('./firebase', () => ({ db: null, isFirebaseConfigured: false }));
    const { recordSmartImportAttempt: recordUnconfigured } = await import('./smartImportAttemptService');

    await recordUnconfigured({ source: 'ai', confidence: 'high', carrier: 'ups', corrected: true });
    expect(addDocMock).not.toHaveBeenCalled();
  });
});

describe('computeSmartImportMissRateStats', () => {
  it('returns zeroes on empty input', () => {
    const stats = computeSmartImportMissRateStats([]);
    expect(stats.total).toBe(0);
    expect(stats.corrected).toBe(0);
    expect(stats.missRate).toBe(0);
    expect(stats.sourceBreakdown).toEqual({ regex: 0, ai: 0 });
    expect(stats.perCarrier).toEqual({});
  });

  it('computes overall miss rate and per-carrier breakdown', () => {
    const sample = [
      { source: 'regex', carrier: 'ups', corrected: false },
      { source: 'regex', carrier: 'ups', corrected: true },
      { source: 'ai', carrier: 'israel-post', corrected: false },
      { source: 'ai', carrier: 'israel-post', corrected: false },
      { source: 'regex', carrier: 'israel-post', corrected: true }
    ];

    const stats = computeSmartImportMissRateStats(sample);
    expect(stats.total).toBe(5);
    expect(stats.corrected).toBe(2);
    expect(stats.missRate).toBe(2 / 5);
    expect(stats.sourceBreakdown).toEqual({ regex: 3, ai: 2 });

    expect(stats.perCarrier.ups).toEqual({ total: 2, corrected: 1, missRate: 0.5 });
    expect(stats.perCarrier['israel-post']).toEqual({ total: 3, corrected: 1, missRate: 1 / 3 });
  });

  it('treats a missing carrier as "other"', () => {
    const stats = computeSmartImportMissRateStats([{ source: 'regex', corrected: false }]);
    expect(stats.perCarrier.other).toEqual({ total: 1, corrected: 0, missRate: 0 });
  });
});
