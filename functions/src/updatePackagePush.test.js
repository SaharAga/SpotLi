import { describe, it, expect, vi } from 'vitest';
import { createUpdatePackagePushHandler, hasMeaningfulPackageUpdate } from './updatePackagePush.js';

// Every `after` below carries an automated marker unless the test is about the
// marker itself: without one the handler returns before it looks at anything,
// which would make these assertions pass for the wrong reason.
const AUTOMATED = { lastUpdateSource: 'gmail_sync' };

// `sendPushToUser` returns early when the user has no subscribed device, so a
// fake with no tokens never reaches webpush at all — asserting against it would
// pass whether or not the handler decided to send. Every "did/didn't push" test
// below therefore uses a db that does have a token, and watches
// `sendNotification`.
function fakeDbWithOneToken() {
  return {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          get: async () => ({
            empty: false,
            docs: [{ id: 'tok0', data: () => ({ endpoint: 'https://push.example/abc' }), ref: { delete: async () => {} } }]
          })
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
    db: fakeDbWithOneToken(),
    webpush: { sendNotification: vi.fn().mockResolvedValue(undefined), setVapidDetails: vi.fn() },
    vapidPublicKey: 'pub',
    vapidPrivateKey: 'priv',
    vapidSubject: 'mailto:test@example.com'
  });

  it('skips updates when there is no meaningful change', async () => {
    const deps = baseDeps();
    const handler = createUpdatePackagePushHandler(deps);
    await handler(makeUpdateEvent(
      { id: 'pkg1', status: 'in_transit' },
      { id: 'pkg1', status: 'in_transit', ...AUTOMATED }
    ));
    expect(deps.webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('attempts to send push when status advances to ready_for_pickup', async () => {
    const deps = baseDeps();
    const handler = createUpdatePackagePushHandler(deps);
    await expect(handler(makeUpdateEvent(
      { id: 'pkg1', status: 'in_transit', title: 'AliExpress' },
      { id: 'pkg1', status: 'ready_for_pickup', title: 'AliExpress', pickupLocation: 'Dizengoff Center', lockerPin: '1234', ...AUTOMATED }
    ))).resolves.not.toThrow();
    expect(deps.webpush.sendNotification).toHaveBeenCalledTimes(1);
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
      { id: 'pkg1', status: 'delivered', ...AUTOMATED }
    ))).resolves.toBeUndefined();
  });

  it('stays silent when the user changes the status themselves', async () => {
    // The whole point of the guard: a manual status change is something the
    // user is already looking at, so pushing it back at them is noise. The
    // client's schema writes an explicit null to clear any stale marker.
    const deps = baseDeps();
    const handler = createUpdatePackagePushHandler(deps);
    await handler(makeUpdateEvent(
      { id: 'pkg1', status: 'in_transit', source: 'gmail_sync' },
      { id: 'pkg1', status: 'delivered', source: 'gmail_sync', lastUpdateSource: null }
    ));
    expect(deps.webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('stays silent when the marker is absent entirely', async () => {
    // Fail closed. Every package written before this field existed has no
    // marker, and so would any future write path that forgets to stamp one.
    const deps = baseDeps();
    const handler = createUpdatePackagePushHandler(deps);
    await handler(makeUpdateEvent(
      { id: 'pkg1', status: 'in_transit' },
      { id: 'pkg1', status: 'delivered' }
    ));
    expect(deps.webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('does not read the creation source as update provenance', async () => {
    // `source` persists through every merge, so keying on it would fire on
    // every manual edit of a Gmail-created package.
    const deps = baseDeps();
    const handler = createUpdatePackagePushHandler(deps);
    await handler(makeUpdateEvent(
      { id: 'pkg1', status: 'in_transit', source: 'email_forwarding' },
      { id: 'pkg1', status: 'delivered', source: 'email_forwarding' }
    ));
    expect(deps.webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('does nothing when data is missing or deleted', async () => {
    const deps = baseDeps();
    const handler = createUpdatePackagePushHandler(deps);
    await handler({ data: { before: null, after: null }, params: { uid: 'u1' } });
    expect(deps.webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('does nothing when uid param is missing', async () => {
    const deps = baseDeps();
    const handler = createUpdatePackagePushHandler(deps);
    await handler(makeUpdateEvent(
      { id: 'pkg1', status: 'in_transit' },
      { id: 'pkg1', status: 'delivered', ...AUTOMATED },
      null
    ));
    expect(deps.webpush.sendNotification).not.toHaveBeenCalled();
  });
});
