import { STORAGE_KEYS } from '../constants/storageKeys';

/**
 * Supported Navigation Applications.
 *
 * @enum {string}
 */
export const NAV_APPS = Object.freeze({
  WAZE: 'waze',
  GOOGLE_MAPS: 'google_maps',
  APPLE_MAPS: 'apple_maps',
  MOOVIT: 'moovit',
  OS_DEFAULT: 'os_default'
});

/**
 * ============================================================================
 * NATIVE APP MIGRATION BLUEPRINT (React Native / Capacitor / Flutter):
 * ============================================================================
 * 1. Web / PWA (Current):
 *    - Browsers restrict querying installed native apps to prevent device fingerprinting.
 *    - Universal HTTPS deep links (https://waze.com/ul, https://maps.apple.com,
 *      https://www.google.com/maps, https://moovitapp.com) are used so the OS
 *      automatically intercepts them to launch the installed native app, falling
 *      back to the web browser if the app is not installed.
 *    - Android supports `geo:0,0?q=...` to prompt the system-level App Chooser.
 *
 * 2. Native App Migration (Future):
 *    - iOS: Declare schemes in Info.plist (`LSApplicationQueriesSchemes`: ['waze', 'comgooglemaps', 'moovit', 'maps'])
 *      and use `canOpenURL()` to filter out uninstalled apps from the choice sheet dynamically.
 *    - Android: Declare `<queries>` in AndroidManifest.xml (`waze://`, `geo:`, `google.navigation:`, `moovit://`)
 *      and use `PackageManager.queryIntentActivities()`.
 *    - Dispatch: Replace `window.open()` in `openNavigationApp()` with `AppLauncher.openUrl()` or `Linking.openURL()`.
 * ============================================================================
 */

/**
 * Builds a universal deep link or URI scheme for the target navigation provider.
 *
 * @param {string} appId - One of NAV_APPS values.
 * @param {{ location?: string, lat?: number | string, lng?: number | string, title?: string }} target
 * @returns {string} The fully formatted navigation URL.
 */
export function buildNavigationUrl(appId, target = {}) {
  const { location = '', lat, lng, title = '' } = target;
  const cleanLocation = (typeof location === 'string' ? location : '').trim();
  const cleanTitle = (typeof title === 'string' ? title : '').trim();
  const query = cleanLocation || cleanTitle;

  const hasCoords =
    lat !== undefined &&
    lat !== null &&
    lng !== undefined &&
    lng !== null &&
    !Number.isNaN(Number(lat)) &&
    !Number.isNaN(Number(lng));

  const numLat = hasCoords ? Number(lat) : null;
  const numLng = hasCoords ? Number(lng) : null;

  switch (appId) {
    case NAV_APPS.WAZE:
      if (hasCoords) {
        return `https://waze.com/ul?ll=${numLat},${numLng}&navigate=yes`;
      }
      return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;

    case NAV_APPS.GOOGLE_MAPS:
      if (hasCoords && cleanLocation) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cleanLocation}`)}`;
      }
      if (hasCoords) {
        return `https://www.google.com/maps/search/?api=1&query=${numLat},${numLng}`;
      }
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

    case NAV_APPS.APPLE_MAPS:
      if (hasCoords && cleanLocation) {
        return `https://maps.apple.com/?ll=${numLat},${numLng}&q=${encodeURIComponent(cleanLocation)}`;
      }
      if (hasCoords) {
        return `https://maps.apple.com/?ll=${numLat},${numLng}&q=${encodeURIComponent(cleanTitle || 'Pickup Point')}`;
      }
      return `https://maps.apple.com/?q=${encodeURIComponent(query)}`;

    case NAV_APPS.MOOVIT:
      if (hasCoords) {
        return `https://moovitapp.com/?dest_lat=${numLat}&dest_lon=${numLng}&dest_name=${encodeURIComponent(query || 'Pickup Location')}`;
      }
      return `https://moovitapp.com/?to=${encodeURIComponent(query)}`;

    case NAV_APPS.OS_DEFAULT:
      if (hasCoords && cleanLocation) {
        return `geo:${numLat},${numLng}?q=${encodeURIComponent(cleanLocation)}`;
      }
      if (hasCoords) {
        return `geo:${numLat},${numLng}?q=${numLat},${numLng}`;
      }
      return `geo:0,0?q=${encodeURIComponent(query)}`;

    default:
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
}

