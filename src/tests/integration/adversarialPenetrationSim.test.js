import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deliveryService, MAX_IMPORT_SIZE_BYTES } from '../../services/deliveryService';
import { escapeCSVCell, formatPackageCSVRow } from '../../utils/exportUtils';
import { parsePackageList, parsePackage, packageSchema } from '../../schemas/packageSchema';
import { detectCarrier } from '../../utils/carrierDetector';
import { parseSmartText } from '../../utils/smartParser';

let mockStore = {};

beforeAll(() => {
  globalThis.localStorage = {
    getItem: (key) => mockStore[key] || null,
    setItem: (key, value) => { mockStore[key] = String(value); },
    removeItem: (key) => { delete mockStore[key]; },
    clear: () => { mockStore = {}; }
  };
});

beforeEach(() => {
  mockStore = {};
});

describe('Adversarial Penetration & External Abuse Simulation: Client & Data Layer', () => {
  describe('1. Multi-Tenant BOLA & Database Authorization Contract Audit', () => {
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

    it('enforces strict BOLA invariants on user packages preventing horizontal hijacking', () => {
      // Must check isOwner on read, delete, create, update
      expect(rules).toContain('match /users/{userId}');
      expect(rules).toContain('allow read, write: if isOwner(userId);');
      expect(rules).toContain('match /packages/{packageId}');
      expect(rules).toContain('allow read, delete: if isOwner(userId);');

      // Update must strictly prevent changing userId to another tenant
      expect(rules).toMatch(/request\.resource\.data\.userId == resource\.data\.userId/);
    });

    it('seals sensitive server-only collections against any direct client reads or writes', () => {
      // OAuth refresh tokens in /gmailConnections
      expect(rules).toMatch(/match \/gmailConnections\/\{(uid|connectionId)[^}]*\}[\s\S]*?allow read, write: if false;/);

      // Rate limits and quota counters in /usage, /carrierUsage, and /gmailAiUsage
      expect(rules).toMatch(/match \/usage\/\{docId\}[\s\S]*?allow read, write: if false;/);
      expect(rules).toMatch(/match \/carrierUsage\/\{docId\}[\s\S]*?allow read, write: if false;/);
      expect(rules).toMatch(/match \/gmailAiUsage\/\{docId\}[\s\S]*?allow read, write: if false;/);

      // Push notification tokens must never be read back by clients
      expect(rules).toMatch(/match \/pushSubscriptions\/\{uid\}\/tokens\/\{tokenId\}[\s\S]*?allow read: if false;/);

      // Universal catch-all deny rule
      expect(rules).toMatch(/match \/\{document=\*\*\}[\s\S]*?allow read, write: if false;/);
    });
  });

  describe('2. Prototype Pollution & Hostile Object Injection via Import', () => {
    it('defends against __proto__ and constructor.prototype injection in data import', () => {
      const hostilePayload = JSON.stringify({
        schemaVersion: 1,
        scope: 'all',
        packages: [
          {
            id: 'pkg-attack-1',
            title: 'Hacked Package',
            trackingNumber: 'RR999888777IL',
            carrier: 'israel-post',
            status: 'in_transit',
            __proto__: { isAdmin: true, attackerInjected: true },
            constructor: { prototype: { pwned: true } }
          }
        ]
      });

      const res = deliveryService.importData(hostilePayload, 'user_target_123');
      expect(res.success).toBe(true);

      // Verify Object.prototype is unpolluted
      expect({}.isAdmin).toBeUndefined();
      expect({}.attackerInjected).toBeUndefined();
      expect({}.pwned).toBeUndefined();
      expect(Object.prototype.isAdmin).toBeUndefined();
      expect(Object.prototype.attackerInjected).toBeUndefined();
      expect(Object.prototype.pwned).toBeUndefined();
    });

    it('zod package schema strips unknown keys while repairing schema drops prototype pollution', () => {
      const inputWithPollution = {
        id: 'pkg-pollute-test',
        title: 'Test Title',
        trackingNumber: 'LP123456789IL',
        carrier: 'cainiao',
        status: 'in_transit',
        maliciousKey: 'maliciousValue',
        execScript: '<script>evil()</script>'
      };

      // Strict schema strips all unallowlisted keys (for network/cloud verification)
      const parsedStrict = packageSchema.parse(inputWithPollution);
      expect(parsedStrict.maliciousKey).toBeUndefined();
      expect(parsedStrict.execScript).toBeUndefined();
      expect(parsedStrict.id).toBe('pkg-pollute-test');

      // Repairing import schema removes prototype poisoning
      const parsedRepaired = parsePackage(inputWithPollution);
      expect(parsedRepaired).not.toBeNull();
      expect(parsedRepaired.id).toBe('pkg-pollute-test');
    });
  });

  describe('3. Payload Bombing & Resource Exhaustion (DoS)', () => {
    it('rejects oversized JSON import payloads exceeding MAX_IMPORT_SIZE_BYTES', () => {
      // Create a payload larger than 2MB
      const giantString = 'A'.repeat(MAX_IMPORT_SIZE_BYTES + 1024);
      const res = deliveryService.importData(giantString, 'user_123');

      expect(res.success).toBe(false);
      expect(res.error).toContain('2MB');
    });

    it('flags list overflow when package count exceeds soft limit without silently dropping data', () => {
      // Simulate an import attempting to inject 1050 items (exceeding soft limit 1000)
      const massiveList = Array.from({ length: 1050 }, (_, i) => ({
        id: `pkg-${i}`,
        title: `Package ${i}`,
        trackingNumber: `TRK${i}IL`,
        carrier: 'israel-post',
        status: 'in_transit'
      }));

      const { packages, overflow, total } = parsePackageList(massiveList);
      expect(Array.isArray(packages)).toBe(true);
      expect(total).toBe(1050);
      expect(packages.length).toBe(1050);
      expect(overflow).toBe(true);
    });
  });

  describe('4. Formula Injection (CSV/Spreadsheet Injection) Neutralization', () => {
    it('neutralizes all formula injection trigger prefixes in CSV cells', () => {
      const maliciousFormulaTriggers = [
        '=cmd|"/C calc"!A0',
        '+cmd|"/C calc"!A0',
        '-cmd|"/C calc"!A0',
        '@SUM(1+1)*cmd|"/C calc"!A0',
        '\t=2+2',
        '\r=cmd'
      ];

      for (const formula of maliciousFormulaTriggers) {
        const escaped = escapeCSVCell(formula);
        // Must be enclosed in quotes and start with apostrophe
        expect(escaped.startsWith('"\'')).toBe(true);
      }
    });

    it('safely formats package with formula triggers without corrupting genuine values', () => {
      const hostilePackage = {
        id: 'pkg-formula-1',
        title: '=1+1 harmful title',
        trackingNumber: '@HARMFUL123',
        carrier: 'dhl',
        status: 'in_transit',
        notes: '-10% discount applied'
      };

      const row = formatPackageCSVRow(hostilePackage);
      const titleCell = row[1];
      const trackingCell = row[2];
      const notesCell = row[9];

      expect(titleCell).toBe('"\'=1+1 harmful title"');
      expect(trackingCell).toBe('"\'@HARMFUL123"');
      expect(notesCell).toBe('"\'-10% discount applied"');
    });
  });

  describe('5. ReDoS Backtracking Attack Simulation on Inbound Parsers', () => {
    it('ensures detectCarrier completes safely (< 500ms bound) under hostile repetitive input', () => {
      const hostilePatterns = [
        'A'.repeat(30000) + '!',
        'RR' + '9'.repeat(30000) + 'X',
        'http://' + 'a.'.repeat(2000) + 'com',
        'משלוח ' + 'דואר '.repeat(2000) + '123'
      ];

      const start = performance.now();
      for (const pattern of hostilePatterns) {
        const result = detectCarrier(pattern);
        expect(typeof result).toBe('object');
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500); // Fast defense against event loop freeze
    });

    it('ensures parseSmartText completes safely without catastrophic backtracking', () => {
      const hostileText = 'החבילה שלך מספר ' + '123456789 '.repeat(1000) + ' ממתינה בלוקר';

      const start = performance.now();
      const parsed = parseSmartText(hostileText);
      const elapsed = performance.now() - start;

      expect(parsed).toBeDefined();
      expect(elapsed).toBeLessThan(500);
    });
  });
});
