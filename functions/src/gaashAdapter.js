/**
 * GAASH Worldwide (געש) Tracking Adapter.
 *
 * Queries GAASH Worldwide's public WordPress REST API endpoint:
 * https://gaashwd.com/wp-json/gaash-parcel-status-tracker/v1/parcel-tracking-data
 *
 * Requires a dynamic public nonce embedded in gaashwd.com HTML ('parcelStatusTrackerData.nonce').
 * The adapter caches this nonce in memory and auto-refreshes it on expiration or HTTP 401.
 *
 * $0 operational cost, runs server-to-server in Cloud Functions without browser CORS restrictions.
 */

let cachedNonce = null;
let cachedNonceTime = 0;
const NONCE_TTL_MS = 60 * 60 * 1000; // 1 hour cache (WordPress nonces are valid for 12-24h)
const GAASH_BASE_URL = 'https://gaashwd.com';
const FETCH_TIMEOUT_MS = 6000;

export function _resetNonceCacheForTesting() {
  cachedNonce = null;
  cachedNonceTime = 0;
}

/**
 * Stage mapping from Hebrew / English status keywords to unified Deliveree stage
 * @param {string} text 
 * @returns {'delivered' | 'out_for_delivery' | 'customs' | 'in_transit' | 'shipped' | 'ordered'}
 */
export function inferGaashStage(text = '') {
  const clean = String(text || '').toLowerCase();
  if (clean.includes('נמסר') || clean.includes('delivered') || clean.includes('נאסף מהלוקר')) {
    return 'delivered';
  }
  if (
    clean.includes('איסוף') ||
    clean.includes('out for delivery') ||
    clean.includes('בחלוקה') ||
    clean.includes('לוקר') ||
    clean.includes('נקודת איסוף') ||
    clean.includes('ready for collection')
  ) {
    return 'out_for_delivery';
  }
  if (clean.includes('מכס') || clean.includes('customs') || clean.includes('עמילות')) {
    return 'customs';
  }
  if (clean.includes('נקלט') || clean.includes('נאסף') || clean.includes('shipped') || clean.includes('התקבל')) {
    return 'shipped';
  }
  if (clean.includes('בדרך') || clean.includes('במעבר') || clean.includes('מיון') || clean.includes('נמל')) {
    return 'in_transit';
  }
  return 'in_transit';
}

/**
 * Maps GAASH distributor name to local carrier id
 * @param {string} distName
 * @returns {string | null}
 */
export function mapGaashDistributor(distName = '') {
  const clean = String(distName || '').toLowerCase();
  if (clean.includes('chita') || clean.includes('צ\'יטה') || clean.includes('cheetah')) return 'chita';
  if (/(?:^|[^\u0590-\u05fea-z0-9])(?:בר|bar)(?:[^\u0590-\u05fea-z0-9]|$)/i.test(clean)) return 'bar-distribution';
  if (clean.includes('post') || clean.includes('דואר')) return 'israel-post';
  if (clean.includes('hfd') || clean.includes('epost') || clean.includes('איפוס')) return 'hfd';
  if (clean.includes('buzzr') || clean.includes('באזר')) return 'buzzr';
  return null;
}

/**
 * Fetch with strict timeout controller
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Retrieve active public WordPress nonce from gaashwd.com HTML
 * @param {boolean} forceRefresh
 * @returns {Promise<string>}
 */
