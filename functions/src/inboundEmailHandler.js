/**
 * Inbound Email Webhook Handler.
 *
 * Ingests forwarded shipping confirmation emails (from SendGrid Inbound Parse,
 * Mailgun, Postmark, or CloudMailin webhooks), extracts carrier tracking
 * details, and saves the package directly to the user's Firestore collection.
 *
 * This serves the no-OAuth manual-forwarding fallback address only
 * (getIngestionEmailAddress / LIVE_INBOUND_INBOX_ID in emailSyncService.js).
 * The Gmail auto-sync path is handled separately via OAuth + Pub/Sub push —
 * see gmailPushHandler.js — and never sends mail to this webhook.
 */

import { sanitizeEmailHtml, extractTrackingDetails, inferDeliveryStatus } from './trackingExtraction.js';

export { sanitizeEmailHtml, extractTrackingDetails, inferDeliveryStatus };

/**
 * Extracts userId from the recipient email address.
 * Formats:
 * - `233b362d7b331adfde6e+usr_abc123@cloudmailin.net`
 * - `usr_abc123@in.deliveree.app`
 * - `abc123.pkg@in.deliveree.app`
 * @param {string} toAddress
 * @returns {string|null}
 */
export function extractUserIdFromToAddress(toAddress) {
  if (typeof toAddress !== 'string') return null;

  // 1. Check for plus-addressing (e.g. 233b362d7b331adfde6e+usr_abc123@cloudmailin.net)
  const plusMatch = toAddress.match(/\+(?:usr_)?([a-zA-Z0-9_-]+)@/i);
  if (plusMatch && plusMatch[1]) {
    const cleanId = plusMatch[1].split('_')[0];
    if (cleanId && cleanId.length >= 3) return cleanId;
  }

  // 2. Check for direct subdomain pattern (e.g. usr_abc123@in.deliveree.app or abc123.pkg@deliveree.app)
  const emailMatch = toAddress.match(/([a-zA-Z0-9_-]+)(?:\.pkg)?@(?:in\.)?(?:deliveree\.app|cloudmailin\.net)/i);
  if (!emailMatch) return null;

  const localPart = emailMatch[1];
  // Strip usr_ prefix if present
  const userId = localPart.startsWith('usr_') ? localPart.slice(4) : localPart;
  const cleanUserId = userId.split('_')[0];
  return cleanUserId && cleanUserId.length >= 3 ? cleanUserId : null;
}

/**
 * Creates the inbound email HTTP handler.
 * @param {{ db: any }} deps
 */
export function createInboundEmailHandler({ db }) {
  return async function handleInboundEmail(req, res) {
    // Only accept POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      const payload = req.body || {};
      const headers = payload.headers || {};
      const envelope = payload.envelope || {};

      // Extract recipient, subject, and text/html from various webhook formats (CloudMailin, SendGrid, Mailgun, Postmark)
      const to =
        payload.to ||
        payload.recipient ||
        payload.To ||
        (envelope.to?.[0] || envelope.to) ||
        (headers.to || headers.To) ||
        '';

      const subject = payload.subject || payload.Subject || headers.subject || headers.Subject || '';
      const rawHtml = payload.html || payload['body-html'] || payload.HtmlBody || '';
      const rawText = payload.plain || payload.text || payload['body-plain'] || payload.TextBody || '';

      const cleanText = rawText || sanitizeEmailHtml(rawHtml);
      const userId = extractUserIdFromToAddress(to);

      if (!userId) {
        res.status(400).json({ error: 'Invalid or missing recipient ingestion token' });
        return;
      }

      const { trackingNumber, carrier, title, status: detectionStatus } = extractTrackingDetails(subject, cleanText);

      // Forwarded email is an unattended ingestion path.  A plausible token
      // is not enough to create persistent package data: only the extractor's
      // strongest, deterministic tier may cross this boundary.
      if (!trackingNumber || detectionStatus !== 'verified') {
        // Return 200 to acknowledge webhook receipt so provider doesn't re-deliver in a retry loop
        res.status(200).json({
          ok: false,
          message: 'No verified tracking number recognized in email content'
        });
        return;
      }

      const packageId = `pkg-email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const nowIso = new Date().toISOString();

      const newPackage = {
        id: packageId,
        userId,
        title,
        trackingNumber,
        carrier,
        status: inferDeliveryStatus(subject, cleanText),
        source: 'email_forwarding',
        notes: subject ? `From Email: ${subject.slice(0, 100)}` : '',
        createdAt: nowIso,
        updatedAt: nowIso,
        isArchived: false
      };

      if (db) {
        // Save to user's scoped packages collection so client real-time listener sees it
        const userPkgRef = db.collection('users').doc(userId).collection('packages').doc(packageId);
        await userPkgRef.set(newPackage);

        // Also save to root packages collection for backwards compatibility
        const rootPkgRef = db.collection('packages').doc(packageId);
        await rootPkgRef.set(newPackage);
      }

      res.status(200).json({
        ok: true,
        packageId,
        trackingNumber,
        carrier,
        title
      });
    } catch (err) {
      console.error('[InboundEmailHandler] Error processing email:', err);
      // Return 200 with error flag to prevent infinite webhook retries
      res.status(200).json({ ok: false, error: err.message || 'Internal error' });
    }
  };
}
