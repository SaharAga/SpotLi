import { describe, it, expect, vi } from 'vitest';
import { getGmailClientForUser } from './gmailAuth.js';
import { createGmailPushHandler, syncHistoryForConnection } from './gmailPushHandler.js';

vi.mock('./gmailAuth.js', () => ({
  getGmailClientForUser: vi.fn(),
  setGmailConnection: vi.fn().mockResolvedValue(),
  findGmailConnectionByEmail: vi.fn()
}));

describe('createGmailPushHandler Unit Tests', () => {
  it('rejects non-POST requests with 405', async () => {
    const handler = createGmailPushHandler({ db: null, clientSecret: 'secret', pushToken: 'token123' });
    const req = { method: 'GET', query: { token: 'token123' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn()
    };

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('fails closed and rejects with 401 if pushToken is undefined or empty', async () => {
    const handler = createGmailPushHandler({ db: null, clientSecret: 'secret', pushToken: '' });
    const req = { method: 'POST', query: { token: '' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn()
    };

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects with 401 if query token does not match pushToken', async () => {
    const handler = createGmailPushHandler({ db: null, clientSecret: 'secret', pushToken: 'valid-token' });
    const req = { method: 'POST', query: { token: 'wrong-token' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn()
    };

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('acknowledges with 200 ok when body has no message data', async () => {
    const handler = createGmailPushHandler({ db: null, clientSecret: 'secret', pushToken: 'valid-token' });
    const req = {
      method: 'POST',
      query: { token: 'valid-token' },
      body: {}
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn()
    };

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('ok');
  });
});

describe('syncHistoryForConnection Order Correlation', () => {
  it('merges tracking number into existing untracked package when orderNumber matches (Tier 1)', async () => {
    const mockDocs = [
      {
        id: 'pkg-order-1',
        data: () => ({
          id: 'pkg-order-1',
          title: 'Keychron K2 Keyboard',
          orderNumber: '818274917401',
          trackingNumber: '',
          status: 'ordered'
        })
      }
    ];

    const setMock = vi.fn().mockResolvedValue();
    const docMock = vi.fn().mockReturnValue({ set: setMock });
    const collectionMock = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ docs: mockDocs }),
      doc: docMock,
      add: vi.fn()
    });

    const db = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({ collection: collectionMock, set: vi.fn().mockResolvedValue() })
      })
    };

    const mockGmail = {
      users: {
        history: {
          list: vi.fn().mockResolvedValue({
            data: {
              history: [
                {
                  messagesAdded: [{ message: { id: 'msg-shipping-1' } }]
                }
              ]
            }
          })
        },
        messages: {
          get: vi.fn().mockResolvedValue({
            data: {
              id: 'msg-shipping-1',
              snippet: 'Tracking LP00582910482CN Order #818274917401',
              payload: {
                headers: [
                  { name: 'Subject', value: 'AliExpress: Your order has shipped' },
                  { name: 'From', value: 'transaction@notice.aliexpress.com' }
                ],
                body: {
                  data: Buffer.from(
                    'Your order #818274917401 has shipped with Cainiao. Tracking number LP00582910482CN'
                  ).toString('base64url')
                }
              }
            }
          })
        }
      }
    };

    getGmailClientForUser.mockReturnValue({ gmail: mockGmail });

    const result = await syncHistoryForConnection({
      db,
      connection: { uid: 'u1', refreshToken: 'rt', historyId: '100' },
      clientSecret: 'secret',
      newHistoryId: '101'
    });

    expect(result.saved).toBe(0);
    expect(result.updated).toBe(1);
    expect(docMock).toHaveBeenCalledWith('pkg-order-1');
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingNumber: 'LP00582910482CN',
        carrier: 'cainiao'
      }),
      { merge: true }
    );
  });

  it('skips 404 Not Found message entities without aborting remaining messages or historyId progression', async () => {
    const setMock = vi.fn().mockResolvedValue();
    const docMock = vi.fn().mockReturnValue({ set: setMock });
    const collectionMock = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ docs: [] }),
      doc: docMock,
      add: vi.fn()
    });

    const db = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({ collection: collectionMock, set: vi.fn().mockResolvedValue() })
      })
    };

    const notFoundError = new Error('Requested entity was not found.');
    notFoundError.code = 404;

    const mockGmail = {
      users: {
        history: {
          list: vi.fn().mockResolvedValue({
            data: {
              history: [
                {
                  messagesAdded: [
                    { message: { id: 'msg-deleted-404' } },
                    { message: { id: 'msg-valid-package' } }
                  ]
                }
              ]
            }
          })
        },
        messages: {
          get: vi.fn().mockImplementation(({ id }) => {
            if (id === 'msg-deleted-404') {
              return Promise.reject(notFoundError);
            }
            return Promise.resolve({
              data: {
                id: 'msg-valid-package',
                snippet: 'Tracking 1Z9999999999999999',
                payload: {
                  headers: [
                    { name: 'Subject', value: 'UPS Shipment Notification' },
                    { name: 'From', value: 'pkginfo@ups.com' }
                  ],
                  body: {
                    data: Buffer.from('Your package 1Z9999999999999999 is on the way with UPS.').toString('base64url')
                  }
                }
              }
            });
          })
        }
      }
    };

    getGmailClientForUser.mockReturnValue({ gmail: mockGmail });

    const result = await syncHistoryForConnection({
      db,
      connection: { uid: 'u1', refreshToken: 'rt', historyId: '200' },
      clientSecret: 'secret',
      newHistoryId: '205'
    });

    expect(result.saved).toBe(1);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingNumber: '1Z9999999999999999',
        carrier: 'ups'
      })
    );
  });
});