/**
 * Retrieves the user's preferred navigation app from localStorage.
 *
 * @returns {string|null} The stored NAV_APPS id or null if none is set.
 */
export function getPreferredNavigationApp() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const val = localStorage.getItem(STORAGE_KEYS.PREFERRED_NAV_APP);
    if (val && Object.values(NAV_APPS).includes(val)) {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists the user's preferred navigation app to localStorage.
 *
 * @param {string} appId - One of NAV_APPS values.
 * @returns {boolean} Whether the preference was successfully saved.
 */
export function setPreferredNavigationApp(appId) {
  if (typeof localStorage === 'undefined') return false;
  if (!appId || !Object.values(NAV_APPS).includes(appId)) return false;
  try {
    localStorage.setItem(STORAGE_KEYS.PREFERRED_NAV_APP, appId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears the user's preferred navigation app from localStorage.
 *
 * @returns {boolean} Whether the clear operation succeeded.
 */
export function clearPreferredNavigationApp() {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.removeItem(STORAGE_KEYS.PREFERRED_NAV_APP);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the specified navigation app deep link or web link in a new tab/app.
 *
 * @param {string} appId
 * @param {{ location?: string, lat?: number | string, lng?: number | string, title?: string }} target
 * @returns {Window|null}
 */
export function openNavigationApp(appId, target = {}) {
  const url = buildNavigationUrl(appId, target);
  if (typeof window !== 'undefined') {
    if (url.startsWith('geo:')) {
      window.location.href = url;
      return null;
    }
    return window.open(url, '_blank', 'noopener,noreferrer');
  }
  return null;
}

/**
 * Returns metadata list for all supported navigation apps.
 *
 * @param {string} [language='he']
 * @returns {Array<{ id: string, name: string, nameHe: string, type: 'driving'|'transit'|'multi'|'system', descEn: string, descHe: string, color: string, badgeBg: string }>}
 */
export function getNavigationAppList(language = 'he') {
  return [
    {
      id: NAV_APPS.WAZE,
      name: 'Waze',
      nameHe: 'ווייז (Waze)',
      type: 'driving',
      descEn: 'Live traffic, fastest driving route & speed cameras',
      descHe: 'ניווט לרכב בזמן אמת, עומסי תנועה ודיווחים חיים',
      color: 'bg-cyan-500 hover:bg-cyan-400 text-white',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
    },
    {
      id: NAV_APPS.GOOGLE_MAPS,
      name: 'Google Maps',
      nameHe: 'גוגל מפות (Google Maps)',
      type: 'multi',
      descEn: 'Driving, walking, transit & Street View',
      descHe: 'מפות, ניווט רגלי, נהיגה ותצוגת רחוב',
      color: 'bg-blue-600 hover:bg-blue-500 text-white',
      badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40'
    },
    {
      id: NAV_APPS.APPLE_MAPS,
      name: 'Apple Maps',
      nameHe: 'אפל מפות (Apple Maps)',
      type: 'multi',
      descEn: 'Native Apple ecosystem navigation',
      descHe: 'ניווט מובנה במכשירי iOS ו-macOS',
      color: 'bg-slate-700 hover:bg-slate-600 text-white',
      badgeBg: 'bg-slate-700/60 text-slate-200 border-slate-600'
    },
    {
      id: NAV_APPS.MOOVIT,
      name: 'Moovit',
      nameHe: 'מוביט (Moovit)',
      type: 'transit',
      descEn: 'Public transit, bus lines, train & light rail',
      descHe: 'תחבורה ציבורית, קווי אוטובוס, רכבת ורכבת קלה',
      color: 'bg-amber-600 hover:bg-amber-500 text-white',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    }
  ];
}
