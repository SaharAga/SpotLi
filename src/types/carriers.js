// Carrier definitions, brand themes, tracking URL templates, and detection rules.
//
// `patterns` is the single source of truth for carrier detection. Each entry is
// a *rule*, not a bare regex, so the table can express everything the detector
// needs instead of having the detector restate it:
//
//   re         the regex to match a sanitized (uppercased, unpunctuated) code
//   confidence 'high' for a rule that identifies the carrier on its own,
//              'medium' for a loose/ambiguous format (the default)
//   checksum   name of a validator in the detector's checksum registry, or null
//   priority   lower wins; rules are evaluated in ascending priority across all
//              carriers, which is how cross-carrier precedence (e.g. Aramex's
//              11-digit rule before FedEx's 12-digit one) is encoded
//
// Rules expose a `test()` method, so a rule can be used anywhere a regex was.

/** Priority given to rules that don't ask for one: after every explicit rule. */
export const GENERIC_RULE_PRIORITY = 1000;

/**
 * Build a detection rule.
 * @param {RegExp} re
 * @param {{ confidence?: 'high' | 'medium', checksum?: string | null, priority?: number }} [options]
 */
function rule(re, options = {}) {
  return {
    re,
    confidence: options.confidence || 'medium',
    checksum: options.checksum || null,
    priority: options.priority ?? GENERIC_RULE_PRIORITY,
    /** @param {string} value */
    test: (value) => re.test(value)
  };
}

/**
 * Builds Israel Post checkpoints from the itemtrace gateway's `itemhistory`
 * field. This is an unofficial, undocumented API — `itemhistory` has been
 * observed as a single free-text status string, but may also come back as an
 * array of per-event objects (field names unconfirmed), so both shapes are
 * handled rather than assumed. Falls back to a single `laststatus`
 * checkpoint (the prior behavior) when `itemhistory` isn't present or isn't
 * usable, so a shape this doesn't recognize degrades instead of losing data.
 * @param {object} data - raw itemtrace gateway response
 * @param {string} trackNum
 * @returns {Array<object>}
 */
function buildIsraelPostCheckpoints(data, trackNum) {
  const { itemhistory, laststatus, unitname } = data;

  if (Array.isArray(itemhistory) && itemhistory.length > 0) {
    return itemhistory.map((entry, index) => {
      const title =
        (typeof entry === 'string' ? entry : entry?.status || entry?.eventname || entry?.description) ||
        laststatus ||
        '';
      const location = (typeof entry !== 'string' && (entry?.location || entry?.unitname || entry?.city)) || unitname || 'דואר ישראל';
      const rawTimestamp = typeof entry !== 'string' ? entry?.date || entry?.eventdate || entry?.timestamp : null;
      const timestamp = rawTimestamp && !Number.isNaN(Date.parse(rawTimestamp))
        ? new Date(rawTimestamp).toISOString()
        : new Date().toISOString();

      return {
        id: `cp-ilp-${trackNum}-${index}`.slice(0, 100),
        title,
        description: title,
        descriptionHe: title,
        location,
        timestamp,
        isCompleted: true
      };
    });
  }

  if (!laststatus) return [];

  return [
    {
      id: `cp-ilp-${trackNum}-0`.slice(0, 100),
      title: laststatus,
      description: typeof itemhistory === 'string' ? itemhistory : '',
      descriptionHe: laststatus,
      location: unitname || 'דואר ישראל',
      timestamp: new Date().toISOString(),
      isCompleted: true
    }
  ];
}

/**
 * Maps Exelot last-mile courier names to Deliveree carrier IDs.
 * @param {string} [lmp]
 * @returns {string|null}
 */
export function mapExelotLocalCarrier(lmp = '') {
  const clean = String(lmp || '').toLowerCase();
  if (clean.includes('buzzr') || clean.includes('באזר')) return 'buzzr';
  if (clean.includes('chita') || clean.includes('צ\'יטה') || clean.includes('cheetah')) return 'chita';
  if (clean.includes('hfd') || clean.includes('איפוס') || clean.includes('epost')) return 'hfd';
  if (clean.includes('post') || clean.includes('דואר')) return 'israel-post';
  if (clean.includes('bar') || clean.includes('בר')) return 'bar-distribution';
  return null;
}

/**
 * Maps Cainiao destination courier code to Deliveree carrier IDs.
 * @param {string} [cpCode]
 * @returns {string|null}
 */
