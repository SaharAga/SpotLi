import { detectCarrier, sanitizeTrackingNumber } from './carrierDetector.js';
import { detectStore } from './storeDetector.js';
import { getCarrier } from '../types/carriers.js';
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

    // 1. Check query parameters
    for (const param of SHORT_TRACKING_QUERY_PARAMS) {
      const val = parsed.searchParams.get(param);
      if (val && val.trim().length >= 4 && val.trim().length <= 40) {
        const sanitized = sanitizeTrackingNumber(val);
        if (sanitized) return sanitized;
      }
    }

    // 2. Check path segments (e.g. chtr.co.il/t/CH12345678 or chtr.co.il/12345678)
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
  { carrierId: 'chita', patterns: [/מחברת\s*צ['׳`״]יטה/i, /מצ['׳`״]יטה/i, /חברת\s*צ['׳`״]יטה/i, /צ['׳`״]יטה\s*שליחויות/i, /שליחויות\s*צ['׳`״]יטה/i, /שליח\s*צ['׳`״]יטה/i, /צ['׳`״]יטה\s*שופס/i, /צ['׳`״]יטה/i, /chita/i] },
  { carrierId: 'israel-post', patterns: [/מדואר\s*ישראל/i, /דואר\s*ישראל/i, /מחברת\s*דואר\s*ישראל/i, /דבר\s*דואר/i, /חבילת\s*דואר/i, /סניף\s*הדואר/i, /סוכנות\s*(?:ה)?דואר/i, /מרכז\s*המסירה\s*בדואר/i, /יחידת\s*(?:ה)?דואר/i] },
  { carrierId: 'hfd', patterns: [/מחברת\s*HFD/i, /מ-?HFD/i, /אי-?פוסט/i, /HFD\s*שליחויות/i, /e-?post/i, /משלוח\s*HFD/i, /HFD/i] },
  { carrierId: 'boxit', patterns: [/מחברת\s*בוקסיט/i, /מ-?BoxIt/i, /בוקסיט/i, /boxit/i, /חבילת\s*בוקסיט/i] },
  { carrierId: 'buzzr', patterns: [/באזר\s*שליחויות/i, /מחברת\s*באזר/i, /מבאזר/i, /משלוח\s*Buzzr/i, /משלוח\s*באזר/i, /buzzr/i] },
  { carrierId: 'tapuz', patterns: [/תפוז\s*שליחויות/i, /מחברת\s*תפוז/i, /מתפוז/i, /משלוח\s*תפוז/i, /tapuz\s*delivery/i, /tapuz/i] },
  { carrierId: 'bar-distribution', patterns: [/בר\s*הפצה/i, /מחברת\s*בר\s*הפצה/i, /מבר\s*הפצה/i, /חברת\s*בר\s*הפצה/i, /bar\s*distribution/i, /barexpress/i] },
  { carrierId: 'lionwheel', patterns: [/ליאון\s*וויל/i, /מליאון\s*וויל/i, /lionwheel/i] },
  { carrierId: 'flying-cargo', patterns: [/פליינג\s*קרגו/i, /flying\s*cargo/i, /פדאקס\s*ישראל/i] },
  { carrierId: 'cargo', patterns: [/קרגו\s*שליחויות/i, /cargo\s*express/i] },
  { carrierId: 'getpackage', patterns: [/גט\s*פקג['׳`״]/i, /getpackage/i] },
  { carrierId: 'zigzag', patterns: [/זיגזג\s*שליחויות/i, /שליח\s*זיגזג/i, /זיגזג/i, /zigzag/i] },
  { carrierId: 'orian', patterns: [/אוריאן/i, /orian/i] }
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
 * Extracts pickup location or locker info from Hebrew and English SMS/Email text snippets.
 * @param {string} text 
 * @returns {string}
 */
