import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VALID_STATUSES } from '../../utils/packageValidator';

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
      'source', 'confidence', 'lockerPin', 'schemaVersion'
    ];

    for (const key of requiredKeys) {
      expect(allowedKeys.has(key), `Key "${key}" must be allowlisted in firestore.rules`).toBe(true);
    }
  });
});
