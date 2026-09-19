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

const { recordTrainingExample, _enableTestTrainingReporting } = await import('./trainingDataService');

describe('recordTrainingExample', () => {
  beforeEach(() => {
    addDocMock.mockReset();
    collectionMock.mockClear();
    _enableTestTrainingReporting(true);
  });

  afterAll(() => {
    _enableTestTrainingReporting(false);
  });

  it('suppresses writes in test mode when not explicitly enabled', async () => {
    _enableTestTrainingReporting(false);
    await recordTrainingExample({
      userId: 'user-42',
      source: 'ai',
      confidence: 'medium',
      inputText: 'sample text',
      initialValues: {},
      correctedValues: {}
    });
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('does nothing without a userId', async () => {
    await recordTrainingExample({
      source: 'ai',
      confidence: 'high',
      inputText: 'hello',
      initialValues: {},
      correctedValues: {}
    });
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('writes the real input text and before/after values, scoped to trackedFields', async () => {
    addDocMock.mockResolvedValue({ id: 'doc1' });

    await recordTrainingExample({
      userId: 'user-42',
      source: 'ai',
      confidence: 'medium',
      inputText: 'Your AliExpress order RS948219481IL has shipped',
      initialValues: { title: 'Order', trackingNumber: 'RS1IL', carrier: 'israel-post', origin: 'China', notes: 'x', extra: 'dropped' },
      correctedValues: { title: 'Order', trackingNumber: 'RR2IL', carrier: 'israel-post', origin: 'China', notes: 'y' }
    });

    expect(collectionMock).toHaveBeenCalledWith({ fake: 'db' }, 'trainingExamples');
    const [, payload] = addDocMock.mock.calls[0];
    expect(payload.userId).toBe('user-42');
    expect(payload.source).toBe('ai');
    expect(payload.confidence).toBe('medium');
    expect(payload.inputText).toBe('Your AliExpress order RS948219481IL has shipped');
    expect(payload.initialValues).toEqual({ title: 'Order', trackingNumber: 'RS1IL', carrier: 'israel-post', origin: 'China', notes: 'x' });
    expect(payload.correctedValues.trackingNumber).toBe('RR2IL');
    expect(payload.initialValues.extra).toBeUndefined();
  });

  it('redacts PII from inputText and freeform fields (notes/origin/title), but not trackingNumber/carrier', async () => {
    addDocMock.mockResolvedValue({ id: 'doc1' });

    await recordTrainingExample({
      userId: 'user-42',
      source: 'regex',
      confidence: null,
      inputText: 'Contact recipient: Dana Cohen, call 050-1234567 about RR111222333IL',
      initialValues: { trackingNumber: '1234567890123', notes: 'leave with doorman, call 050-1234567' },
      correctedValues: { trackingNumber: '1234567890123', notes: 'call 050-1234567 for access' }
    });

    const [, payload] = addDocMock.mock.calls[0];
    expect(payload.inputText).not.toContain('050-1234567');
    expect(payload.inputText).toContain('[REDACTED_PHONE]');
    // Note-prefix redaction also catches the "recipient:" label itself.
    expect(payload.inputText).not.toContain('Dana Cohen');
    expect(payload.initialValues.notes).toContain('[REDACTED_PHONE]');
    expect(payload.correctedValues.notes).toContain('[REDACTED_PHONE]');
    // trackingNumber is deliberately never redacted, even though it would
    // otherwise match the credit-card pattern (13-19 digits) — it's the
    // exact value this dataset exists to capture correctly.
    expect(payload.initialValues.trackingNumber).toBe('1234567890123');
    expect(payload.correctedValues.trackingNumber).toBe('1234567890123');
  });

  it('caps inputText length', async () => {
    addDocMock.mockResolvedValue({ id: 'doc1' });
    const longText = 'a'.repeat(6000);

    await recordTrainingExample({
      userId: 'user-42',
      source: 'ai',
      confidence: 'low',
      inputText: longText,
      initialValues: {},
      correctedValues: {}
    });

    const [, payload] = addDocMock.mock.calls[0];
    expect(payload.inputText.length).toBeLessThanOrEqual(5000);
  });

  it('never throws when the write fails', async () => {
    addDocMock.mockRejectedValue(new Error('offline'));

    await expect(
      recordTrainingExample({ userId: 'user-1', source: 'ai', confidence: 'high', inputText: '', initialValues: {}, correctedValues: {} })
    ).resolves.toBeUndefined();
  });
});

describe('recordTrainingExample when Firebase is not configured', () => {
  it('does nothing and never touches Firestore', async () => {
    addDocMock.mockClear();
    vi.resetModules();
    vi.doMock('./firebase', () => ({ db: null, isFirebaseConfigured: false }));
    const { recordTrainingExample: recordUnconfigured } = await import('./trainingDataService');

    await recordUnconfigured({ userId: 'user-1', source: 'ai', confidence: 'high', inputText: 'x', initialValues: {}, correctedValues: {} });
    expect(addDocMock).not.toHaveBeenCalled();
  });
});
