import { describe, it, expect } from 'vitest';
import { sanitizeString, validatePackage, validatePackageList, isPackageListOverflowing, PACKAGE_LIST_ADVISORY_LIMIT } from './packageValidator';

describe('packageValidator - sanitizeString', () => {
  it('returns empty string for null, undefined, and non-string falsy values', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
    expect(sanitizeString('')).toBe('');
  });

  it('converts numbers and booleans to string safely', () => {
    expect(sanitizeString(12345)).toBe('12345');
    expect(sanitizeString(true)).toBe('true');
  });

  it('strips script tags and inner JavaScript content', () => {
    const payload = 'Keychron K2 <script>alert("XSS Attack!");</script> Keyboard';
    expect(sanitizeString(payload)).toBe('Keychron K2  Keyboard');
  });

  it('strips self-closing tags and inline event handlers', () => {
    const payload = '<img src=x onerror="alert(1)" /> Sony Headphones <svg onload="evil()"></svg>';
    expect(sanitizeString(payload)).toBe('Sony Headphones');
  });

  it('strips dangerous URI schemes (javascript:, vbscript:, data:text/html)', () => {
    const payload = 'javascript:alert(document.cookie)';
    expect(sanitizeString(payload)).toBe('alert(document.cookie)');
  });

  it('strips non-printable ASCII control characters', () => {
    const payload = 'Clean\x00Text\x07With\x1FControl\x7FChars';
    expect(sanitizeString(payload)).toBe('CleanTextWithControlChars');
  });

  it('enforces maxLength truncation', () => {
    const longString = 'A'.repeat(600);
    expect(sanitizeString(longString, 50).length).toBe(50);
  });

  it('applies early length bound guard on huge strings to prevent CPU exhaustion', () => {
    const hugeString = '<script>evil()</script>' + 'B'.repeat(50000);
    const result = sanitizeString(hugeString, 100);
    expect(result.length).toBe(100);
    expect(result).not.toContain('<script>');
  });

  it('strips raw HTML angle brackets and tags', () => {
    const payload = '<p>Parcel at <b>Airport</b> terminal</p>';
    expect(sanitizeString(payload)).toBe('Parcel at Airport terminal');
  });
});

