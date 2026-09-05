import { describe, it, expect, vi } from 'vitest';
import { createGmailPushHandler } from './gmailPushHandler.js';

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
