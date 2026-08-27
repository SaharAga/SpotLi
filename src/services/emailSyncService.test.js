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
      expect(getConnectedServices().gmail).toBe(true);

      setConnectedService('outlook', true);
      expect(getConnectedServices().outlook).toBe(true);

      setConnectedService('gmail', false);
      expect(getConnectedServices().gmail).toBe(false);
      expect(getConnectedServices().outlook).toBe(true);
    });

    it('auto-migrates legacy state when currentUser is provided', () => {
      window.localStorage.setItem('deliveree_email_integrations_v1', JSON.stringify({ gmail: true }));
      const services = getConnectedServices({ email: 'sahar@example.com' });
      expect(services.gmail).toBe(true);
      expect(services.accounts.length).toBe(1);
      expect(services.accounts[0].email).toBe('sahar@example.com');
    });
  });

  describe('Multi-Email Accounts Management', () => {
    it('adds, lists, disconnects and removes connected accounts', async () => {
      const { disconnectService: disconnect } = await import('./emailSyncService');
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

      disconnect('gmail');
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

  describe('setupOutlookAutoForward', () => {
    it('fails fast on missing access token or email', async () => {
      const { setupOutlookAutoForward: setupOutlook } = await import('./emailSyncService');
      const res = await setupOutlook(null, 'test@in.deliveree.app');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Missing access token');
    });

    it('creates messageRule via Microsoft Graph API', async () => {
      const { setupOutlookAutoForward: setupOutlook } = await import('./emailSyncService');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'rule-123' })
      });
      global.fetch = fetchMock;

      const res = await setupOutlook('mock-ms-token', 'usr_123@in.deliveree.app');
      expect(res.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('requestGmailForwardingSetup & requestOutlookForwardingSetup', () => {
    it('returns error when firebase is not configured', async () => {
      const { requestGmailForwardingSetup: requestGmail, requestOutlookForwardingSetup: requestOutlook } =
        await import('./emailSyncService');
      const resGmail = await requestGmail('usr_123@in.deliveree.app');
      expect(resGmail.ok).toBe(false);

      const resOutlook = await requestOutlook('usr_123@in.deliveree.app');
      expect(resOutlook.ok).toBe(false);
    });
  });
});
