import { describe, it, expect } from 'vitest';
import {
  validatePackageSafe,
  validatePackageListSafe,
  parsePackage,
  parsePackageList,
  CURRENT_SCHEMA_VERSION,
  PACKAGE_LIST_SOFT_LIMIT
} from './packageSchema';
import { validatePackage } from '../utils/packageValidator';

describe('packageSchema Zod validation', () => {
  it('validates a complete, well-formed package', () => {
    const validPkg = {
      id: 'pkg-123',
      title: 'Ergonomic Keyboard',
      titleHe: 'מקלדת ארגונומית',
      trackingNumber: 'IL123456789IL',
      carrier: 'israel_post',
      carrierName: 'Israel Post',
      status: 'in_transit',
      category: 'electronics',
      orderDate: '2026-08-10',
      expectedDeliveryDate: '2026-08-25',
      origin: 'Shenzhen, China',
      destination: 'Tel Aviv, Israel',
      notes: 'Please leave at the door',
      notesHe: 'להשאיר ליד הדלת',
      isPinned: true,
      isArchived: false,
      checkpoints: [
        {
          id: 'cp-1',
          title: 'Departed sorting facility',
          titleHe: 'יצא ממרכז מיון',
          description: 'Package en route',
          location: 'Shenzhen',
          timestamp: '2026-08-12T10:00:00Z',
          isCompleted: true
        }
      ],
      createdAt: '2026-08-10T12:00:00Z',
      updatedAt: '2026-08-12T10:00:00Z',
      userId: 'user-xyz-123'
    };

    const result = validatePackageSafe(validPkg);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Ergonomic Keyboard');
      expect(result.data.trackingNumber).toBe('IL123456789IL');
      expect(result.data.status).toBe('in_transit');
      expect(result.data.checkpoints.length).toBe(1);
    }
  });

  it('rejects invalid statuses outside the permitted enum', () => {
    const invalidPkg = {
      id: 'pkg-123',
      title: 'Item',
      trackingNumber: 'TRK123',
      status: 'exploit_stage'
    };

    const result = validatePackageSafe(invalidPkg);
    expect(result.success).toBe(false);
  });

  it('rejects packages where checkpoints exceed array cap of 50', () => {
    const checkpoints = Array.from({ length: 51 }, (_, i) => ({
      id: `cp-${i}`,
      title: `Checkpoint ${i}`
    }));

    const result = validatePackageSafe({
      id: 'pkg-overflow',
      title: 'Overflowing Checkpoints',
      trackingNumber: 'TRK999',
      status: 'in_transit',
      checkpoints
    });

    expect(result.success).toBe(false);
  });

  it('enforces string length constraints on fields', () => {
    const longTitlePkg = {
      id: 'pkg-long',
      title: 'A'.repeat(201),
      trackingNumber: 'TRK123',
      status: 'in_transit'
    };

    const result = validatePackageSafe(longTitlePkg);
    expect(result.success).toBe(false);
  });

  it('strips extraneous unwhitelisted keys to prevent parameter injection / prototype pollution', () => {
    const dirtyData = {
      id: 'pkg-clean',
      title: 'Clean Item',
      trackingNumber: 'TRKCLEAN',
      status: 'shipped',
      maliciousField: 'exploit',
      __proto__: { polluted: true }
    };

    const result = validatePackageSafe(dirtyData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maliciousField).toBeUndefined();
      expect({}.polluted).toBeUndefined();
    }
  });

  it('validates package lists safely', () => {
    const list = [
      { id: 'pkg-1', title: 'Package 1', trackingNumber: 'TRK1', status: 'shipped' },
      { id: 'pkg-2', title: 'Package 2', trackingNumber: 'TRK2', status: 'delivered' }
    ];

    const result = validatePackageListSafe(list);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe(2);
    }
  });
});

