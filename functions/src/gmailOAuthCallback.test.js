import { describe, it, expect } from 'vitest';
import { createGmailOAuthCallbackHandler, validateReturnOrigin } from './gmailOAuthCallback.js';
import { createStateToken } from './gmailStateToken.js';

const PROD = 'https://deliveree-app-2a938.web.app';

describe('validateReturnOrigin', () => {
  it('accepts the production origin itself', () => {
    expect(validateReturnOrigin(PROD, PROD)).toBe(PROD);
  });

  it('accepts the firebaseapp.com equivalent of the same project', () => {
    expect(validateReturnOrigin(PROD, 'https://deliveree-app-2a938.firebaseapp.com')).toBe(
      'https://deliveree-app-2a938.firebaseapp.com'
    );
  });

  it('accepts a named Hosting channel (e.g. staging) of the same project', () => {
    expect(validateReturnOrigin(PROD, 'https://deliveree-app-2a938--staging.web.app')).toBe(
      'https://deliveree-app-2a938--staging.web.app'
    );
  });

  it('accepts a channel URL with the random hash suffix Firebase appends', () => {
    expect(validateReturnOrigin(PROD, 'https://deliveree-app-2a938--staging-ab12cd34.web.app')).toBe(
      'https://deliveree-app-2a938--staging-ab12cd34.web.app'
    );
  });

  it('rejects an origin belonging to a different Firebase project', () => {
    expect(validateReturnOrigin(PROD, 'https://some-other-project.web.app')).toBeNull();
  });

  it('rejects an arbitrary external domain (open-redirect attempt)', () => {
    expect(validateReturnOrigin(PROD, 'https://evil.example.com')).toBeNull();
  });

  it('rejects a domain that merely contains the project id as a prefix trick', () => {
    expect(validateReturnOrigin(PROD, 'https://deliveree-app-2a938.web.app.evil.com')).toBeNull();
  });

  it('rejects non-https origins', () => {
    expect(validateReturnOrigin(PROD, 'http://deliveree-app-2a938.web.app')).toBeNull();
  });

  it('rejects malformed candidates', () => {
    expect(validateReturnOrigin(PROD, 'not-a-url')).toBeNull();
    expect(validateReturnOrigin(PROD, '')).toBeNull();
    expect(validateReturnOrigin(PROD, undefined)).toBeNull();
    expect(validateReturnOrigin(PROD, null)).toBeNull();
  });
});

describe('createGmailOAuthCallbackHandler', () => {
  const clientSecret = 'test-secret-key-123';
  const stagingOrigin = 'https://deliveree-app-2a938--staging.web.app';

  it('redirects error to returnOrigin when a valid state token carries a staging origin', async () => {
    process.env.APP_BASE_URL = PROD;
    const handler = createGmailOAuthCallbackHandler({
      db: {},
      clientSecret
    });

    const state = createStateToken({
      uid: 'user123',
      secret: clientSecret,
      returnOrigin: stagingOrigin
    });

    let redirectedTo = null;
    const req = {
      query: {
        error: 'access_denied',
        state
      }
    };
    const res = {
      redirect: (url) => {
        redirectedTo = url;
      }
    };

    await handler(req, res);
    expect(redirectedTo).toBe(`${stagingOrigin}/?gmail=error`);
  });

  it('redirects error to appBaseUrl when state token is missing', async () => {
    process.env.APP_BASE_URL = PROD;
    const handler = createGmailOAuthCallbackHandler({
      db: {},
      clientSecret
    });

    let redirectedTo = null;
    const req = {
      query: {
        error: 'access_denied'
      }
    };
    const res = {
      redirect: (url) => {
        redirectedTo = url;
      }
    };

    await handler(req, res);
    expect(redirectedTo).toBe(`${PROD}/?gmail=error`);
  });

  it('redirects error to appBaseUrl when state token is invalid', async () => {
    process.env.APP_BASE_URL = PROD;
    const handler = createGmailOAuthCallbackHandler({
      db: {},
      clientSecret
    });

    let redirectedTo = null;
    const req = {
      query: {
        code: 'dummy-code',
        state: 'invalid-state-token'
      }
    };
    const res = {
      redirect: (url) => {
        redirectedTo = url;
      }
    };

    await handler(req, res);
    expect(redirectedTo).toBe(`${PROD}/?gmail=error`);
  });
});
