import { DEFAULT_FORWARDING_FILTER_QUERY } from '../constants/emailFilters';
import { auth, isFirebaseConfigured } from './firebase';

const EMAIL_INTEGRATIONS_STORAGE_KEY = 'deliveree_email_integrations_v1';

export const LIVE_INBOUND_EMAIL_DOMAIN = 'cloudmailin.net';
export const LIVE_INBOUND_INBOX_ID = '233b362d7b331adfde6e';

/**
 * Derives a consistent, user-specific ingestion email address using the live receiving gateway.
 * @param {{ uid?: string } | null | undefined} user
 * @returns {string}
 */
export function getIngestionEmailAddress(user) {
  if (!user || !user.uid) {
    return `${LIVE_INBOUND_INBOX_ID}@${LIVE_INBOUND_EMAIL_DOMAIN}`;
  }
  const cleanUid = String(user.uid).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  return `${LIVE_INBOUND_INBOX_ID}+usr_${cleanUid}@${LIVE_INBOUND_EMAIL_DOMAIN}`;
}

/**
 * Reads user's connected email services state from local storage with auto-reconciliation.
 * @param {object} [currentUser] Optional current authenticated user for legacy state migration
 * @returns {{ gmail: boolean, outlook: boolean, accounts: Array<{ email: string, service: string, connectedAt: string }> }}
 */
export function getConnectedServices(currentUser = null) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { gmail: false, outlook: false, accounts: [] };
  }
  try {
    const raw = window.localStorage.getItem(EMAIL_INTEGRATIONS_STORAGE_KEY);
    if (!raw) return { gmail: false, outlook: false, accounts: [] };
    const parsed = JSON.parse(raw);
    let accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];

    // Auto-migration: If legacy flag is true but accounts list is empty, synthesize an entry
    if (parsed.gmail && !accounts.some((a) => a.service === 'gmail')) {
      accounts.push({
        email: currentUser?.email || 'Connected Gmail Account',
        service: 'gmail',
        connectedAt: new Date().toISOString()
      });
    }
    if (parsed.outlook && !accounts.some((a) => a.service === 'outlook')) {
      accounts.push({
        email: currentUser?.email || 'Connected Outlook Account',
        service: 'outlook',
        connectedAt: new Date().toISOString()
      });
    }

    const hasGmail = Boolean(parsed.gmail || accounts.some((a) => a.service === 'gmail'));
    const hasOutlook = Boolean(parsed.outlook || accounts.some((a) => a.service === 'outlook'));

    return {
      gmail: hasGmail,
      outlook: hasOutlook,
      accounts
    };
  } catch {
    return { gmail: false, outlook: false, accounts: [] };
  }
}

/**
 * Gets the list of all connected email accounts.
 * @param {object} [currentUser]
 * @returns {Array<{ email: string, service: string, connectedAt: string }>}
 */
export function getConnectedAccounts(currentUser = null) {
  return getConnectedServices(currentUser).accounts;
}

/**
 * Adds or updates a connected email account.
 * @param {{ email: string, service?: string, connectedAt?: string }} account
 */
