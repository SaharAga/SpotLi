import { describe, it, expect } from 'vitest';
import { APP_NAME, APP_NAME_HE, INGESTION_EMAIL_DOMAIN, APP_COPYRIGHT } from './app.js';

describe('App Constants', () => {
  it('exports expected branding and domain constants', () => {
    expect(APP_NAME).toBe('Deliveree');
    expect(APP_NAME_HE).toBe('Deliveree');
    expect(INGESTION_EMAIL_DOMAIN).toBe('in.deliveree.app');
    expect(APP_COPYRIGHT).toBe('© 2026 Deliveree');
  });
});
