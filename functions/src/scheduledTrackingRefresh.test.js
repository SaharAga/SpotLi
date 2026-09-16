import { describe, it, expect, vi } from 'vitest';
import {
  createScheduledTrackingRefreshHandler,
  buildTrackingPatch,
  isRefreshablePackage,
  isDueForLookup,
  nextPollState,
  normalizeNumber,
  POLL_STATE_COLLECTION
} from './scheduledTrackingRefresh.js';
import { TRACKING_REFRESH_LIMITS } from './config.js';
import { isAutomatedSource } from './automatedSources.js';

describe('isRefreshablePackage', () => {
  const base = { trackingNumber: 'RS1', status: 'in_transit' };

  it('accepts a live package with a number', () => {
    expect(isRefreshablePackage(base)).toBe(true);
  });

  it('refuses a package with no tracking number to look up', () => {
    expect(isRefreshablePackage({ ...base, trackingNumber: '' })).toBe(false);
    expect(isRefreshablePackage({ ...base, trackingNumber: '  -- ' })).toBe(false);
  });

  it('refuses terminal and archived packages', () => {
    // These can only ever spend quota to be told what we already know.
    expect(isRefreshablePackage({ ...base, status: 'delivered' })).toBe(false);
    expect(isRefreshablePackage({ ...base, status: 'returned_to_sender' })).toBe(false);
    expect(isRefreshablePackage({ ...base, isArchived: true })).toBe(false);
  });

  it('refuses demo packages', () => {
    expect(isRefreshablePackage({ ...base, isDemo: true })).toBe(false);
  });
});

describe('isDueForLookup', () => {
  it('treats a never-polled number as due', () => {
    expect(isDueForLookup(null, 1000)).toBe(true);
    expect(isDueForLookup({}, 1000)).toBe(true);
    expect(isDueForLookup({ nextEligibleAt: 'garbage' }, 1000)).toBe(true);
  });

  it('honours the stored next-eligible time', () => {
    expect(isDueForLookup({ nextEligibleAt: 2000 }, 1999)).toBe(false);
    expect(isDueForLookup({ nextEligibleAt: 2000 }, 2000)).toBe(true);
  });
});

describe('nextPollState', () => {
  const { MIN_INTERVAL_MS, MAX_INTERVAL_MS, MAX_CONSECUTIVE_FAILURES } = TRACKING_REFRESH_LIMITS;

  it('resets to the base interval after a productive lookup', () => {
    const state = nextPollState({ consecutiveQuiet: 5 }, { productive: true }, 1000);
    expect(state.nextEligibleAt).toBe(1000 + MIN_INTERVAL_MS);
    expect(state.consecutiveQuiet).toBe(0);
  });

  it('backs off geometrically while nothing comes back', () => {
    let state = null;
    const first = nextPollState(state, { productive: false }, 0);
    expect(first.nextEligibleAt).toBe(MIN_INTERVAL_MS);

    state = nextPollState(first, { productive: false }, 0);
    expect(state.nextEligibleAt).toBe(MIN_INTERVAL_MS * 2);

    state = nextPollState(state, { productive: false }, 0);
    expect(state.nextEligibleAt).toBe(MIN_INTERVAL_MS * 4);
  });

  it('never backs off past the ceiling, however long it stays quiet', () => {
    // A number the network has never heard of costs the same as a real one, so
    // the ceiling is what stops a handful of dead numbers eating the budget.
    let state = null;
    for (let i = 0; i < MAX_CONSECUTIVE_FAILURES + 20; i += 1) {
      state = nextPollState(state, { productive: false }, 0);
    }
    expect(state.nextEligibleAt).toBe(MAX_INTERVAL_MS);
    expect(state.consecutiveQuiet).toBeLessThanOrEqual(MAX_CONSECUTIVE_FAILURES);
  });
});

