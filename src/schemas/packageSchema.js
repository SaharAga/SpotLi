import { z } from 'zod';
import { sanitizeString, VALID_STATUSES } from '../utils/packageValidator';
import { CARRIERS, getCarrier } from '../types/carriers';
import { CATEGORIES } from '../types/stages';
import { toLocalISODate } from '../utils/dateUtils';

export { VALID_STATUSES };

/**
 * Zod schema for individual tracking checkpoint verification.
 * @type {z.ZodType<import('../types/deliveree').Checkpoint>}
 */
export const checkpointSchema = z.object({
  id: z.string().max(100).transform(s => sanitizeString(s, 100)),
  title: z.string().max(200).transform(s => sanitizeString(s, 200)),
  titleHe: z.string().max(200).optional().transform(s => (s ? sanitizeString(s, 200) : undefined)),
  description: z.string().max(500).optional().default('').transform(s => sanitizeString(s, 500)),
  descriptionHe: z.string().max(500).optional().default('').transform(s => sanitizeString(s, 500)),
  location: z.string().max(150).optional().default('').transform(s => sanitizeString(s, 150)),
  timestamp: z.string().max(50).default(() => new Date().toISOString()),
  isCompleted: z.boolean().default(true)
}).strip();

/**
 * Zod schema for full Package entity verification and sanitization.
 * @type {z.ZodType<import('../types/deliveree').Package>}
 */
export const packageSchema = z.object({
  id: z.string().max(100).transform(s => sanitizeString(s, 100)),
  title: z.string().min(1).max(200).transform(s => sanitizeString(s, 200)),
  titleHe: z.string().max(200).optional().transform(s => (s ? sanitizeString(s, 200) : undefined)),
  trackingNumber: z.string().min(1).max(100).transform(s => sanitizeString(s, 100).toUpperCase().replace(/[^A-Z0-9_-]/g, '')),
  carrier: z.string().max(50).default('other').transform(s => sanitizeString(s, 50).toLowerCase()),
  carrierName: z.string().max(100).optional().transform(s => (s ? sanitizeString(s, 100) : undefined)),
  status: z.enum(VALID_STATUSES).default('in_transit'),
  category: z.string().max(50).default('other').transform(s => sanitizeString(s, 50).toLowerCase()),
  orderDate: z.string().max(50).optional().default(() => toLocalISODate()),
  expectedDeliveryDate: z.string().max(50).optional().default(''),
  origin: z.string().max(150).optional().default('').transform(s => sanitizeString(s, 150)),
  destination: z.string().max(150).optional().default('Israel').transform(s => sanitizeString(s, 150)),
  notes: z.string().max(1000).optional().default('').transform(s => sanitizeString(s, 1000)),
  notesHe: z.string().max(1000).optional().default('').transform(s => sanitizeString(s, 1000)),
  pickupCode: z.string().max(50).optional().transform(s => (s ? sanitizeString(s, 50) : undefined)),
  pickupLocation: z.string().max(250).optional().transform(s => (s ? sanitizeString(s, 250) : undefined)),
  pickupHours: z.string().max(200).optional().transform(s => (s ? sanitizeString(s, 200) : undefined)),
  pickupPhone: z.string().max(50).optional().transform(s => (s ? sanitizeString(s, 50) : undefined)),
  pickupDeadline: z.string().max(50).optional().transform(s => (s ? sanitizeString(s, 50) : undefined)),
  returnDeadline: z.string().max(50).optional().transform(s => (s ? sanitizeString(s, 50) : undefined)),
  returnNotes: z.string().max(500).optional().transform(s => (s ? sanitizeString(s, 500) : undefined)),
  isRedirected: z.boolean().default(false),
  originalPickupLocation: z.string().max(250).optional().transform(s => (s ? sanitizeString(s, 250) : undefined)),
  redirectedAt: z.string().max(50).optional().transform(s => (s ? sanitizeString(s, 50) : undefined)),
  redirectReason: z.string().max(100).optional().transform(s => (s ? sanitizeString(s, 100) : undefined)),
  store: z.string().max(100).optional().transform(s => (s ? sanitizeString(s, 100) : undefined)),
  shelfNumber: z.string().max(50).optional().transform(s => (s ? sanitizeString(s, 50) : undefined)),
  localTrackingNumber: z.string().max(100).optional().transform(s => (s ? sanitizeString(s, 100).toUpperCase().replace(/[^A-Z0-9_-]/g, '') : undefined)),
  localCarrier: z.string().max(50).optional().transform(s => (s ? sanitizeString(s, 50).toLowerCase() : undefined)),
  aliases: z.array(z.string().max(100)).max(10).optional().default([]),
  customsDetails: z.object({
    amount: z.number().optional(),
    paymentUrl: z.string().max(500).optional(),
    isCleared: z.boolean().optional(),
    declarationNumber: z.string().max(100).optional(),
    handler: z.string().max(100).optional()
  }).optional(),
  isPinned: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  checkpoints: z.array(checkpointSchema).max(50).default([]),
  createdAt: z.string().max(50).default(() => new Date().toISOString()),
  updatedAt: z.string().max(50).default(() => new Date().toISOString()),
  userId: z.string().max(128).optional()
}).strip();

