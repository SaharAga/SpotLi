import { auth, isFirebaseConfigured, functionsInstance } from './firebase';
import { STORAGE_KEYS } from '../constants/storageKeys';

const EMAIL_INTEGRATIONS_STORAGE_KEY = STORAGE_KEYS.EMAIL_INTEGRATIONS;

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

    // Reconcile placeholder accounts with currentUser email and dedupe identical emails
    const uniqueAccounts = [];
    const seenEmails = new Set();
    for (const a of accounts) {
      let email = a.email;
      if (email === 'Connected Gmail Account' && currentUser?.email) {
        email = currentUser.email;
      }
      const key = email.toLowerCase();
      if (!seenEmails.has(key)) {
        seenEmails.add(key);
        uniqueAccounts.push({ ...a, email });
      }
    }

    const hasGmail = Boolean(parsed.gmail || uniqueAccounts.some((a) => a.service === 'gmail'));
    const hasOutlook = Boolean(parsed.outlook || uniqueAccounts.some((a) => a.service === 'outlook'));

    return {
      gmail: hasGmail,
      outlook: hasOutlook,
      accounts: uniqueAccounts
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
 * Updates status of a connected account ('pending' | 'active').
 * @param {string} email
 * @param {'pending' | 'active'} status
 */
export function updateAccountStatus(email, status) {
  if (typeof window === 'undefined' || !window.localStorage || !email) return;
  try {
    const current = getConnectedServices();
    const updatedAccounts = current.accounts.map((a) => {
      if (a.email.toLowerCase() === email.toLowerCase()) {
        return { ...a, status };
      }
      return a;
    });
    const updated = {
      ...current,
      accounts: updatedAccounts
    };
    window.localStorage.setItem(EMAIL_INTEGRATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[EmailSyncService] Failed to update account status:', err);
  }
}

/**
 * Adds or updates a connected email account.
 * @param {{ email: string, service?: string, status?: string, connectedAt?: string, token?: string }} account
 */
export function addConnectedAccount(account) {
  if (typeof window === 'undefined' || !window.localStorage || !account?.email) return;

  try {
    const current = getConnectedServices();
    const serviceType = account.service || 'gmail';
    const isPlaceholder = (e) => e === 'Connected Gmail Account' || e === 'Connected Outlook Account';

    // Remove matching email or stale placeholder when real email is supplied
    const filteredAccounts = current.accounts.filter(
      (a) =>
        a.email.toLowerCase() !== account.email.toLowerCase() &&
        !(isPlaceholder(a.email) && !isPlaceholder(account.email) && a.service === serviceType)
    );
    const updatedAccounts = [
      ...filteredAccounts,
      {
        email: account.email,
        service: serviceType,
        status: account.status || 'active',
        connectedAt: account.connectedAt || new Date().toISOString()
      }
    ];
    const updated = {
      ...current,
      [serviceType]: true,
      accounts: updatedAccounts
    };
    window.localStorage.setItem(EMAIL_INTEGRATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[EmailSyncService] Failed to save connected account:', err);
  }
}

/**
 * Calls the gmailDisconnect Cloud Function: revokes the stored refresh
 * token, cancels the Gmail watch subscription, and deletes the server-side
 * gmailConnections/{uid} doc. No client-side forwarding address exists to
 * clean up under the OAuth+push model.
 */
export async function revokeGmailConnection() {
  if (!functionsInstance) return;
  try {
    const { httpsCallable } = await import('firebase/functions');
    const disconnect = httpsCallable(functionsInstance, 'gmailDisconnect');
    await disconnect();
  } catch (err) {
    console.warn('[EmailSyncService] gmailDisconnect call failed:', err);
  }
}

/**
 * Completely disconnects a specific service ('gmail' or 'outlook') and removes its accounts.
 * @param {'gmail' | 'outlook'} service
 */
export async function disconnectService(service) {
  if (typeof window === 'undefined' || !window.localStorage || !service) return;
  try {
    if (service === 'gmail') {
      await revokeGmailConnection();
    }

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
 * Removes a connected email account by email address and cleans up remote rules/tokens.
 * @param {string} email
 */
export async function removeConnectedAccount(email) {
  if (typeof window === 'undefined' || !window.localStorage || !email) return;
  try {
    const current = getConnectedServices();
    const target = current.accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (target?.service === 'gmail') {
      await revokeGmailConnection();
    }

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
    console.warn('[EmailSyncService] Failed to set connected service:', err);
  }
}

/**
 * Starts the Gmail auto-sync connect flow: calls the `gmailOAuthStart`
 * Cloud Function (which mints a short-lived signed state token bound to
 * the signed-in Firebase user, verified server-side via App Check + the
 * callable's own auth context — never a bare uid in a URL) to get a Google
 * consent URL, then navigates the whole page there.
 *
 * This replaces the old signInWithPopup + forwardingAddresses/filters
 * REST-call flow entirely: no forwarding rule is created in the mailbox,
 * no confirmation-email scraping happens, and the connection is read-only
 * (gmail.readonly) with sync driven server-side by Cloud Functions via a
 * stored refresh token + Pub/Sub push, independent of any open tab.
 *
 * Because this navigates away, the caller doesn't get a result back in the
 * usual sense — the app re-mounts after Google redirects back to
 * `${APP_BASE_URL}/?gmail=connected` (or `?gmail=error`), which
 * IngestionGuideModal reads on mount to show the outcome.
 *
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function connectGmail() {
  if (!isFirebaseConfigured || !auth?.currentUser || !functionsInstance) {
    return { ok: false, error: 'Sign in required to connect Gmail' };
  }

  try {
    const { httpsCallable } = await import('firebase/functions');
    const start = httpsCallable(functionsInstance, 'gmailOAuthStart');
    const res = await start();
    const url = res?.data?.url;
    if (!url) {
      return { ok: false, error: 'Failed to start Gmail connection' };
    }
    window.location.href = url;
    return { ok: true };
  } catch (err) {
    console.error('[EmailSyncService] connectGmail error:', err);
    return { ok: false, error: err.message || 'Failed to start Gmail connection' };
  }
}

/**
 * Reads the real Gmail connection state from the server. The client can't
 * read gmailConnections/{uid} directly (Firestore rules deny it — the doc
 * holds a refresh token), so this is the only way the UI learns whether
 * Gmail is actually connected; it's the source of truth for Gmail's status,
 * not the localStorage bookkeeping getConnectedServices() reads (that stays
 * accurate for Outlook, which has no server-side connection doc).
 * @returns {Promise<{ connected: boolean, emailAddress?: string, connectedAt?: string }>}
 */
export async function getGmailConnectionStatus() {
  if (!isFirebaseConfigured || !auth?.currentUser || !functionsInstance) {
    return { connected: false };
  }
  try {
    const { httpsCallable } = await import('firebase/functions');
    const status = httpsCallable(functionsInstance, 'gmailConnectionStatus');
    const res = await status();
    return res?.data || { connected: false };
  } catch (err) {
    console.warn('[EmailSyncService] getGmailConnectionStatus error:', err);
    return { connected: false };
  }
}

/**
 * Triggers the server-side 30-day historical backfill for the signed-in
 * user's connected Gmail account. Called by the client right after the
 * OAuth redirect-back completes, as a belt-and-suspenders companion to the
 * fire-and-forget backfill the OAuth callback already kicks off itself.
 * @returns {Promise<{ ok: boolean, saved?: number, error?: string }>}
 */
export async function triggerGmailBackfill() {
  if (!functionsInstance) return { ok: false, error: 'Firebase is not configured' };
  try {
    const { httpsCallable } = await import('firebase/functions');
    const backfill = httpsCallable(functionsInstance, 'gmailBackfill');
    const res = await backfill();
    return { ok: true, ...res.data };
  } catch (err) {
    console.warn('[EmailSyncService] triggerGmailBackfill error:', err);
    return { ok: false, error: err.message || 'Backfill failed' };
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

    // Check if this account is already linked
    const currentServices = getConnectedServices();
    const isAlreadyConnected = currentServices.accounts.some(
      (a) => a.email.toLowerCase() === connectedEmail.toLowerCase()
    );
    if (isAlreadyConnected) {
      return { ok: true, alreadyConnected: true, email: connectedEmail };
    }

    // Always add the account to connected accounts list
    addConnectedAccount({ email: connectedEmail, service: 'outlook' });

    if (!accessToken) {
      return { ok: true, email: connectedEmail };
    }

    try {
      await setupOutlookAutoForward(accessToken, ingestionEmail);
    } catch (forwardErr) {
      console.warn('[EmailSyncService] Non-blocking Outlook forward rule warning:', forwardErr);
    }

    return { ok: true, email: connectedEmail };
  } catch (err) {
    console.error('[EmailSyncService] requestOutlookForwardingSetup error:', err);
    return { ok: false, error: err.message || 'Microsoft authentication was cancelled or failed' };
  }
}


