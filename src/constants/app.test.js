import { describe, it, expect } from 'vitest';
import { APP_NAME, APP_NAME_HE, INGESTION_EMAIL_DOMAIN, APP_COPYRIGHT } from './app.js';

describe('App Constants', () => {
  it('exports expected branding and domain constants', () => {
    expect(APP_NAME).toBe('SpotLi');
    expect(APP_NAME_HE).toBe('SpotLi');
    expect(INGESTION_EMAIL_DOMAIN).toBe('in.spotliapp.com');
    expect(APP_COPYRIGHT).toBe('© 2026 SpotLi');
  });
});
