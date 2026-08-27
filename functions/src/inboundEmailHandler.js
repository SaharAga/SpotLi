/**
 * Inbound Email Webhook Handler.
 *
 * Ingests forwarded shipping confirmation emails (from SendGrid Inbound Parse,
 * Mailgun, Postmark, or standard email webhooks), extracts carrier tracking
 * details, and saves the package directly to the user's Firestore collection.
 */

/**
 * Strips HTML tags and decodes common entities to produce clean plain text.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeEmailHtml(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

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
 * Regex patterns for common carriers and tracking numbers in emails.
 */
const TRACKING_PATTERNS = [
  // Israel Post / UPU S10 format (e.g., RR123456789IL, LP123456789CN)
  { carrier: 'israel-post', regex: /\b([A-Z]{2}\d{9}[A-Z]{2})\b/ },
  // Cheetah / Bar Distribution (IL local numeric)
  { carrier: 'cheetah', regex: /\b(CH\d{8,12})\b/i },
  // DHL Express (10 digits)
  { carrier: 'dhl', regex: /\b(\d{10})\b/ },
  // FedEx (12 or 15 digits)
  { carrier: 'fedex', regex: /\b(\d{12}|\d{15})\b/ },
  // UPS (1Z...)
  { carrier: 'ups', regex: /\b(1Z[0-9A-Z]{16})\b/i },
  // Cainiao / AliExpress standard
  { carrier: 'cainiao', regex: /\b(LP\d{14}|CN\d{13,16})\b/i }
];

/**
 * Extracts tracking details from email subject and body.
 * @param {string} subject
 * @param {string} body
 * @returns {{ trackingNumber: string|null, carrier: string, title: string }}
 */
export function extractTrackingDetails(subject = '', body = '') {
  const combinedText = `${subject} ${body}`.slice(0, 10000); // Cap to 10k chars against DoS
  
  let foundTracking = null;
  let foundCarrier = 'other';

  for (const { carrier, regex } of TRACKING_PATTERNS) {
    const match = combinedText.match(regex);
    if (match && match[1]) {
      foundTracking = match[1].toUpperCase();
      foundCarrier = carrier;
      break;
    }
  }

  // Derive a friendly title from subject or fallback
  let cleanTitle = subject
    .replace(/(fwd:|re:|fw:)/gi, '')
    .replace(/(order confirmation|shipping update|your order has shipped|נשלחה חבילה|אישור הזמנה)/gi, '')
    .trim();

  if (!cleanTitle || cleanTitle.length < 3) {
    cleanTitle = foundCarrier !== 'other' 
      ? `Package via ${foundCarrier.toUpperCase()}` 
      : 'New Online Order';
  }

  return {
    trackingNumber: foundTracking,
    carrier: foundCarrier,
    title: cleanTitle.slice(0, 80)
  };
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

      // Check if this is a Gmail Forwarding Confirmation email from Google
      const isGoogleForwarding = 
        /gmail forwarding confirmation/i.test(subject) ||
        /אישור העברה ב-Gmail/i.test(subject) ||
        /forwarding-noreply@google\.com/i.test(cleanText) ||
        /requested to automatically forward mail/i.test(cleanText);

      if (isGoogleForwarding) {
        const combined = `${cleanText} ${rawHtml}`;
        const linkMatch = combined.match(/https:\/\/(?:mail-settings\.google\.com|mail\.google\.com)\/mail\/vf-[a-zA-Z0-9_-]+/i);
        if (linkMatch && linkMatch[0]) {
          try {
            const verifyUrl = linkMatch[0];
            const resp = await fetch(verifyUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            const html = await resp.text();
            
            // If there is an action confirmation form, submit it
            const formMatch = html.match(/<form[^>]*action="([^"]*)"[^>]*>([\s\S]*?)<\/form>/i);
            if (formMatch) {
              const actionUrl = formMatch[1].startsWith('http') 
                ? formMatch[1] 
                : new URL(formMatch[1], verifyUrl).href;
              
              const inputs = {};
              const inputMatches = formMatch[2].matchAll(/<input[^>]*name="([^"]*)"[^>]*value="([^"]*)"/gi);
              for (const match of inputMatches) {
                inputs[match[1]] = match[2];
              }
              inputs['act'] = 'confirm';

              const bodyParams = new URLSearchParams(inputs);
              await fetch(actionUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                body: bodyParams.toString()
              });
            }

            res.status(200).json({ ok: true, type: 'google_forwarding_verified', url: verifyUrl });
            return;
          } catch (err) {
            console.error('[InboundEmailHandler] Failed to auto-confirm Gmail forwarding:', err);
          }
        }
      }

      if (!userId) {
        res.status(400).json({ error: 'Invalid or missing recipient ingestion token' });
        return;
      }

      const { trackingNumber, carrier, title } = extractTrackingDetails(subject, cleanText);

      if (!trackingNumber) {
        // Return 200 to acknowledge webhook receipt so provider doesn't re-deliver in a retry loop
        res.status(200).json({ 
          ok: false, 
          message: 'No tracking number recognized in email content' 
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
        status: 'ordered',
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
