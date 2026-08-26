/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getIngestionEmailAddress,
  getConnectedServices,
  getConnectedAccounts,
  addConnectedAccount,
  removeConnectedAccount,
  setConnectedService,
  setupGmailAutoForward
} from './emailSyncService';

describe('emailSyncService Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('getIngestionEmailAddress', () => {
    it('returns clean email based on user uid', () => {
      expect(getIngestionEmailAddress({ uid: 'user12345' })).toBe('usr_user12345@in.deliveree.app');
    });

    it('returns placeholder when user is null or missing uid', () => {
      expect(getIngestionEmailAddress(null)).toBe('your-id.pkg@in.deliveree.app');
      expect(getIngestionEmailAddress({})).toBe('your-id.pkg@in.deliveree.app');
    });

    it('strips non-alphanumeric characters from uid', () => {
      expect(getIngestionEmailAddress({ uid: 'user-abc_123!@#' })).toBe('usr_userabc123@in.deliveree.app');
    });
  });

  describe('getConnectedServices & setConnectedService', () => {
    it('defaults to false for all services', () => {
      const state = getConnectedServices();
      expect(state).toEqual({ gmail: false, outlook: false, accounts: [] });
    });

    it('persists connected state across calls', () => {
      setConnectedService('gmail', true);
      expect(getConnectedServices()).toEqual({ gmail: true, outlook: false, accounts: [] });

      setConnectedService('outlook', true);
      expect(getConnectedServices()).toEqual({ gmail: true, outlook: true, accounts: [] });

      setConnectedService('gmail', false);
      expect(getConnectedServices()).toEqual({ gmail: false, outlook: true, accounts: [] });
    });
  });

  describe('Multi-Email Accounts Management', () => {
    it('adds, lists, and removes connected accounts', () => {
      expect(getConnectedAccounts()).toEqual([]);

      addConnectedAccount({ email: 'sahar@gmail.com', service: 'gmail' });
      addConnectedAccount({ email: 'work@company.com', service: 'gmail' });

      const accounts = getConnectedAccounts();
      expect(accounts.length).toBe(2);
      expect(accounts.map((a) => a.email)).toEqual(['sahar@gmail.com', 'work@company.com']);
      expect(getConnectedServices().gmail).toBe(true);

      removeConnectedAccount('sahar@gmail.com');
      const remaining = getConnectedAccounts();
      expect(remaining.length).toBe(1);
      expect(remaining[0].email).toBe('work@company.com');
      expect(getConnectedServices().gmail).toBe(true);

      removeConnectedAccount('work@company.com');
      expect(getConnectedAccounts().length).toBe(0);
      expect(getConnectedServices().gmail).toBe(false);
    });
  });

  describe('setupGmailAutoForward', () => {
    it('fails fast on missing access token or email', async () => {
      const res = await setupGmailAutoForward(null, 'test@in.deliveree.app');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Missing access token');
    });

    it('successfully calls Google Gmail API endpoints', async () => {
      const fetchMock = vi.fn().mockImplementation((url) => {
        if (url.includes('forwardingAddresses')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ forwardingEmail: 'usr_123@in.deliveree.app' })
          });
        }
        if (url.includes('filters')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'filter-123' })
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      global.fetch = fetchMock;

      const res = await setupGmailAutoForward('mock-google-token', 'usr_123@in.deliveree.app');
      expect(res.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getConnectedServices().gmail).toBe(true);
    });

    it('tolerates 409 conflict when forwarding address was already added', async () => {
      const fetchMock = vi.fn().mockImplementation((url) => {
        if (url.includes('forwardingAddresses')) {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: () => Promise.resolve({ error: { message: 'Already exists' } })
          });
        }
        if (url.includes('filters')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'filter-123' })
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      global.fetch = fetchMock;

      const res = await setupGmailAutoForward('mock-google-token', 'usr_123@in.deliveree.app');
      expect(res.ok).toBe(true);
    });

    it('returns error when filter creation fails', async () => {
      const fetchMock = vi.fn().mockImplementation((url) => {
        if (url.includes('forwardingAddresses')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({})
          });
        }
        if (url.includes('filters')) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: { message: 'Invalid query criteria' } })
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      global.fetch = fetchMock;

      const res = await setupGmailAutoForward('mock-google-token', 'usr_123@in.deliveree.app');
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Invalid query criteria');
    });
  });

  describe('requestGmailForwardingSetup', () => {
    it('returns error when firebase is not configured', async () => {
      const { requestGmailForwardingSetup: requestSetup } = await import('./emailSyncService');
      const res = await requestSetup('usr_123@in.deliveree.app');
      expect(res.ok).toBe(false);
    });
  });
});
