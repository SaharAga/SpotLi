import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VALID_STATUSES } from '../../utils/packageValidator';
import { parsePackage, CLOUD_WRITABLE_KEYS, pickCloudWritableFields } from '../../schemas/packageSchema';
import { mergePackageData } from '../../services/deliveryService';

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('Firestore anonymous telemetry rules contract', () => {
  it('allowlists fields and rejects mutable telemetry documents', () => {
    expect(rules).toContain("request.resource.data.keys().hasOnly([\n          'id', 'status', 'type', 'message', 'rating', 'isAnonymous'");
    expect(rules).toContain("request.resource.data.keys().hasOnly([\n          'id', 'signature', 'componentName', 'message', 'appVersion'");
    expect(rules).toContain("request.resource.data.keys().hasOnly([\n          'source', 'confidence', 'editedFields', 'timestamp'");
    expect(rules).toMatch(/request\.resource\.data\.signature\.size\(\) > 0/);
    expect(rules).toContain("(png|jpe?g|webp|gif)(;[a-z0-9=_-]+)*;base64,");
    expect(rules).toMatch(/request\.resource\.data\.screenWidth is number[\s\S]*?screenWidth <= 10000/);
    expect(rules).toMatch(/request\.resource\.data\.screenHeight is number[\s\S]*?screenHeight <= 10000/);
    expect(rules).toMatch(/request\.resource\.data\.userAgent is string[\s\S]*?userAgent\.size\(\) <= 300/);
    expect(rules).toMatch(/match \/feedback\/\{feedbackId\}[\s\S]*?allow update, delete: if false;/);
    expect(rules).toMatch(/match \/crashReports\/\{crashId\}[\s\S]*?allow update, delete: if false;/);
    expect(rules).toMatch(/match \/parseCorrections\/\{docId\}[\s\S]*?allow update, delete: if false;/);
  });
});


describe('Firestore package rules contract', () => {
  // `firestore.rules` is the actual enforcement; the client's VALID_STATUSES
  // (which packageSchema.js turns into its Zod enum) is defense-in-depth. They
  // encode the same invariant deliberately — but only one of them is enforced,
  // so drift is not symmetric: a status the client accepts and the rules omit
  // is written to localStorage and then REJECTED by Firestore, and the package
  // silently stops syncing for every signed-in user.
  //
  // That is exactly what happened when `returned_to_sender` was added to the
  // client in #181 without the matching rules change. Nothing caught it,
  // because this file only ever asserted the anonymous-telemetry collections.
  it('accepts exactly the statuses the client considers valid', () => {
    const match = rules.match(/let validStatuses = \[([\s\S]*?)\];/);
    expect(match, 'validStatuses block not found in firestore.rules').not.toBeNull();

    const rulesStatuses = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

    // Compared as sorted sets: order in either list is not part of the contract,
    // membership is.
    expect([...rulesStatuses].sort()).toEqual([...VALID_STATUSES].sort());
  });

  it('still enforces the status allowlist on writes', () => {
    expect(rules).toMatch(/data\.status is string && data\.status in validStatuses/);
  });

  it('allows all package fields produced by schema and ingestion pipelines', () => {
    const match = rules.match(/let allowedKeys = \[([\s\S]*?)\];/);
    expect(match, 'allowedKeys block not found in firestore.rules').not.toBeNull();

    const allowedKeys = new Set([...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));

    const requiredKeys = [
      'id', 'title', 'titleHe', 'trackingNumber', 'carrier', 'carrierName',
      'status', 'category', 'orderDate', 'expectedDeliveryDate', 'origin',
      'destination', 'notes', 'notesHe', 'isPinned', 'isArchived',
      'checkpoints', 'pickupCode', 'pickupLocation', 'pickupHours', 'pickupPhone',
      'pickupDeadline', 'returnDeadline', 'returnNotes',
      'isRedirected', 'originalPickupLocation', 'redirectedAt', 'redirectReason',
      'store', 'orderNumber', 'createdAt', 'updatedAt', 'userId',
      'shelfNumber', 'localTrackingNumber', 'localCarrier', 'aliases', 'customsDetails',
      'source', 'lastUpdateSource', 'confidence', 'lockerPin', 'schemaVersion'
    ];

    for (const key of requiredKeys) {
      expect(allowedKeys.has(key), `Key "${key}" must be allowlisted in firestore.rules`).toBe(true);
    }
  });
});

// The keys half of the same contract, from the other direction. The test above
// asks "does the rules allowlist contain every field we produce?" — which
// passes happily while the client ALSO produces fields the allowlist omits.
// That asymmetry is what broke sync: firestore.rules gates writes on
// `hasOnly`, so one unexpected key refuses the whole document with "Missing or
// insufficient permissions", and the repairing schema's `catchall` (which
// preserves unknown fields on purpose, so an older client cannot strip a newer
// one's data) meant any stray field became permanent. `location`, written by
// mergePackageData and read by nothing, did exactly that.
describe('Firestore package rules contract — what the client actually sends', () => {
  const allowedKeysFromRules = () => {
    const match = rules.match(/let allowedKeys = \[([\s\S]*?)\];/);
    expect(match, 'allowedKeys block not found in firestore.rules').not.toBeNull();
    return new Set([...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
  };

  it('never emits a key the rules would refuse, for a freshly parsed package', () => {
    const allowed = allowedKeysFromRules();
    const parsed = parsePackage({
      id: 'pkg-1', title: 'T', trackingNumber: 'AB1', status: 'in_transit', userId: 'u1'
    });

    // isDemo reached here: the schema emits it on every package, so before it
    // was allowlisted *no* client write could satisfy hasOnly.
    const refused = Object.keys(parsed).filter((k) => !allowed.has(k));
    expect(refused, 'fields the client sends that firestore.rules refuses').toEqual([]);
  });

  it('never emits a key the rules would refuse, for a merged package', () => {
    const allowed = allowedKeysFromRules();
    const merged = mergePackageData(
      { id: 'pkg-1', title: 'AliExpress', trackingNumber: 'EP903055034', carrier: 'israel-post', status: 'in_transit', userId: 'u1' },
      { trackingNumber: 'EP903055034', status: 'ready_for_pickup' }
    );
    const sent = parsePackage({ ...merged, userId: 'u1' });

    const refused = Object.keys(sent).filter((k) => !allowed.has(k));
    expect(refused, 'fields the merge path sends that firestore.rules refuses').toEqual([]);
  });

  it('keeps CLOUD_WRITABLE_KEYS and the rules allowlist identical', () => {
    // The boundary filter is only as good as its list. Drift in either
    // direction is a bug: a key here but not in the rules is a write that
    // fails, a key in the rules but not here is a field that silently never
    // reaches the cloud.
    expect([...CLOUD_WRITABLE_KEYS].sort()).toEqual([...allowedKeysFromRules()].sort());
  });

  it('drops an unknown field at the boundary instead of poisoning the write', () => {
    // The durable half of the fix: catchall keeps unknown fields locally, and
    // they stop here rather than refusing the document.
    const narrowed = pickCloudWritableFields({
      id: 'pkg-1', title: 'T', trackingNumber: 'AB1', status: 'in_transit',
      somethingAFutureVersionAdded: 'x', location: 'Tel Aviv'
    });
    expect(narrowed).not.toHaveProperty('somethingAFutureVersionAdded');
    expect(narrowed).not.toHaveProperty('location');
    expect(narrowed.trackingNumber).toBe('AB1');
  });
});
