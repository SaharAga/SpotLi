/**
 * Small localStorage helpers that centralize the guard/parse/warn/fallback
 * boilerplate repeated across modules.
 *
 * Semantics intentionally match the existing call sites: reads never throw —
 * they warn and return the fallback when storage is unavailable, missing, or
 * holds malformed JSON.
 */

function getStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    // Some browsers throw on property access in strict private mode
    return null;
  }
}

/**
 * Reads and JSON-parses a key. Never throws.
 * @template T
 * @param {string} key
 * @param {T} [fallback=null]
 * @returns {T}
 */
export function readJSON(key, fallback = null) {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch (e) {
    console.warn(`[storage] Failed to read "${key}" from localStorage:`, e);
    return fallback;
  }
}

/**
 * JSON-serializes and writes a value.
 *
 * Unlike readJSON this surfaces failure to the caller by returning false
 * (quota exceeded, private mode, unserializable value) so callers can react
 * instead of silently losing data. It still does not throw.
 * @param {string} key
 * @param {any} value
 * @returns {boolean} true when the value was persisted
 */
export function writeJSON(key, value) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`[storage] Failed to write "${key}" to localStorage:`, e);
    return false;
  }
}

/**
 * Reads a raw (non-JSON) string value. Never throws.
 * @param {string} key
 * @param {string|null} [fallback=null]
 * @returns {string|null}
 */
export function readString(key, fallback = null) {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw === null || raw === undefined ? fallback : raw;
  } catch (e) {
    console.warn(`[storage] Failed to read "${key}" from localStorage:`, e);
    return fallback;
  }
}

/**
 * Writes a raw (non-JSON) string value.
 * @param {string} key
 * @param {string} value
 * @returns {boolean} true when the value was persisted
 */
export function writeString(key, value) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    // Ignore in strict private mode
    return false;
  }
}