export async function getGaashNonce(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedNonce && (now - cachedNonceTime < NONCE_TTL_MS)) {
    return cachedNonce;
  }

  try {
    const res = await fetchWithTimeout(GAASH_BASE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to load GAASH homepage: HTTP ${res.status}`);
    }
    const html = await res.text();
    const match = html.match(/"nonce":"([a-zA-Z0-9]+)"/);
    if (!match || !match[1]) {
      throw new Error('GAASH nonce not found in homepage HTML');
    }
    cachedNonce = match[1];
    cachedNonceTime = now;
    return cachedNonce;
  } catch (err) {
    console.warn('[GaashAdapter] Error fetching nonce:', err.message);
    throw err;
  }
}

/**
 * Query GAASH live tracking data
 * @param {string} trackingNumber
 * @returns {Promise<object>} Unified Deliveree tracking record
 */
export async function fetchGaashTracking(trackingNumber) {
  const cleanTrack = String(trackingNumber || '').trim();
  if (!cleanTrack) {
    return {
      carrier: 'gaash',
      tracked: false,
      reason: 'invalid-tracking-number',
      status: null,
      checkpoints: []
    };
  }

  let nonce;
  try {
    nonce = await getGaashNonce();
  } catch (err) {
    return {
      carrier: 'gaash',
      tracked: false,
      reason: 'nonce-fetch-failed',
      message: err.message,
      status: null,
      checkpoints: []
    };
  }

  let res;
  try {
    const apiUrl = `${GAASH_BASE_URL}/wp-json/gaash-parcel-status-tracker/v1/parcel-tracking-data?parcel_id=${encodeURIComponent(cleanTrack)}&lang=he`;
    res = await fetchWithTimeout(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'X-WP-Nonce': nonce,
        'Accept': 'application/json'
      }
    });

    // If 401 (expired nonce), refresh once and retry
    if (res.status === 401) {
      nonce = await getGaashNonce(true);
      res = await fetchWithTimeout(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'X-WP-Nonce': nonce,
          'Accept': 'application/json'
        }
      });
    }

    if (!res.ok) {
      return {
        carrier: 'gaash',
        tracked: false,
        reason: `http-${res.status}`,
        status: null,
        checkpoints: []
      };
    }

    const data = await res.json();
    const statuses = Array.isArray(data?.Statuses) ? data.Statuses : [];
    if (statuses.length === 0) {
      return {
        carrier: 'gaash',
        tracked: false,
        reason: 'no-checkpoints',
        message: 'No tracking records found for this GAASH parcel',
        status: null,
        checkpoints: []
      };
    }

    const checkpoints = statuses.map((st, idx) => ({
      id: `cp-gsh-${cleanTrack}-${idx}`.slice(0, 100),
      title: st.StatusDescription || st.StatusName || st.Status || '',
      description: st.StatusDescription || '',
      descriptionHe: st.StatusDescription || '',
      location: st.Location || st.Hub || 'געש',
      timestamp: st.StatusDate && !Number.isNaN(Date.parse(st.StatusDate))
        ? new Date(st.StatusDate).toISOString()
        : new Date().toISOString(),
      isCompleted: true
    }));

    const lastStatus = checkpoints[0]?.title || '';
    const stage = inferGaashStage(lastStatus);

    const pudo = data.PudoDetails;
    const localCarrier = pudo?.DeliveryCompany ? mapGaashDistributor(pudo.DeliveryCompany) : null;
    const localTrackingNumber = pudo?.LastMileTrackingNumber || data.HAWB || null;
    const shelfNumber = pudo?.Madaf || pudo?.ShelfNumber || null;

    let pickupLocation = null;
    if (pudo?.Name) {
      pickupLocation = pudo.Address ? `${pudo.Name}, ${pudo.Address}` : pudo.Name;
    }

    return {
      carrier: 'gaash',
      tracked: true,
      status: stage,
      checkpoints,
      location: pudo?.City || pudo?.Name || 'געש וורלדוויד',
      estimatedDelivery: data.EstimatedDeliveryDate || null,
      localTrackingNumber,
      localCarrier,
      shelfNumber,
      pickupLocation,
      pickupHours: pudo?.OpeningHours || null
    };
  } catch (err) {
    console.warn('[GaashAdapter] Error executing tracking query:', err.message);
    return {
      carrier: 'gaash',
      tracked: false,
      reason: 'upstream-error',
      message: err.message,
      status: null,
      checkpoints: []
    };
  }
}
