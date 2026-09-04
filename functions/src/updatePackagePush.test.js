import { describe, it, expect, vi } from 'vitest';
import { createUpdatePackagePushHandler, hasMeaningfulPackageUpdate } from './updatePackagePush.js';

function fakeDbWithNoTokens() {
  return {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          get: async () => ({ empty: true, docs: [] })
        })
      })
    })
  };
}

function makeUpdateEvent(beforeData, afterData, uid = 'u1') {
  return {
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData }
    },
    params: { uid, packageId: afterData?.id || beforeData?.id }
  };
}

describe('hasMeaningfulPackageUpdate', () => {
  it('returns true when status advances', () => {
    expect(hasMeaningfulPackageUpdate(
      { status: 'in_transit' },
      { status: 'out_for_delivery' }
    )).toBe(true);
  });

  it('returns true when locker PIN arrives', () => {
    expect(hasMeaningfulPackageUpdate(
      { status: 'ready_for_pickup', lockerPin: null },
      { status: 'ready_for_pickup', lockerPin: '4321' }
    )).toBe(true);
  });

  it('returns true when pickupCode arrives', () => {
    expect(hasMeaningfulPackageUpdate(
      { status: 'ready_for_pickup' },
      { status: 'ready_for_pickup', pickupCode: '8877' }
    )).toBe(true);
  });

  it('returns true when delivery is rerouted', () => {
    expect(hasMeaningfulPackageUpdate(
      { isRedirected: false },
      { isRedirected: true, pickupLocation: 'New Locker' }
    )).toBe(true);
  });

  it('returns true when pickup location changes', () => {
    expect(hasMeaningfulPackageUpdate(
      { pickupLocation: 'Old Point' },
      { pickupLocation: 'New Point' }
    )).toBe(true);
  });

  it('returns false when package is archived', () => {
    expect(hasMeaningfulPackageUpdate(
      { status: 'delivered', isArchived: false },
      { status: 'delivered', isArchived: true }
    )).toBe(false);
  });

  it('returns false when no meaningful field changes', () => {
    expect(hasMeaningfulPackageUpdate(
      { status: 'in_transit', title: 'Package' },
      { status: 'in_transit', title: 'Package' }
    )).toBe(false);
  });
});

describe('createUpdatePackagePushHandler', () => {
  const baseDeps = () => ({
    db: fakeDbWithNoTokens(),
    webpush: { sendNotification: vi.fn(), setVapidDetails: vi.fn() },
    vapidPublicKey: 'pub',
    vapidPrivateKey: 'priv',
    vapidSubject: 'mailto:test@example.com'
  });

  it('skips updates when there is no meaningful change', async () => {
    const deps = baseDeps();
    const handler = createUpdatePackagePushHandler(deps);
    await handler(makeUpdateEvent(
      { id: 'pkg1', status: 'in_transit' },
      { id: 'pkg1', status: 'in_transit' }
    ));
    expect(deps.webpush.setVapidDetails).not.toHaveBeenCalled();
  });

  it('attempts to send push when status advances to ready_for_pickup', async () => {
    const deps = baseDeps();
    const handler = createUpdatePackagePushHandler(deps);
    await expect(handler(makeUpdateEvent(
      { id: 'pkg1', status: 'in_transit', title: 'AliExpress' },
      { id: 'pkg1', status: 'ready_for_pickup', title: 'AliExpress', pickupLocation: 'Dizengoff Center', lockerPin: '1234' }
    ))).resolves.not.toThrow();
  });

  it('never throws when the push send itself fails', async () => {
    const deps = baseDeps();
    deps.db = {
      collection: () => ({
        doc: () => ({
          collection: () => ({
            get: async () => {
              throw new Error('firestore down');
            }
          })
        })
      })
    };
    const handler = createUpdatePackagePushHandler(deps);
    await expect(handler(makeUpdateEvent(
      { id: 'pkg1', status: 'in_transit' },
      { id: 'pkg1', status: 'delivered' }
    ))).resolves.toBeUndefined();
  });

  it('does nothing when data is missing or deleted', async () => {
    const deps = baseDeps();
    const handler = createUpdatePackagePushHandler(deps);
    await handler({ data: { before: null, after: null }, params: { uid: 'u1' } });
    expect(deps.webpush.setVapidDetails).not.toHaveBeenCalled();
  });

  it('does nothing when uid param is missing', async () => {
    const deps = baseDeps();
    const handler = createUpdatePackagePushHandler(deps);
    await handler(makeUpdateEvent(
      { id: 'pkg1', status: 'in_transit' },
      { id: 'pkg1', status: 'delivered' },
      null
    ));
    expect(deps.webpush.setVapidDetails).not.toHaveBeenCalled();
  });
});
