import { describe, it, expect, beforeEach } from 'vitest';
import { resolveUnverifiedCandidateWithAi } from './gmailAiFallback.js';

function createFakeDb() {
  const store = new Map();
  const inserted = [];
  return {
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return { key };
        },
        add(data) {
          inserted.push({ collection: name, data });
          return Promise.resolve();
        }
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          const data = store.get(ref.key);
          return { exists: data !== undefined, data: () => data };
        },
        set(ref, data, opts) {
          const existing = opts?.merge ? store.get(ref.key) || {} : {};
          store.set(ref.key, { ...existing, ...data });
        }
      };
      return fn(tx);
    },
    _inserted: inserted,
    _store: store
  };
}

function makeExtraction({ status = 'probable', score = 0.7 } = {}) {
  return {
    status,
    candidates: [{ id: 'cand_1', value: 'RR123456789IL', carrierCandidates: ['israel-post'] }],
    selectedCandidate: { value: 'RR123456789IL', score }
  };
}

describe('resolveUnverifiedCandidateWithAi', () => {
  let db;

  beforeEach(() => {
    db = createFakeDb();
  });

  it('returns null without an apiKey', async () => {
    const result = await resolveUnverifiedCandidateWithAi({
      db,
      apiKey: '',
      uid: 'u1',
      subject: 'Your order has shipped',
      body: 'tracking RR123456789IL',
      from: 'noreply@amazon.com',
      extraction: makeExtraction()
    });
    expect(result).toBeNull();
  });

  it('returns null when the deterministic parser found no candidates', async () => {
    const result = await resolveUnverifiedCandidateWithAi({
      db,
      apiKey: 'key',
      uid: 'u1',
      subject: 'hi',
      body: '',
      from: 'a@b.com',
      extraction: { status: 'none', candidates: [] }
    });
    expect(result).toBeNull();
  });

  it('returns null for an already-verified extraction (nothing to resolve)', async () => {
    const result = await resolveUnverifiedCandidateWithAi({
      db,
      apiKey: 'key',
      uid: 'u1',
      subject: 'Your order has shipped',
      from: 'noreply@amazon.com',
      body: 'tracking RR123456789IL',
      extraction: makeExtraction({ status: 'verified' })
    });
    expect(result).toBeNull();
  });

  it('never calls Gemini for a message that fails the shipping-candidate gate', async () => {
    let called = false;
    const result = await resolveUnverifiedCandidateWithAi({
      db,
      apiKey: 'key',
      uid: 'u1',
      subject: 'Happy birthday!',
      body: 'no shipping content here',
      from: 'friend@personalmail.com',
      extraction: makeExtraction(),
      parseFn: async () => {
        called = true;
        return { confidence: 'high', trackingNumber: 'RR123456789IL', carrier: 'israel-post' };
      }
    });
    expect(called).toBe(false);
    expect(result).toBeNull();
  });

  it('resolves a probable candidate when Gemini confirms it with medium/high confidence', async () => {
    const result = await resolveUnverifiedCandidateWithAi({
      db,
      apiKey: 'key',
      uid: 'u1',
      subject: 'Your order has shipped',
      body: 'tracking info inside',
      from: 'noreply@amazon.com',
      extraction: makeExtraction(),
      parseFn: async () => ({
        confidence: 'high',
        trackingNumber: 'RR123456789IL',
        carrier: 'israel-post',
        title: 'Amazon Order'
      })
    });
    expect(result).toEqual({
      trackingNumber: 'RR123456789IL',
      carrier: 'israel-post',
      title: 'Amazon Order',
      confidence: 'high'
    });

    const insight = db._inserted.find((i) => i.collection === 'gmailParseInsights');
    expect(insight.data.outcome).toBe('ai-resolved');
  });

  it('returns null and logs when Gemini declines (low/none confidence)', async () => {
    const result = await resolveUnverifiedCandidateWithAi({
      db,
      apiKey: 'key',
      uid: 'u1',
      subject: 'Your order has shipped',
      body: 'ambiguous text',
      from: 'noreply@amazon.com',
      extraction: makeExtraction(),
      parseFn: async () => ({ confidence: 'none', trackingNumber: '', carrier: 'other' })
    });
    expect(result).toBeNull();
    const insight = db._inserted.find((i) => i.collection === 'gmailParseInsights');
    expect(insight.data.outcome).toBe('ai-declined');
  });

  it('respects a run-scoped budget independent of the daily cap', async () => {
    const runBudget = { used: 2, max: 2 };
    let called = false;
    const result = await resolveUnverifiedCandidateWithAi({
      db,
      apiKey: 'key',
      uid: 'u1',
      subject: 'Your order has shipped',
      body: 'tracking info',
      from: 'noreply@amazon.com',
      extraction: makeExtraction(),
      runBudget,
      parseFn: async () => {
        called = true;
        return { confidence: 'high', trackingNumber: 'RR123456789IL', carrier: 'israel-post' };
      }
    });
    expect(called).toBe(false);
    expect(result).toBeNull();
  });

  it('does not increment the daily usage counter for a call the shipping gate rejects', async () => {
    await resolveUnverifiedCandidateWithAi({
      db,
      apiKey: 'key',
      uid: 'u1',
      subject: 'Happy birthday!',
      body: 'no shipping content',
      from: 'friend@personalmail.com',
      extraction: makeExtraction()
    });

    const today = new Date().toISOString().slice(0, 10);
    expect(db._store?.get?.(`gmailAiUsage/user_u1_${today}`)).toBeUndefined();
  });
});
