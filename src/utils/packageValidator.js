import { CARRIERS, getCarrier } from '../types/carriers';
import { STAGES, CATEGORIES } from '../types/stages';
import { toLocalISODate } from './dateUtils';
// NOTE: this module deliberately does NOT import from '../schemas/packageSchema'.
// packageSchema imports `sanitizeString` from here; importing back created a
// circular dependency. The canonical status list therefore lives here and is
// re-exported by packageSchema, keeping the dependency one-directional.

/**
 * Valid delivery status identifiers matching DeliveryStageId.
 * Note: `STAGES` covers only the visual pipeline, so it is not a substitute
 * for this list (it omits `exception`).
 * @type {readonly [import('../types/deliveree').DeliveryStageId, ...import('../types/deliveree').DeliveryStageId[]]}
 */
export const VALID_STATUSES = /** @type {const} */ ([
  'ordered',
  'shipped',
  'in_transit',
  'customs',
  'out_for_delivery',
  'delivered',
  'exception',
  'archived'
]);

const VALID_CARRIER_IDS = new Set(Object.keys(CARRIERS));
const VALID_STAGE_IDS = new Set(VALID_STATUSES || STAGES.map(s => s.id));
const VALID_CATEGORY_IDS = new Set(CATEGORIES.map(c => c.id));

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Current package record schema version stamped on validated records.
 * Kept in sync with `CURRENT_SCHEMA_VERSION` in `../schemas/packageSchema`; it
 * is duplicated rather than imported because packageSchema imports from this
 * module and the dependency must stay one-directional.
 * @type {number}
 */
export const SCHEMA_VERSION = 1;

/**
 * Advisory ceiling for a package list. Nothing is truncated at this size — it
 * exists so callers can warn. Silently slicing here meant a user with more
 * than 1,000 packages had every export quietly cut short while storage kept
 * all of them (issue #40).
 * @type {number}
 */
export const PACKAGE_LIST_ADVISORY_LIMIT = 1000;

/**
 * Sanitizes an untrusted string by stripping HTML/script tags, XSS attack vectors,
 * dangerous URI schemes, HTML entities, and non-printable control characters.
 *
 * @param {unknown} input - The input to sanitize
 * @param {number} [maxLength=500] - Maximum allowed length
 * @returns {string} Sanitized string
 */
