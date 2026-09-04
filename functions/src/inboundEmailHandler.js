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

import {
  sanitizeEmailHtml,
  extractTrackingDetails,
  extractAllTrackingDetails,
  inferDeliveryStatus,
  shouldAdvanceStatus
} from './trackingExtraction.js';

export { sanitizeEmailHtml, extractTrackingDetails, extractAllTrackingDetails, inferDeliveryStatus, shouldAdvanceStatus };

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
 * @param {{ db: any, webhookToken?: string }} deps
 */
export function createInboundEmailHandler({ db, webhookToken }) {
  return async function handleInboundEmail(req, res) {
    // Only accept POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    // Authenticate the webhook with a shared secret before any document
    // mutation, mirroring gmailPushNotification's `?token=` query-param check.
    // Fails closed: deny access whenever secret is not configured or does not match.
    if (!webhookToken || req.query?.token !== webhookToken) {
      res.status(401).json({ error: 'Unauthorized' });
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

      const cleanHtml = rawHtml ? sanitizeEmailHtml(rawHtml) : '';
      const cleanText = (rawText && cleanHtml)
        ? `${rawText}\n\n${cleanHtml}`
        : (rawText || cleanHtml);
      const userId = extractUserIdFromToAddress(to);

      if (!userId) {
        res.status(400).json({ error: 'Invalid or missing recipient ingestion token' });
        return;
      }

      const allExtracted = extractAllTrackingDetails(subject, cleanText, '', { html: rawHtml });
      const verifiedPackages = allExtracted.filter((pkg) => pkg.trackingNumber && pkg.status === 'verified');

      // Forwarded email is an unattended ingestion path. Only the extractor's
      // strongest, deterministic tier may cross this boundary.
      if (verifiedPackages.length === 0) {
        // Return 200 to acknowledge webhook receipt so provider doesn't re-deliver in a retry loop
        res.status(200).json({
          ok: false,
          message: 'No verified tracking number recognized in email content'
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const userPackagesRef = db ? db.collection('users').doc(userId).collection('packages') : null;
      const results = [];

      for (let idx = 0; idx < verifiedPackages.length; idx += 1) {
        const ext = verifiedPackages[idx];
        const upperTrackingNumber = ext.trackingNumber.toUpperCase();
        const inferredStatus = ext.deliveryStatus || inferDeliveryStatus(subject, cleanText);

        let existingDocId = null;
        let existingData = null;

        if (userPackagesRef && typeof userPackagesRef.where === 'function') {
          // eslint-disable-next-line no-await-in-loop
          const existingQuery = await userPackagesRef
            .where('trackingNumber', '==', upperTrackingNumber)
            .limit(1)
            .get();

          if (existingQuery && !existingQuery.empty) {
            const existingDoc = existingQuery.docs[0];
            existingData = existingDoc.data() || {};
            existingDocId = existingDoc.id;

            const patch = { updatedAt: nowIso };
            if (shouldAdvanceStatus(existingData.status, inferredStatus)) {
              patch.status = inferredStatus;
            }
            if (ext.lockerPin && !existingData.lockerPin) {
              patch.lockerPin = ext.lockerPin;
            }
            if (ext.lockerPin && !existingData.pickupCode) {
              patch.pickupCode = ext.lockerPin;
            }
            if (ext.pickupLocation && (!existingData.pickupLocation || ext.isRedirected)) {
              patch.pickupLocation = ext.pickupLocation;
            }
            if (ext.pickupHours && !existingData.pickupHours) {
              patch.pickupHours = ext.pickupHours;
            }
            if (ext.pickupPhone && !existingData.pickupPhone) {
              patch.pickupPhone = ext.pickupPhone;
            }
            if (ext.isRedirected) {
              patch.isRedirected = true;
              if (ext.originalPickupLocation || existingData.pickupLocation) {
                patch.originalPickupLocation = ext.originalPickupLocation || existingData.pickupLocation;
              }
              if (ext.redirectReason) {
                patch.redirectReason = ext.redirectReason;
              }
            }

            const userPkgRef = userPackagesRef.doc(existingDocId);
            // eslint-disable-next-line no-await-in-loop
            await userPkgRef.set(patch, { merge: true });

            const rootPkgRef = db.collection('packages').doc(existingDocId);
            // eslint-disable-next-line no-await-in-loop
            await rootPkgRef.set(patch, { merge: true });

            results.push({
              ok: true,
              packageId: existingDocId,
              trackingNumber: upperTrackingNumber,
              carrier: ext.carrier,
              title: existingData.title || ext.title,
              updated: true
            });
            continue;
          }
        }

        const packageId = verifiedPackages.length > 1
          ? `pkg-email-${Date.now()}-${idx + 1}-${Math.random().toString(36).slice(2, 7)}`
          : `pkg-email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const newPackage = {
          id: packageId,
          userId,
          title: ext.title,
          trackingNumber: upperTrackingNumber,
          carrier: ext.carrier,
          status: inferredStatus,
          source: 'email_forwarding',
          notes: subject ? `From Email: ${subject.slice(0, 100)}` : '',
          ...(ext.lockerPin ? { lockerPin: ext.lockerPin, pickupCode: ext.lockerPin } : {}),
          ...(ext.pickupLocation ? { pickupLocation: ext.pickupLocation } : {}),
          ...(ext.pickupHours ? { pickupHours: ext.pickupHours } : {}),
          ...(ext.pickupPhone ? { pickupPhone: ext.pickupPhone } : {}),
          ...(ext.isRedirected ? { isRedirected: ext.isRedirected } : {}),
          ...(ext.originalPickupLocation ? { originalPickupLocation: ext.originalPickupLocation } : {}),
          ...(ext.redirectReason ? { redirectReason: ext.redirectReason } : {}),
          createdAt: nowIso,
          updatedAt: nowIso,
          isArchived: false
        };

        if (db) {
          const userPkgRef = userPackagesRef.doc(packageId);
          // eslint-disable-next-line no-await-in-loop
          await userPkgRef.set(newPackage);

          const rootPkgRef = db.collection('packages').doc(packageId);
          // eslint-disable-next-line no-await-in-loop
          await rootPkgRef.set(newPackage);
        }

        results.push({
          ok: true,
          packageId,
          trackingNumber: upperTrackingNumber,
          carrier: ext.carrier,
          title: ext.title
        });
      }

      const primary = results[0];
      res.status(200).json({
        ...primary,
        packages: results
      });
    } catch (err) {
      console.error('[InboundEmailHandler] Error processing email:', err);
      // Return 200 with error flag to prevent infinite webhook retries
      res.status(200).json({ ok: false, error: err.message || 'Internal error' });
    }
  };
}