describe('buildTrackingPatch', () => {
  const pkg = { status: 'in_transit', checkpoints: [{ id: 'cp-1' }], carrier: 'other' };

  it('returns null when the lookup found nothing', () => {
    expect(buildTrackingPatch(pkg, null)).toBeNull();
    expect(buildTrackingPatch(pkg, { tracked: false, status: 'delivered' })).toBeNull();
  });

  it('returns null when nothing actually changed', () => {
    // Load-bearing: a no-op patch would be a Firestore write and an update-push
    // event for an event that did not happen.
    expect(buildTrackingPatch(pkg, {
      tracked: true, status: 'in_transit', checkpoints: [{ id: 'cp-1' }]
    })).toBeNull();
  });

  it('carries a status advance and stamps automated provenance', () => {
    const patch = buildTrackingPatch(pkg, { tracked: true, status: 'delivered' });
    expect(patch.status).toBe('delivered');
    expect(patch.lastUpdateSource).toBe('live_tracking');
    // The stamp is only worth anything if the push trigger honours it.
    expect(isAutomatedSource(patch.lastUpdateSource)).toBe(true);
  });

  it('never walks a package backwards out of a terminal state', () => {
    // A stale upstream record must not un-deliver a package the user has
    // already been told was delivered.
    const delivered = { ...pkg, status: 'delivered' };
    expect(buildTrackingPatch(delivered, { tracked: true, status: 'in_transit' })).toBeNull();
  });

  it('adds only checkpoints it does not already have', () => {
    const patch = buildTrackingPatch(pkg, {
      tracked: true, checkpoints: [{ id: 'cp-1' }, { id: 'cp-2' }]
    });
    expect(patch.checkpoints.map((c) => c.id)).toEqual(['cp-2', 'cp-1']);
  });

  it('fills an unknown carrier from auto-detect but never overwrites a known one', () => {
    const detected = { tracked: true, detectedCarrier: 'israel-post', detectedCarrierName: 'Israel Post' };
    expect(buildTrackingPatch(pkg, detected).carrier).toBe('israel-post');

    const known = { ...pkg, carrier: 'ydm', carrierName: 'YDM Group' };
    expect(buildTrackingPatch(known, detected)).toBeNull();
  });
});

function fakeDb({ users = [], pollState = {} } = {}) {
  const writes = [];
  const stateWrites = [];

  const packagesFor = (uid) => ({
    limit: () => ({
      get: async () => ({
        docs: (users.find((u) => u.id === uid)?.packages || []).map((pkg) => ({
          data: () => pkg,
          ref: { set: async (patch) => { writes.push({ uid, id: pkg.id, patch }); } }
        }))
      })
    })
  });

  return {
    writes,
    stateWrites,
    collection: (name) => {
      if (name === 'users') {
        return {
          limit: () => ({
            get: async () => ({
              docs: users.map((u) => ({ id: u.id, ref: { collection: () => packagesFor(u.id) } }))
            })
          })
        };
      }
      if (name === POLL_STATE_COLLECTION) {
        return {
          doc: (number) => ({
            get: async () => ({
              exists: Object.prototype.hasOwnProperty.call(pollState, number),
              data: () => pollState[number]
            }),
            set: async (data) => { stateWrites.push({ number, data }); }
          })
        };
      }
      throw new Error(`unexpected collection ${name}`);
    }
  };
}

