import { detectCarrier } from './carrierDetector';
import { detectStore } from './storeDetector';
import { CARRIERS } from '../types/carriers';
import { sanitizeString } from './packageValidator';

/**
 * Known Carrier URL Patterns with their extraction rules and carrier hints
 */
const CARRIER_URL_RULES = [
  // Israel Post (mypost.israelpost.co.il, israelpost.co.il, postil.com)
  {
    carrierId: 'israel-post',
    hostPattern: /(?:israelpost\.co\.il|postil\.com)/i,
    paramNames: ['itemcode', 'item', 'barcode', 'num', 'track', 'tracking', 'id', 'code', 'awb', 'b', 't'],
    pathPatterns: [
      /\/itemtrace[/?#]?.*?[?&](?:itemcode|item|barcode|num|track|id)=([A-Z0-9_-]+)/i,
      /\/item\/([A-Z0-9_-]+)/i,
      /\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // HFD / E-Post (hfd.co.il, epost.co.il, tracking.hfd.co.il)
  {
    carrierId: 'hfd',
    hostPattern: /(?:hfd\.co\.il|epost\.co\.il)/i,
    paramNames: ['t', 'num', 'track', 'tracking', 'barcode', 'id', 'item', 'code', 'b'],
    pathPatterns: [
      /\/tracking\/([A-Z0-9_-]+)/i,
      /\/t\/([A-Z0-9_-]+)/i
    ]
  },
  // Chita Delivery (chita.co.il, chita-il.com)
  {
    carrierId: 'chita',
    hostPattern: /(?:chita(?:-il)?\.co\.il|chita-il\.com)/i,
    paramNames: ['b', 'num', 'track', 'tracking', 'barcode', 'id', 'item', 't'],
    pathPatterns: [
      /\/tracking\/([A-Z0-9_-]+)/i,
      /\/runportal\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // BoxIt (boxit.co.il)
  {
    carrierId: 'boxit',
    hostPattern: /boxit\.co\.il/i,
    paramNames: ['b', 'num', 'code', 'track', 'tracking', 'id', 't'],
    pathPatterns: [
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
      /\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // Flying Cargo (flying-cargo.com)
  {
    carrierId: 'flying-cargo',
    hostPattern: /flying-cargo\.com/i,
    paramNames: ['n', 'num', 'track', 'tracking', 'awb', 'id', 't'],
    pathPatterns: [
      /\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // Cargo Express (cargoexpress.co.il)
  {
    carrierId: 'cargo',
    hostPattern: /cargoexpress\.co\.il/i,
    paramNames: ['tracknum', 'num', 'track', 'tracking', 'id', 't'],
    pathPatterns: [
      /\/track\/([A-Z0-9_-]+)/i
    ]
  },
  // ZigZag (zigzag24.co.il, zigzag.co.il)
  {
    carrierId: 'zigzag',
    hostPattern: /zigzag(?:24)?\.co\.il/i,
    paramNames: ['code', 'num', 'track', 'tracking', 'id', 't'],
    pathPatterns: [
      /\/track\/([A-Z0-9_-]+)/i
    ]
  },
  // GetPackage (getpackage.com)
  {
    carrierId: 'getpackage',
    hostPattern: /getpackage\.com/i,
    paramNames: ['id', 'num', 'track', 'tracking', 'code', 't'],
    pathPatterns: [
      /\/tracking\/([A-Z0-9_-]+)/i
    ]
  },
  // Orian (orian.com)
  {
    carrierId: 'orian',
    hostPattern: /orian\.com/i,
    paramNames: ['num', 'track', 'tracking', 'id', 'awb', 't'],
    pathPatterns: [
      /\/track\/([A-Z0-9_-]+)/i
    ]
  },
  // AliExpress / Cainiao (aliexpress.com, cainiao.com, global.cainiao.com)
  {
    carrierId: 'cainiao',
    hostPattern: /(?:cainiao\.com|aliexpress\.com)/i,
    paramNames: ['mailNoList', 'mailNo', 'tracking', 'track', 'num', 'id', 'code', 'awb', 't'],
    pathPatterns: [
      /\/detail\/([A-Z0-9_-]+)/i,
      /\/trace\/([A-Z0-9_-]+)/i
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

/**
 * Generic query parameters often used for tracking numbers
 */
const GENERIC_TRACKING_PARAMS = [
  'track', 'tracking', 'num', 'code', 't', 'id', 'barcode', 'item', 'awb', 'b',
  'itemcode', 'mailNoList', 'mailNo', 'trknbr', 'tLabels', 'pNumbers', 'ShipmentNumber', 'tracknum'
];

/**
 * Extracts tracking numbers and carrier hints embedded inside URLs/links from SMS & emails.
 * @param {string} text 
 * @returns {Array<{ trackingNumber: string, carrierHint?: string }>}
 */
export function extractUrlsAndTrackings(text) {
  if (!text || typeof text !== 'string') return [];

  const results = [];
  const seenTrackings = new Set();

  // URL matching regex: bounded, deterministic
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'`()[\]{}]+/gi;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const rawUrl = match[0].replace(/[.,;:!?]+$/, ''); // Strip trailing punctuation
    let parsedUrl = null;

    try {
      const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      parsedUrl = new URL(fullUrl);
    } catch {
      // If URL parsing fails, continue
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
    let carrierHint = matchedRule ? matchedRule.carrierId : undefined;

    // 1. Check carrier specific query parameters
    if (matchedRule) {
      for (const param of matchedRule.paramNames) {
        const val = searchParams.get(param);
        if (val && val.trim().length >= 4 && val.trim().length <= 35) {
          foundTracking = val.trim();
          break;
        }
      }

      // Check path patterns
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

    // 2. Generic query parameter extraction
    if (!foundTracking) {
      for (const param of GENERIC_TRACKING_PARAMS) {
        const val = searchParams.get(param);
        if (val && val.trim().length >= 5 && val.trim().length <= 35) {
          const cleanedVal = val.trim();
          if (/^[A-Za-z0-9_-]+$/.test(cleanedVal)) {
            foundTracking = cleanedVal;
            break;
          }
        }
      }
    }

    // 3. Trailing pathname token extraction (e.g. boxit.co.il/b/BOX12345 or /item/RS123456789IL)
    if (!foundTracking) {
      const pathSegments = pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment && lastSegment.length >= 6 && lastSegment.length <= 35) {
          if (/^[A-Za-z0-9_-]+$/.test(lastSegment)) {
            // Check if last segment looks like a tracking candidate
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
      results.push({
        trackingNumber: foundTracking,
        carrierHint
      });
    }
  }

  return results;
}

/**
 * Extracts pickup location or locker info from Hebrew and English SMS/Email text snippets.
 * @param {string} text 
 * @returns {string}
 */
export function extractPickupLocation(text) {
  if (!text || typeof text !== 'string') return '';

  // Patterns for locker / pickup point extraction (bounded without ReDoS)
  const patterns = [
    // Hebrew patterns:
    // "בלוקר דיזנגוף סנטר", "בנקודת איסוף מכולת שלום", "בסניף דואר מרכזי", "בכתובת הרצל 10", "קוד איסוף 1234 בסניף שרונה"
    /(?:בלוקר|בנקודת\s*איסוף|בסניף|בכתובת|במרכז\s*מסירה|בבית\s*עסק|נקודת\s*חלוקה|לוקר)[\s:-]+([^,.\n\r]{2,50})/i,
    // English patterns:
    // "at pickup point Main Street Hub", "locker Location Dizengoff", "at branch Post Office"
    /(?:at\s+(?:the\s+)?pickup\s+point|at\s+(?:the\s+)?locker|at\s+(?:the\s+)?branch|pickup\s+location|locker\s+location)[\s:-]+([^,.\n\r]{2,50})/i
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const loc = match[1].trim().replace(/^['":\-–—\s]+|['":\-–—\s]+$/g, '');
      if (loc && loc.length >= 2) {
        return loc;
      }
    }
  }

  return '';
}

/**
 * Extracts potential tracking numbers from unstructured text.
 * @param {string} text 
 * @returns {string[]}
 */
export function extractTrackingCandidates(text) {
  if (!text || typeof text !== 'string') return [];

  const candidates = new Set();

  // 0. Extract tracking numbers from URLs first
  const urlExtracted = extractUrlsAndTrackings(text);
  for (const item of urlExtracted) {
    if (item.trackingNumber) {
      candidates.add(item.trackingNumber);
    }
  }
  
  // 1. Explicit labels (Hebrew & English colloquial phrases)
  // "החבילה שלך מחכה", "איסוף חבילה", "קוד איסוף", "מספר משלוח", "מעקב הזמנה", "דבר דואר", "משלוח מספר", "מס׳ מעקב", "חבילתך יצאה", "שליח בדרך", "Order #", "Shipment #", "Waybill", "AWB", "Package ID", "Tracking:"
  const labeledRegex = /(?:tracking(?:\s*number|\s*no|\s*code)?|מעקב(?:\s*משלוח|\s*הזמנה)?|מספר\s*מעקב|חבילה\s*מספר|מס['׳`״]\s*מעקב|מספר\s*משלוח|משלוח\s*מספר|דבר\s*דואר(?:\s*שמספרו)?|חבילתך\s*יצאה(?:\s*במשלוח)?|החבילה\s*שלך\s*מחכה(?:\s*במספר)?|איסוף\s*חבילה(?:\s*מספר)?|קוד\s*איסוף|שליח\s*בדרך(?:\s*משלוח)?|order\s*#|shipment\s*#|package\s*id|waybill|awb)[\s:=#-]+([A-Z0-9_-]{5,35})/gi;
  let match;
  while ((match = labeledRegex.exec(text)) !== null) {
    if (match[1]) {
      const candidate = match[1].trim();
      // Ignore if captured token is just the word "number" or "code" from the label
      if (!/^(?:number|no|code|id)$/i.test(candidate)) {
        candidates.add(candidate);
      }
    }
  }

  // 2. Tokenized match across words
  const words = text.replace(/[,;:"'()<>[\]{}?&=/\\#%*+!|`^~]/g, ' ').split(/\s+/);
  for (const word of words) {
    const cleaned = word.trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    if (!cleaned) continue;

    // Pattern matches
    if (/^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(cleaned)) candidates.add(cleaned);
    else if (/^1Z[0-9A-Z]{16}$/i.test(cleaned)) candidates.add(cleaned);
    else if (/^(LP|CAINIAO)\d{10,}/i.test(cleaned)) candidates.add(cleaned);
    else if (/^4PX\d{10,}/i.test(cleaned)) candidates.add(cleaned);
    else if (/^YT\d{16,18}$/i.test(cleaned)) candidates.add(cleaned);
    else if (/^(CH|CT|HFD|BOX|TPZ|YDM|CRG|CARGO|GP|GET|FC|OR|ORN|BAR|ZZ|ZIG)\d{6,12}$/i.test(cleaned)) candidates.add(cleaned);
    else if (/^\d{10,22}$/.test(cleaned) && (cleaned.length === 10 || cleaned.length === 12 || cleaned.length === 15 || cleaned.length === 20 || cleaned.length === 22)) candidates.add(cleaned);
  }

  return Array.from(candidates);
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
      carrierName: CARRIERS['other'].name,
      category: 'other',
      origin: '',
      destination: 'Israel',
      notes: '',
      notesHe: '',
      pickupLocation: ''
    };
  }

  const cleanText = sanitizeString(rawText, 5000);
  const candidates = extractTrackingCandidates(cleanText);
  const urlExtracted = extractUrlsAndTrackings(cleanText);
  const pickupLocation = extractPickupLocation(cleanText);
  
  let bestTracking = '';
  let bestCarrier = 'other';
  let bestConfidence = 'none';

  // If a carrier hint was discovered directly from the URL domain/path, give it strong precedence
  for (const item of urlExtracted) {
    if (item.trackingNumber) {
      const detection = detectCarrier(item.trackingNumber);
      const effectiveCarrier = item.carrierHint || detection.carrierId;
      if (effectiveCarrier && effectiveCarrier !== 'other') {
        bestTracking = item.trackingNumber;
        bestCarrier = effectiveCarrier;
        bestConfidence = 'high';
        break;
      }
    }
  }

  // If not found via URL carrier hint, scan all candidate tracking codes
  if (!bestTracking || bestConfidence !== 'high') {
    for (const cand of candidates) {
      const detection = detectCarrier(cand);
      if (detection.confidence === 'high') {
        bestTracking = cand;
        bestCarrier = detection.carrierId;
        bestConfidence = 'high';
        break;
      } else if (detection.confidence === 'medium' && bestConfidence !== 'high') {
        bestTracking = cand;
        bestCarrier = detection.carrierId;
        bestConfidence = 'medium';
      } else if (!bestTracking) {
        bestTracking = cand;
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
    } else if (storeInfo.id === 'aliexpress') {
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

  const carrierObj = CARRIERS[bestCarrier] || CARRIERS['other'];

  // Construct notes snippet incorporating pickup location if detected
  let notesText = cleanText;
  if (notesText.length > 300) {
    notesText = notesText.slice(0, 300) + '...';
  }

  return {
    title,
    titleHe,
    trackingNumber: bestTracking,
    carrier: bestCarrier,
    carrierName: carrierObj.name,
    category,
    origin: carrierObj.country || '',
    destination: 'Israel',
    notes: notesText,
    notesHe: notesText,
    pickupLocation
  };
}
