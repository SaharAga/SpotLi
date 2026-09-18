import { detectCarrier, sanitizeTrackingNumber } from './carrierDetector.js';
import { detectStore } from './storeDetector.js';
import { getCarrier, CARRIER_LIST } from '../types/carriers.js';
import { sanitizeString } from './packageValidator.js';
import { toLocalISODate } from './dateUtils.js';
import { extractAndScoreCandidates, classifyConfidenceTier } from './candidateScorer.js';
import { extractOpeningHours } from './openingHoursService.js';

/** Known shortened domains used by Israeli & Global logistics providers and SMS gateways */
export const SHORT_DOMAINS = [
  'chtr.co.il',
  'slnk.to',
  'is.gd',
  'bit.ly',
  'tinyurl.com',
  't.ly',
  'rb.gy',
  'bityl.co',
  'sm-s.co',
  'sms-i.co',
  '1click.co.il',
  'link.buzzr.co.il'
];

/** Carrier mappings for dedicated courier short-link domains */
export const CARRIER_SHORT_DOMAINS = {
  'chtr.co.il': 'chita',
  'chita-il.com': 'chita',
  'chita.co.il': 'chita',
  'epost.co.il': 'hfd',
  'boxit.co.il': 'boxit',
  'buzzr.co.il': 'buzzr',
  'link.buzzr.co.il': 'buzzr',
  'tapuzdelivery.co.il': 'tapuz',
  'tapuz.co.il': 'tapuz',
  'bardistribution.co.il': 'bar-distribution',
  'barexpress.co.il': 'bar-distribution',
  'tracking.lionwheel.com': 'lionwheel'
};

/** Common query parameter names used for tracking or delivery IDs */
const SHORT_TRACKING_QUERY_PARAMS = [
  'b', 'num', 't', 'track', 'tracking', 'id', 'code', 'item', 'barcode', 'itemcode', 'order',
  'tradeId', 'orderId', 'outPackageId', 'trade_no', 'mailNo', 'mailNoList'
];

/**
 * Checks if a given string/URL is a shortened URL.
 * @param {string} urlString 
 * @returns {boolean}
 */