/**
 * Zod schema for package collections.
 * @type {z.ZodType<import('../types/deliveree').Package[]>}
 */
export const packageListSchema = z.array(packageSchema);

/**
 * Validates untrusted data against the Package Zod schema.
 * Rejects prototype pollution, strips unknown keys, and handles data sanitization.
 * 
 * @param {unknown} data
 * @returns {z.SafeParseReturnType<unknown, import('../types/deliveree').Package>}
 */
export function validatePackageSafe(data) {
  return packageSchema.safeParse(data);
}

/**
 * Validates untrusted data list against the Package List Zod schema.
 * 
 * @param {unknown} data
 * @returns {z.SafeParseReturnType<unknown, import('../types/deliveree').Package[]>}
 */
export function validatePackageListSafe(data) {
  return packageListSchema.safeParse(data);
}

/* ------------------------------------------------------------------------- *
 * Single repairing entry point (P0.1)
 *
 * Historically two complete validators existed: the strict Zod schema above
 * (which REJECTS malformed records) and the hand-rolled validator in
 * packageValidator.js (which REPAIRS them). Which one ran depended on the
 * code path. The schema below folds the REPAIR policy into Zod so there is
 * one entry point — `parsePackage` / `parsePackageList` — applying exactly
 * the coercions the hand-rolled validator applied.
 * ------------------------------------------------------------------------- */

/** Current package record schema version. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Advisory ceiling for a package list. Used only to raise an `overflow` flag —
 * lists are never truncated (P0.2).
 */
export const PACKAGE_LIST_SOFT_LIMIT = 1000;

/** Maximum number of checkpoints retained per package. */
export const MAX_CHECKPOINTS = 50;

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const VALID_CARRIER_IDS = new Set(Object.keys(CARRIERS));
const VALID_STAGE_IDS = new Set(VALID_STATUSES);
const VALID_CATEGORY_IDS = new Set(CATEGORIES.map(c => c.id));

/**
 * Prototype-pollution guard used as a Zod `.preprocess()` step: copies own keys
 * onto a null-prototype object, dropping `__proto__` / `constructor` /
 * `prototype`. Unknown (but harmless) keys are deliberately kept — erasing them
 * silently was the data-loss bug this replaces.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function stripDangerousKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const safeObj = Object.create(null);
  for (const key of Object.keys(value)) {
    if (!DANGEROUS_KEYS.has(key)) {
      safeObj[key] = value[key];
    }
  }
  return safeObj;
}

/**
 * Field helper: sanitize an unknown value into a bounded string, applying a
 * fallback when the sanitized result is empty.
 *
 * @param {number} maxLength
 * @param {string|(() => string)} [fallback='']
 */
function repairedString(maxLength, fallback = '') {
  return z.unknown().optional().transform((value) => {
    const cleaned = sanitizeString(value, maxLength);
    if (cleaned) return cleaned;
    return typeof fallback === 'function' ? fallback() : fallback;
  });
}

/**
 * Field helper: coerce a value to a member of `allowed`, falling back to
 * `fallbackValue` for anything unrecognized.
 *
 * @param {Set<string>} allowed
 * @param {string} fallbackValue
 */
function repairedEnum(allowed, fallbackValue) {
  return z.unknown().optional().transform((value) => {
    const raw = typeof value === 'string' ? value.toLowerCase().trim() : '';
    return allowed.has(raw) ? raw : fallbackValue;
  });
}

/**
 * Repairing checkpoint schema — coerces anything object-shaped into a valid
 * checkpoint using the legacy fallback values.
 */
export const repairingCheckpointSchema = z.preprocess(
  stripDangerousKeys,
  z.object({
    id: repairedString(100),
    title: repairedString(200, 'Status Update'),
    titleHe: repairedString(200),
    description: repairedString(500),
    descriptionHe: repairedString(500),
    location: repairedString(150),
    timestamp: repairedString(50, () => new Date().toISOString()),
    isCompleted: z.unknown().optional().transform(v => (typeof v === 'boolean' ? v : true))
  }).catchall(z.unknown())
).transform((cp) => ({
  ...cp,
  titleHe: cp.titleHe || cp.title,
  descriptionHe: cp.descriptionHe || cp.description
}));

/**
 * Repairing package schema. Unknown keys survive (`catchall`), dangerous keys
 * do not (`preprocess`), and every known field carries the coercion the legacy
 * hand-rolled validator applied.
 */