describe('packageValidator - validatePackage', () => {
  it('rejects non-object and array inputs', () => {
    expect(validatePackage(null)).toBeNull();
    expect(validatePackage(undefined)).toBeNull();
    expect(validatePackage('string')).toBeNull();
    expect(validatePackage(123)).toBeNull();
    expect(validatePackage([])).toBeNull();
  });

  it('normalizes missing fields with sane default values', () => {
    const minimal = {
      trackingNumber: 'RS123456789IL'
    };

    const validated = validatePackage(minimal);
    expect(validated).not.toBeNull();
    expect(validated.trackingNumber).toBe('RS123456789IL');
    expect(validated.id).toMatch(/^pkg-/);
    expect(validated.title).toBe('Untitled Package');
    expect(validated.carrier).toBe('other');
    expect(validated.status).toBe('in_transit');
    expect(validated.category).toBe('other');
    expect(validated.isPinned).toBe(false);
    expect(validated.isArchived).toBe(false);
    expect(Array.isArray(validated.checkpoints)).toBe(true);
    expect(validated.createdAt).toBeDefined();
    expect(validated.updatedAt).toBeDefined();
  });

  it('validates and preserves valid known carriers and status stages', () => {
    const validPkg = {
      id: 'pkg-999',
      title: 'Valid Keyboard',
      trackingNumber: 'LP00582910482CN',
      carrier: 'cainiao',
      status: 'customs',
      category: 'electronics',
      origin: 'Shenzhen, China',
      destination: 'Tel Aviv, Israel',
      isPinned: true,
      isArchived: false,
      checkpoints: [
        {
          id: 'cp-1',
          title: 'Customs Clear',
          location: 'Ben Gurion',
          isCompleted: true
        }
      ]
    };

    const validated = validatePackage(validPkg);
    expect(validated.carrier).toBe('cainiao');
    expect(validated.status).toBe('customs');
    expect(validated.category).toBe('electronics');
    expect(validated.isPinned).toBe(true);
    expect(validated.checkpoints.length).toBe(1);
    expect(validated.checkpoints[0].title).toBe('Customs Clear');
  });

  it('falls back to safe defaults when carrier or status is unknown/invalid', () => {
    const invalidEnums = {
      title: 'Hacked Package',
      trackingNumber: 'BADTRACK123',
      carrier: 'non-existent-carrier',
      status: 'malicious-stage',
      category: 'unsupported-cat'
    };

    const validated = validatePackage(invalidEnums);
    expect(validated.carrier).toBe('other');
    expect(validated.status).toBe('in_transit');
    expect(validated.category).toBe('other');
  });

  it('sanitizes strings inside title, notes, and checkpoints', () => {
    const dirtyPkg = {
      title: 'Title <script>alert(1)</script>',
      notes: '<img src=x onerror=alert(2)> Urgent delivery',
      checkpoints: [
        {
          title: 'Location <b>Update</b> <iframe src="evil.com"></iframe>',
          description: '<script>steal()</script>Arrived safely'
        }
      ]
    };

    const validated = validatePackage(dirtyPkg);
    expect(validated.title).toBe('Title');
    expect(validated.notes).toBe('Urgent delivery');
    expect(validated.checkpoints[0].title).toBe('Location Update');
    expect(validated.checkpoints[0].description).toBe('Arrived safely');
  });

  it('guards against prototype pollution attacks', () => {
    const maliciousJson = JSON.parse(
      '{"id": "pkg-pwn", "title": "Attack", "__proto__": {"polluted": true}, "constructor": {"prototype": {"isAdmin": true}}}'
    );

    const validated = validatePackage(maliciousJson);
    expect(validated.id).toBe('pkg-pwn');
    expect({}.polluted).toBeUndefined();
    expect({}.isAdmin).toBeUndefined();
    expect(Object.prototype.polluted).toBeUndefined();
  });

  it('strips unwhitelisted rogue keys from package objects', () => {
    const roguePayload = {
      id: 'pkg-100',
      title: 'Valid Title',
      trackingNumber: 'TRK100',
      carrier: 'israel_post',
      rogueProperty: 'malicious payload',
      injectedScript: 'alert(1)',
      isAdmin: true
    };

    const validated = validatePackage(roguePayload);
    expect(validated.title).toBe('Valid Title');
    expect(validated.rogueProperty).toBeUndefined();
    expect(validated.injectedScript).toBeUndefined();
    expect(validated.isAdmin).toBeUndefined();
  });

  it('preserves valid cross-border domestic handover and drops invalid domestic-to-domestic handover', () => {
    // Valid cross-border handover
    const validCrossBorder = {
      id: 'pkg-cross-1',
      title: 'AliExpress Item',
      trackingNumber: 'LP00582910482CN',
      carrier: 'cainiao',
      localCarrier: 'israel-post',
      localTrackingNumber: 'RU0126608087Z'
    };
    const validRes = validatePackage(validCrossBorder);
    expect(validRes.carrier).toBe('cainiao');
    expect(validRes.localCarrier).toBe('israel-post');
    expect(validRes.localTrackingNumber).toBe('RU0126608087Z');

    // Invalid domestic-to-domestic handover
    const invalidDomestic = {
      id: 'pkg-dom-1',
      title: 'Tapuz Delivery',
      trackingNumber: '48142143',
      carrier: 'tapuz',
      localCarrier: 'cargo',
      localTrackingNumber: '48142143'
    };
    const invalidRes = validatePackage(invalidDomestic);
    expect(invalidRes.carrier).toBe('tapuz');
    expect(invalidRes.localCarrier).toBeUndefined();
    expect(invalidRes.localTrackingNumber).toBeUndefined();

    // Redundant identical carrier and tracking number
    const selfHandover = {
      id: 'pkg-self-1',
      title: 'DHL Item',
      trackingNumber: '1234567890',
      carrier: 'dhl',
      localCarrier: 'dhl',
      localTrackingNumber: '1234567890'
    };
    const selfRes = validatePackage(selfHandover);
    expect(selfRes.carrier).toBe('dhl');
    expect(selfRes.localCarrier).toBeUndefined();
    expect(selfRes.localTrackingNumber).toBeUndefined();
  });
});

