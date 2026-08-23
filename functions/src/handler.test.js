import { describe, it, expect, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { createParseWithAiHandler } from './handler.js';

function createFakeDb(initialCounts = {}) {
  const store = new Map(Object.entries(initialCounts));
  return {
    collection(name) {
      return { doc: (id) => ({ key: `${name}/${id}` }) };
    },
    async runTransaction(fn) {
      return fn({
        async get(ref) {
          const data = store.get(ref.key);
          return { exists: data !== undefined, data: () => data };
        },
        set(ref, data, opts) {
          const existing = opts?.merge ? store.get(ref.key) || {} : {};
          store.set(ref.key, { ...existing, ...data });
        }
      });
    }
  };
}

describe('createParseWithAiHandler', () => {
  it('rejects an unauthenticated request before touching Firestore or Gemini', async () => {
    const parseFn = vi.fn();
    const db = createFakeDb();
    const handler = createParseWithAiHandler({ db, apiKey: 'test-key', parseFn });

    await expect(handler({ auth: null, data: { mode: 'text-fallback', text: 'hi' } }))
      .rejects.toThrow(/sign in/i);
    expect(parseFn).not.toHaveBeenCalled();
  });

  it('rejects an invalid payload before incrementing usage or calling Gemini', async () => {
    const parseFn = vi.fn();
    const db = createFakeDb();
    const handler = createParseWithAiHandler({ db, apiKey: 'test-key', parseFn });

    await expect(handler({ auth: { uid: 'u1' }, data: { mode: 'text-fallback' } }))
      .rejects.toThrow(/text is required/i);
    expect(parseFn).not.toHaveBeenCalled();
  });

  it('calls Gemini with the payload and api key once auth/limits/payload all pass', async () => {
    const parseFn = vi.fn().mockResolvedValue({
      trackingNumber: 'RS948219481IL',
      carrier: 'israel-post',
      title: 'Israel Post Package',
      pickupLocation: '',
      origin: '',
      notes: '',
      confidence: 'high'
    });
    const db = createFakeDb();
    const handler = createParseWithAiHandler({ db, apiKey: 'test-key', parseFn });

    const result = await handler({
      auth: { uid: 'u1' },
      data: { mode: 'text-fallback', text: 'RS948219481IL arrived' }
    });

    expect(parseFn).toHaveBeenCalledWith(
      { mode: 'text-fallback', text: 'RS948219481IL arrived' },
      'test-key'
    );
    expect(result.trackingNumber).toBe('RS948219481IL');
  });

  it('throws resource-exhausted once the per-user daily limit is already used up', async () => {
    const parseFn = vi.fn();
    const today = new Date().toISOString().slice(0, 10);
    const db = createFakeDb({ [`usage/user_u1_${today}`]: { count: 30 } });
    const handler = createParseWithAiHandler({ db, apiKey: 'test-key', parseFn });

    const call = handler({ auth: { uid: 'u1' }, data: { mode: 'text-fallback', text: 'hi' } });
    await expect(call).rejects.toBeInstanceOf(HttpsError);
    await expect(call).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect(parseFn).not.toHaveBeenCalled();
  });

  it('never lets a failed usage check fall through to calling Gemini anyway', async () => {
    const parseFn = vi.fn().mockResolvedValue({ trackingNumber: 'should-not-happen' });
    const today = new Date().toISOString().slice(0, 10);
    const db = createFakeDb({ [`usage/global_${today}`]: { count: 500 } });
    const handler = createParseWithAiHandler({ db, apiKey: 'test-key', parseFn });

    await expect(
      handler({ auth: { uid: 'brand-new-user' }, data: { mode: 'image', imageBase64: 'aGVsbG8=' } })
    ).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect(parseFn).not.toHaveBeenCalled();
  });
});
