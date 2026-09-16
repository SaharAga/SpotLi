import { describe, it, expect, vi } from 'vitest';
import {
  createRegisterTrackingNumberHandler,
  isRegisterablePackage
} from './registerTrackingNumber.js';
import { POLL_STATE_COLLECTION } from './scheduledTrackingRefresh.js';

describe('isRegisterablePackage', () => {
  const base = { trackingNumber: 'RS948219481IL' };

  it('accepts a real tracking number', () => {
    expect(isRegisterablePackage(base)).toBe(true);
  });

  it('refuses demo and archived rows', () => {
    expect(isRegisterablePackage({ ...base, isDemo: true })).toBe(false);
    expect(isRegisterablePackage({ ...base, isArchived: true })).toBe(false);
  });

  it('refuses numbers too short or too long to be one', () => {
    // Registration is the unit 17TRACK most likely bills, so an order line or
    // a PIN must never spend it.
    expect(isRegisterablePackage({ trackingNumber: '1234' })).toBe(false);
    expect(isRegisterablePackage({ trackingNumber: 'X'.repeat(50) })).toBe(false);
  });

  it('refuses a number with no digits at all', () => {
    expect(isRegisterablePackage({ trackingNumber: 'ABCDEFGH' })).toBe(false);
  });

  it('refuses a missing or malformed package', () => {
    expect(isRegisterablePackage(null)).toBe(false);
    expect(isRegisterablePackage({})).toBe(false);
  });
});

function fakeDb({ state = {} } = {}) {
  const writes = [];
  return {
    writes,
    collection: (name) => {
      expect(name).toBe(POLL_STATE_COLLECTION);
      return {
        doc: (number) => ({
          get: async () => ({
            exists: Object.prototype.hasOwnProperty.call(state, number),
            data: () => state[number]
          }),
          set: async (data) => { writes.push({ number, data }); }
        })
      };
    }
  };
}

const event = (pkg) => ({ data: { data: () => pkg } });

describe('createRegisterTrackingNumberHandler', () => {
  it('enrols a newly added parcel', async () => {
    const db = fakeDb();
    const register = vi.fn().mockResolvedValue(true);

    await createRegisterTrackingNumberHandler({
      db, track17ApiKey: 'k', register, now: () => 1234
    })(event({ trackingNumber: 'rs-948 219', carrier: 'israel-post' }));

    // Normalized the same way the poller and the client match numbers.
    expect(register).toHaveBeenCalledWith('RS948219', 9061, 'k');
    expect(db.writes[0].data.registeredAt).toBe(1234);
  });

  it('enrols a manually typed parcel too, not just automated ones', async () => {
    // The opposite scoping to the push trigger, on purpose: a number the user
    // typed has no inbox pipeline behind it to notice anything later.
    const db = fakeDb();
    const register = vi.fn().mockResolvedValue(true);

    await createRegisterTrackingNumberHandler({ db, track17ApiKey: 'k', register })(
      event({ trackingNumber: 'RS948219481IL', source: 'manual' })
    );

    expect(register).toHaveBeenCalledTimes(1);
  });

  it('sends no carrier code for a courier 17TRACK has no mapping for', async () => {
    // Omitting the code is 17TRACK's auto-detect mode, which is the whole point
    // for the Israeli couriers that have no catalogue id on our side.
    const db = fakeDb();
    const register = vi.fn().mockResolvedValue(true);

    await createRegisterTrackingNumberHandler({ db, track17ApiKey: 'k', register })(
      event({ trackingNumber: 'GAIH50911204', carrier: 'ydm' })
    );

    expect(register).toHaveBeenCalledWith('GAIH50911204', undefined, 'k');
  });

  it('never re-enrols a number already registered', async () => {
    const db = fakeDb({ state: { RS948219: { registeredAt: 1 } } });
    const register = vi.fn();

    await createRegisterTrackingNumberHandler({ db, track17ApiKey: 'k', register })(
      event({ trackingNumber: 'RS948219' })
    );

    expect(register).not.toHaveBeenCalled();
  });

  it('leaves a freshly enrolled number due immediately', async () => {
    // So the next scheduled run collects whatever history 17TRACK already holds
    // rather than waiting a full interval for a parcel that may be moving.
    const db = fakeDb();
    await createRegisterTrackingNumberHandler({
      db, track17ApiKey: 'k', register: async () => true
    })(event({ trackingNumber: 'RS948219481IL' }));

    expect(db.writes[0].data.nextEligibleAt).toBe(0);
  });

  it('records nothing when registration failed', async () => {
    // Otherwise the ledger would claim an enrolment that never happened and the
    // parcel would never be retried.
    const db = fakeDb();
    await createRegisterTrackingNumberHandler({
      db, track17ApiKey: 'k', register: async () => false
    })(event({ trackingNumber: 'RS948219481IL' }));

    expect(db.writes).toHaveLength(0);
  });

  it('spends nothing when no API key is configured', async () => {
    const db = fakeDb();
    const register = vi.fn();

    await createRegisterTrackingNumberHandler({ db, track17ApiKey: '', register })(
      event({ trackingNumber: 'RS948219481IL' })
    );

    expect(register).not.toHaveBeenCalled();
  });

  it('still enrols when the ledger read fails', async () => {
    // One redundant registration beats a parcel that goes untracked entirely.
    const db = {
      collection: () => ({
        doc: () => ({
          get: async () => { throw new Error('firestore down'); },
          set: async () => {}
        })
      })
    };
    const register = vi.fn().mockResolvedValue(true);

    await createRegisterTrackingNumberHandler({ db, track17ApiKey: 'k', register })(
      event({ trackingNumber: 'RS948219481IL' })
    );

    expect(register).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a demo row or a missing document', async () => {
    const db = fakeDb();
    const register = vi.fn();
    const handler = createRegisterTrackingNumberHandler({ db, track17ApiKey: 'k', register });

    await handler(event({ trackingNumber: 'RS948219481IL', isDemo: true }));
    await handler({ data: null });

    expect(register).not.toHaveBeenCalled();
  });
});
