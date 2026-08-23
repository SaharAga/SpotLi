import { describe, it, expect, vi, beforeEach } from 'vitest';

const addDocMock = vi.fn();
const collectionMock = vi.fn((db, name) => ({ db, name }));

vi.mock('firebase/firestore', () => ({
  collection: (...args) => collectionMock(...args),
  addDoc: (...args) => addDocMock(...args)
}));

vi.mock('./firebase', () => ({
  db: { fake: 'db' },
  isFirebaseConfigured: true
}));

const { recordParseCorrection } = await import('./parseCorrectionService');

describe('recordParseCorrection', () => {
  beforeEach(() => {
    addDocMock.mockReset();
    collectionMock.mockClear();
  });

  it('does nothing when there are no edited fields', async () => {
    await recordParseCorrection({ source: 'ai', confidence: 'high', editedFields: [] });
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('writes only field names, source, and confidence — never field values', async () => {
    addDocMock.mockResolvedValue({ id: 'doc1' });

    await recordParseCorrection({
      source: 'ai',
      confidence: 'medium',
      editedFields: ['trackingNumber', 'carrier']
    });

    expect(collectionMock).toHaveBeenCalledWith({ fake: 'db' }, 'parseCorrections');
    expect(addDocMock).toHaveBeenCalledTimes(1);
    const [, payload] = addDocMock.mock.calls[0];
    expect(payload.source).toBe('ai');
    expect(payload.confidence).toBe('medium');
    expect(payload.editedFields).toEqual(['trackingNumber', 'carrier']);
    expect(typeof payload.timestamp).toBe('string');
  });

  it('defaults source to "regex" and confidence to null when not provided', async () => {
    addDocMock.mockResolvedValue({ id: 'doc1' });

    await recordParseCorrection({ editedFields: ['title'] });

    const [, payload] = addDocMock.mock.calls[0];
    expect(payload.source).toBe('regex');
    expect(payload.confidence).toBeNull();
  });

  it('never throws when the write fails', async () => {
    addDocMock.mockRejectedValue(new Error('offline'));

    await expect(
      recordParseCorrection({ source: 'ai', confidence: 'low', editedFields: ['origin'] })
    ).resolves.toBeUndefined();
  });
});

describe('recordParseCorrection when Firebase is not configured', () => {
  it('does nothing and never touches Firestore', async () => {
    addDocMock.mockClear();
    vi.resetModules();
    vi.doMock('./firebase', () => ({ db: null, isFirebaseConfigured: false }));
    const { recordParseCorrection: recordUnconfigured } = await import('./parseCorrectionService');

    await recordUnconfigured({ source: 'ai', confidence: 'high', editedFields: ['trackingNumber'] });
    expect(addDocMock).not.toHaveBeenCalled();
  });
});