describe('packageValidator - validatePackageList', () => {
  it('returns empty array when given non-array inputs', () => {
    expect(validatePackageList(null)).toEqual([]);
    expect(validatePackageList(undefined)).toEqual([]);
    expect(validatePackageList('not an array')).toEqual([]);
    expect(validatePackageList({})).toEqual([]);
  });

  it('filters out null, primitives, and invalid entries in array', () => {
    const mixed = [
      null,
      undefined,
      'invalid item',
      12345,
      [],
      { title: 'Valid 1', trackingNumber: 'TRK1' },
      { title: 'Valid 2', trackingNumber: 'TRK2' }
    ];

    const result = validatePackageList(mixed);
    expect(result.length).toBe(2);
    expect(result[0].title).toBe('Valid 1');
    expect(result[1].title).toBe('Valid 2');
  });

  it('sanitizes every package in the list', () => {
    const list = [
      { title: '<script>alert(1)</script>Item 1', trackingNumber: 'TRK1' },
      { title: 'Item 2', notes: '<img src=x onerror=bad()>Notes 2', trackingNumber: 'TRK2' }
    ];

    const result = validatePackageList(list);
    expect(result.length).toBe(2);
    expect(result[0].title).toBe('Item 1');
    expect(result[1].notes).toBe('Notes 2');
  });
});

describe('packageValidator - no silent truncation above 1,000 (issue #40)', () => {
  const makeList = (n) => Array.from({ length: n }, (_, i) => ({
    id: `pkg-${i}`,
    title: `Package ${i}`,
    trackingNumber: `RR${String(i).padStart(9, '0')}IL`,
    carrier: 'israel-post'
  }));

  it('returns all 1,200 records instead of slicing at the advisory limit', () => {
    const result = validatePackageList(makeList(1200));
    expect(result.length).toBe(1200);
    expect(result[1199].id).toBe('pkg-1199');
  });

  it('survives a read -> write -> export-shaped round trip without losing records', () => {
    const original = makeList(1200);

    // read (validate) -> persist (serialize) -> re-read -> export (validate again)
    const onRead = validatePackageList(original);
    const persisted = JSON.stringify(onRead);
    const rehydrated = JSON.parse(persisted);
    const exported = validatePackageList(rehydrated);

    expect(onRead.length).toBe(1200);
    expect(rehydrated.length).toBe(1200);
    expect(exported.length).toBe(1200);
    expect(exported.map(p => p.id)).toEqual(original.map(p => p.id));
  });

  it('flags overflow as advisory rather than dropping records', () => {
    const result = validatePackageList(makeList(PACKAGE_LIST_ADVISORY_LIMIT + 5));
    expect(isPackageListOverflowing(result)).toBe(true);
    expect(result.length).toBe(PACKAGE_LIST_ADVISORY_LIMIT + 5);
    expect(isPackageListOverflowing(validatePackageList(makeList(3)))).toBe(false);
  });

  it('preserves an already-stamped schemaVersion and stamps one otherwise', () => {
    const [stamped] = validatePackageList([{ title: 'A', trackingNumber: 'T1', schemaVersion: 7 }]);
    const [unstamped] = validatePackageList([{ title: 'B', trackingNumber: 'T2' }]);
    expect(stamped.schemaVersion).toBe(7);
    expect(unstamped.schemaVersion).toBe(1);
  });
});
