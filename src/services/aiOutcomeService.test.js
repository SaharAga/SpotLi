import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

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

const { recordAiOutcome, detectAiOutcome, AI_OUTCOME_WINDOW_MS, _enableTestAiOutcome } = await import('./aiOutcomeService');

describe('recordAiOutcome', () => {
  beforeEach(() => {
    addDocMock.mockReset();
    collectionMock.mockClear();
    _enableTestAiOutcome(true);
  });

  afterAll(() => {
    _enableTestAiOutcome(false);
  });

  it('suppresses writes in test mode when test outcome is not enabled', async () => {
    _enableTestAiOutcome(false);
    await recordAiOutcome({ outcome: 'deleted', carrier: 'ups', confidence: 'high', userId: 'user-1' });
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('writes a delete outcome with no editedFields', async () => {
    addDocMock.mockResolvedValue({ id: 'doc1' });
    await recordAiOutcome({ outcome: 'deleted', carrier: 'ups', confidence: 'high', userId: 'user-1' });

    expect(collectionMock).toHaveBeenCalledWith({ fake: 'db' }, 'gmailAiOutcomes');
    expect(addDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ outcome: 'deleted', carrier: 'ups', confidence: 'high', editedFields: [], userId: 'user-1' })
    );
  });

  it('does nothing for an edited outcome with no editedFields', async () => {
    await recordAiOutcome({ outcome: 'edited', carrier: 'ups', confidence: 'high', editedFields: [], userId: 'user-1' });
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('does nothing without a userId — this write requires an authenticated caller', async () => {
    await recordAiOutcome({ outcome: 'deleted', carrier: 'ups', confidence: 'high', userId: null });
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('writes only field names, carrier, confidence, and userId — never a tracking number or free text', async () => {
    addDocMock.mockResolvedValue({ id: 'doc1' });
    await recordAiOutcome({ outcome: 'edited', carrier: 'israel-post', confidence: 'medium', editedFields: ['trackingNumber'], userId: 'user-1' });

    const payload = addDocMock.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual(['carrier', 'confidence', 'editedFields', 'outcome', 'timestamp', 'userId']);
    expect(payload.editedFields).toEqual(['trackingNumber']);
  });
});

describe('detectAiOutcome', () => {
  const now = Date.parse('2026-08-31T12:00:00.000Z');

  function makePkg(overrides = {}) {
    return {
      id: 'pkg1',
      source: 'gmail_sync_ai',
      carrier: 'ups',
      confidence: 'medium',
      trackingNumber: '1Z999AA10123456784',
      createdAt: new Date(now - 1000).toISOString(),
      ...overrides
    };
  }

  it('returns null when there is no previous package (e.g. an ADD)', () => {
    expect(detectAiOutcome({ type: 'ADD', payload: { id: 'pkg1' } }, undefined, now)).toBeNull();
  });

  it('returns null for a package not sourced from the AI fallback', () => {
    const pkg = makePkg({ source: 'gmail_sync' });
    expect(detectAiOutcome({ type: 'DELETE', payload: { id: 'pkg1' } }, pkg, now)).toBeNull();
  });

  it('flags a delete of a recently AI-created package', () => {
    const pkg = makePkg();
    expect(detectAiOutcome({ type: 'DELETE', payload: { id: 'pkg1' } }, pkg, now)).toEqual({
      outcome: 'deleted',
      carrier: 'ups',
      confidence: 'medium',
      editedFields: []
    });
  });

  it('does not flag a delete once the package is older than the outcome window', () => {
    const pkg = makePkg({ createdAt: new Date(now - AI_OUTCOME_WINDOW_MS - 1000).toISOString() });
    expect(detectAiOutcome({ type: 'DELETE', payload: { id: 'pkg1' } }, pkg, now)).toBeNull();
  });

  it('flags an update that changes the carrier or trackingNumber', () => {
    const pkg = makePkg();
    const result = detectAiOutcome(
      { type: 'UPDATE', payload: { id: 'pkg1', carrier: 'fedex' } },
      pkg,
      now
    );
    expect(result).toEqual({ outcome: 'edited', carrier: 'ups', confidence: 'medium', editedFields: ['carrier'] });
  });

  it('does not flag an update that only changes an untracked field like status or notes', () => {
    const pkg = makePkg();
    const result = detectAiOutcome(
      { type: 'UPDATE', payload: { id: 'pkg1', status: 'delivered', notes: 'left at door' } },
      pkg,
      now
    );
    expect(result).toBeNull();
  });

  it('does not flag an update with the same carrier/trackingNumber value (no real change)', () => {
    const pkg = makePkg();
    const result = detectAiOutcome(
      { type: 'UPDATE', payload: { id: 'pkg1', carrier: pkg.carrier, trackingNumber: pkg.trackingNumber } },
      pkg,
      now
    );
    expect(result).toBeNull();
  });

  it('ignores STATUS_CHANGE and UPDATE_ALL mutation types', () => {
    const pkg = makePkg();
    expect(detectAiOutcome({ type: 'STATUS_CHANGE', payload: { packageId: 'pkg1' } }, pkg, now)).toBeNull();
    expect(detectAiOutcome({ type: 'UPDATE_ALL', payload: [] }, pkg, now)).toBeNull();
  });
});
