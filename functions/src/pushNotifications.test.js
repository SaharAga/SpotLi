import { describe, it, expect, vi } from 'vitest';
import { sendPushToUser, subscriptionDocId } from './pushNotifications.js';

function fakeDb(tokens) {
  const deleted = [];
  return {
    _deleted: deleted,
    collection: () => ({
      doc: () => ({
        collection: () => ({
          get: async () => ({
            empty: tokens.length === 0,
            docs: tokens.map((t, i) => ({
              id: `tok${i}`,
              data: () => t,
              ref: { delete: async () => deleted.push(`tok${i}`) }
            }))
          })
        })
      })
    })
  };
}

describe('subscriptionDocId', () => {
  it('is deterministic for the same endpoint', () => {
    expect(subscriptionDocId('https://push.example.com/abc')).toBe(subscriptionDocId('https://push.example.com/abc'));
  });

  it('differs for different endpoints', () => {
    expect(subscriptionDocId('https://push.example.com/abc')).not.toBe(subscriptionDocId('https://push.example.com/xyz'));
  });
});

describe('sendPushToUser', () => {
  it('does nothing when VAPID keys are missing', async () => {
    const webpush = { sendNotification: vi.fn(), setVapidDetails: vi.fn() };
    const result = await sendPushToUser({
      db: fakeDb([{ endpoint: 'e1', keys: {} }]),
      uid: 'u1',
      payload: { title: 'x' },
      webpush,
      vapidPublicKey: '',
      vapidPrivateKey: ''
    });
    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('does nothing when there are no subscriptions', async () => {
    const webpush = { sendNotification: vi.fn(), setVapidDetails: vi.fn() };
    const result = await sendPushToUser({
      db: fakeDb([]),
      uid: 'u1',
      payload: { title: 'x' },
      webpush,
      vapidPublicKey: 'pub',
      vapidPrivateKey: 'priv'
    });
    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(webpush.setVapidDetails).not.toHaveBeenCalled();
  });

  it('sends to every subscription and counts successes', async () => {
    const webpush = { sendNotification: vi.fn().mockResolvedValue(undefined), setVapidDetails: vi.fn() };
    const result = await sendPushToUser({
      db: fakeDb([{ endpoint: 'e1', keys: {} }, { endpoint: 'e2', keys: {} }]),
      uid: 'u1',
      payload: { title: 'x' },
      webpush,
      vapidPublicKey: 'pub',
      vapidPrivateKey: 'priv'
    });
    expect(result).toEqual({ sent: 2, removed: 0 });
    expect(webpush.setVapidDetails).toHaveBeenCalledWith('mailto:support@spotliapp.com', 'pub', 'priv');
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
  });

  it('removes subscriptions the push service reports gone (410)', async () => {
    const webpush = {
      sendNotification: vi.fn().mockRejectedValue({ statusCode: 410, message: 'gone' }),
      setVapidDetails: vi.fn()
    };
    const db = fakeDb([{ endpoint: 'e1', keys: {} }]);
    const result = await sendPushToUser({
      db,
      uid: 'u1',
      payload: { title: 'x' },
      webpush,
      vapidPublicKey: 'pub',
      vapidPrivateKey: 'priv'
    });
    expect(result).toEqual({ sent: 0, removed: 1 });
    expect(db._deleted).toEqual(['tok0']);
  });

  it('does not remove subscriptions on a non-expiry error', async () => {
    const webpush = {
      sendNotification: vi.fn().mockRejectedValue({ statusCode: 500, message: 'server error' }),
      setVapidDetails: vi.fn()
    };
    const db = fakeDb([{ endpoint: 'e1', keys: {} }]);
    const result = await sendPushToUser({
      db,
      uid: 'u1',
      payload: { title: 'x' },
      webpush,
      vapidPublicKey: 'pub',
      vapidPrivateKey: 'priv'
    });
    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(db._deleted).toEqual([]);
  });
});