export function addConnectedAccount(account) {
  if (typeof window === 'undefined' || !window.localStorage || !account?.email) return;
  try {
    const current = getConnectedServices();
    const existingAccounts = current.accounts.filter(
      (a) => a.email.toLowerCase() !== account.email.toLowerCase()
    );
    const updatedAccounts = [
      ...existingAccounts,
      {
        email: account.email,
        service: account.service || 'gmail',
        connectedAt: account.connectedAt || new Date().toISOString()
      }
    ];
    const updated = {
      ...current,
      [account.service || 'gmail']: true,
      accounts: updatedAccounts
    };
    window.localStorage.setItem(EMAIL_INTEGRATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[EmailSyncService] Failed to save connected account:', err);
  }
}

/**
 * Completely disconnects a specific service ('gmail' or 'outlook') and removes its accounts.
 * @param {'gmail' | 'outlook'} service
 */
export function disconnectService(service) {
  if (typeof window === 'undefined' || !window.localStorage || !service) return;
  try {
    const current = getConnectedServices();
    const remainingAccounts = current.accounts.filter((a) => a.service !== service);
    const updated = {
      ...current,
      [service]: false,
      accounts: remainingAccounts
    };
    window.localStorage.setItem(EMAIL_INTEGRATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[EmailSyncService] Failed to disconnect service:', err);
  }
}

/**
 * Removes a connected email account by email address.
 * @param {string} email
 */
export function removeConnectedAccount(email) {
  if (typeof window === 'undefined' || !window.localStorage || !email) return;
  try {
    const current = getConnectedServices();
    const updatedAccounts = current.accounts.filter(
      (a) => a.email.toLowerCase() !== email.toLowerCase()
    );
    const hasGmail = updatedAccounts.some((a) => a.service === 'gmail');
    const hasOutlook = updatedAccounts.some((a) => a.service === 'outlook');
    const updated = {
      gmail: hasGmail,
      outlook: hasOutlook,
      accounts: updatedAccounts
    };
    window.localStorage.setItem(EMAIL_INTEGRATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[EmailSyncService] Failed to remove connected account:', err);
  }
}

/**
 * Saves connected service state.
 * @param {'gmail' | 'outlook'} service
 * @param {boolean} isConnected
 */
export function setConnectedService(service, isConnected) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const current = getConnectedServices();
    const updated = { ...current, [service]: Boolean(isConnected) };
    if (!isConnected) {
      updated.accounts = (current.accounts || []).filter((a) => a.service !== service);
    }
    window.localStorage.setItem(EMAIL_INTEGRATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[EmailSyncService] Failed to save connected service state:', err);
  }
}

/**
 * Programmatically creates a shipping email forwarding filter in Gmail via Google REST API.
 * @param {string} accessToken Valid Google OAuth access token with gmail.settings.basic scope
 * @param {string} ingestionEmail The user's Deliveree ingestion email address
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function setupGmailAutoForward(accessToken, ingestionEmail) {
  if (!accessToken || !ingestionEmail) {
    return { ok: false, error: 'Missing access token or ingestion address' };
  }

  try {
    // 1. Register forwarding address in Gmail
    const addForwardingRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/settings/forwardingAddresses',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ forwardingEmail: ingestionEmail })
      }
    );

    // 409 Conflict means the address is already registered, which is fine
    if (!addForwardingRes.ok && addForwardingRes.status !== 409) {
      const errData = await addForwardingRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'Failed to register forwarding address in Gmail');
    }

    // 2. Create shipping filter in Gmail
    const filterQuery = DEFAULT_FORWARDING_FILTER_QUERY;
    
    const createFilterRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/settings/filters',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          criteria: {
            query: filterQuery
          },
          action: {
            forward: ingestionEmail
          }
        })
      }
    );

    if (!createFilterRes.ok) {
      const filterErrData = await createFilterRes.json().catch(() => ({}));
      throw new Error(filterErrData.error?.message || 'Failed to create forwarding filter in Gmail');
    }

    setConnectedService('gmail', true);
    return { ok: true };
  } catch (err) {
    console.error('[EmailSyncService] setupGmailAutoForward error:', err);
    return { ok: false, error: err.message || 'Failed to connect Gmail forwarding' };
  }
}

/**
 * Prompts Google OAuth popup to grant gmail.settings.basic scope and configures the forwarding filter.
 * @param {string} ingestionEmail
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function requestGmailForwardingSetup(ingestionEmail) {
  if (!isFirebaseConfigured || !auth) {
    return { ok: false, error: 'Firebase is not configured' };
  }

  try {
    const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/gmail.settings.basic');
    provider.setCustomParameters({ prompt: 'select_account consent' });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;
    const connectedEmail = result?.user?.email || 'Gmail Account';

    if (!accessToken) {
      return { ok: false, error: 'Google OAuth token was not granted' };
    }

    const forwardRes = await setupGmailAutoForward(accessToken, ingestionEmail);
    if (forwardRes.ok) {
      addConnectedAccount({ email: connectedEmail, service: 'gmail' });
      return { ok: true, email: connectedEmail };
    }
    return forwardRes;
  } catch (err) {
    console.error('[EmailSyncService] requestGmailForwardingSetup error:', err);
    return { ok: false, error: err.message || 'Google authentication was cancelled or failed' };
  }
}

/**
 * Programmatically creates a shipping email forwarding rule in Outlook via Microsoft Graph REST API.
 * @param {string} accessToken Valid Microsoft OAuth access token
 * @param {string} ingestionEmail The user's Deliveree ingestion email address
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function setupOutlookAutoForward(accessToken, ingestionEmail) {
  if (!accessToken || !ingestionEmail) {
    return { ok: false, error: 'Missing access token or ingestion address' };
  }

  try {
    const createRuleRes = await fetch(
      'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: 'Deliveree Shipping Ingestion',
          sequence: 1,
          isEnabled: true,
          conditions: {
            senderContains: [
              'aliexpress', 'amazon', 'shein', 'temu',
              'dhl', 'fedex', 'ups', 'israelpost', 'iherb',
              'zara', 'next', 'chita'
            ],
            bodyOrSubjectContains: [
              'shipped', 'tracking', 'order', 'package',
              'מעקב', 'נשלחה', 'הזמנה', 'חבילה'
            ]
          },
          actions: {
            forwardTo: [
              {
                emailAddress: {
                  address: ingestionEmail
                }
              }
            ]
          }
        })
      }
    );

    if (!createRuleRes.ok && createRuleRes.status !== 409) {
      const errData = await createRuleRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'Failed to create forwarding rule in Outlook');
    }

    setConnectedService('outlook', true);
    return { ok: true };
  } catch (err) {
    console.error('[EmailSyncService] setupOutlookAutoForward error:', err);
    return { ok: false, error: err.message || 'Failed to connect Outlook forwarding' };
  }
}

/**
 * Prompts Microsoft OAuth popup to grant Mail.ReadWrite scope and configures the forwarding rule.
 * @param {string} ingestionEmail
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function requestOutlookForwardingSetup(ingestionEmail) {
  if (!isFirebaseConfigured || !auth) {
    return { ok: false, error: 'Firebase is not configured' };
  }

  try {
    const { signInWithPopup, OAuthProvider } = await import('firebase/auth');
    const provider = new OAuthProvider('microsoft.com');
    provider.addScope('Mail.ReadWrite');
    provider.addScope('MailboxSettings.ReadWrite');
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(auth, provider);
    const credential = OAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;
    const connectedEmail = result?.user?.email || 'Outlook Account';

    if (!accessToken) {
      return { ok: false, error: 'Microsoft OAuth token was not granted' };
    }

    const forwardRes = await setupOutlookAutoForward(accessToken, ingestionEmail);
    if (forwardRes.ok) {
      addConnectedAccount({ email: connectedEmail, service: 'outlook' });
      return { ok: true, email: connectedEmail };
    }
    return forwardRes;
  } catch (err) {
    console.error('[EmailSyncService] requestOutlookForwardingSetup error:', err);
    return { ok: false, error: err.message || 'Microsoft authentication was cancelled or failed' };
  }
}


