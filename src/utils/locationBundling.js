/**
 * Utilities for grouping and detecting packages waiting at the same pickup location or locker.
 */

const NOISE_WORDS = [
  'סניף', 'נקודת', 'איסוף', 'לוקר', 'בוקסיט', 'אי-פוסט', 'איפוסט', 'חנות', 'קניון',
  'boxit', 'epost', 'e-post', 'yellow', 'box', 'yellowbox', 'locker', 'store', 'branch'
];

/**
 * Normalizes a location string for robust fuzzy matching.
 * Handles Hebrew/English variations, punctuation, and common courier prefixes.
 * @param {string} location
 * @returns {string}
 */
export function normalizeLocation(location) {
  if (!location || typeof location !== 'string') return '';

  const clean = location
    .toLowerCase()
    .trim()
    .replace(/[,\-_#/().]/g, ' ')
    .replace(/["'״׳]/g, '');

  const tokens = clean
    .split(/\s+/)
    .filter((token) => Boolean(token) && !NOISE_WORDS.includes(token));

  const result = tokens.join(' ');
  return result || location.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Checks if two location strings refer to the same physical spot.
 * @param {string} locA
 * @param {string} locB
 * @returns {boolean}
 */
export function areLocationsMatching(locA, locB) {
  if (!locA || !locB || typeof locA !== 'string' || typeof locB !== 'string') {
    return false;
  }

  const normA = normalizeLocation(locA);
  const normB = normalizeLocation(locB);

  if (!normA || !normB) return false;

  // Direct normalized match
  if (normA === normB) return true;

  // Substring match for longer address strings (e.g. "Dizengoff Center #142" and "Dizengoff Center")
  if (normA.length >= 6 && normB.length >= 6) {
    if (normA.includes(normB) || normB.includes(normA)) {
      return true;
    }
  }

  return false;
}

/**
 * Finds all active packages that share the same pickup location as targetPkg.
 * Excludes delivered and archived packages, as well as targetPkg itself.
 * @param {Object} targetPkg
 * @param {Array<Object>} allPackages
 * @returns {Array<Object>}
 */
export function findSameLocationPackages(targetPkg, allPackages = []) {
  if (!targetPkg || !targetPkg.pickupLocation || !Array.isArray(allPackages)) {
    return [];
  }

  const targetLoc = targetPkg.pickupLocation;

  return allPackages.filter((p) => {
    if (!p || p.id === targetPkg.id) return false;
    if (p.isArchived || p.status === 'archived' || p.status === 'delivered') return false;
    if (!p.pickupLocation) return false;

    return areLocationsMatching(targetLoc, p.pickupLocation);
  });
}

/**
 * Groups all active packages by shared pickup locations.
 * Returns only clusters with 2 or more packages.
 * @param {Array<Object>} allPackages
 * @returns {Array<{ location: string, normalizedKey: string, packages: Array<Object> }>}
 */
export function getBundledLocations(allPackages = []) {
  if (!Array.isArray(allPackages)) return [];

  const activePackages = allPackages.filter((p) => (
    p &&
    !p.isArchived &&
    p.status !== 'archived' &&
    p.status !== 'delivered' &&
    Boolean(p.pickupLocation)
  ));

  const clusters = [];

  for (const pkg of activePackages) {
    let matchedCluster = clusters.find((c) => areLocationsMatching(c.location, pkg.pickupLocation));

    if (matchedCluster) {
      matchedCluster.packages.push(pkg);
    } else {
      clusters.push({
        location: pkg.pickupLocation,
        normalizedKey: normalizeLocation(pkg.pickupLocation),
        packages: [pkg]
      });
    }
  }

  return clusters.filter((c) => c.packages.length >= 2);
}