describe('parsePackage — the single repairing entry point', () => {
  it('returns null only for non-object input', () => {
    expect(parsePackage(null)).toBeNull();
    expect(parsePackage(undefined)).toBeNull();
    expect(parsePackage('string')).toBeNull();
    expect(parsePackage(123)).toBeNull();
    expect(parsePackage([])).toBeNull();
    expect(parsePackage({})).not.toBeNull();
  });

  it('repairs rather than rejects, matching the legacy validator exactly', () => {
    const corpus = [
      {},
      { id: 'pkg-1' },
      { id: 'pkg-2', title: '', trackingNumber: '' },
      { id: 'pkg-3', title: 'Item', trackingNumber: 'rr 123-456!!', status: 'exploit_stage' },
      { id: 'pkg-4', title: 'A'.repeat(400), carrier: 'NOT_A_CARRIER', category: 'nope' },
      { id: 'pkg-5', title: 'X', status: 'DELIVERED ', isPinned: 'yes', isArchived: 0 },
      { id: 'pkg-6', title: 'Y', notes: '<script>alert(1)</script>hi', checkpoints: 'not-an-array' },
      {
        id: 'pkg-7',
        title: 'Z',
        checkpoints: [{ id: 'cp-1', title: 'Departed', timestamp: '2026-01-01T00:00:00Z' }, null, 5]
      },
      { id: 'pkg-8', title: 'W', userId: 'user-1', destination: '' }
    ];

    for (const raw of corpus) {
      const legacy = validatePackage(raw);
      const parsed = parsePackage(raw);
      expect(parsed).not.toBeNull();

      // Every field the legacy validator produced must be repaired identically,
      // except the generated id/date fallbacks which embed Date.now().
      for (const key of Object.keys(legacy)) {
        if (['id', 'createdAt', 'updatedAt', 'orderDate'].includes(key) && !raw[key]) continue;
        if (key === 'checkpoints') {
          expect(parsed.checkpoints.length).toBe(legacy.checkpoints.length);
          continue;
        }
        expect({ key, value: parsed[key] }).toEqual({ key, value: legacy[key] });
      }
      expect('userId' in parsed).toBe('userId' in legacy);
    }
  });

  it('preserves specific legacy repair values', () => {
    const repaired = parsePackage({ id: 'p', title: '   ', trackingNumber: '???' });
    expect(repaired.title).toBe('Untitled Package');
    expect(repaired.trackingNumber).toBe('UNTRACKED');
    expect(repaired.status).toBe('in_transit');
    expect(repaired.carrier).toBe('other');
    expect(repaired.destination).toBe('Israel');
  });

  it('keeps unknown fields instead of erasing them', () => {
    const parsed = parsePackage({
      id: 'p-unknown',
      title: 'Keeps Extras',
      trackingNumber: 'TRK1',
      experimentalField: 42,
      nested: { a: 1 }
    });

    expect(parsed.experimentalField).toBe(42);
    expect(parsed.nested).toEqual({ a: 1 });
  });

  it('still drops prototype-polluting keys', () => {
    const parsed = parsePackage(
      JSON.parse('{"id":"p-poison","title":"T","trackingNumber":"TRK","__proto__":{"polluted":true}}')
    );
    expect(parsed).not.toBeNull();
    expect({}.polluted).toBeUndefined();
  });

  it('defaults schemaVersion for existing records and keeps an explicit one', () => {
    expect(parsePackage({ id: 'v', title: 'T' }).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsePackage({ id: 'v', title: 'T', schemaVersion: 7 }).schemaVersion).toBe(7);
    expect(parsePackage({ id: 'v', title: 'T', schemaVersion: 'x' }).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('caps checkpoints at 50 without rejecting the package', () => {
    const checkpoints = Array.from({ length: 60 }, (_, i) => ({ id: `cp-${i}`, title: `CP ${i}` }));
    const parsed = parsePackage({ id: 'cp-pkg', title: 'T', checkpoints });
    expect(parsed.checkpoints.length).toBe(50);
  });
});

describe('parsePackageList — no silent truncation', () => {
  it('returns an empty result for non-arrays', () => {
    expect(parsePackageList(null).packages).toEqual([]);
    expect(parsePackageList({}).packages).toEqual([]);
    expect(parsePackageList('nope').total).toBe(0);
  });

  it('returns every item above the soft limit and reports overflow', () => {
    const list = Array.from({ length: PACKAGE_LIST_SOFT_LIMIT + 250 }, (_, i) => ({
      id: `pkg-${i}`,
      title: `Package ${i}`,
      trackingNumber: `TRK${i}`
    }));

    const result = parsePackageList(list);
    expect(result.packages.length).toBe(PACKAGE_LIST_SOFT_LIMIT + 250);
    expect(result.overflow).toBe(true);
    expect(result.total).toBe(PACKAGE_LIST_SOFT_LIMIT + 250);
    expect(result.packages[PACKAGE_LIST_SOFT_LIMIT + 249].id).toBe(`pkg-${PACKAGE_LIST_SOFT_LIMIT + 249}`);
  });

  it('counts non-object entries as invalid and drops them', () => {
    const result = parsePackageList([{ id: 'a', title: 'A' }, null, 'x', 5, []]);
    expect(result.packages.length).toBe(1);
    expect(result.invalid).toBe(4);
    expect(result.overflow).toBe(false);
  });
});