export function isShortenedUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;

  try {
    const raw = urlString.trim();
    const formatted = raw.startsWith('http') ? raw : `https://${raw}`;
    const parsed = new URL(formatted);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    return SHORT_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/**
 * Returns a carrier hint if the URL domain is a dedicated courier domain.
 * @param {string} urlString 
 * @returns {string|null} Carrier ID or null
 */
export function extractCarrierFromShortUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return null;

  try {
    const raw = urlString.trim();
    const formatted = raw.startsWith('http') ? raw : `https://${raw}`;
    const parsed = new URL(formatted);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    for (const [domain, carrierId] of Object.entries(CARRIER_SHORT_DOMAINS)) {
      if (host === domain || host.endsWith(`.${domain}`)) {
        return carrierId;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Extracts potential tracking identifier embedded in URL path or query parameters.
 * @param {string} urlString 
 * @returns {string|null} Extracted identifier or null
 */
export function extractIdentifierFromShortUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return null;

  try {
    const raw = urlString.trim();
    const formatted = raw.startsWith('http') ? raw : `https://${raw}`;
    const parsed = new URL(formatted);

    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const isShortOrCourier = SHORT_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`)) ||
      Object.keys(CARRIER_SHORT_DOMAINS).some(domain => host === domain || host.endsWith(`.${domain}`));

    // 1. Check query parameters (valid for known carriers or short URLs)
    for (const param of SHORT_TRACKING_QUERY_PARAMS) {
      const val = parsed.searchParams.get(param);
      if (val && val.trim().length >= 4 && val.trim().length <= 40) {
        const sanitized = sanitizeTrackingNumber(val);
        if (sanitized) return sanitized;
      }
    }

    // 2. Check path segments ONLY for verified short-link or courier domains
    if (!isShortOrCourier) {
      return null;
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      const isWebFile = /\.(?:html?|php|jsp|aspx?|do)$/i.test(last);
      const isEndpointName = /^(?:detail|index|home|track|tracking|trace|view|package|orders?|logistics)$/i.test(last);
      if (!isWebFile && !isEndpointName && last && last.length >= 4 && last.length <= 40) {
        const sanitized = sanitizeTrackingNumber(last);
        if (sanitized && /^[A-Z0-9_-]+$/.test(sanitized)) {
          return sanitized;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Known Carrier URL Patterns with their extraction rules and carrier hints
 */
export const CARRIER_URL_RULES = [
  // Israel Post (mypost.israelpost.co.il, israelpost.co.il, postil.com)
  {
    carrierId: 'israel-post',
    hostPattern: /(?:mypost\.israelpost\.co\.il|israelpost\.co\.il|postil\.com)/i,
    paramNames: ['itemcode', 'item', 'barcode', 'num', 'track', 'tracking', 'id', 'code', 'awb', 'b', 't'],
    pathPatterns: [
      /\/itemtrace[/?#]?.*?[?&](?:itemcode|item|barcode|num|track|id)=([A-Z0-9_-]+)/i,
      /\/itemtrace\/([A-Z0-9_-]+)/i,
      /\/item\/([A-Z0-9_-]+)/i,
      /\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // YDM Group. Only the feedback host is listed: their tracking links are
  // `ilto.run/<code>` short URLs whose path is a message id, and that domain has
  // not been confirmed as YDM-exclusive — mapping a shortener to one carrier
  // would misattribute every other sender that uses it.
  {
    carrierId: 'ydm',
    hostPattern: /ydm-?feedback\.co\.il/i,
    paramNames: [],
    pathPatterns: []
  },
  // Focus Logistics (focuslogistics.co.il)
  {
    carrierId: 'focus',
    hostPattern: /focuslogistics\.co\.il/i,
    paramNames: ['num', 'track', 'tracking', 'barcode', 'id', 'code'],
    pathPatterns: [/\/tracking\/([A-Z0-9_-]+)/i]
  },
  // Chita Delivery / Cheetah (chtr.co.il, chita-il.com, chita.co.il)
  {
    carrierId: 'chita',
    hostPattern: /(?:chtr\.co\.il|chita(?:-il)?\.co\.il|chita-il\.com)/i,
    paramNames: ['b', 'num', 'track', 'tracking', 'barcode', 'id', 'item', 't', 'code'],
    pathPatterns: [
      /\/runportal\/tracking\?num=([A-Z0-9_-]+)/i,
      /\/runportal\/tracking\/([A-Z0-9_-]+)/i,
      /\/runportal\/track\/([A-Z0-9_-]+)/i,
      /\/tracking\/([A-Z0-9_-]+)/i,
      /\/t\/([A-Z0-9_-]+)/i,
      /\/([A-Z0-9_-]{6,30})/i
    ]
  },
  // HFD / E-Post (hfd.co.il, epost.co.il, tracking.hfd.co.il)
  {
    carrierId: 'hfd',
    hostPattern: /(?:hfd\.co\.il|epost\.co\.il|tracking\.hfd\.co\.il)/i,
    paramNames: ['t', 'num', 'track', 'tracking', 'barcode', 'id', 'item', 'code', 'b'],
    pathPatterns: [
      /\/tracking\/([A-Z0-9_-]+)/i,
      /\/track\/([A-Z0-9_-]+)/i,
      /\/t\/([A-Z0-9_-]+)/i,
      /\/e\/([A-Z0-9_-]+)/i
    ]
  },
  // BoxIt (boxit.co.il)
  {
    carrierId: 'boxit',
    hostPattern: /boxit\.co\.il/i,
    paramNames: ['b', 'num', 'code', 'track', 'tracking', 'id', 't'],
    pathPatterns: [
      /\/tracking\/([A-Z0-9_-]+)/i,
      /\/b\/([A-Z0-9_-]+)/i,
      /\/lockers\/([A-Z0-9_-]+)/i
    ]
  },
  // Buzzr (buzzr.co.il, link.buzzr.co.il)
  {
    carrierId: 'buzzr',
    hostPattern: /(?:buzzr\.co\.il|link\.buzzr\.co\.il)/i,
    paramNames: ['num', 'track', 'code', 'id', 'b', 't'],
    pathPatterns: [
      /\/track\/([A-Z0-9_-]+)/i,
      /\/tracking\/([A-Z0-9_-]+)/i,
      /\/b\/([A-Z0-9_-]+)/i
    ]
  },
  // Tapuz Delivery (tapuzdelivery.co.il, tapuz.co.il)
  {
    carrierId: 'tapuz',
    hostPattern: /(?:tapuzdelivery\.co\.il|tapuz\.co\.il)/i,
    paramNames: ['num', 'track', 'code', 'id', 'b', 't'],
    pathPatterns: [
      /\/tracking\/([A-Z0-9_-]+)/i,
      /\/track\/([A-Z0-9_-]+)/i,
      /\/%D7%90%D7%99%D7%A4%D7%94-%D7%94%D7%97%D7%91%D7%99%D7%9C%D7%94-%D7%A9%D7%9C%D7%99\/\?num=([A-Z0-9_-]+)/i
    ]
  },
  // Bar Distribution (bardistribution.co.il, barexpress.co.il, bar-express.co.il)
  {
    carrierId: 'bar-distribution',
    hostPattern: /(?:bardistribution\.co\.il|barexpress\.co\.il|bar-express\.co\.il)/i,
    paramNames: ['track', 'tracknum', 'num', 'code', 'barcode', 'id'],
    pathPatterns: [
      /\/track\?track=([A-Z0-9_-]+)/i,
      /\/track\/([A-Z0-9_-]+)/i,
      /\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // LionWheel (lionwheel.com, tracking.lionwheel.com)
  {
    carrierId: 'lionwheel',
    hostPattern: /(?:lionwheel\.com|tracking\.lionwheel\.com)/i,
    paramNames: ['order', 'orderId', 'num', 'track', 'id'],
    pathPatterns: [
      /\/orders\/([A-Z0-9_-]+)/i,
      /\/tracking\/([A-Z0-9_-]+)/i,
      /\/track\/([A-Z0-9_-]+)/i
    ]
  },
  // Flying Cargo (flying-cargo.com)
  {
    carrierId: 'flying-cargo',
    hostPattern: /flying-cargo\.com/i,
    paramNames: ['n', 'num', 'track', 'tracking', 'awb', 'id', 't'],
    pathPatterns: [
      /\/tracking\/([A-Z0-9_-]+)/i,
      /\/track\/([A-Z0-9_-]+)/i
    ]
  },
  // Cargo Express (cargoexpress.co.il)
  {
    carrierId: 'cargo',
    hostPattern: /cargoexpress\.co\.il/i,
    paramNames: ['tracknum', 'num', 'track', 'tracking', 'id', 't'],
    pathPatterns: [
      /\/track\/([A-Z0-9_-]+)/i,
      /\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // ZigZag (zigzag24.co.il, zigzag.co.il)
  {
    carrierId: 'zigzag',
    hostPattern: /zigzag(?:24)?\.co\.il/i,
    paramNames: ['code', 'num', 'track', 'tracking', 'id', 't'],
    pathPatterns: [
      /\/track\/([A-Z0-9_-]+)/i,
      /\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // GetPackage (getpackage.com)
  {
    carrierId: 'getpackage',
    hostPattern: /getpackage\.com/i,
    paramNames: ['id', 'num', 'track', 'tracking', 'code', 't'],
    pathPatterns: [
      /\/tracking\/([A-Z0-9_-]+)/i,
      /\/track\/([A-Z0-9_-]+)/i
    ]
  },
  // Orian (orian.com)
  {
    carrierId: 'orian',
    hostPattern: /orian\.com/i,
    paramNames: ['num', 'track', 'tracking', 'id', 'awb', 't'],
    pathPatterns: [
      /\/track\/([A-Z0-9_-]+)/i,
      /\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // AliExpress / Cainiao (aliexpress.com, cainiao.com, global.cainiao.com)
  {
    carrierId: 'cainiao',
    hostPattern: /(?:cainiao\.com|aliexpress\.com)/i,
    paramNames: ['tradeId', 'orderId', 'outPackageId', 'trade_no', 'mailNoList', 'mailNo', 'tracking', 'track', 'num', 'id', 'code', 'awb', 't'],
    pathPatterns: [
      /\/detail\/([A-Z0-9_-]+)/i,
      /\/trace\/([A-Z0-9_-]+)/i,
      /\/newDetail\.htm\?mailNoList=([A-Z0-9_-]+)/i
    ]
  },
  // SHEIN (shein.com)
  {
    carrierId: 'shein',
    hostPattern: /shein\.com/i,
    paramNames: ['track', 'tracking', 'order', 'num', 'id'],
    pathPatterns: [
      /\/orders\/detail\/([A-Z0-9_-]+)/i,
      /\/user\/orders\/detail\/([A-Z0-9_-]+)/i,
      /\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // 4PX (4px.com)
  {
    carrierId: '4px',
    hostPattern: /4px\.com/i,
    paramNames: ['keyword', 'track', 'tracking', 'num', 'id', 't'],
    pathPatterns: [
      /\/track\/([A-Z0-9_-]+)/i
    ]
  },
  // DHL (dhl.com)
  {
    carrierId: 'dhl',
    hostPattern: /dhl\.com/i,
    paramNames: ['AWB', 'awb', 'tracking-id', 'trackingNumber', 'num', 'track', 't'],
    pathPatterns: [
      /\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // FedEx (fedex.com)
  {
    carrierId: 'fedex',
    hostPattern: /fedex\.com/i,
    paramNames: ['trknbr', 'tracknumbers', 'trackingNumber', 'num', 'track', 't'],
    pathPatterns: [
      /\/fedextrack\/([A-Z0-9_-]+)/i
    ]
  },
  // UPS (ups.com)
  {
    carrierId: 'ups',
    hostPattern: /ups\.com/i,
    paramNames: ['tracknum', 'tracknum1', 'track', 'tracking', 'id', 't'],
    pathPatterns: [
      /\/track\/([A-Z0-9_-]+)/i
    ]
  },
  // USPS (usps.com, tools.usps.com)
  {
    carrierId: 'usps',
    hostPattern: /usps\.com/i,
    paramNames: ['tLabels', 'track', 'tracking', 'num', 'id', 't'],
    pathPatterns: [
      /\/TrackConfirmAction\?tLabels=([A-Z0-9_-]+)/i
    ]
  },
  // YunExpress (yunexpress.com, yuntrack.com)
  {
    carrierId: 'yunexpress',
    hostPattern: /(?:yunexpress\.com|yuntrack\.com)/i,
    paramNames: ['pNumbers', 'pNumber', 'num', 'track', 'tracking', 't'],
    pathPatterns: [
      /\/parcelTracking\?pNumbers=([A-Z0-9_-]+)/i
    ]
  },
  // Yanwen (yw56.com.cn, yanwen.com.cn)
  {
    carrierId: 'yanwen',
    hostPattern: /(?:yw56\.com\.cn|yanwen\.com\.cn)/i,
    paramNames: ['num', 'nums', 'track', 'tracking', 'id', 't'],
    pathPatterns: [
      /\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // Royal Mail (royalmail.com)
  {
    carrierId: 'royal-mail',
    hostPattern: /royalmail\.com/i,
    paramNames: ['track', 'tracking', 'num', 'id', 't'],
    pathPatterns: [
      /\/tracking-results\/([A-Z0-9_-]+)/i
    ]
  },
  // Aramex (aramex.com)
  {
    carrierId: 'aramex',
    hostPattern: /aramex\.com/i,
    paramNames: ['ShipmentNumber', 'shipmentNumber', 'num', 'track', 'tracking', 'awb', 'id', 't'],
    pathPatterns: [
      /\/track\/results\/([A-Z0-9_-]+)/i
    ]
  }
];

/** Generic query parameters often used for tracking numbers */
const GENERIC_TRACKING_PARAMS = [
  'track', 'tracking', 'num', 'code', 't', 'id', 'barcode', 'item', 'awb', 'b',
  'itemcode', 'mailNoList', 'mailNo', 'trknbr', 'tLabels', 'pNumbers', 'ShipmentNumber', 'tracknum', 'order'
];


/**
 * Known Hebrew courier phrasing signatures mapped to carrier IDs
 */
const HEBREW_CARRIER_PHRASES = [
  { carrierId: 'chita', patterns: [/מחברת\s*צ['׳`״’‘]יטה/i, /מצ['׳`״’‘]יטה/i, /חברת\s*צ['׳`״’‘]יטה/i, /צ['׳`״’‘]יטה\s*שליחויות/i, /שליחויות\s*צ['׳`״’‘]יטה/i, /שליח\s*צ['׳`״’‘]יטה/i, /צ['׳`״’‘]יטה\s*שופס/i, /צ['׳`״’‘]יטה/i, /chita/i] },
  { carrierId: 'israel-post', patterns: [/מדואר\s*ישראל/i, /דואר\s*ישראל/i, /מחברת\s*דואר\s*ישראל/i, /israel\s*post/i, /israelpost/i] },
  { carrierId: 'hfd', patterns: [/מחברת\s*HFD/i, /מ-?HFD/i, /אי-?פוסט/i, /HFD\s*שליחויות/i, /e-?post/i, /משלוח\s*HFD/i, /HFD/i] },
  { carrierId: 'boxit', patterns: [/מחברת\s*בוקסיט/i, /מ-?BoxIt/i, /בוקסיט/i, /boxit/i, /חבילת\s*בוקסיט/i] },
  { carrierId: 'buzzr', patterns: [/באזר\s*שליחויות/i, /מחברת\s*באזר/i, /מבאזר/i, /משלוח\s*Buzzr/i, /משלוח\s*באזר/i, /buzzr/i] },
  { carrierId: 'tapuz', patterns: [/תפוז\s*שליחויות/i, /מחברת\s*תפוז/i, /מתפוז/i, /משלוח\s*תפוז/i, /tapuz\s*delivery/i, /tapuz/i] },
  { carrierId: 'bar-distribution', patterns: [/בר\s*הפצה/i, /מחברת\s*בר\s*הפצה/i, /מבר\s*הפצה/i, /חברת\s*בר\s*הפצה/i, /bar\s*distribution/i, /barexpress/i] },
  { carrierId: 'lionwheel', patterns: [/ליאון\s*וויל/i, /מליאון\s*וויל/i, /lionwheel/i] },
  { carrierId: 'flying-cargo', patterns: [/פליינג\s*קרגו/i, /flying\s*cargo/i, /פדאקס\s*ישראל/i] },
  // "חברת ההפצה CARGO" — the brand appears bare, so the bare form must match.
  // Anchored to a distribution-company phrase or the carrier's own host, since
  // "cargo" is an ordinary English word and Flying Cargo is a separate carrier.
  { carrierId: 'cargo', patterns: [/קרגו\s*שליחויות/i, /cargo\s*express/i, /חברת\s*ה?הפצה\s*CARGO/i, /cargo-?ship/i] },
  // Same shape as CARGO above: "פוקוס" is an ordinary Hebrew word, so the bare
  // form is deliberately absent — it is matched only where a distribution
  // company is being named, or by the carrier's own host.
  { carrierId: 'focus', patterns: [/חברת\s*ה?הפצה\s*["'״׳’]?\s*פוקוס/i, /מחברת\s*פוקוס/i, /פוקוס\s*לוגיסטיק/i, /focus\s*logistics/i, /focuslogistics/i] },
  // "קבוצת YDM" is how their messages sign off. Unlike פוקוס or CARGO the bare
  // token is not an ordinary word in either language, so it needs no phrase
  // anchor — the risk here is the opposite one, a brand written only as an
  // acronym being missed.
  { carrierId: 'ydm', patterns: [/קבוצת\s*YDM/i, /\bYDM\b/, /ydm-?feedback/i] },
  { carrierId: 'getpackage', patterns: [/גט\s*פקג['׳`״’‘]/i, /getpackage/i] },
  { carrierId: 'zigzag', patterns: [/זיגזג\s*שליחויות/i, /שליח\s*זיגזג/i, /זיגזג/i, /zigzag/i] },
  { carrierId: 'orian', patterns: [/אוריאן/i, /orian/i] },
  { carrierId: 'exelot', patterns: [/אקסלוט/i, /exelot/i] },
  // Generic Israeli postal phrases — placed after named couriers so messages like
  // "בר הפצה - דבר דואר BAR..." correctly attribute to the named courier rather
  // than defaulting to Israel Post.
  { carrierId: 'israel-post', patterns: [/דבר\s*דואר/i, /חבילת\s*דואר/i, /סניף\s*הדואר/i, /סוכנות\s*(?:ה)?דואר/i, /מרכז\s*המסירה\s*בדואר/i, /יחידת\s*(?:ה)?דואר/i] },
  // Global carriers. Israeli users receive these notifications in English as
  // often as in Hebrew, and without a brand phrase their bare-digit waybills
  // (DHL 10, FedEx 12) have no corroboration at all.
  // The ambiguous three-letter brands are matched case-sensitively so that
  // "groups", "backups" and "ups and downs" don't register as a carrier.
  { carrierId: 'dhl', patterns: [/\bdhl\b/i, /די\s*(?:איי?ט?ש|איי?ץ|אץ)['׳`״’‘]?\s*אל/i] },
  { carrierId: 'fedex', patterns: [/\bfedex\b/i, /\bfed\s*ex\b/i, /פדאקס/i, /פדקס/i] },
  { carrierId: 'ups', patterns: [/\bUPS\b/, /יו\s*פי\s*אס/i] },
  { carrierId: 'usps', patterns: [/\bUSPS\b/i, /united\s*states\s*postal/i] },
  { carrierId: 'aramex', patterns: [/\baramex\b/i, /ארامקס/i, /ארמקס/i] },
  { carrierId: 'royal-mail', patterns: [/\broyal\s*mail\b/i] },
  { carrierId: 'cainiao', patterns: [/\bcainiao\b/i, /קאיניאו/i] },
  { carrierId: 'yunexpress', patterns: [/\byun\s*express\b/i] },
  { carrierId: '4px', patterns: [/\b4px\b/i] }
];

const REDIRECT_PARAM_NAMES = new Set([
  'url', 'target', 'dest', 'destination', 'redirect', 'redirect_url',
  'link', 'r', 'u', 'to', 'next', 'forward', 'target_url', 'click_url',
  'orig_url', 'uri', 'goto'
]);

/**
 * Attempts to decode a URL component and returns a clean http(s) URL if valid.
 * Handles single and double percent-encoded URLs.
 * @param {string} val
 * @returns {string|null}
 */
function tryDecodeUrl(val) {
  if (!val || typeof val !== 'string') return null;
  let decoded = val.trim();
  try {
    if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
      decoded = decodeURIComponent(decoded);
      if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
        decoded = decodeURIComponent(decoded);
      }
    }
  } catch {}

  if (/^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(decoded)) {
    return decoded;
  }
  return null;
}

/**
 * Unwraps nested or redirect URLs generated by email service providers (SendGrid, Klaviyo, AliExpress, Shein, Amazon).
 * @param {string} url
 * @param {number} [maxDepth=3]
 * @returns {string|null} Unwrapped target URL, or null if no redirect parameter found.
 */
export function unwrapRedirectUrl(url, maxDepth = 3) {
  if (!url || typeof url !== 'string') return null;

  let currentUrl = url.trim();
  let unwrapped = null;

  for (let depth = 0; depth < maxDepth; depth++) {
    try {
      const fullUrl = currentUrl.startsWith('http') ? currentUrl : `https://${currentUrl}`;
      const parsed = new URL(fullUrl);

      let extracted = null;

      // 1. Check known redirect parameter keys
      for (const [key, val] of parsed.searchParams.entries()) {
        const lowerKey = key.toLowerCase();
        if (REDIRECT_PARAM_NAMES.has(lowerKey)) {
          const candidate = tryDecodeUrl(val);
          if (candidate) {
            extracted = candidate;
            break;
          }
        }
      }

      // 2. Fallback: inspect parameter values for embedded http/https
      if (!extracted) {
        for (const [_, val] of parsed.searchParams.entries()) {
          if (/https?%3A|https?:\/\//i.test(val)) {
            const candidate = tryDecodeUrl(val);
            if (candidate) {
              extracted = candidate;
              break;
            }
          }
        }
      }

      if (extracted && extracted !== currentUrl) {
        unwrapped = extracted;
        currentUrl = extracted;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  return unwrapped;
}

/**
 * Extracts tracking numbers and carrier hints embedded inside URLs/links from SMS & emails.
 * @param {string} text 
 * @returns {Array<{ trackingNumber: string, carrierHint?: string }>}
 */
export function extractUrlsAndTrackings(text) {
  if (!text || typeof text !== 'string') return [];

  const results = [];
  const seenTrackings = new Set();

  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'`()[\]{}]+/gi;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const rawUrl = match[0].replace(/[.,;:!?]+$/, '');
    const unwrapped = unwrapRedirectUrl(rawUrl);
    const urlsToInspect = unwrapped && unwrapped !== rawUrl ? [unwrapped, rawUrl] : [rawUrl];

    for (const urlCandidate of urlsToInspect) {
      let parsedUrl = null;

      try {
        const fullUrl = urlCandidate.startsWith('http') ? urlCandidate : `https://${urlCandidate}`;
        parsedUrl = new URL(fullUrl);
      } catch {
        continue;
      }

      const host = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname;
    const searchParams = parsedUrl.searchParams;

    let matchedRule = null;
    for (const rule of CARRIER_URL_RULES) {
      if (rule.hostPattern.test(host)) {
        matchedRule = rule;
        break;
      }
    }

    let foundTracking = '';
    let carrierHint = matchedRule ? matchedRule.carrierId : (extractCarrierFromShortUrl(rawUrl) || undefined);

    if (matchedRule) {
      for (const param of matchedRule.paramNames) {
        const val = searchParams.get(param);
        if (val && val.trim().length >= 4 && val.trim().length <= 35) {
          foundTracking = val.trim();
          break;
        }
      }

      if (!foundTracking && matchedRule.pathPatterns) {
        for (const pattern of matchedRule.pathPatterns) {
          const pathMatch = pattern.exec(rawUrl) || pattern.exec(pathname);
          if (pathMatch && pathMatch[1] && pathMatch[1].trim().length >= 4) {
            foundTracking = pathMatch[1].trim();
            break;
          }
        }
      }
    }

    if (!foundTracking) {
      const shortId = extractIdentifierFromShortUrl(rawUrl);
      if (shortId) {
        foundTracking = shortId;
      }
    }

    if (!foundTracking) {
      for (const param of GENERIC_TRACKING_PARAMS) {
        const val = searchParams.get(param);
        if (val && val.trim().length >= 4 && val.trim().length <= 35) {
          const cleanedVal = val.trim();
          if (/^[A-Za-z0-9_-]+$/.test(cleanedVal)) {
            foundTracking = cleanedVal;
            break;
          }
        }
      }
    }

    if (!foundTracking) {
      const pathSegments = pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment && lastSegment.length >= 6 && lastSegment.length <= 35) {
          if (/^[A-Za-z0-9_-]+$/.test(lastSegment)) {
            const testCandidate = detectCarrier(lastSegment);
            if (testCandidate.confidence !== 'none' || /^[A-Za-z]{2}\d{9}[A-Za-z]{2}$/.test(lastSegment)) {
              foundTracking = lastSegment;
            }
          }
        }
      }
    }

      if (foundTracking && !seenTrackings.has(foundTracking)) {
        seenTrackings.add(foundTracking);
        const resItem = { trackingNumber: foundTracking };
        if (carrierHint) {
          resItem.carrierHint = carrierHint;
        }
        results.push(resItem);
        break;
      }
    }
  }

  return results;
}

/**
 * Extracts collection PIN / Locker Code from Hebrew and English SMS/Notification text.
 * @param {string} text 
 * @returns {string}
 */
export function extractLockerPin(text) {
  if (!text || typeof text !== 'string') return '';

  const patterns = [
    /(?:קוד\s*(?:לפתיחת\s*(?:ה)?לוקר|סודי\s*לפתיחה|לפתיחה|לאיסוף|איסוף|לוקר|סודי|פתיחה|משיכה|אימות|פתיחת\s*תא|אימות\s*לאיסוף|מסירה|איסוף\s*חבילה))[\s:-]+([A-Za-z0-9]{3,8})\b/i,
    /(?:קוד)[\s:-]+([A-Za-z0-9]{4,8})\b/i,
    /(?:pickup\s*(?:pin|code)|collection\s*(?:pin|code)|locker\s*(?:pin|code|password)|pin\s*code|\bpin|entry\s*code)[\s:-]+([A-Za-z0-9]{3,8})\b/i
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const pin = match[1].trim();
      if (pin && !/^(?:http|https|code|pin|null|undefined)$/i.test(pin)) {
        return pin;
      }
    }
  }

  return '';
}

/**
 * Extracts shelf number (מדף / מספר איסוף) from Hebrew and English SMS/notification text.
 * Examples: מדף ג693, מדף: 412, מספר מדף: ג-693, במדף 12ב, shelf 42, bin #12
 * @param {string} text 
 * @returns {string}
 */
export function extractShelfNumber(text) {
  if (!text || typeof text !== 'string') return '';

  const patterns = [
    /(?:(?:מספר\s+|מס['׳]?\s+)?(?:ב)?מדף(?:\s*(?:מספר|מס['׳]?))?)[\s:#*-]+([א-ת0-9]{1,4}(?:[/-][א-ת0-9]{1,4})?|[א-ת]?\d{1,4}[א-ת]?)(?:[^\S\r\n]|$|[.,;!])/i,
    /(?:\b(?:shelf|bin)\s*(?:number|no|num|#)?)[\s:#*-]+([a-z0-9]{1,4}(?:-[a-z0-9]{1,4})?|[a-z]?\d{1,4}[a-z]?)(?:[^\S\r\n]|$|[.,;!])/i
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const shelf = match[1].trim();
      if (shelf && !/^(?:http|https|null|undefined)$/i.test(shelf)) {
        return shelf;
      }
    }
  }

  return '';
}

/**
 * Extracts pickup location or locker info from Hebrew and English SMS/Email text snippets.
 * @param {string} text 
 * @returns {string}
 */
export function extractPickupLocation(text) {
  if (!text || typeof text !== 'string') return '';

  const patterns = [
    /(?:נקודת\s*איסוף|בנקודת\s*איסוף|נקודת\s*מסירה|בנקודת\s*מסירה|מרכז\s*מסירה|במרכז\s*מסירה|בלוקר|לוקר|ביחידת\s*(?:ה)?דואר|יחידת\s*(?:ה)?דואר|בסוכנות\s*(?:ה)?דואר|סוכנות\s*(?:ה)?דואר|בסניף\s*מסירה|סניף\s*מסירה|בסניף|סניף|בכתובת|כתובת\s*לאיסוף|בחנות|בבית\s*עסק|נקודת\s*חלוקה|בנקודת\s*חלוקה|איסוף\s*מ|מחכה\s*לך\s*ב|(?:ממתינה|ממתין)\s*לך\s*ב|נמצאת\s*ב)[\s:-]+([^,.\r\n]{2,60})/i,
    /(?:waiting\s+(?:for\s+you\s+)?at\s+(?:the\s+)?(?:pickup\s+point|locker|branch)|at\s+(?:the\s+)?pickup\s+point|at\s+(?:the\s+)?locker|at\s+(?:the\s+)?branch|pickup\s+location|pickup\s+point|locker\s+location|waiting\s+(?:for\s+you\s+)?at)[\s:-]+([^,.\r\n]{2,60})/i
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      let loc = match[1].trim();
      loc = loc.replace(/^(?:(?:at\s+)?(?:the\s+)?(?:pickup\s+point|pickup\s+location|locker|branch)[\s:-]*)+/i, '');
      loc = loc.replace(/(?:\s*[-–—|/.]?\s*(?:שעות\s*פתיחה|שעות\s*פעילות|קוד\s*איסוף|קוד\s*לאיסוף|קוד|טלפון|טל|בירורים|לינק|כתובת|הוראות|phone|tel|hours|open\s+until|open|pin|code|http|https).*)$/i, '');
      loc = loc.replace(/^['":\-–—\s]+|['":\-–—\s]+$/g, '');
      if (loc && loc.length >= 2 && !/^(?:http|https|www|israelpost|hfd|boxit|chita|buzzr)$/i.test(loc)) {
        return loc;
      }
    }
  }

  return '';
}

/**
 * Extracts a store, courier, or pickup contact phone number from text.
 * Handles Israeli landline formats (02/03/04/08/09-XXXXXXX), mobile (05X-XXXXXXX),
 * VoIP/special (07X-XXXXXXX, 1-700/1-800), and international (+972...).
 * @param {string} text
 * @returns {string}
 */
export function extractPickupPhone(text) {
  if (!text || typeof text !== 'string') return '';

  const patterns = [
    /(?:טלפון(?:\s*לבירורים|\s*ליצירת\s*קשר|\s*סניף|\s*חנות)?|טל['׳]|נייד|שליח\s*בטלפון|בירורים(?:\s*במוקד)?|מוקד|phone|tel|call)[\s:-]+(\+?972[- ]?[0-9]{1,2}[- ]?[0-9]{3}[- ]?[0-9]{4}|0[2-9][- ]?[0-9]{7}|05[0-9][- ]?[0-9]{7}|1-[78]00[- ]?[0-9]{3}[- ]?[0-9]{3})\b/i,
    /(?:\+972[- ]?[2-9][- ]?[0-9]{7}|0[23489][- ]?[0-9]{7}|05[0-9][- ]?[0-9]{7}|1-[78]00[- ]?[0-9]{3}[- ]?[0-9]{3})\b/
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const phone = match[1].trim().replace(/[^\d+]/g, '');
      if (phone.length >= 7 && phone.length <= 15) {
        return match[1].trim();
      }
    } else if (match && match[0]) {
      const phone = match[0].trim().replace(/[^\d+]/g, '');
      if (phone.length >= 7 && phone.length <= 15) {
        return match[0].trim();
      }
    }
  }

  return '';
}

/**
 * Detects whether a delivery was rerouted / redirected to an alternate pickup point.
 * Extracts the redirect flag, reason, and original location if mentioned.
 * @param {string} text
 * @returns {{ isRedirected: boolean, originalPickupLocation?: string, redirectReason?: string, newPickupLocation?: string }}
 */
export function extractRedirectInfo(text) {
  if (!text || typeof text !== 'string') return { isRedirected: false };

  // Prefix reason with original location, e.g.:
  // "בשל עומס בלוקר דיזנגוף סנטר, חבילתך 509482019 הועברה לנקודת איסוף מכולת העיר בוגרשוב 12. קוד: 8192."
  const prefixRedirectMatch = /(?:בשל|עקב)\s*(?:עומס|ביקוש|תפוסה|סגירה|תקלה|אילוץ\s*תפעולי)\s*(?:בלוקר|בסניף|בנקודת\s*איסוף|ב)?\s*([^,.\r\n]+?)\s*,\s*(?:(?:החבילה|חבילתך|המשלוח|משלוח)\s*[A-Za-z0-9_-]*\s*)?(?:הועברה|הופנתה|נותבה|נשלחה)\s*(?:ל|אל)?\s*(?:נקודת\s*איסוף|סניף|לוקר|חנות)?[\s:-]+([^,.\r\n]{2,60})/i.exec(text);
  if (prefixRedirectMatch && prefixRedirectMatch[1] && prefixRedirectMatch[2]) {
    let origLoc = prefixRedirectMatch[1].trim().replace(/^['":\-–—\s()]+|['":\-–—\s()]+$/g, '');
    origLoc = origLoc.replace(/^(?:לוקר|סניף|נקודת\s*איסוף)\s*/i, '');
    let newLoc = prefixRedirectMatch[2].trim().replace(/(?:\s*[-–—|/]?\s*(?:שעות\s*פתיחה|קוד\s*איסוף|קוד|שעות\s*פעילות|טלפון|phone|hours).*)$/i, '').replace(/^['":\-–—\s()]+|['":\-–—\s()]+$/g, '');
    return {
      isRedirected: true,
      newPickupLocation: newLoc,
      originalPickupLocation: origLoc || undefined,
      redirectReason: /(?:עומס|capacity|overflow)/i.test(text) ? 'locker_capacity' : 'operational'
    };
  }

  const redirectPatterns = [
    /(?:עקב|בשל)\s*(?:עומס|ביקוש|תפוסה|סגירה|תקלה|אילוץ\s*תפעולי)[^.\r\n]*?(?:הועברה|הופנתה|נותבה|נשלחה)\s*(?:ל|אל)?\s*(?:נקודת\s*איסוף|סניף|לוקר|חנות)?[\s:-]+([^,.\r\n]{2,60})/i,
    /(?:נקודת\s*(?:ה)?איסוף\s*(?:שונתה|הוחלפה|עודכנה)\s*(?:ל|אל)?[\s:-]+)([^,.\r\n]{2,60})/i,
    /(?:הועברה\s*לנקודת\s*איסוף\s*חלופית[\s:-]+)([^,.\r\n]{2,60})/i,
    /(?:חבילתך\s*הועברה\s*(?:ל|אל)?\s*(?:נקודת\s*איסוף|סניף|לוקר)?[\s:-]+)([^,.\r\n]{2,60})/i,
    /(?:(?:redirected|rerouted|transferred)\s+(?:to\s+(?:pickup\s+(?:point|location)|locker|branch)?|at)[\s:-]+)([^,.\r\n]{2,60})/i,
    /(?:pickup\s+(?:point|location)\s+(?:changed|redirected|updated)\s+to[\s:-]+)([^,.\r\n]{2,60})/i
  ];

  for (const pattern of redirectPatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      let newLoc = match[1].trim();
      // Remove trailing parenthetical or "instead of" clause from the new location string
      newLoc = newLoc.replace(/(?:\s*\(?(?:במקום|במקור|instead\s+of).*\)?)$/i, '');
      newLoc = newLoc.replace(/(?:\s*[-–—|/]?\s*(?:שעות\s*פתיחה|קוד\s*איסוף|שעות\s*פעילות|טלפון|phone|hours).*)$/i, '');
      newLoc = newLoc.replace(/^['":\-–—\s()]+|['":\-–—\s()]+$/g, '');

      let origLoc = '';
      const origMatch = /(?:במקום|במקור|originally|instead\s+of)[\s:-]+([^,.)\r\n]{2,60})/i.exec(text);
      if (origMatch && origMatch[1]) {
        origLoc = origMatch[1].trim().replace(/^['":\-–—\s()]+|['":\-–—\s()]+$/g, '');
      }

      return {
        isRedirected: true,
        newPickupLocation: newLoc,
        originalPickupLocation: origLoc || undefined,
        redirectReason: /(?:עומס|capacity|overflow)/i.test(text) ? 'locker_capacity' : 'operational'
      };
    }
  }

  if (/(?:הועברה\s*לנקודת\s*איסוף\s*חלופית|עקב\s*עומס\s*בלוקר|שונתה\s*נקודת\s*האיסוף|package\s*redirected|was\s*redirected|rerouted\s*to\s*alternate)/i.test(text)) {
    return {
      isRedirected: true,
      redirectReason: /(?:עומס|capacity|overflow)/i.test(text) ? 'locker_capacity' : 'operational'
    };
  }

  return { isRedirected: false };
}

/**
 * Extracts potential tracking numbers from unstructured text with OTP and false-positive suppression.
 * @param {string} text 
 * @returns {string[]}
 */
export function extractTrackingCandidates(text) {
  if (!text || typeof text !== 'string') return [];

  const candidates = new Set();

  // 1. If text has HTML tags, extract href links and unwrap redirects
  let workingText = text;
  if (/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["']/i.test(text)) {
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(text)) !== null) {
      const href = linkMatch[1];
      if (href && !href.startsWith('mailto:') && !href.startsWith('javascript:')) {
        const unwrapped = unwrapRedirectUrl(href);
        if (unwrapped) {
          workingText += ` ${unwrapped} `;
        }
        workingText += ` ${href} `;
      }
    }
  }

  // Extract tracking numbers from Schema.org script tags if present in pasted HTML
  if (/<script[^>]*type=["']application\/ld\+json["']/i.test(text)) {
    const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    while ((scriptMatch = scriptRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(scriptMatch[1].trim());
        const traverse = (obj) => {
          if (!obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) return obj.forEach(traverse);
          if (obj['@graph'] && Array.isArray(obj['@graph'])) obj['@graph'].forEach(traverse);
          if (typeof obj.trackingNumber === 'string' && obj.trackingNumber.trim().length >= 4) {
            candidates.add(obj.trackingNumber.trim());
          }
          if (obj.orderDelivery) traverse(obj.orderDelivery);
        };
        traverse(parsed);
      } catch {}
    }
  }

  const urlExtracted = extractUrlsAndTrackings(workingText);
  for (const item of urlExtracted) {
    if (item.trackingNumber) {
      candidates.add(item.trackingNumber);
    }
  }
  
  const labeledRegex = /(?:tracking(?:\s*number|\s*no|\s*code|\s*id|\s*#)?|מעקב(?:\s*משלוח|\s*הזמנה)?|מספר\s*מעקב|חבילה\s*מספר|מס['׳`״’‘]\s*מעקב|קוד\s*מעקב|מספר\s*משלוח|משלוח\s*מספר|דבר\s*דואר(?:\s*שמספרו)?|חבילתך\s*יצאה(?:\s*במשלוח)?|חבילתך\s*במספר|החבילה\s*שלך\s*מחכה(?:\s*במספר)?|איסוף\s*חבילה(?:\s*מספר)?|קוד\s*חבילה|קוד\s*משלוח|ברקוד(?:\s*משלוח)?|שליח\s*בדרך(?:\s*משלוח)?|order\s*#|shipment\s*#|package\s*id|waybill|awb)[\s:=#-]+([A-Za-z0-9_-]{5,35})/gi;
  let match;
  while ((match = labeledRegex.exec(workingText)) !== null) {
    if (match[1]) {
      const candidate = match[1].trim();
      if (!/^(?:number|no|code|id|pin|null|undefined)$/i.test(candidate)) {
        candidates.add(candidate);
      }
    }
  }

  const words = workingText.replace(/[,;:"'()<>[\]{}?&=/\\#%*+!|`^~]/g, ' ').split(/\s+/);
  for (const word of words) {
    const cleaned = word.trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    if (!cleaned) continue;

    // Suppress phone numbers
    if (/^(?:\+?972|0)(?:5[0-9]|7[0-9]|[23489])\d{7}$/.test(cleaned)) {
      continue;
    }

    // Suppress OTP verification codes
    if (/^\d{4,8}$/.test(cleaned)) {
      const idx = workingText.indexOf(cleaned);
      if (idx !== -1) {
        const window = workingText.slice(Math.max(0, idx - 40), Math.min(workingText.length, idx + cleaned.length + 40));
        if (/(?:קוד\s*אימות|קוד\s*חד-?פעמי|אימות\s*חשבון|verification\s*code|otp|security\s*code)/i.test(window)) {
          continue;
        }
      }
    }

    if (/^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(cleaned)) candidates.add(cleaned.toUpperCase());
    else if (/^1Z[0-9A-Z]{16}$/i.test(cleaned)) candidates.add(cleaned.toUpperCase());
    else if (/^(LP|CAINIAO|GSH)\d+|AE[A-Z0-9]{8,20}/i.test(cleaned)) candidates.add(cleaned.toUpperCase());
    else if (/^S\d{10,20}$/i.test(cleaned)) candidates.add(cleaned.toUpperCase());
    else if (/^4PX\d{10,}/i.test(cleaned)) candidates.add(cleaned.toUpperCase());
    else if (/^YT\d{16,18}$/i.test(cleaned)) candidates.add(cleaned.toUpperCase());
    else if (/^(CH|CT|CHT|CHTR|HFD|EP|BOX|BX|TPZ|YDM|TAPUZ|CRG|CARGO|GP|GET|FC|OR|ORN|BAR|BD|ZZ|ZIG|LW|LION|BZR|BUZZR|BZ|XLT)\d{6,14}$/i.test(cleaned)) candidates.add(cleaned.toUpperCase());
    else if (/^\d{8,22}$/.test(cleaned) && (cleaned.length === 8 || cleaned.length === 9 || cleaned.length === 10 || cleaned.length === 12 || cleaned.length === 14 || cleaned.length === 15 || cleaned.length === 16 || cleaned.length === 18 || cleaned.length === 20 || cleaned.length === 22)) candidates.add(cleaned);
  }

  return Array.from(candidates);
}

/**
 * Detects courier from Hebrew phrasing signatures in SMS or notification text.
 * @param {string} text 
 * @returns {string|null}
 */
export function detectCarrierFromPhrasing(text) {
  if (!text || typeof text !== 'string') return null;

  for (const entry of HEBREW_CARRIER_PHRASES) {
    for (const pattern of entry.patterns) {
      if (pattern.test(text)) {
        return entry.carrierId;
      }
    }
  }

  return null;
}

/**
 * Extracts delivery/pickup dates and status cues from text.
 * Handles relative dates ("היום", "מחר") and explicit dates (DD/MM/YYYY, DD/MM).
 *
 * @param {string} text
 * @returns {{ expectedDeliveryDate?: string, orderDate?: string, statusHint?: string }}
 */
export function extractDatesAndStatus(text) {
  if (!text || typeof text !== 'string') return {};

  const now = new Date();
  const todayISO = toLocalISODate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = toLocalISODate(tomorrow);

  // 1. Relative dates with delivery phrasing
  if (/(?:תסופק היום|יסופק היום|היום עם שליח|השליח בדרך אליך היום|בדרך אליך היום|מגיע היום|צפוי להגיע היום|מתוכנן להגיע היום|מתוכננת להגיע היום|היום בין השעות|delivered today|out for delivery today)/i.test(text)) {
    return { expectedDeliveryDate: todayISO, statusHint: 'out_for_delivery' };
  }

  if (/(?:תסופק מחר|יסופק מחר|מחר עם שליח|מגיע מחר|צפוי להגיע מחר|מחר בין השעות|delivered tomorrow)/i.test(text)) {
    return { expectedDeliveryDate: tomorrowISO, statusHint: 'out_for_delivery' };
  }

  // 2. Explicit arrival/delivery dates: e.g. "הגיעה ב19/08", "הגיע ב-19/08", "הגיעה ב- 19.08", "נמסרה ב 19/08"
  const arrivalMatch = /(?:הגיע[הה]?\s*(?:ב|בתאריך|-)?\s*|נמסר[הה]?\s*(?:ב|בתאריך|-)?\s*|סופק[הה]?\s*(?:ב|בתאריך|-)?\s*)(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/i.exec(text);
  if (arrivalMatch) {
    const day = parseInt(arrivalMatch[1], 10);
    const month = parseInt(arrivalMatch[2], 10);
    let year = arrivalMatch[3] ? parseInt(arrivalMatch[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isLockerOrPickup = /(?:לוקר|נקודת|סניף|מרכז\s*מסירה|איסוף|pickup|locker|למקום)/i.test(text);
      return {
        expectedDeliveryDate: dateStr,
        orderDate: dateStr,
        statusHint: isLockerOrPickup ? 'ready_for_pickup' : 'delivered'
      };
    }
  }

  // 3. Explicit expected delivery date: e.g. "צפוי להגיע ב-25/08", "מועד משוער: 25/08/2026"
  const expectedMatch = /(?:צפוי[הה]?\s*להגיע\s*(?:ב|בתאריך|-)?\s*|מועד\s*(?:ה)?אספקה\s*(?:משוער)?[:\s-]*|משלוח\s*צפוי\s*עד[:\s-]*)(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/i.exec(text);
  if (expectedMatch) {
    const day = parseInt(expectedMatch[1], 10);
    const month = parseInt(expectedMatch[2], 10);
    let year = expectedMatch[3] ? parseInt(expectedMatch[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        expectedDeliveryDate: dateStr,
        statusHint: 'in_transit'
      };
    }
  }

  return {};
}

/**
 * Intelligently parses raw email, SMS, or notification text to construct a package payload.
 * @param {string} rawText 
 * @returns {object} Partial package data extracted from text
 */
/**
 * Strips characters that carry no meaning but change every string comparison.
 *
 * Hebrew messages containing Latin tracking numbers are full of bidi control
 * marks — a sender's client inserts them around the Latin run so it displays
 * correctly right-to-left. They are invisible, the user cannot remove them,
 * and they sit exactly where the parser looks for a word boundary. The same
 * goes for non-breaking spaces out of HTML email bodies and zero-width joiners
 * from emoji-capable clients.
 *
 * Normalising once here, rather than defending against them in each pattern,
 * means every extraction path benefits and no future rule has to remember.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeMessageText(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    // Bidi controls and zero-width characters: invisible, and never part of
    // an identifier.
    .replace(/[\u200B-\u200F\u061C\u2066-\u2069\uFEFF]/g, '')
    // Every other Unicode space behaves as a separator but fails /\s/-adjacent
    // assumptions and exact-match comparisons.
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // A tab is a separator that no sender means anything by, but it is not a
    // space to any pattern that looks for one — an identifier printed in
    // groups ("rs 7361 0294 1 il") stops being re-joinable the moment its
    // separators are tabs.
    .replace(/\t/g, ' ')
    // Runs of horizontal whitespace collapse; newlines are meaningful for
    // pickup-location and address extraction, so they survive.
    .replace(/ {2,}/g, ' ');
}

/**
 * Words that end a merchant name rather than belong to it.
 *
 * A merchant name runs until the sentence resumes, and in Hebrew it resumes
 * with a verb or a preposition. Without this, "מ- LA BEAUTE הגיע לחברת ההפצה"
 * reads the whole clause as the shop's name.
 */
const MERCHANT_STOP_WORDS = new Set([
  'הגיע', 'הגיעה', 'הגיעו', 'נמסר', 'נמסרה', 'נמסרו', 'נשלח', 'נשלחה', 'נקלט',
  'נקלטה', 'יצא', 'יצאה', 'עבר', 'עברה', 'התקבל', 'התקבלה', 'יונח', 'תימסר',
  'ממתין', 'ממתינה', 'ממתינים', 'מחכה', 'בדרך', 'עבור', 'אל', 'אליך', 'אליכם',
  'מספר', "מס'", 'מס', 'שמספרה', 'שמספרו', 'שמספר', 'למעקב', 'לכתובת', 'לחברת', 'לנקודת', 'ללוקר',
  'לסניף', 'בקישור', 'באתר', 'תודה', 'שלום', 'היי', 'מבקש', 'מבקשת', 'מבקשים', 'לספק', 'למסור'
]);

/**
 * Every display name a courier goes by, for rejecting a courier sitting in the
 * merchant slot.
 *
 * The carrier *phrase* list cannot serve here: a name that is also an ordinary
 * word — פוקוס, CARGO — is deliberately listed there only with an anchor like
 * "חברת ההפצה", so bare "שליח של פוקוס" would sail past it and be filed as the
 * shop. Matching the catalogue's own names instead catches the bare form, which
 * is exactly the case that matters in this slot.
 */
const CARRIER_DISPLAY_NAMES = new Set(
  CARRIER_LIST.flatMap((carrier) => [carrier.name, carrier.hebrewName, carrier.logoText])
    .filter(Boolean)
    .map((name) => name.trim().toLowerCase())
);

/** Words that mean the slot holds a courier or a place, not a shop. */
const NOT_A_MERCHANT = /^(?:ה?לוקר|ה?שליח|ה?סניף|ה?נקודת|ה?דואר|ה?מחסן|ה?חנות|ה?כתובת|ה?חברת)/i;

/**
 * Reads a merchant name off the start of `rest`, stopping where the sentence
 * resumes.
 *
 * @param {string} rest text immediately after the "from" prefix
 * @returns {string} the merchant, or '' when the slot holds something else
 */
function readMerchantWords(rest) {
  const line = rest.split(/[\n.,:;!?"״]/)[0] || '';
  const words = line.trim().split(/\s+/).filter(Boolean);

  const taken = [];
  for (const word of words) {
    if (taken.length >= 4) break;
    if (MERCHANT_STOP_WORDS.has(word)) break;
    // A word that is only punctuation or a bare number is not part of a name.
    if (!/[A-Za-z\u0590-\u05FF]/.test(word)) break;
    taken.push(word);
    if (taken.join(' ').length > 40) break;
  }

  const candidate = taken.join(' ').trim();
  if (!candidate || candidate.length < 2 || candidate.length > 40) return '';
  if (NOT_A_MERCHANT.test(candidate)) return '';
  // Reject something shaped like a tracking number, not merely something long:
  // with the /i flag `[A-Z0-9_-]` matches letters, so this used to drop any
  // single-word shop of eight letters or more ("BeautyBar"). Requiring a digit
  // keeps RS736102941IL out while letting a real name through.
  if (/^(?=[A-Z0-9_-]*\d)[A-Z0-9_-]{8,}$/i.test(candidate)) return '';
  return candidate;
}

export function parseSmartText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      title: '',
      titleHe: '',
      trackingNumber: '',
      carrier: 'other',
      carrierName: getCarrier('other').name,
      category: 'other',
      origin: '',
      destination: 'Israel',
      notes: '',
      notesHe: '',
      pickupLocation: '',
      lockerPin: '',
      shelfNumber: '',
      store: '',
      storeHe: '',
      storeInfo: null
    };
  }

  const cleanText = normalizeMessageText(sanitizeString(rawText, 5000));
  // `extractAndScoreCandidates` is the single extraction path. The older
  // `extractTrackingCandidates` produced a parallel, unscored candidate set
  // whose result was already unused here; calling it only invited the two
  // lists to drift apart. It survives as an exported helper for its own tests.
  const scoredCandidates = extractAndScoreCandidates(cleanText).map((candidate) => ({
    ...candidate,
    status: classifyConfidenceTier(candidate.score, candidate)
  }));
  const urlExtracted = extractUrlsAndTrackings(cleanText);
  const pickupLocation = extractPickupLocation(cleanText);
  const redirectInfo = extractRedirectInfo(cleanText);
  const effectivePickupLocation = redirectInfo.newPickupLocation || pickupLocation;
  const pickupHours = extractOpeningHours(cleanText);
  const pickupPhone = extractPickupPhone(cleanText);
  const lockerPin = extractLockerPin(cleanText);
  const shelfNumber = extractShelfNumber(cleanText);
  const phraseCarrier = detectCarrierFromPhrasing(cleanText);

  let bestTracking = '';
  let bestCarrier = phraseCarrier || 'other';

  const urlCarrier = urlExtracted.find((u) => u.carrierHint && u.carrierHint !== 'other')?.carrierHint;

  // 1. Preferred: High-confidence candidate from calibrated candidate scorer
  if (scoredCandidates.length > 0 && scoredCandidates[0].score > 0) {
    const top = scoredCandidates[0];
    bestTracking = top.value;
    const detected = detectCarrier(bestTracking);
    const hasDistinctivePrefix = /[A-Z]/i.test(bestTracking) || top.checksum === 'pass';
    const topCarrier = (phraseCarrier && phraseCarrier !== 'other')
      ? phraseCarrier
      : (urlCarrier && urlCarrier !== 'other' && !hasDistinctivePrefix)
        ? urlCarrier
        : (top.carrierCandidates && top.carrierCandidates[0] && top.carrierCandidates[0] !== 'other')
          ? top.carrierCandidates[0]
          : (urlCarrier && urlCarrier !== 'other')
            ? urlCarrier
            : (detected.carrierId !== 'other' ? detected.carrierId : 'other');
    // A bare digit run tells you nothing about which carrier issued it. Ten
    // digits matches DHL and twelve matches FedEx, so "שליחות 7920079333" —
    // an Israeli courier's own job number — was being labelled DHL purely on
    // length. Without a carrier phrase, a carrier host or a passing check
    // digit, the honest answer is that the carrier is unknown: the package is
    // still saved and still tracked manually, but it is not filed under a
    // carrier it never touched.
    // `distinctive` answers "is this a shipment id", which an explicit
    // "מספר מעקב"/"חבילה שמספרה" label settles on its own. It does not answer
    // "which carrier issued it", and using it for both is how a bare
    // ten-digit number in an H&M dispatch SMS came back labelled DHL — the
    // number matched DHL *and* Aramex, and the first of the two won. When more
    // than one carrier claims the shape, the value distinguishes none of them.
    // Restricted to all-digit values on purpose. A letter-bearing id carries
    // real carrier evidence in the letters themselves (UB…YP is Yanwen,
    // LP…CN is Cainiao) even when several patterns happen to match its shape;
    // widening this to every multi-match value sent both of those to 'other'.
    // A bare digit run has no such evidence to offer.
    const shapeMatchesSeveralCarriers = (top.carrierCandidates?.length ?? 0) > 1
      && !/[A-Z]/i.test(String(top.value || ''));
    const carrierIsGuessedFromShape = (top.distinctive === false || shapeMatchesSeveralCarriers)
      && !phraseCarrier
      && !urlCarrier
      && top.checksum !== 'pass';

    bestCarrier = carrierIsGuessedFromShape ? 'other' : topCarrier;
  } else {
    // 2. URL extracted tracking codes and carrier hints fallback
    for (const item of urlExtracted) {
      if (item.trackingNumber) {
        const detection = detectCarrier(item.trackingNumber);
        const effectiveCarrier = item.carrierHint || phraseCarrier || detection.carrierId;
        if (effectiveCarrier && effectiveCarrier !== 'other') {
          bestTracking = item.trackingNumber;
          bestCarrier = effectiveCarrier;
          break;
        } else if (!bestTracking) {
          bestTracking = item.trackingNumber;
        }
      }
    }
  }

  /**
   * Merchant named by sentence shape rather than by catalogue.
   *
   * `detectStore` recognises a fixed list of large retailers. Most Israeli
   * courier SMS name a shop that will never be on such a list — the reported
   * case was "חבילה מSeestarz online מספר 48094292", a small store whose name
   * the message states outright while the app titled the package
   * "Package 48094292" and showed no merchant at all.
   *
   * The grammar is the signal: "<parcel> from <merchant> number <id>". Reading
   * the slot between the two keywords needs no catalogue and so works for a
   * shop nobody has heard of, which is the whole point.
   */
  const extractMerchantPhrase = (text) => {
    // The merchant sits on either side of the number, and both shapes are
    // common in real Israeli courier SMS:
    //
    //   A  "חבילה מSeestarz online מספר 48094292 נמסרה"     before it
    //   B  "מספר משלוח 4046309 מ- LA BEAUTE הגיע לחברת..."   after it
    //
    // Shape A alone was matched first, which read Seestarz correctly and left
    // LA BEAUTE unnamed. What both share is the `מ` prefix; what differs is
    // only where the number sits, so anchor on the prefix and read forward.
    // The two anchors are deliberately not equally permissive. Shape A is
    // introduced by a parcel noun and closed by מספר, so a מ attached straight
    // to Hebrew ("מקפה עלית") is safely read as the prefix. Shape B has no such
    // bracket: the word after the number can be any Hebrew verb that simply
    // begins with מ, and "מספר 12345678 ממתינה" was read as a shop called
    // "מתינה". So there, the prefix must announce itself — a maqaf or hyphen, a
    // space, or a Latin letter — and an attached Hebrew word is left alone.
    const anchors = [
      // `(?!ספר|ס')` keeps the parcel noun from pairing with the מ of מספר
      // itself: "החבילה מספר 12345678" was otherwise read as a shop called ספר.
      /(?:ה)?(?:חבילה|משלוח|הזמנה|שליחות)\s+מ(?!ספר|ס')[־-]?\s*/i,
      /(?:מספר|מס')\s*(?:משלוח|חבילה|הזמנה)?\s*[A-Za-z0-9-]{4,}\s+(?:מאת\s+|מ(?:[־-]\s*|\s+|(?=[A-Za-z])))/i,
      //   C  "שליח מטעם I-HERB בדרך אליך"                       named outright
      //
      // A handover SMS often names no parcel and no number at all, only who the
      // courier is carrying for. "מטעם"/"של" state the relationship explicitly,
      // so unlike the bare מ prefix above this one needs no bracketing keyword.
      /(?:ה)?שליח(?:ים|ות)?\s+(?:מטעם|של)\s+/i
    ];

    for (const anchor of anchors) {
      const match = anchor.exec(text);
      if (!match) continue;

      const rest = text.slice(match.index + match[0].length);
      const candidate = readMerchantWords(rest);
      // A courier carries *for* a shop, but the same sentence shape also
      // introduces the courier itself ("שליח מטעם קבוצת YDM"). A name the
      // carrier detector recognises is the delivery company, not the merchant —
      // and filing it as the shop would put the courier's name on the package.
      if (!candidate) continue;
      if (detectCarrierFromPhrasing(candidate)) continue;
      if (CARRIER_DISPLAY_NAMES.has(candidate.trim().toLowerCase())) continue;
      return candidate;
    }
    return '';
  };

  // Detect merchant / store
  const storeInfo = detectStore(cleanText);
  let detectedStore = '';
  let detectedStoreHe = '';
  let category = 'other';

  if (storeInfo) {
    detectedStore = storeInfo.name;
    detectedStoreHe = storeInfo.hebrewName;
    if (['shein', 'asos', 'zara', 'next', 'terminalx'].includes(storeInfo.id)) {
      category = 'clothing';
    } else if (['amazon', 'ksp', 'ivory', 'apple'].includes(storeInfo.id)) {
      category = 'electronics';
    } else if (['aliexpress', 'temu'].includes(storeInfo.id)) {
      category = 'clothing';
    } else if (['iherb', 'superpharm'].includes(storeInfo.id)) {
      category = 'health';
    }
  } else {
    // Fallback only. A catalogue hit carries a Hebrew name, a brand colour and
    // an id the UI keys off; a phrase carries a name and nothing else, so it
    // must never displace one.
    const merchantPhrase = extractMerchantPhrase(cleanText);
    if (merchantPhrase) {
      detectedStore = merchantPhrase;
      detectedStoreHe = merchantPhrase;
    }
  }

  // Extract explicit product / item candidate from text if present
  const extractItemCandidate = (text) => {
    if (!text || typeof text !== 'string') return null;
    const quoteMatch = text.match(/["'״”]([^"'״”\n]{3,50})["'״”]/);
    if (quoteMatch && quoteMatch[1]) {
      const candidate = quoteMatch[1].trim();
      // Israeli courier SMS quote the *courier* — 'הגיע לחברת ההפצה "פוקוס"' —
      // and that quoted name was becoming the package's item description, so a
      // LA BEAUTE order was titled "פוקוס". What is quoted is only an item if
      // nothing right before it says a delivery company is being named.
      const before = text.slice(Math.max(0, quoteMatch.index - 40), quoteMatch.index);
      const namesACarrier = /(?:חברת|לחברת|באמצעות|ע["']?י)\s*(?:ה?הפצה|ה?משלוחים|ה?שליחויות|ה?שילוח)?\s*$/i.test(before);
      if (
        !namesACarrier &&
        !/^[A-Z0-9_-]{8,35}$/i.test(candidate) &&
        !/^(?:order|package|tracking|delivery|shipment|חבילה|משלוח|הזמנה|איסוף)/i.test(candidate) &&
        !/^https?:\/\//i.test(candidate)
      ) {
        return candidate;
      }
    }
    const labelMatch = text.match(/(?:item|product|מוצר|פריט|עבור|for)\s*[:：-]\s*([A-Za-z0-9\u0590-\u05FF\s-]{3,50})(?:[,\n.]|$)/i);
    if (labelMatch && labelMatch[1]) {
      const candidate = labelMatch[1].trim();
      if (
        !/^(?:order|package|tracking|delivery|shipment|pickup|חבילה|משלוח|הזמנה|איסוף)/i.test(candidate) &&
        !/^[A-Z0-9_-]{8,35}$/i.test(candidate)
      ) {
        return candidate;
      }
    }
    const parenMatch = text.match(/\(([A-Za-z0-9\u0590-\u05FF\s-]{3,40})\)/);
    if (parenMatch && parenMatch[1]) {
      const candidate = parenMatch[1].trim();
      if (
        !/^(?:מדף|סניף|לוקר|קוד|חבילה|מספר|order|package|shelf|code|\d+)/i.test(candidate) &&
        !/^[A-Z0-9_-]{8,35}$/i.test(candidate)
      ) {
        return candidate;
      }
    }
    return null;
  };

  const itemCandidate = extractItemCandidate(cleanText);

  // Extract order number if mentioned in text
  const orderMatch = cleanText.match(/(?:order\s*(?:id|#|no|number)?|מספר\s*הזמנה|הזמנה\s*מספר)\s*[:：#]?\s*([A-Za-z0-9-]{6,35})\b/i);
  const parsedOrderNumber = orderMatch ? orderMatch[1].trim() : undefined;

  // Determine Title
  let title = '';
  let titleHe = '';
  if (itemCandidate) {
    title = detectedStore ? `${detectedStore} - ${itemCandidate}` : itemCandidate;
    titleHe = (detectedStoreHe || detectedStore) ? `${detectedStoreHe || detectedStore} - ${itemCandidate}` : itemCandidate;
  } else if (detectedStore) {
    title = `${detectedStore} Order`;
    titleHe = `הזמנה מ-${detectedStoreHe || detectedStore}`;
  } else if (bestTracking) {
    // The whole tracking number, not the first eight characters plus a
    // literal ellipsis. This string is the package's stored name, and
    // CourierActionHub interpolates it into the WhatsApp/SMS message a user
    // sends a courier — "pick up package for Package RS948219..." names
    // nothing the courier can act on. The list view truncates for display.
    title = `Package ${bestTracking}`;
    titleHe = `חבילה ${bestTracking}`;
  } else {
    title = 'New Tracked Package';
    titleHe = 'חבילה חדשה למעקב';
  }

  const carrierObj = getCarrier(bestCarrier);

  // Construct notes snippet
  let notesText = cleanText;
  if (notesText.length > 300) {
    notesText = notesText.slice(0, 300) + '...';
  }
  const dateInfo = extractDatesAndStatus(cleanText);

  // Infer delivery status from text
  let status = dateInfo.statusHint || 'ordered';
  const lowerText = cleanText.toLowerCase();
  // Hebrew puts the verb first as readily as last: a real Israeli courier SMS
  // opens "נמסרה חבילה שמספרה …", which none of the subject-first phrasings
  // below matched, so a delivered package was filed as still in transit. Both
  // orders are accepted, but only when נמסר sits next to the noun — "נמסרה
  // לשליח" is a handover to the courier, which is out_for_delivery and is
  // matched further down.
  // No \b anywhere: it is defined on ASCII \w, so it never matches against a
  // Hebrew letter and silently kills the alternative it is attached to.
  //
  // The noun and the verb are not always adjacent either. A real Seestarz SMS
  // reads "חבילה מSeestarz online מספר 48094292 נמסרה" — merchant and number
  // sit between them — and was filed as in_transit for it. The gap is bounded
  // and tempered: it stops at a sentence break, so a חבילה in one sentence
  // cannot be paired with a נמסרה in the next, and it refuses to cross a
  // negation, so "החבילה לא נמסרה" and "טרם נמסרה" stay undelivered. That
  // negation guard is the whole cost of allowing a gap at all.
  //
  // `(?![\u0590-\u05FF])` pins the verb's suffix. Without it `[ההת]?` simply
  // backtracks to empty when the לשליח lookahead fails, matching the bare
  // נמסר inside נמסרה and reporting "נמסרה לשליח" — a handover to the courier
  // — as delivered. Caught by the test battery on the first run of this change.
  //
  // `לנקודת` joins `לשליח` as a destination that is not the recipient: a parcel
  // "נמסר לנקודת האיסוף" has been handed to a pickup point, which is
  // ready_for_pickup and is matched below.
  const deliveredHe = /(?:נמסרה בהצלחה|נמסר ליעד|(?:ה)?(?:חבילה|משלוח|הזמנה)(?:(?!לא\s|טרם\s|אינה\s|אינו\s|עדיין\s|[.!?\n])[\s\S]){0,60}?\s*נמסר[ההת]?(?![\u0590-\u05FF])(?!\s*ל(?:שליח|נקודת))|נמסר[ההת]?(?![\u0590-\u05FF])\s+(?:ה)?(?:חבילה|משלוח|הזמנה)(?!\s*ל(?:שליח|נקודת)))/i;

  // Three more ways a message says the delivery already happened, none of which
  // use נמסר at all. Each was a held-out corpus case reporting in_transit —
  // fixing a regex because a case there failed is what that corpus is for.
  //
  // - collected at the counter: "תודה שאספת את דבר הדואר …"      (Israel Post)
  // - the courier closed the job: "שליח דיווח ביצוע שליחות …"     (Bar Group)
  // - you are asked to rate the delivery: "איך היה עם השליח?"      (Cheetah)
  //
  // The third is the broadest and the most reliable: nobody is asked to rate a
  // courier before the courier has been. It is kept to explicit rating language
  // rather than any mention of a שליח, which would sweep up every message that
  // merely says one is on the way.
  const deliveredEventHe = /(?:תודה שאספת|תודה שאספתם|דיווח ביצוע|השליח דיווח שמסר|שליח דיווח על ביצוע שליחות|דיווח שמסר|נמסרה לדלת|נמסר לדלת|נמסרה ליד הדלת|נמסר ליד הדלת|איך היה עם השליח|משוב על השליח|לדרג את השליח|דירוג השליח|לדרג את חווית המשלוח|לדרג את חוויית המשלוח)/i;

  if (
    /\b(delivered|successfully delivered)\b/i.test(lowerText) ||
    deliveredHe.test(lowerText) ||
    deliveredEventHe.test(lowerText)
  ) {
    status = 'delivered';
  } else if (
    lockerPin ||
    redirectInfo.isRedirected ||
    /\b(ready for pickup|ready for collection|available for pickup|waiting for pickup|delivered to locker)\b/i.test(lowerText) ||
    /(?:מוכנה לאיסוף|מוכן לאיסוף|ממתינה לאיסוף|ממתין לאיסוף|ממתינה בלוקר|ממתין בלוקר|(?:ממתינה|ממתין|מחכה)\s*לך\s*ב[־-]?|הגיעה לנקודת|הגיע לנקודת|הגיע לסניף|הגיעה לסניף|הגיע לסוכנות|הגיעה לסוכנות|הגיעה ללוקר|הגיע ללוקר|הועברה ללוקר|הועברה לנקודת|מחכה לך בנקודת|מחכה לך בלוקר|מחכה בלוקר|מחכה לך בסניף|מדף\s*\d+|נמסר[ההת]?\s+לנקודת|הועבר[ההת]?\s+לנקודת|הגיע[הה]?\s+לנקודת)/i.test(lowerText)
  ) {
    status = 'ready_for_pickup';
  } else if (
    /\b(out for delivery|with courier)\b/i.test(lowerText) ||
    /(?:יוצאת למסירה|יוצא למסירה|יצאה עם שליח|נמסרה לשליח|יצא(?:ה)?\s*לאספקה|מתוכנן להגיע היום|מתוכננת להגיע היום|בדקות הקרובות|בשעה הקרובה|השליח בדרך אליך|שליח\s+[^\n]+בדרך אליך|תסופק היום|יסופק היום|היום עם שליח|מגיע היום|צפוי להגיע היום|מבקש(?:ים)?\s+(?:למסור|לספק)|בדרך למסור|נמסר[ההת]?\s+(?:ה)?(?:חבילה|משלוח|הזמנה)\s+לשליח)/i.test(lowerText)
  ) {
    status = 'out_for_delivery';
  } else if (/\b(delivery issue|delivery failed|customs clearance)\b/i.test(lowerText) || /(?:עיכוב במכס|בעיה במסירה|מסירה נכשלה|ניסינו למסור|ניסיון מסירה|לא היית בבית|לא היית בכתובת|לא נמצאת בכתובת|לא נמצאתם בכתובת)/i.test(lowerText)) {
    status = 'exception';
  } else if (
    bestTracking ||
    /\b(shipped|in transit|dispatched|on its way)\b/i.test(lowerText) ||
    /\b(?:shipping status (?:has been )?updated|new shipping information|shipping update|status update)\b/i.test(lowerText) ||
    /(?:נשלחה|נשלח|בדרך|עודכן סטטוס המשלוח|סטטוס המשלוח עודכן|עדכון סטטוס משלוח|פרטי משלוח חדשים|פרטי המשלוח עודכנו|עדכון לגבי המשלוח|עדכון על המשלוח|מחו"ל טרם הגיע למחסננו)/i.test(lowerText)
  ) {
    status = status === 'ordered' ? 'in_transit' : status;
  }

  const selectedCandidate = scoredCandidates.find((candidate) => candidate.value === bestTracking)
    || scoredCandidates[0]
    || null;
  let candidateStatus = selectedCandidate?.status || (lockerPin && phraseCarrier ? 'verified' : (bestTracking ? 'uncertain' : 'none'));

  // A carrier brand in the text says *which* carrier, not that the number
  // beside it is a shipment id — courier ads, delivery surveys and "we'll text
  // you when it ships" all name a carrier with no shipment behind them. So a
  // brand match corroborates a candidate that already has its own support, and
  // promotes it one step; it can no longer lift `uncertain` straight to the
  // tier Smart Import auto-fills from.
  if (bestTracking && (phraseCarrier || urlCarrier) && bestCarrier !== 'other' && candidateStatus === 'probable') {
    candidateStatus = 'verified';
  }

  // `none` means the evidence says this is not a tracking number. Publishing it
  // in `trackingNumber` anyway is how a parking fine or an invoice number ends
  // up saved as a package that will never update.
  if (candidateStatus === 'none') {
    bestTracking = '';
  }

  const allPackages = [];
  const verifiedCandidates = scoredCandidates.filter((c) => (c.score >= 0.80 && c.checksum !== 'fail') || c.schemaOrgMatch);
  const targetCandidates = verifiedCandidates.length > 0
    ? verifiedCandidates
    : (scoredCandidates.length > 0 && scoredCandidates[0].score >= 0.60 ? [scoredCandidates[0]] : []);

  const orderedCandidates = targetCandidates.length > 1
    ? [...targetCandidates].sort((a, b) => (a.sourceSpan?.start ?? 0) - (b.sourceSpan?.start ?? 0))
    : targetCandidates;

  const seenTracking = new Set();
  for (let idx = 0; idx < orderedCandidates.length; idx += 1) {
    const cand = orderedCandidates[idx];
    if (seenTracking.has(cand.value)) continue;
    seenTracking.add(cand.value);

    const tn = cand.value;
    const topCandCarrier = cand.carrierCandidates && cand.carrierCandidates[0];
    const candCarrier = (cand.distinctive && topCandCarrier)
      ? topCandCarrier
      : (bestCarrier !== 'other' ? bestCarrier : (topCandCarrier || 'other'));
    const candCarrierObj = getCarrier(candCarrier);

    let candTitle = title;
    let candTitleHe = titleHe;
    if (orderedCandidates.length > 1) {
      candTitle = detectedStore
        ? `${detectedStore} Order #${idx + 1} (${tn.slice(-4)})`
        : `Package ${tn}`;
      candTitleHe = detectedStore
        ? `הזמנה מ-${detectedStoreHe || detectedStore} #${idx + 1} (${tn.slice(-4)})`
        : `חבילה ${tn}`;
    }

    allPackages.push({
      title: candTitle,
      titleHe: candTitleHe,
      trackingNumber: tn,
      carrier: candCarrier,
      carrierName: candCarrierObj.name,
      category,
      status,
      origin: candCarrierObj.country || '',
      destination: 'Israel',
      expectedDeliveryDate: dateInfo.expectedDeliveryDate || undefined,
      orderDate: dateInfo.orderDate || undefined,
      notes: notesText,
      notesHe: notesText,
      pickupLocation: effectivePickupLocation,
      pickupHours,
      pickupPhone,
      pickupCode: lockerPin,
      lockerPin,
      shelfNumber,
      isRedirected: redirectInfo.isRedirected || false,
      originalPickupLocation: redirectInfo.originalPickupLocation || undefined,
      redirectReason: redirectInfo.redirectReason || undefined,
      store: detectedStore,
      storeHe: detectedStoreHe,
      storeInfo,
      orderNumber: parsedOrderNumber,
      candidateStatus: cand.status || 'verified',
      candidate: cand
    });
  }

  return {
    title,
    titleHe,
    orderNumber: parsedOrderNumber,
    trackingNumber: bestTracking,
    carrier: bestCarrier,
    carrierName: carrierObj.name,
    category,
    status,
    origin: carrierObj.country || '',
    destination: 'Israel',
    expectedDeliveryDate: dateInfo.expectedDeliveryDate || undefined,
    orderDate: dateInfo.orderDate || undefined,
    notes: notesText,
    notesHe: notesText,
    pickupLocation: effectivePickupLocation,
    pickupHours,
    pickupPhone,
    pickupCode: lockerPin,
    lockerPin,
    shelfNumber,
    isRedirected: redirectInfo.isRedirected || false,
    originalPickupLocation: redirectInfo.originalPickupLocation || undefined,
    redirectReason: redirectInfo.redirectReason || undefined,
    store: detectedStore,
    storeHe: detectedStoreHe,
    storeInfo,
    // Additive metadata for callers that need an accuracy-aware decision.
    // `trackingNumber` remains for backwards compatibility; Smart Import
    // gates unattended auto-fill on `candidateStatus` below.
    candidateStatus,
    candidates: scoredCandidates,
    allPackages
  };
}

/**
 * Extracts all tracking packages from input text for multi-package disaggregation.
 * @param {string} rawText
 * @returns {Array<object>}
 */
export function extractAllTrackingDetails(rawText) {
  const parsed = parseSmartText(rawText);
  return parsed.allPackages || [];
}

/**
 * The tracking numbers a parse found *besides* the one it ranked first.
 *
 * A courier handover SMS routinely names two: the courier's own tracking number
 * and the merchant's shipment number ("מספר שליחות: 19611199 / מספר מעקב:
 * GAIH50911204"). Which one scores higher is a ranking decision and says nothing
 * about which one the user already has on the dashboard, so both have to reach
 * the duplicate check — and both are worth keeping as aliases on a package that
 * really is new, so the next message about it matches whichever number it quotes.
 *
 * Only candidates the scorer actually accepted are returned. A number it rated
 * `uncertain` or `none`, or flagged as a false positive, is an order total or a
 * phone number far more often than an identifier, and an alias is persistent:
 * a wrong one silently attaches every future message carrying that number to
 * the wrong package.
 *
 * @param {object} parsed - a `parseSmartText` result
 * @returns {Array<string>} distinct alternates, best first, never including the primary
 */
export function alternateTrackingNumbers(parsed) {
  if (!parsed || !Array.isArray(parsed.candidates)) return [];

  // Same transform as deliveryService's normalizeTrackingNumber, inlined rather
  // than imported so a parser utility does not pull a storage service (and its
  // localStorage access) into every consumer. It is only used to compare
  // candidates against each other here; the match itself renormalizes.
  const canonicalize = (value) => (typeof value === 'string' ? value.replace(/[\s-]+/g, '').toUpperCase() : '');

  const primary = canonicalize(parsed.trackingNumber || '');
  const seen = new Set(primary ? [primary] : []);
  const alternates = [];

  for (const candidate of parsed.candidates) {
    if (!candidate?.value) continue;
    if (candidate.status !== 'probable') continue;
    if (candidate.falsePositiveFlags?.length) continue;

    const canonical = canonicalize(candidate.value);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    alternates.push(candidate.value);
  }

  return alternates;
}
