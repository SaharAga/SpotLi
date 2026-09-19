import { describe, it, expect, vi, beforeEach } from 'vitest';

const setDocMock = vi.fn();
const docMock = vi.fn((db, collection, id) => ({ db, collection, id }));

vi.mock('firebase/firestore', () => ({
  doc: (...args) => docMock(...args),
  setDoc: (...args) => setDocMock(...args)
}));

vi.mock('./firebase', () => ({
  db: { fake: 'db' },
  isFirebaseConfigured: true
}));

vi.mock('../utils/anonymousId', () => ({
  getOrCreateAnonymousId: vi.fn(() => 'anon-123')
}));

const { recordFeatureUse, _enableTestFeatureUsage } = await import('./featureUsageService');

describe('recordFeatureUse', () => {
  beforeEach(() => {
    setDocMock.mockReset();
    docMock.mockClear();
    _enableTestFeatureUsage(true);
  });

  it('no-ops in test mode when not explicitly enabled', async () => {
    _enableTestFeatureUsage(false);
    await recordFeatureUse('smart_import', { uid: 'user-1' });
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('rejects an unrecognized feature id', async () => {
    await recordFeatureUse('not_a_real_feature', { uid: 'user-1' });
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('writes a merge-set doc keyed by feature_identity_date, content is just feature+date', async () => {
    setDocMock.mockResolvedValue(undefined);
    const today = new Date().toISOString().slice(0, 10);

    await recordFeatureUse('smart_import', { uid: 'user-1' });

    expect(docMock).toHaveBeenCalledWith({ fake: 'db' }, 'featureUsage', `smart_import_user-1_${today}`);
    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      { feature: 'smart_import', date: today },
      { merge: true }
    );
  });

  it('falls back to an anonymous id when no uid is provided (guest)', async () => {
    setDocMock.mockResolvedValue(undefined);
    const today = new Date().toISOString().slice(0, 10);

    await recordFeatureUse('export');

    expect(docMock).toHaveBeenCalledWith({ fake: 'db' }, 'featureUsage', `export_anon-123_${today}`);
  });

  it('never writes an identity into the document content', async () => {
    setDocMock.mockResolvedValue(undefined);
    await recordFeatureUse('gmail_sync', { uid: 'user-1' });

    const [, payload] = setDocMock.mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual(['date', 'feature']);
  });

  it('never throws when the write fails', async () => {
    setDocMock.mockRejectedValue(new Error('offline'));
    await expect(recordFeatureUse('pwa_install', { uid: 'user-1' })).resolves.toBeUndefined();
  });
});

describe('recordFeatureUse when Firebase is not configured', () => {
  it('does nothing and never touches Firestore', async () => {
    setDocMock.mockClear();
    vi.resetModules();
    vi.doMock('./firebase', () => ({ db: null, isFirebaseConfigured: false }));
    vi.doMock('../utils/anonymousId', () => ({ getOrCreateAnonymousId: vi.fn(() => 'anon-123') }));
    const { recordFeatureUse: recordUnconfigured } = await import('./featureUsageService');

    await recordUnconfigured('smart_import', { uid: 'user-1' });
    expect(setDocMock).not.toHaveBeenCalled();
  });
});
