import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { parseSmartText } from '../../utils/smartParser';
import { detectCarrier } from '../../utils/carrierDetector';
import { detectStore } from '../../utils/storeDetector';
import { deliveryService } from '../../services/deliveryService';

/**
 * Restores the parser -> detector seam coverage that was lost when the original
 * ingestion pipeline testbench was deleted along with the dead IndexedDB
 * adapter (0.15.3). Only the adapter-backed steps were dead; steps 1-3 below
 * are the repo's only assertion that `parseSmartText` -> `detectCarrier` ->
 * `detectStore` actually compose on raw, un-sanitized share text. The unit
 * suites feed each module hand-built inputs, so a change to `parseSmartText`'s
 * output shape that breaks `detectCarrier`'s input contract would otherwise
 * pass CI.
 *
 * `deliveryService` (localStorage-backed) is the terminal sink; the IndexedDB
 * adapter no longer exists and must not be reintroduced.
 */
describe('Integration Testbench: Ingestion Pipeline (raw share text -> smartParser -> carrierDetector -> storeDetector -> deliveryService)', () => {
  let mockLocalStorage = {};

  beforeAll(() => {
    globalThis.localStorage = {
      getItem: (k) => mockLocalStorage[k] || null,
      setItem: (k, v) => { mockLocalStorage[k] = String(v); },
      removeItem: (k) => { delete mockLocalStorage[k]; },
      clear: () => { mockLocalStorage = {}; }
    };
  });

  beforeEach(() => {
    mockLocalStorage = {};
  });

  it('ingests a Hebrew Israel Post SMS with an AliExpress origin end to end', () => {
    const rawSms = 'שלום סהר, דבר דואר שמספרו RS948219481IL מאתר עליאקספרס הגיע למרכז המסירה בסניף דיזנגוף סנטר תל אביב.';

    // 1. Parse raw text (Smart Parser)
    const parsed = parseSmartText(rawSms);
    expect(parsed.trackingNumber).toBe('RS948219481IL');

    // 2. Detect Carrier - fed straight from the parser's output, not a literal
    const carrierRes = detectCarrier(parsed.trackingNumber);
    expect(carrierRes.carrierId).toBe('israel-post');

    // 3. Detect Store
    const packageDraft = {
      id: 'pkg-israel-post-aliexpress',
      title: parsed.title || 'AliExpress Shipment',
      trackingNumber: parsed.trackingNumber,
      carrier: carrierRes.carrierId,
      status: 'in_transit',
      notes: rawSms,
      origin: 'AliExpress Global Hub'
    };

    const storeRes = detectStore(packageDraft);
    expect(storeRes).toBeDefined();
    expect(storeRes.id).toBe('aliexpress');

    // Terminal sink: the composed draft survives validation and round-trips.
    const saved = deliveryService.savePackages([packageDraft], 'integration-user');
    expect(saved.ok).toBe(true);

    const retrieved = deliveryService.getPackages('integration-user');
    const target = retrieved.find(p => p.trackingNumber === 'RS948219481IL');
    expect(target).toBeDefined();
    expect(target.carrier).toBe('israel-post');
    expect(target.origin).toBe('AliExpress Global Hub');
  });

  it('ingests Amazon US DHL shipment text end to end', () => {
    const rawText = 'Your Amazon US package with tracking 4829104821 via DHL Express is out for delivery.';
    const parsed = parseSmartText(rawText);
    expect(parsed.trackingNumber).toBe('4829104821');

    const carrierRes = detectCarrier(parsed.trackingNumber);
    expect(carrierRes.carrierId).toBe('dhl');

    const pkg = {
      id: 'pkg-dhl-amazon',
      title: 'Amazon Gadget',
      trackingNumber: parsed.trackingNumber,
      carrier: carrierRes.carrierId,
      status: 'out_for_delivery',
      origin: 'Amazon US'
    };

    const store = detectStore(pkg);
    expect(store.id).toBe('amazon');

    const saved = deliveryService.savePackages([pkg], 'integration-user');
    expect(saved.ok).toBe(true);
    const stored = deliveryService.getPackages('integration-user');
    expect(stored.some(p => p.id === 'pkg-dhl-amazon')).toBe(true);
  });
});