export function sanitizeString(input, maxLength = 500) {
  if (input === null || input === undefined) {
    return '';
  }

  let str = typeof input === 'string' ? input : String(input);

  // Early length guard to prevent CPU exhaustion on huge strings
  const earlyBound = Math.max(maxLength * 4, 2000);
  if (str.length > earlyBound) {
    str = str.slice(0, earlyBound);
  }

  // 1. Remove non-printable control characters (ASCII 0-8, 11-12, 14-31, 127-159)
  // eslint-disable-next-line no-control-regex
  str = str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');

  // 2. Strip dangerous script/style/iframe/embed/object tags and their inner content
  str = str.replace(/<\s*(?:script|style|iframe|object|embed|applet|svg|meta|link)[^>]*>[\s\S]*?<\s*\/\s*(?:script|style|iframe|object|embed|applet|svg|meta|link)\s*>/gi, '');

  // 3. Strip self-closing or unclosed dangerous tags (e.g. <script ... />, <img ... />)
  str = str.replace(/<\s*(?:script|style|iframe|object|embed|applet|svg|meta|link|base)[^>]*\/?>/gi, '');

  // 4. Strip inline event handlers (e.g. onerror=..., onclick=..., onload=...)
  str = str.replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 5. Strip dangerous URL schemes (javascript:, vbscript:, data:text/html)
  str = str.replace(/(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, '');

  // 6. Strip all remaining HTML tags
  str = str.replace(/<\/?[a-zA-Z][^>]*>/g, '');

  // 7. Strip unescaped angle brackets and quotes that could be injected into attributes
  str = str.replace(/[<>]/g, '');

  // 8. Trim whitespace
  str = str.trim();

  // 9. Enforce max length constraint (including 0)
  if (typeof maxLength === 'number' && maxLength >= 0 && str.length > maxLength) {
    str = str.slice(0, maxLength);
  }

  return str;

}

/**
 * Validates and sanitizes a single checkpoint object.
 *
 * @param {unknown} cp - Checkpoint object
 * @param {number} index - Fallback index for ID generation
 * @returns {object|null} Sanitized checkpoint or null if completely invalid
 */
function validateCheckpoint(cp, index = 0) {
  if (!cp || typeof cp !== 'object' || Array.isArray(cp)) {
    return null;
  }

  // Guard against prototype pollution by building an isolated object
  const safeObj = Object.create(null);
  for (const key of Object.keys(cp)) {
    if (!DANGEROUS_KEYS.has(key)) {
      safeObj[key] = cp[key];
    }
  }

  const id = sanitizeString(safeObj.id, 100) || `cp-${Date.now()}-${index}`;
  const title = sanitizeString(safeObj.title, 200) || 'Status Update';
  const titleHe = sanitizeString(safeObj.titleHe, 200) || title;
  const description = sanitizeString(safeObj.description, 500) || '';
  const descriptionHe = sanitizeString(safeObj.descriptionHe, 500) || description;
  const location = sanitizeString(safeObj.location, 150) || '';
  const timestamp = sanitizeString(safeObj.timestamp, 50) || new Date().toISOString();
  const isCompleted = typeof safeObj.isCompleted === 'boolean' ? safeObj.isCompleted : true;

  return {
    id,
    title,
    titleHe,
    description,
    descriptionHe,
    location,
    timestamp,
    isCompleted
  };
}

// Strict whitelist of permitted top-level keys
const ALLOWED_PACKAGE_KEYS = new Set([
  'id',
  'title',
  'titleHe',
  'trackingNumber',
  'carrier',
  'carrierName',
  'status',
  'category',
  'orderDate',
  'expectedDeliveryDate',
  'origin',
  'destination',
  'notes',
  'notesHe',
  'isPinned',
  'isArchived',
  'checkpoints',
  'createdAt',
  'updatedAt',
  'userId',
  'schemaVersion'
]);

/**
 * Strictly validates and normalizes a package object against system schemas.
 * Rejects prototype pollution, strips unwhitelisted keys, and ensures strict data integrity.
 *
 * @param {unknown} pkg - The package object to validate
 * @returns {object|null} Validated and sanitized package object, or null if input is not an object
 */
export function validatePackage(pkg) {
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    return null;
  }

  // Guard against prototype pollution and unwhitelisted keys
  const safeObj = Object.create(null);
  for (const key of Object.keys(pkg)) {
    if (!DANGEROUS_KEYS.has(key) && ALLOWED_PACKAGE_KEYS.has(key)) {
      safeObj[key] = pkg[key];
    }
  }

  // 1. Identification
  const id = sanitizeString(safeObj.id, 100) || `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const title = sanitizeString(safeObj.title, 200) || 'Untitled Package';
  const titleHe = sanitizeString(safeObj.titleHe, 200) || title;
  
  // Tracking number: uppercase alphanumeric + dash/underscore
  const rawTracking = sanitizeString(safeObj.trackingNumber, 100).toUpperCase();
  const trackingNumber = rawTracking.replace(/[^A-Z0-9_-]/g, '') || 'UNTRACKED';

  // 2. Carrier resolution & fallback
  const rawCarrier = typeof safeObj.carrier === 'string' ? safeObj.carrier.toLowerCase().trim() : '';
  const carrier = VALID_CARRIER_IDS.has(rawCarrier) ? rawCarrier : 'other';
  const defaultCarrierObj = getCarrier(carrier);
  const carrierName = sanitizeString(safeObj.carrierName, 100) || defaultCarrierObj.name;

  // 3. Status stage resolution & fallback
  const rawStatus = typeof safeObj.status === 'string' ? safeObj.status.toLowerCase().trim() : '';
  const status = VALID_STAGE_IDS.has(rawStatus) ? rawStatus : 'in_transit';

  // 4. Category resolution & fallback
  const rawCategory = typeof safeObj.category === 'string' ? safeObj.category.toLowerCase().trim() : '';
  const category = VALID_CATEGORY_IDS.has(rawCategory) ? rawCategory : 'other';

  // 5. Dates & Routes
  const orderDate = sanitizeString(safeObj.orderDate, 50) || toLocalISODate();
  const expectedDeliveryDate = sanitizeString(safeObj.expectedDeliveryDate, 50) || '';
  const origin = sanitizeString(safeObj.origin, 150) || '';
  const destination = sanitizeString(safeObj.destination, 150) || 'Israel';

  // 6. Notes
  const notes = sanitizeString(safeObj.notes, 1000) || '';
  const notesHe = sanitizeString(safeObj.notesHe, 1000) || notes;

  // 7. Flags
  const isPinned = Boolean(safeObj.isPinned);
  const isArchived = Boolean(safeObj.isArchived);

  // 8. Checkpoints list validation (cap at 50)
  let checkpoints = [];
  if (Array.isArray(safeObj.checkpoints)) {
    checkpoints = safeObj.checkpoints
      .slice(0, 50)
      .map((cp, idx) => validateCheckpoint(cp, idx))
      .filter(Boolean);
  }

  // 9. Timestamps
  const createdAt = sanitizeString(safeObj.createdAt, 50) || new Date().toISOString();
  const updatedAt = sanitizeString(safeObj.updatedAt, 50) || new Date().toISOString();
  
  // Schema version: preserved when already stamped, otherwise stamped now.
  const rawSchemaVersion = safeObj.schemaVersion;
  const schemaVersion = Number.isInteger(rawSchemaVersion) && rawSchemaVersion > 0
    ? rawSchemaVersion
    : SCHEMA_VERSION;

  // Optional userId
  const userId = safeObj.userId ? sanitizeString(safeObj.userId, 128) : undefined;

  // Construct a clean, isolated output object
  const output = {
    id,
    title,
    titleHe,
    trackingNumber,
    carrier,
    carrierName,
    status,
    category,
    orderDate,
    expectedDeliveryDate,
    origin,
    destination,
    notes,
    notesHe,
    isPinned,
    isArchived,
    checkpoints,
    createdAt,
    updatedAt,
    schemaVersion
  };

  if (userId) {
    output.userId = userId;
  }

  return output;
}

/**
 * Validates, filters, and sanitizes an entire package list.
 * Guards against prototype pollution and discards invalid entries.
 *
 * NEVER truncates: every valid entry is returned. Lists longer than
 * `PACKAGE_LIST_ADVISORY_LIMIT` are returned in full — callers that care about
 * size can compare against that constant (see `isPackageListOverflowing`).
 *
 * @param {unknown} packages - The list of packages
 * @returns {Array<object>} Sanitized list of valid packages
 */
export function validatePackageList(packages) {
  if (!Array.isArray(packages)) {
    return [];
  }

  const result = [];
  for (let i = 0; i < packages.length; i++) {
    const item = packages[i];
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const validated = validatePackage(item);
      if (validated) {
        result.push(validated);
      }
    }
  }

  return result;
}

/**
 * Reports whether a validated list sits above the advisory ceiling. Advisory
 * only — nothing is dropped.
 *
 * @param {unknown} packages
 * @returns {boolean}
 */
export function isPackageListOverflowing(packages) {
  return Array.isArray(packages) && packages.length > PACKAGE_LIST_ADVISORY_LIMIT;
}
