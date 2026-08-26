import { DEFAULT_FORWARDING_FILTER_QUERY } from '../constants/emailFilters';

const EMAIL_INTEGRATIONS_STORAGE_KEY = 'deliveree_email_integrations_v1';

/**
 * Derives a consistent, user-specific ingestion email address.
 * @param {{ uid?: string } | null | undefined} user
 * @returns {string}
 */
export function getIngestionEmailAddress(user) {
  if (!user || !user.uid) {
    return 'your-id.pkg@in.deliveree.app';
  }
  const cleanUid = String(user.uid).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  return `usr_${cleanUid}@in.deliveree.app`;
}

/**
 * Reads user's connected email services state from local storage.
 * @returns {{ gmail: boolean, outlook: boolean }}
 */
export function getConnectedServices() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { gmail: false, outlook: false };
  }
  try {
    const raw = window.localStorage.getItem(EMAIL_INTEGRATIONS_STORAGE_KEY);
    if (!raw) return { gmail: false, outlook: false };
    const parsed = JSON.parse(raw);
    return {
      gmail: Boolean(parsed.gmail),
      outlook: Boolean(parsed.outlook)
    };
  } catch {
    return { gmail: false, outlook: false };
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