export function mapCainiaoLocalCarrier(cpCode = '') {
  const code = String(cpCode || '').toUpperCase();
  if (code.includes('POST_IL') || code.includes('ISRAEL_POST') || code.includes('IL_POST')) return 'israel-post';
  if (code.includes('CHEETAH') || code.includes('CHITA')) return 'chita';
  if (code.includes('EXELOT')) return 'exelot';
  if (code.includes('BUZZR')) return 'buzzr';
  if (code.includes('HFD')) return 'hfd';
  if (code.includes('BAR')) return 'bar-distribution';
  return null;
}

export const CARRIERS = {
  'israel-post': {
    id: 'israel-post',
    name: 'Israel Post',
    hebrewName: 'דואר ישראל',
    color: 'from-red-500 to-rose-600',
    badgeBg: 'bg-red-500/10 border-red-500/30 text-red-400',
    accentColor: '#ef4444',
    logoText: 'דואר',
    website: 'https://mypost.israelpost.co.il',
    getTrackingUrl: (trackNum) => `https://mypost.israelpost.co.il/itemtrace?itemcode=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    /**
     * Real upstream integration (Israel Post Open Status Gateway).
     */
    liveTracking: {
      endpoint: (trackNum) =>
        `https://mypost.israelpost.co.il/umbraco/api/itemtrace/getitemtrace?itemcode=${encodeURIComponent(trackNum)}`,
      parse: (data, trackNum, { inferStageFromText }) => {
        if (!data || !data.itemcode) return null;

        const checkpoints = buildIsraelPostCheckpoints(data, trackNum);
        const historyText = checkpoints.map((cp) => cp.title).join(' ') || data.laststatus || '';
        const stage = inferStageFromText(historyText);

        const customsPaymentUrl = data.CustomsPaymentLink || data.customsPaymentLink || null;
        const customsDetails = customsPaymentUrl ? {
          required: true,
          amount: data.CustomsAmount || data.customsAmount || null,
          currency: 'ILS',
          paymentUrl: customsPaymentUrl,
          status: 'pending'
        } : null;

        return {
          carrier: 'israel-post',
          tracked: true,
          status: stage,
          checkpoints,
          location: data.unitname || null,
          estimatedDelivery: null,
          shelfNumber: data.Madaf || data.madaf || data.ShelfNumber || null,
          pickupDeadline: data.PickupDaysLeft ? `${data.PickupDaysLeft} days` : null,
          customsDetails
        };
      }
    },
    patterns: [
      // UPU S10 ending in IL (e.g. RS123456789IL) — carries a mod-11 check digit.
      rule(/^[A-Z]{2}\d{9}IL$/i, { confidence: 'high', checksum: 'upu-s10', priority: 10 }),
      // Any other alphanumeric code ending in IL is still Israel Post, unchecksummed.
      rule(/^[A-Z0-9]{7,}IL$/i, { confidence: 'high', priority: 20 }),
      // "מהיר לתיבה" (fast-to-mailbox) domestic items: two letters, nine
      // digits, then a sender-route letter and a service digit — MA002378449N8
      // and MA001487109E5 are both real. The trailing letter identifies the
      // distributor, so it is not a fixed marker and must not be pinned to one
      // value. No country suffix and no check digit, so nothing else matched
      // these and they were dropped entirely.
      rule(/^[A-Z]{2}\d{9}[A-Z]\d$/i, { confidence: 'high', priority: 15 }),
      // Israel Post's domestic identifiers: two letters, ten digits, one
      // trailing letter — RU0126608087Z, UZ0626073436Y, MB0121596516Y,
      // RR0126918893X, MA1646098403F. They carry no country suffix and no
      // check digit, so none of the rules above matched and every one of these
      // messages produced nothing at all.
      rule(/^[A-Z]{2}\d{10}[A-Z]$/i, { confidence: 'high', priority: 12 }),
      // Counter-issued items ("תודה שאספת את דבר הדואר YY00370128005").
      rule(/^YY\d{11}$/i, { confidence: 'high', priority: 12 }),
      // Universal registered mail without a country suffix — ambiguous, hence medium.
      rule(/^[A-Z]{2}\d{8,9}$/i),
      // UPU S10 from any origin country. Inbound mail from Belgium, Sweden,
      // Hong Kong or the Netherlands (RG…BE, RE…SE, RT…HK, RS…NL) is delivered
      // here by Israel Post and tracked through its own itemtrace, but only
      // …IL matched, so a genuine registered item with a verifying check digit
      // was dropped purely for having the wrong suffix.
      //
      // Left unprioritised on purpose: the generic tier sorts after every
      // explicit rule, so GB still resolves to Royal Mail and US to USPS and
      // this only catches what no carrier claims. It also carries no checksum
      // — `evaluateCandidateRules` takes the first checksum any matching rule
      // offers, so attaching upu-s10 here made unrelated formats that merely
      // share the shape (Yanwen's UB…YP) report a *failing* check digit and
      // lose a confidence tier.
      rule(/^[A-Z]{2}\d{9}[A-Z]{2}$/i)
    ],
    sample: 'RS948219481IL',
    country: 'Israel'
  },
  'chita': {
    id: 'chita',
    name: 'Cheetah Delivery (Chita)',
    hebrewName: "צ'יטה שליחויות",
    color: 'from-amber-600 to-orange-700',
    badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    accentColor: '#d97706',
    logoText: "צ'יטה",
    website: 'https://chita-il.com',
    getTrackingUrl: (trackNum) => `https://chita-il.com/runportal/tracking?num=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^(CH|CT)\d{8,12}$/i, { confidence: 'high', priority: 30 }),
      rule(/^CHT[A-Z0-9]{7,12}$/i, { confidence: 'high', priority: 31 }),
      rule(/^CHTR[A-Z0-9]{6,12}$/i, { confidence: 'high', priority: 32 })
    ],
    sample: 'CH10849201',
    country: 'Israel'
  },
  'hfd': {
    id: 'hfd',
    name: 'HFD / E-Post',
    hebrewName: 'HFD שליחויות / אי-פוסט',
    color: 'from-blue-700 to-indigo-800',
    badgeBg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    accentColor: '#3b82f6',
    logoText: 'HFD',
    website: 'https://hfd.co.il',
    getTrackingUrl: (trackNum) => `https://hfd.co.il/tracking?num=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^HFD\d{8,12}$/i, { confidence: 'high', priority: 50 }),
      rule(/^EP\d{8,12}$/i, { confidence: 'high', priority: 51 }),
      rule(/^5\d{8,9}$/)
    ],
    sample: 'HFD90481029',
    country: 'Israel'
  },
  'boxit': {
    id: 'boxit',
    name: 'BoxIt',
    hebrewName: 'בוקסיט (BoxIt)',
    color: 'from-pink-600 to-rose-600',
    badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    accentColor: '#f43f5e',
    logoText: 'BoxIt',
    website: 'https://boxit.co.il',
    getTrackingUrl: (trackNum) => `https://boxit.co.il/tracking/${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^BOX[0-9A-Z]{6,12}$/i, { confidence: 'high', priority: 40 }),
      rule(/^BX\d{7,10}$/i, { confidence: 'high', priority: 41 })
    ],
    sample: 'BOX920194',
    country: 'Israel'
  },
  'tapuz': {
    id: 'tapuz',
    name: 'Tapuz Delivery',
    hebrewName: 'תפוז שליחויות',
    color: 'from-orange-500 to-amber-600',
    badgeBg: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    accentColor: '#f97316',
    logoText: 'תפוז',
    website: 'https://tapuzdelivery.co.il',
    getTrackingUrl: (trackNum) => `https://tapuzdelivery.co.il/%D7%90%D7%99%D7%A4%D7%94-%D7%94%D7%97%D7%91%D7%99%D7%9C%D7%94-%D7%A9%D7%9C%D7%99/?num=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^(TPZ|YDM|TAPUZ)\d{6,12}$/i, { confidence: 'high', priority: 60 }),
      rule(/^7\d{8}$/)
    ],
    sample: 'TPZ84920194',
    country: 'Israel'
  },
  'cargo': {
    id: 'cargo',
    name: 'Cargo Express',
    hebrewName: 'קרגו שליחויות',
    color: 'from-cyan-600 to-blue-700',
    badgeBg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
    accentColor: '#0891b2',
    logoText: 'Cargo',
    website: 'https://cargoexpress.co.il',
    getTrackingUrl: (trackNum) => `https://cargoexpress.co.il/track?tracknum=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^CRG\d{7,12}$/i, { confidence: 'high', priority: 70 }),
      rule(/^CARGO\d{6,10}$/i, { confidence: 'high', priority: 71 }),
      rule(/^ECSA\d{6,9}$/i, { confidence: 'high', priority: 72 })
    ],
    sample: 'CRG9104821',
    country: 'Israel'
  },
  'focus': {
    id: 'focus',
    name: 'Focus Logistics',
    hebrewName: 'פוקוס',
    color: 'from-violet-600 to-purple-700',
    badgeBg: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
    accentColor: '#7c3aed',
    logoText: 'פוקוס',
    website: 'https://focuslogistics.co.il',
    // Their SMS links the site root, not a per-parcel page, and no public
    // tracking URL format is known — so this points where the message points
    // rather than inventing a query string that 404s.
    getTrackingUrl: () => 'https://focuslogistics.co.il',
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    // No bare-digit rule on purpose. The reported parcel was `4046309` — seven
    // digits, which would also match an order number, a PIN and half the
    // numbers in an average SMS. Focus is recognised from the phrase and the
    // host instead (see HEBREW_CARRIER_PHRASES and CARRIER_URL_RULES), the same
    // way `cargo` is.
    patterns: [
      rule(/^(FCS|FOCUS)\d{6,12}$/i, { confidence: 'high', priority: 62 })
    ],
    sample: 'FCS4046309',
    country: 'Israel'
  },
  'getpackage': {
    id: 'getpackage',
    name: 'GetPackage',
    hebrewName: "גט פקג' (GetPackage)",
    color: 'from-emerald-600 to-teal-700',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    accentColor: '#059669',
    logoText: 'GetPkg',
    website: 'https://getpackage.com',
    getTrackingUrl: (trackNum) => `https://getpackage.com/tracking?id=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^GP[A-Z0-9]{8,12}$/i, { confidence: 'high', priority: 80 }),
      rule(/^GET\d{8,10}$/i, { confidence: 'high', priority: 81 })
    ],
    sample: 'GP94820194',
    country: 'Israel'
  },
  'flying-cargo': {
    id: 'flying-cargo',
    name: 'Flying Cargo / FedEx Israel',
    hebrewName: 'פליינג קרגו / פדאקס ישראל',
    color: 'from-indigo-600 to-violet-700',
    badgeBg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
    accentColor: '#6366f1',
    logoText: 'FC',
    website: 'https://www.flying-cargo.com',
    getTrackingUrl: (trackNum) => `https://www.flying-cargo.com/tracking?n=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^FC\d{8,12}$/i, { confidence: 'high', priority: 90 }),
      rule(/^4\d{9}$/)
    ],
    sample: 'FC84920194',
    country: 'Israel'
  },
  'orian': {
    id: 'orian',
    name: 'Orian / UPS Israel',
    hebrewName: 'אוריאן / UPS ישראל',
    color: 'from-amber-800 to-amber-950',
    badgeBg: 'bg-amber-600/10 border-amber-600/30 text-amber-300',
    accentColor: '#b45309',
    logoText: 'אוריאן',
    website: 'https://orian.com',
    getTrackingUrl: (trackNum) => `https://orian.com/track?num=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^(OR|ORN)\d{8,12}$/i, { confidence: 'high', priority: 100 }),
      rule(/^\d{9}-\d$/i, { confidence: 'high', priority: 101 })
    ],
    sample: 'OR94820194',
    country: 'Israel'
  },
  'bar-distribution': {
    id: 'bar-distribution',
    name: 'Bar Distribution',
    hebrewName: 'בר הפצה',
    color: 'from-blue-600 to-slate-800',
    badgeBg: 'bg-blue-600/10 border-blue-600/30 text-blue-300',
    accentColor: '#2563eb',
    logoText: 'בר',
    website: 'https://bardistribution.co.il',
    getTrackingUrl: (trackNum) => `https://bardistribution.co.il/track?track=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://barexpress.co.il/track?track=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^(BAR|BD)\d{6,12}$/i, { confidence: 'high', priority: 110 }),
      rule(/^9\d{8}$/)
    ],
    sample: 'BAR1094821',
    country: 'Israel'
  },
  'lionwheel': {
    id: 'lionwheel',
    name: 'LionWheel',
    hebrewName: 'ליאון וויל (LionWheel)',
    color: 'from-cyan-600 to-blue-800',
    badgeBg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
    accentColor: '#06b6d4',
    logoText: 'Lion',
    website: 'https://lionwheel.com',
    getTrackingUrl: (trackNum) => `https://tracking.lionwheel.com/orders/${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^(LW|LION)\d{6,14}$/i, { confidence: 'high', priority: 115 }),
      rule(/^LW[A-Z0-9]{6,14}$/i, { confidence: 'high', priority: 116 })
    ],
    sample: 'LW94820194',
    country: 'Israel'
  },
  'buzzr': {
    id: 'buzzr',
    name: 'Buzzr',
    hebrewName: 'באזר (Buzzr)',
    color: 'from-yellow-500 to-amber-600',
    badgeBg: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    accentColor: '#eab308',
    logoText: 'Buzzr',
    website: 'https://buzzr.co.il',
    getTrackingUrl: (trackNum) => `https://buzzr.co.il/track/${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^(BZR|BUZZR)\d{6,12}$/i, { confidence: 'high', priority: 125 }),
      rule(/^BZ[A-Z0-9]{7,12}$/i, { confidence: 'high', priority: 126 })
    ],
    sample: 'BZR84920194',
    country: 'Israel'
  },
  'zigzag': {
    id: 'zigzag',
    name: 'ZigZag Express',
    hebrewName: 'זיגזג שליחויות',
    color: 'from-rose-600 to-red-700',
    badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    accentColor: '#e11d48',
    logoText: 'ZigZag',
    website: 'https://zigzag24.co.il',
    getTrackingUrl: (trackNum) => `https://zigzag24.co.il/track?code=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^ZZ\d{7,12}$/i, { confidence: 'high', priority: 120 }),
      rule(/^ZIG\d{6,10}$/i, { confidence: 'high', priority: 121 })
    ],
    sample: 'ZZ9482019',
    country: 'Israel'
  },
  'gaash': {
    id: 'gaash',
    name: 'GAASH Worldwide',
    hebrewName: 'געש וורלדוויד (GAASH)',
    color: 'from-orange-600 to-amber-700',
    badgeBg: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    accentColor: '#ea580c',
    logoText: 'געש',
    website: 'https://gaashwd.com',
    getTrackingUrl: (trackNum) => `https://gaashwd.com/?trackingNumber=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    liveTracking: {
      endpoint: (trackNum) =>
        `https://gaashwd.com/wp-json/gaash-parcel-status-tracker/v1/parcel-tracking-data?parcel_id=${encodeURIComponent(trackNum)}&lang=he`,
      parse: (data, trackNum, { inferStageFromText }) => {
        if (!data) return null;
        const statuses = Array.isArray(data.Statuses) ? data.Statuses : [];
        if (statuses.length === 0) return null;

        const checkpoints = statuses.map((st, idx) => ({
          id: `cp-gsh-${trackNum}-${idx}`.slice(0, 100),
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
        const stage = inferStageFromText(lastStatus);
        const pudo = data.PudoDetails;
        const localCarrier = pudo?.DeliveryCompany ? mapExelotLocalCarrier(pudo.DeliveryCompany) : null;
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
      }
    },
    patterns: [
      rule(/^GAA[A-Z0-9]{7,15}$/i, { confidence: 'high', priority: 130 }),
      rule(/^GAASH\d{6,12}$/i, { confidence: 'high', priority: 132 })
    ],
    sample: 'GAA124778035',
    country: 'Israel / Cross-Border'
  },
  'exelot': {
    id: 'exelot',
    name: 'Exelot',
    hebrewName: 'אקסלוט (Exelot)',
    color: 'from-blue-700 to-indigo-800',
    badgeBg: 'bg-indigo-600/10 border-indigo-600/30 text-indigo-300',
    accentColor: '#4338ca',
    logoText: 'Exelot',
    website: 'https://exelot.com',
    getTrackingUrl: (trackNum) => `https://exelot.com/tracking/?num=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    liveTracking: {
      endpoint: (trackNum) =>
        `https://app.exelot.com/api/tracking/search?trackingNumber=${encodeURIComponent(trackNum)}`,
      parse: (data, trackNum, { inferStageFromText }) => {
        if (!data) return null;
        const payload = data.data || data;
        const events = payload.events || payload.trackingEvents || payload.checkpoints || [];
        const checkpoints = Array.isArray(events)
          ? events.map((ev, idx) => ({
              id: `cp-xlt-${trackNum}-${idx}`.slice(0, 100),
              title: ev.statusDescription || ev.eventDescription || ev.status || ev.description || '',
              description: ev.details || ev.description || '',
              descriptionHe: ev.statusDescriptionHe || ev.statusDescription || '',
              location: ev.location || payload.current_pudo_name || 'Exelot',
              timestamp: ev.eventDate || ev.timestamp || new Date().toISOString(),
              isCompleted: true
            }))
          : [];

        const lastEvent = checkpoints[0]?.title || payload.status || payload.currentStatus || '';
        const stage = inferStageFromText(lastEvent);
        const localCarrier = mapExelotLocalCarrier(payload.lastMileProvider);

        return {
          carrier: 'exelot',
          tracked: true,
          status: stage,
          checkpoints,
          location: payload.current_pudo_name || payload.location || null,
          estimatedDelivery: payload.estimatedDeliveryDate || null,
          localTrackingNumber: payload.lastMileTrackingNumber || payload.localNumber || null,
          localCarrier,
          shelfNumber: payload.shelfNumber || payload.bin || null,
          pickupLocation: payload.current_pudo_name || null,
          pickupHours: payload.current_pudo_additionalInformation || null
        };
      }
    },
    patterns: [
      rule(/^XLT\d{9}$/i, { confidence: 'high', priority: 135 })
    ],
    sample: 'XLT124778035',
    country: 'Israel / Cross-Border'
  },
  'cainiao': {
    id: 'cainiao',
    name: 'AliExpress / Cainiao',
    hebrewName: 'קאיניאו / עליאקספרס',
    color: 'from-amber-500 to-orange-600',
    badgeBg: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    accentColor: '#f97316',
    logoText: 'Cainiao',
    website: 'https://global.cainiao.com',
    getTrackingUrl: (trackNum) => `https://global.cainiao.com/newDetail.htm?mailNoList=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    liveTracking: {
      endpoint: (trackNum) =>
        `https://global.cainiao.com/global/detail.json?mailNos=${encodeURIComponent(trackNum)}&lang=en-US`,
      parse: (data, trackNum, { inferStageFromText }) => {
        if (!data || !data.module || !Array.isArray(data.module) || data.module.length === 0) return null;
        const mod = data.module[0];
        const detailList = mod.detailList || [];
        const checkpoints = detailList.map((item, idx) => ({
          id: `cp-cn-${trackNum}-${idx}`.slice(0, 100),
          title: item.desc || item.standerdDesc || '',
          description: item.desc || '',
          descriptionHe: item.desc || '',
          location: item.location || 'Cainiao',
          timestamp: item.time ? new Date(item.time).toISOString() : new Date().toISOString(),
          isCompleted: true
        }));

        const lastStatus = checkpoints[0]?.title || mod.status || '';
        const stage = inferStageFromText(lastStatus);

        const destCp = mod.destCpList?.[0];
        const localTrackingNumber = destCp?.mailNo || mod.destMailNo || mod.realMailNo || null;
        const localCarrier = mapCainiaoLocalCarrier(destCp?.cpCode || mod.destCpCode);

        return {
          carrier: 'cainiao',
          tracked: true,
          status: stage,
          checkpoints,
          location: mod.destCountry || null,
          estimatedDelivery: mod.latestDeliveryTime ? new Date(mod.latestDeliveryTime).toISOString() : null,
          localTrackingNumber,
          localCarrier
        };
      }
    },
    patterns: [
      // S10 ending in CN is checksummed; the Cainiao-specific prefixes are not,
      // so they report a passing checksum exactly as the previous branch did.
      rule(/^[A-Z]{2}\d{9}CN$/i, { confidence: 'high', checksum: 'upu-s10', priority: 140 }),
      rule(/^(LP|CAINIAO)\d+/i, { confidence: 'high', checksum: 'assume-valid', priority: 141 }),
      rule(/^AE[A-Z0-9]{10,18}$/i, { confidence: 'high', checksum: 'assume-valid', priority: 142 }),
      rule(/^S0000\d{8,18}$/i, { confidence: 'high', checksum: 'assume-valid', priority: 144 }),
      rule(/^S\d{12,18}$/i, { confidence: 'high', checksum: 'assume-valid', priority: 145 }),
      rule(/^CN\d{10,}$/i, { confidence: 'high', checksum: 'assume-valid', priority: 143 }),
      rule(/^CN\d{10,}/i)
    ],
    sample: 'LP00582910482CN',
    country: 'China'
  },
  'shein': {
    id: 'shein',
    name: 'SHEIN Express',
    hebrewName: 'שיין (SHEIN)',
    color: 'from-slate-700 to-zinc-900',
    badgeBg: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-200',
    accentColor: '#18181b',
    logoText: 'SHEIN',
    website: 'https://www.shein.com',
    getTrackingUrl: (trackNum) => `https://www.shein.com/user/orders/detail/${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^GSH[A-Z0-9]{8,20}$/i, { confidence: 'high', priority: 146 })
    ],
    sample: 'GSH12345678901',
    country: 'Global'
  },
  'yunexpress': {
    id: 'yunexpress',
    name: 'YunExpress',
    hebrewName: 'יון אקספרס (YunExpress)',
    color: 'from-teal-600 to-emerald-700',
    badgeBg: 'bg-teal-500/10 border-teal-500/30 text-teal-400',
    accentColor: '#0d9488',
    logoText: 'Yun',
    website: 'https://www.yunexpress.com',
    getTrackingUrl: (trackNum) => `https://www.yuntrack.com/parcelTracking?pNumbers=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^YT\d{16,18}$/i, { confidence: 'high', priority: 130 })
    ],
    sample: 'YT2109849201948201',
    country: 'China / Global'
  },
  '4px': {
    id: '4px',
    name: '4PX Express',
    hebrewName: '4PX אקספרס',
    color: 'from-blue-600 to-cyan-600',
    badgeBg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
    accentColor: '#06b6d4',
    logoText: '4PX',
    website: 'https://express.4px.com',
    getTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://express.4px.com/track/search?keyword=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^4PX\d+/i, { confidence: 'high', priority: 150 }),
      rule(/^FPX\d+/i, { confidence: 'high', priority: 151 })
    ],
    sample: '4PX300184920194',
    country: 'China / Global'
  },
  'dhl': {
    id: 'dhl',
    name: 'DHL Express',
    hebrewName: 'DHL אקספרס',
    color: 'from-yellow-400 to-amber-500',
    badgeBg: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    accentColor: '#eab308',
    logoText: 'DHL',
    website: 'https://www.dhl.com',
    getTrackingUrl: (trackNum) => `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^\d{10}$/, { confidence: 'high', priority: 210 }),
      rule(/^JJD\d+/i, { confidence: 'high', priority: 211 }),
      rule(/^GM\d{16,18}$/i, { confidence: 'high', priority: 212 })
    ],
    sample: '4829104821',
    country: 'Germany / Global'
  },
  'fedex': {
    id: 'fedex',
    name: 'FedEx',
    hebrewName: 'פדאקס (FedEx)',
    color: 'from-purple-600 to-indigo-600',
    badgeBg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    accentColor: '#a855f7',
    logoText: 'FedEx',
    website: 'https://www.fedex.com',
    getTrackingUrl: (trackNum) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^\d{12}$/, { confidence: 'high', priority: 220 }),
      rule(/^\d{15}$/, { confidence: 'high', priority: 221 }),
      rule(/^\d{20}$/, { confidence: 'high', priority: 222 }),
      rule(/^\d{22}$/, { confidence: 'high', priority: 223 })
    ],
    sample: '794820194821',
    country: 'USA / Global'
  },
  'ups': {
    id: 'ups',
    name: 'UPS',
    hebrewName: 'יו-פי-אס (UPS)',
    color: 'from-amber-700 to-amber-900',
    badgeBg: 'bg-amber-600/10 border-amber-600/30 text-amber-300',
    accentColor: '#d97706',
    logoText: 'UPS',
    website: 'https://www.ups.com',
    getTrackingUrl: (trackNum) => `https://www.ups.com/track?tracknum=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^1Z[0-9A-Z]{16}$/i, { confidence: 'high', priority: 160 }),
      rule(/^\d{9}$/),
      rule(/^\d{11}$/)
    ],
    sample: '1Z999AA10123456784',
    country: 'USA / Global'
  },
  'usps': {
    id: 'usps',
    name: 'USPS',
    hebrewName: 'שירות הדואר של ארה"ב (USPS)',
    color: 'from-blue-800 to-slate-900',
    badgeBg: 'bg-blue-700/10 border-blue-700/30 text-blue-300',
    accentColor: '#1d4ed8',
    logoText: 'USPS',
    website: 'https://www.usps.com',
    getTrackingUrl: (trackNum) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      // IMpb 94/92/93 labels carry a weighted mod-10 check digit.
      rule(/^9[234]\d{20}$/, { confidence: 'high', checksum: 'mod10-31', priority: 180 }),
      rule(/^[A-Z]{2}\d{9}US$/i, { confidence: 'high', checksum: 'upu-s10', priority: 181 })
    ],
    sample: '9400100000000000000000',
    country: 'USA'
  },
  'royal-mail': {
    id: 'royal-mail',
    name: 'Royal Mail',
    hebrewName: 'רויאל מייל (בריטניה)',
    color: 'from-red-600 to-red-800',
    badgeBg: 'bg-red-600/10 border-red-600/30 text-red-300',
    accentColor: '#dc2626',
    logoText: 'Royal Mail',
    website: 'https://www.royalmail.com',
    getTrackingUrl: (trackNum) => `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      rule(/^[A-Z]{2}\d{9}GB$/i, { confidence: 'high', checksum: 'upu-s10', priority: 170 })
    ],
    sample: 'RN123456789GB',
    country: 'United Kingdom'
  },
  'aramex': {
    id: 'aramex',
    name: 'Aramex',
    hebrewName: 'אראמקס (Aramex)',
    color: 'from-orange-600 to-red-700',
    badgeBg: 'bg-orange-600/10 border-orange-600/30 text-orange-300',
    accentColor: '#ea580c',
    logoText: 'Aramex',
    website: 'https://www.aramex.com',
    getTrackingUrl: (trackNum) => `https://www.aramex.com/track/results?ShipmentNumber=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [
      // Aramex 11-digit codes must be tested before FedEx's 12-digit rule.
      rule(/^3\d{9}$/, { confidence: 'high', priority: 200 }),
      rule(/^\d{11}$/, { confidence: 'high', priority: 201 }),
      rule(/^\d{10,11}$/)
    ],
    sample: '3094829104',
    country: 'Middle East / Global'
  },
  'yanwen': {
    id: 'yanwen',
    name: 'Yanwen Express',
    hebrewName: 'ינוואן (Yanwen)',
    color: 'from-emerald-600 to-teal-600',
    badgeBg: 'bg-teal-500/10 border-teal-500/30 text-teal-400',
    accentColor: '#14b8a6',
    logoText: 'YW',
    website: 'https://www.yw56.com.cn',
    getTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (_trackNum) => `https://www.yw56.com.cn/en/`,
    patterns: [
      rule(/^U[A-Z]\d{9}YP$/i, { confidence: 'high', priority: 190 }),
      rule(/^VR\d{9}YP$/i, { confidence: 'high', priority: 191 }),
      rule(/^LP\d{14}YP$/i, { confidence: 'high', priority: 192 }),
      // Any sufficiently long code ending in YP is a Yanwen label.
      rule(/^[\s\S]{8,}YP$/, { confidence: 'high', priority: 193 })
    ],
    sample: 'UY894729184YP',
    country: 'China'
  },
  'other': {
    id: 'other',
    name: 'Other / Universal',
    hebrewName: 'אחר / אוניברסלי',
    color: 'from-slate-600 to-gray-700',
    badgeBg: 'bg-slate-500/10 border-slate-500/30 text-slate-300',
    accentColor: '#64748b',
    logoText: 'Universal',
    website: 'https://t.17track.net',
    getTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    fallbackTrackingUrl: (trackNum) => `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`,
    patterns: [],
    sample: 'TRACK12345678',
    country: 'Global'
  }
};