export function extractPickupLocation(text) {
  if (!text || typeof text !== 'string') return '';

  const patterns = [
    /(?:נקודת\s*איסוף|בנקודת\s*איסוף|נקודת\s*מסירה|בנקודת\s*מסירה|מרכז\s*מסירה|במרכז\s*מסירה|בלוקר|לוקר|ביחידת\s*(?:ה)?דואר|יחידת\s*(?:ה)?דואר|בסוכנות\s*(?:ה)?דואר|סוכנות\s*(?:ה)?דואר|בסניף\s*מסירה|סניף\s*מסירה|בסניף|סניף|בכתובת|כתובת\s*לאיסוף|בחנות|בבית\s*עסק|נקודת\s*חלוקה|בנקודת\s*חלוקה|איסוף\s*מ|מחכה\s*לך\s*ב|ממתינה\s*לך\s*ב|נמצאת\s*ב)[\s:-]+([^,.\r\n]{2,60})/i,
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
  
  const labeledRegex = /(?:tracking(?:\s*number|\s*no|\s*code|\s*id|\s*#)?|מעקב(?:\s*משלוח|\s*הזמנה)?|מספר\s*מעקב|חבילה\s*מספר|מס['׳`״]\s*מעקב|קוד\s*מעקב|מספר\s*משלוח|משלוח\s*מספר|דבר\s*דואר(?:\s*שמספרו)?|חבילתך\s*יצאה(?:\s*במשלוח)?|חבילתך\s*במספר|החבילה\s*שלך\s*מחכה(?:\s*במספר)?|איסוף\s*חבילה(?:\s*מספר)?|קוד\s*חבילה|קוד\s*משלוח|ברקוד(?:\s*משלוח)?|שליח\s*בדרך(?:\s*משלוח)?|order\s*#|shipment\s*#|package\s*id|waybill|awb)[\s:=#-]+([A-Za-z0-9_-]{5,35})/gi;
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
    else if (/^(CH|CT|CHT|CHTR|HFD|EP|BOX|BX|TPZ|YDM|TAPUZ|CRG|CARGO|GP|GET|FC|OR|ORN|BAR|BD|ZZ|ZIG|LW|LION|BZR|BUZZR|BZ)\d{6,14}$/i.test(cleaned)) candidates.add(cleaned.toUpperCase());
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
  if (/(?:תסופק היום|יסופק היום|היום עם שליח|השליח בדרך אליך היום|בדרך אליך היום|מגיע היום|צפוי להגיע היום|היום בין השעות|delivered today|out for delivery today)/i.test(text)) {
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
      store: '',
      storeHe: '',
      storeInfo: null
    };
  }

  const cleanText = sanitizeString(rawText, 5000);
  const candidates = extractTrackingCandidates(cleanText);
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
  const phraseCarrier = detectCarrierFromPhrasing(cleanText);

  let bestTracking = '';
  let bestCarrier = phraseCarrier || 'other';
  let bestConfidence = phraseCarrier ? 'medium' : 'none';

  const urlCarrier = urlExtracted.find((u) => u.carrierHint && u.carrierHint !== 'other')?.carrierHint;

  // 1. Preferred: High-confidence candidate from calibrated candidate scorer
  if (scoredCandidates.length > 0 && scoredCandidates[0].score > 0) {
    const top = scoredCandidates[0];
    bestTracking = top.value;
    const detected = detectCarrier(bestTracking);
    const topCarrier = (phraseCarrier && phraseCarrier !== 'other')
      ? phraseCarrier
      : (top.carrierCandidates && top.carrierCandidates[0] && top.carrierCandidates[0] !== 'other')
        ? top.carrierCandidates[0]
        : (urlCarrier && urlCarrier !== 'other')
          ? urlCarrier
          : (detected.carrierId !== 'other' ? detected.carrierId : 'other');
    bestCarrier = topCarrier;
    bestConfidence = top.highestConfidence || 'high';
  } else {
    // 2. URL extracted tracking codes and carrier hints fallback
    for (const item of urlExtracted) {
      if (item.trackingNumber) {
        const detection = detectCarrier(item.trackingNumber);
        const effectiveCarrier = item.carrierHint || phraseCarrier || detection.carrierId;
        if (effectiveCarrier && effectiveCarrier !== 'other') {
          bestTracking = item.trackingNumber;
          bestCarrier = effectiveCarrier;
          bestConfidence = 'high';
          break;
        } else if (!bestTracking) {
          bestTracking = item.trackingNumber;
        }
      }
    }
  }

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
  }

  // Determine Title
  let title = '';
  let titleHe = '';
  if (detectedStore) {
    title = `${detectedStore} Order`;
    titleHe = `הזמנה מ-${detectedStoreHe || detectedStore}`;
  } else if (bestTracking) {
    title = `Package ${bestTracking.slice(0, 8)}...`;
    titleHe = `חבילה ${bestTracking.slice(0, 8)}...`;
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
  if (/\b(delivered|successfully delivered)\b/i.test(lowerText) || /(?:נמסרה בהצלחה|נמסר ליעד|החבילה נמסרה)/i.test(lowerText)) {
    status = 'delivered';
  } else if (
    lockerPin ||
    redirectInfo.isRedirected ||
    /\b(ready for pickup|ready for collection|available for pickup|waiting for pickup|delivered to locker)\b/i.test(lowerText) ||
    /(?:מוכנה לאיסוף|מוכן לאיסוף|ממתינה לאיסוף|ממתין לאיסוף|ממתינה בלוקר|ממתין בלוקר|הגיעה לנקודת|הגיע לנקודת|הגיע לסניף|הגיעה לסניף|הגיע לסוכנות|הגיעה לסוכנות|הגיעה ללוקר|הגיע ללוקר|הועברה ללוקר|הועברה לנקודת|מחכה לך בנקודת|מחכה לך בלוקר|מחכה בלוקר|מחכה לך בסניף|מדף\s*\d+)/i.test(lowerText)
  ) {
    status = 'ready_for_pickup';
  } else if (
    /\b(out for delivery|with courier)\b/i.test(lowerText) ||
    /(?:יוצאת למסירה|יוצא למסירה|יצאה עם שליח|נמסרה לשליח|השליח בדרך אליך|שליח\s+[^\n]+בדרך אליך|תסופק היום|יסופק היום|היום עם שליח|מגיע היום|צפוי להגיע היום)/i.test(lowerText)
  ) {
    status = 'out_for_delivery';
  } else if (/\b(delivery issue|delivery failed|customs clearance)\b/i.test(lowerText) || /(?:עיכוב במכס|בעיה במסירה|מסירה נכשלה)/i.test(lowerText)) {
    status = 'exception';
  } else if (bestTracking || /\b(shipped|in transit|dispatched|on its way)\b/i.test(lowerText) || /(?:נשלחה|נשלח|בדרך)/i.test(lowerText)) {
    status = status === 'ordered' ? 'in_transit' : status;
  }

  const selectedCandidate = scoredCandidates.find((candidate) => candidate.value === bestTracking)
    || scoredCandidates[0]
    || null;
  let candidateStatus = selectedCandidate?.status || (lockerPin && phraseCarrier ? 'verified' : (bestTracking ? 'uncertain' : 'none'));
  if (bestTracking && (phraseCarrier || urlCarrier) && bestCarrier !== 'other' && candidateStatus !== 'none') {
    candidateStatus = 'verified';
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
    const candCarrier = (cand.carrierCandidates && cand.carrierCandidates[0]) || bestCarrier || 'other';
    const candCarrierObj = getCarrier(candCarrier);

    let candTitle = title;
    let candTitleHe = titleHe;
    if (orderedCandidates.length > 1) {
      candTitle = detectedStore
        ? `${detectedStore} Order #${idx + 1} (${tn.slice(-4)})`
        : `Package ${tn.slice(0, 8)}...`;
      candTitleHe = detectedStore
        ? `הזמנה מ-${detectedStoreHe || detectedStore} #${idx + 1} (${tn.slice(-4)})`
        : `חבילה ${tn.slice(0, 8)}...`;
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
      lockerPin,
      isRedirected: redirectInfo.isRedirected || false,
      originalPickupLocation: redirectInfo.originalPickupLocation || undefined,
      redirectReason: redirectInfo.redirectReason || undefined,
      store: detectedStore,
      storeHe: detectedStoreHe,
      storeInfo,
      candidateStatus: cand.status || 'verified',
      candidate: cand
    });
  }

  return {
    title,
    titleHe,
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
    lockerPin,
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