export const repairingPackageSchema = z.preprocess(
  stripDangerousKeys,
  z.object({
    id: repairedString(100, () => `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    title: repairedString(200, 'Untitled Package'),
    titleHe: repairedString(200),
    trackingNumber: z.unknown().optional().transform((value) => {
      const cleaned = sanitizeString(value, 100).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      return cleaned || 'UNTRACKED';
    }),
    carrier: repairedEnum(VALID_CARRIER_IDS, 'other'),
    carrierName: repairedString(100),
    status: repairedEnum(VALID_STAGE_IDS, 'in_transit'),
    category: repairedEnum(VALID_CATEGORY_IDS, 'other'),
    orderDate: repairedString(50, () => toLocalISODate()),
    expectedDeliveryDate: repairedString(50),
    origin: repairedString(150),
    destination: repairedString(150, 'Israel'),
    notes: repairedString(1000),
    notesHe: repairedString(1000),
    pickupCode: repairedString(50),
    pickupLocation: repairedString(250),
    pickupHours: repairedString(200),
    pickupPhone: repairedString(50),
    pickupDeadline: repairedString(50),
    returnDeadline: repairedString(50),
    returnNotes: repairedString(500),
    isRedirected: z.unknown().optional().transform(Boolean),
    originalPickupLocation: repairedString(250),
    redirectedAt: repairedString(50),
    redirectReason: repairedString(100),
    store: repairedString(100),
    shelfNumber: repairedString(50),
    localTrackingNumber: z.unknown().optional().transform((value) => {
      const cleaned = sanitizeString(value, 100).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      return cleaned || undefined;
    }),
    localCarrier: repairedEnum(VALID_CARRIER_IDS, undefined),
    aliases: z.unknown().optional().transform((value) => {
      if (!Array.isArray(value)) return [];
      return value
        .map((x) => sanitizeString(x, 100).toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
        .filter(Boolean)
        .slice(0, 10);
    }),
    customsDetails: z.unknown().optional().transform((val) => {
      if (!val || typeof val !== 'object' || Array.isArray(val)) return undefined;
      const cd = val;
      return {
        amount: typeof cd.amount === 'number' ? cd.amount : undefined,
        paymentUrl: sanitizeString(cd.paymentUrl, 500) || undefined,
        isCleared: typeof cd.isCleared === 'boolean' ? cd.isCleared : undefined,
        declarationNumber: sanitizeString(cd.declarationNumber, 100) || undefined,
        handler: sanitizeString(cd.handler, 100) || undefined
      };
    }),
    isPinned: z.unknown().optional().transform(Boolean),
    isArchived: z.unknown().optional().transform(Boolean),
    checkpoints: z.unknown().optional().transform((value) => {
      if (!Array.isArray(value)) return [];
      const out = [];
      for (let i = 0; i < value.length && out.length < MAX_CHECKPOINTS; i++) {
        const cp = value[i];
        if (!cp || typeof cp !== 'object' || Array.isArray(cp)) continue;
        const parsed = repairingCheckpointSchema.safeParse(cp);
        if (parsed.success) {
          out.push({ ...parsed.data, id: parsed.data.id || `cp-${Date.now()}-${i}` });
        }
      }
      return out;
    }),
    createdAt: repairedString(50, () => new Date().toISOString()),
    updatedAt: repairedString(50, () => new Date().toISOString()),
    userId: repairedString(128),
    schemaVersion: z.unknown().optional().transform(
      v => (Number.isInteger(v) && v > 0 ? v : CURRENT_SCHEMA_VERSION)
    )
  }).catchall(z.unknown())
).transform((pkg) => {
  const out = {
    ...pkg,
    titleHe: pkg.titleHe || pkg.title,
    notesHe: pkg.notesHe || pkg.notes,
    carrierName: pkg.carrierName || getCarrier(pkg.carrier).name
  };
  // Legacy contract: `userId` is absent rather than empty when unknown.
  if (!out.userId) {
    delete out.userId;
  }
  return out;
});

/**
 * THE package entry point. Repairs and sanitizes untrusted package data.
 * Returns `null` only when the input is not a plain object.
 *
 * @param {unknown} data
 * @returns {object|null} Repaired package, or null
 */
export function parsePackage(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const result = repairingPackageSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * THE package-list entry point. Repairs every entry and NEVER truncates —
 * an over-large list is reported via `overflow` so callers can act on it
 * instead of silently losing records (P0.2).
 *
 * @param {unknown} data
 * @returns {{ packages: object[], total: number, invalid: number, overflow: boolean, limit: number }}
 */
export function parsePackageList(data) {
  if (!Array.isArray(data)) {
    return { packages: [], total: 0, invalid: 0, overflow: false, limit: PACKAGE_LIST_SOFT_LIMIT };
  }

  const packages = [];
  let invalid = 0;
  for (const item of data) {
    const parsed = parsePackage(item);
    if (parsed) {
      packages.push(parsed);
    } else {
      invalid++;
    }
  }

  return {
    packages,
    total: data.length,
    invalid,
    overflow: packages.length > PACKAGE_LIST_SOFT_LIMIT,
    limit: PACKAGE_LIST_SOFT_LIMIT
  };
}