describe('createScheduledTrackingRefreshHandler', () => {
  it('looks a number up once however many packages share it', async () => {
    // Quota is spent per number, not per row: two users tracking one parcel is
    // one lookup and two writes.
    const db = fakeDb({
      users: [
        { id: 'u1', packages: [{ id: 'p1', trackingNumber: 'RS1', status: 'in_transit' }] },
        { id: 'u2', packages: [{ id: 'p2', trackingNumber: 'rs-1', status: 'in_transit' }] }
      ]
    });
    const resolve = vi.fn().mockResolvedValue({ tracked: true, status: 'delivered' });

    const stats = await createScheduledTrackingRefreshHandler({ db, resolve, now: () => 0 })();

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(stats.updated).toBe(2);
    expect(db.writes.every((w) => w.patch.lastUpdateSource === 'live_tracking')).toBe(true);
  });

  it('skips a number that is not due yet and spends no quota on it', async () => {
    const db = fakeDb({
      users: [{ id: 'u1', packages: [{ id: 'p1', trackingNumber: 'RS1', status: 'in_transit' }] }],
      pollState: { RS1: { nextEligibleAt: 5_000 } }
    });
    const resolve = vi.fn();

    const stats = await createScheduledTrackingRefreshHandler({ db, resolve, now: () => 1_000 })();

    expect(resolve).not.toHaveBeenCalled();
    expect(stats.skippedNotDue).toBe(1);
  });

  it('never looks up a delivered or archived package', async () => {
    const db = fakeDb({
      users: [{ id: 'u1', packages: [
        { id: 'p1', trackingNumber: 'RS1', status: 'delivered' },
        { id: 'p2', trackingNumber: 'RS2', status: 'in_transit', isArchived: true },
        { id: 'p3', trackingNumber: '', status: 'in_transit' }
      ] }]
    });
    const resolve = vi.fn();

    const stats = await createScheduledTrackingRefreshHandler({ db, resolve, now: () => 0 })();

    expect(resolve).not.toHaveBeenCalled();
    expect(stats.scanned).toBe(0);
  });

  it('stops at the per-run ceiling', async () => {
    const packages = Array.from({ length: TRACKING_REFRESH_LIMITS.MAX_LOOKUPS_PER_RUN + 25 }, (_, i) => ({
      id: `p${i}`, trackingNumber: `RS${i}`, status: 'in_transit'
    }));
    const db = fakeDb({ users: [{ id: 'u1', packages }] });
    const resolve = vi.fn().mockResolvedValue({ tracked: false });

    const stats = await createScheduledTrackingRefreshHandler({ db, resolve, now: () => 0 })();

    expect(resolve).toHaveBeenCalledTimes(TRACKING_REFRESH_LIMITS.MAX_LOOKUPS_PER_RUN);
    expect(stats.lookups).toBe(TRACKING_REFRESH_LIMITS.MAX_LOOKUPS_PER_RUN);
  });

  it('backs a quiet number off and resets a productive one', async () => {
    const quietDb = fakeDb({
      users: [{ id: 'u1', packages: [{ id: 'p1', trackingNumber: 'RS1', status: 'in_transit' }] }]
    });
    await createScheduledTrackingRefreshHandler({
      db: quietDb, resolve: async () => ({ tracked: false }), now: () => 0
    })();
    expect(quietDb.stateWrites[0].data.consecutiveQuiet).toBe(1);

    const liveDb = fakeDb({
      users: [{ id: 'u1', packages: [{ id: 'p1', trackingNumber: 'RS1', status: 'in_transit' }] }],
      pollState: { RS1: { consecutiveQuiet: 3, nextEligibleAt: 0 } }
    });
    await createScheduledTrackingRefreshHandler({
      db: liveDb, resolve: async () => ({ tracked: true, status: 'delivered' }), now: () => 0
    })();
    expect(liveDb.stateWrites[0].data.consecutiveQuiet).toBe(0);
  });

  it('survives an upstream failure without losing the run', async () => {
    const db = fakeDb({
      users: [{ id: 'u1', packages: [
        { id: 'p1', trackingNumber: 'RS1', status: 'in_transit' },
        { id: 'p2', trackingNumber: 'RS2', status: 'in_transit' }
      ] }]
    });
    const resolve = vi.fn()
      .mockRejectedValueOnce(new Error('17TRACK down'))
      .mockResolvedValueOnce({ tracked: true, status: 'delivered' });

    const stats = await createScheduledTrackingRefreshHandler({ db, resolve, now: () => 0 })();

    expect(stats.errors).toBe(1);
    expect(stats.updated).toBe(1);
  });

  it('normalizes numbers the way the client matches them', () => {
    expect(normalizeNumber('rs-948 219')).toBe('RS948219');
    expect(normalizeNumber(null)).toBe('');
  });
});