export const CARRIER_LIST = Object.values(CARRIERS).filter((c, idx, arr) => arr.findIndex(x => x.id === c.id) === idx);

/**
 * Look up a carrier by id, falling back to the universal 'other' carrier.
 *
 * @param {string} [carrierId]
 * @returns {typeof CARRIERS[keyof typeof CARRIERS]}
 */
export function getCarrier(carrierId) {
  if (carrierId === 'bar-distribution' || carrierId === 'bar') {
    return CARRIERS['bar-distribution'] || CARRIERS['bar'];
  }
  return Object.prototype.hasOwnProperty.call(CARRIERS, carrierId)
    ? CARRIERS[carrierId]
    : CARRIERS['other'];
}

/**
 * All detection rules across every carrier, in evaluation order.
 *
 * Sorted by priority (lower first), then high confidence before medium.
 *
 * @type {Array<{ carrier: object, re: RegExp, confidence: string, checksum: string|null, priority: number, test: (v: string) => boolean }>}
 */
export const DETECTION_RULES = CARRIER_LIST
  .filter((carrier) => carrier.id !== 'other')
  .flatMap((carrier) => carrier.patterns.map((r) => ({ ...r, carrier })))
  .sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.confidence === b.confidence) return 0;
    return a.confidence === 'high' ? -1 : 1;
  });
