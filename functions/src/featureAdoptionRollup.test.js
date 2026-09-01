import { describe, it, expect } from 'vitest';
import { rollupFeatureUsageForDate } from './featureAdoptionRollup.js';

function createFakeDb(initialDocs = []) {
  // Two separate namespaces (featureUsage raw rows vs. featureAdoptionStats
  // aggregates), same as two real Firestore collections would be — a query
  // scoped to one must never see the other's documents.
  const rawStore = new Map(initialDocs.map((d) => [d.id, d.data]));
  const statsStore = new Map();
  const setCalls = [];

  return {
    collection(name) {
      const store = name === 'featureUsage' ? rawStore : name === 'featureAdoptionStats' ? statsStore : new Map();
      return {
        where(field, op, value) {
          if (op !== '==') throw new Error(`unsupported op ${op}`);
          return {
            async get() {
              const docs = [...store.entries()]
                .filter(([, data]) => data?.[field] === value)
                .map(([id, data]) => ({
                  id,
                  data: () => data,
                  ref: { id, delete: () => store.delete(id) }
                }));
              return { docs };
            }
          };
        },
        doc(id) {
          return {
            async set(data, opts) {
              setCalls.push({ collection: name, id, data, opts });
              const existing = opts?.merge ? store.get(id) || {} : {};
              store.set(id, { ...existing, ...data });
            }
          };
        }
      };
    },
    batch() {
      const ops = [];
      return {
        delete(ref) {
          ops.push(ref);
        },
        async commit() {
          for (const ref of ops) ref.delete();
        }
      };
    },
    _store: rawStore,
    _statsStore: statsStore,
    _setCalls: setCalls
  };
}

describe('rollupFeatureUsageForDate', () => {
  it('counts unique rows per feature for the given date and writes featureAdoptionStats', async () => {
    const db = createFakeDb([
      { id: 'a', data: { feature: 'smart_import', date: '2026-08-30' } },
      { id: 'b', data: { feature: 'smart_import', date: '2026-08-30' } },
      { id: 'c', data: { feature: '_app_active', date: '2026-08-30' } },
      { id: 'd', data: { feature: 'export', date: '2026-08-29' } } // different date, ignored
    ]);

    const result = await rollupFeatureUsageForDate({ db, date: '2026-08-30' });

    expect(result).toEqual({ featuresRolledUp: 2, rowsDeleted: 3 });
    expect(db._setCalls).toContainEqual(
      expect.objectContaining({
        collection: 'featureAdoptionStats',
        id: 'smart_import_2026-08-30',
        data: { feature: 'smart_import', date: '2026-08-30', uniqueUsers: 2 }
      })
    );
    expect(db._setCalls).toContainEqual(
      expect.objectContaining({
        collection: 'featureAdoptionStats',
        id: '_app_active_2026-08-30',
        data: { feature: '_app_active', date: '2026-08-30', uniqueUsers: 1 }
      })
    );
  });

  it('deletes the rolled-up raw rows so they do not persist', async () => {
    const db = createFakeDb([{ id: 'a', data: { feature: 'export', date: '2026-08-30' } }]);
    await rollupFeatureUsageForDate({ db, date: '2026-08-30' });
    expect(db._store.has('a')).toBe(false);
  });

  it('leaves rows for other dates untouched', async () => {
    const db = createFakeDb([
      { id: 'a', data: { feature: 'export', date: '2026-08-30' } },
      { id: 'b', data: { feature: 'export', date: '2026-08-29' } }
    ]);
    await rollupFeatureUsageForDate({ db, date: '2026-08-30' });
    expect(db._store.has('b')).toBe(true);
  });

  it('returns zero counts for a date with no rows', async () => {
    const db = createFakeDb([]);
    const result = await rollupFeatureUsageForDate({ db, date: '2026-08-30' });
    expect(result).toEqual({ featuresRolledUp: 0, rowsDeleted: 0 });
  });

  it('is safe to run twice for the same date (merge overwrite, no double counting)', async () => {
    const db = createFakeDb([{ id: 'a', data: { feature: 'export', date: '2026-08-30' } }]);
    await rollupFeatureUsageForDate({ db, date: '2026-08-30' });
    // Re-run against an already-empty set for that date — should not error
    // and should not inflate the stat that already got written.
    await rollupFeatureUsageForDate({ db, date: '2026-08-30' });

    const statCalls = db._setCalls.filter((c) => c.id === 'export_2026-08-30');
    expect(statCalls).toHaveLength(1);
    expect(statCalls[0].data.uniqueUsers).toBe(1);
  });
});
