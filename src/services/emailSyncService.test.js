/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getIngestionEmailAddress,
  getConnectedServices,
  getConnectedAccounts,
  addConnectedAccount,
  removeConnectedAccount,
  setConnectedService,
  connectGmail,
  getGmailConnectionStatus
} from './emailSyncService';

describe('emailSyncService Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('getIngestionEmailAddress', () => {
    it('returns clean email based on user uid', () => {
      expect(getIngestionEmailAddress({ uid: 'user12345' })).toBe('233b362d7b331adfde6e+usr_user12345@cloudmailin.net');
    });

    it('returns placeholder when user is null or missing uid', () => {
      expect(getIngestionEmailAddress(null)).toBe('233b362d7b331adfde6e@cloudmailin.net');
      expect(getIngestionEmailAddress({})).toBe('233b362d7b331adfde6e@cloudmailin.net');
    });

    it('strips non-alphanumeric characters from uid', () => {
      expect(getIngestionEmailAddress({ uid: 'user-abc_123!@#' })).toBe('233b362d7b331adfde6e+usr_userabc123@cloudmailin.net');
    });

    it('preserves full 28-character Firebase Auth UID without truncation', () => {
      const fullUid = 'abcdefghijklmnopqrstuvwxyz12';
      expect(fullUid.length).toBe(28);
      expect(getIngestionEmailAddress({ uid: fullUid })).toBe(`233b362d7b331adfde6e+usr_${fullUid}@cloudmailin.net`);
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
      const { disconnectService: disconnect, updateAccountStatus } = await import('./emailSyncService');

      expect(getConnectedAccounts()).toEqual([]);

      addConnectedAccount({ email: 'sahar@gmail.com', service: 'gmail', status: 'pending' });
      addConnectedAccount({ email: 'work@company.com', service: 'gmail' });

      let accounts = getConnectedAccounts();
      expect(accounts.length).toBe(2);
      expect(accounts[0].status).toBe('pending');

      updateAccountStatus('sahar@gmail.com', 'active');
      accounts = getConnectedAccounts();
      expect(accounts[0].status).toBe('active');

      // No client-side network call: disconnect goes through the
      // gmailDisconnect Cloud Function, which is unavailable in this test
      // environment (no Firebase project configured) and fails silently.
      await removeConnectedAccount('sahar@gmail.com');
      const remaining = getConnectedAccounts();
      expect(remaining.length).toBe(1);
      expect(remaining[0].email).toBe('work@company.com');
      expect(getConnectedServices().gmail).toBe(true);

      await disconnect('gmail');
      expect(getConnectedAccounts().length).toBe(0);
      expect(getConnectedServices().gmail).toBe(false);
    });
  });

  describe('connectGmail', () => {
    it('returns an error when not signed in / Firebase is not configured', async () => {
      const res = await connectGmail();
      expect(res.ok).toBe(false);
      expect(res.error).toBeTruthy();
    });
  });

  describe('getGmailConnectionStatus', () => {
    it('reports not connected when Firebase is not configured / not signed in', async () => {
      const status = await getGmailConnectionStatus();
      expect(status).toEqual({ connected: false });
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

  describe('requestOutlookForwardingSetup', () => {
    it('returns error when firebase is not configured', async () => {
      const { requestOutlookForwardingSetup: requestOutlook } = await import('./emailSyncService');
      const resOutlook = await requestOutlook('usr_123@in.deliveree.app');
      expect(resOutlook.ok).toBe(false);
    });
  });
});
