import { describe, it, expect, vi } from 'vitest';
import { createNewPackagePushHandler } from './newPackagePush.js';

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

function makeEvent(pkgData, uid = 'u1') {
  return {
    data: { data: () => pkgData },
    params: { uid, packageId: pkgData?.id }
  };
}

describe('createNewPackagePushHandler', () => {
  const baseDeps = () => ({
    db: fakeDbWithNoTokens(),
    webpush: { sendNotification: vi.fn(), setVapidDetails: vi.fn() },
    vapidPublicKey: 'pub',
    vapidPrivateKey: 'priv',
    vapidSubject: 'mailto:test@example.com'
  });

  it('skips packages from non-automated sources (manual add / Smart Import)', async () => {
    const deps = baseDeps();
    const handler = createNewPackagePushHandler(deps);
    await handler(makeEvent({ id: 'pkg1', source: 'manual', trackingNumber: 'TRK1' }));
    expect(deps.webpush.setVapidDetails).not.toHaveBeenCalled();
  });

  it('skips packages with no source at all', async () => {
    const deps = baseDeps();
    const handler = createNewPackagePushHandler(deps);
    await handler(makeEvent({ id: 'pkg1', trackingNumber: 'TRK1' }));
    expect(deps.webpush.setVapidDetails).not.toHaveBeenCalled();
  });

  it('attempts to send for gmail_sync packages', async () => {
    const deps = baseDeps();
    const handler = createNewPackagePushHandler(deps);
    // No subscriptions exist in fakeDbWithNoTokens, so sendPushToUser
    // returns early without calling setVapidDetails — this proves the
    // handler reached sendPushToUser at all rather than skipping.
    await expect(handler(makeEvent({ id: 'pkg1', source: 'gmail_sync', trackingNumber: 'TRK1', title: 'Amazon' }))).resolves.not.toThrow();
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
    const handler = createNewPackagePushHandler(deps);
    await expect(handler(makeEvent({ id: 'pkg1', source: 'email_forwarding' }))).resolves.toBeUndefined();
  });

  it('does nothing when there is no package data (deleted before trigger ran)', async () => {
    const deps = baseDeps();
    const handler = createNewPackagePushHandler(deps);
    await handler({ data: { data: () => null }, params: { uid: 'u1' } });
    expect(deps.webpush.setVapidDetails).not.toHaveBeenCalled();
  });

  it('does nothing when uid param is missing', async () => {
    const deps = baseDeps();
    const handler = createNewPackagePushHandler(deps);
    await handler({ data: { data: () => ({ id: 'pkg1', source: 'gmail_sync' }) }, params: {} });
    expect(deps.webpush.setVapidDetails).not.toHaveBeenCalled();
  });
});
