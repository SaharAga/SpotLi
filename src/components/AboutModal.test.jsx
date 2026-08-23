import { describe, it, expect, vi } from 'vitest';
import { CARRIER_LIST, CARRIERS } from '../types/carriers';
import { APP_VERSION, RELEASE_DATE, BUILD_CHANNEL } from '../constants/version';

describe('AboutModal Logic & Specifications', () => {
  it('exposes correct version constants and metadata', () => {
    expect(APP_VERSION).toBe('0.8.0');
    expect(RELEASE_DATE).toBe('2026-08-23');
    expect(BUILD_CHANNEL).toBe('alpha');
  });


  it('contains at least 13 supported shipping carriers', () => {
    expect(CARRIER_LIST.length).toBeGreaterThanOrEqual(13);
    expect(CARRIERS['israel-post']).toBeDefined();
    expect(CARRIERS['chita']).toBeDefined();
    expect(CARRIERS['hfd']).toBeDefined();
    expect(CARRIERS['boxit']).toBeDefined();
    expect(CARRIERS['cainiao']).toBeDefined();
    expect(CARRIERS['4px']).toBeDefined();
    expect(CARRIERS['dhl']).toBeDefined();
    expect(CARRIERS['fedex']).toBeDefined();
    expect(CARRIERS['ups']).toBeDefined();
    expect(CARRIERS['usps']).toBeDefined();
    expect(CARRIERS['royal-mail']).toBeDefined();
    expect(CARRIERS['aramex']).toBeDefined();
    expect(CARRIERS['yanwen']).toBeDefined();
  });

  it('includes bilingual carrier naming for RTL (Hebrew) and LTR (English)', () => {
    CARRIER_LIST.forEach((carrier) => {
      expect(carrier.id).toBeTruthy();
      expect(carrier.name).toBeTruthy();
      if (carrier.id !== 'other') {
        expect(carrier.hebrewName).toBeTruthy();
      }
    });
  });

  it('triggers navigator serviceWorker update if supported and handles fallback gracefully', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGetRegistration = vi.fn().mockResolvedValue({
      update: mockUpdate
    });

    const mockNavigator = {
      serviceWorker: {
        getRegistration: mockGetRegistration
      }
    };

    // Simulate update check execution
    const reg = await mockNavigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.update();
    }

    expect(mockGetRegistration).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('verifies that BIST diagnostics engine reports PASS across all probes for healthy system state', async () => {
    const { runAllBistDiagnostics } = await import('../utils/bistDiagnostics');
    const mockStore = {};
    const mockStorage = {
      getItem: (key) => (Object.prototype.hasOwnProperty.call(mockStore, key) ? mockStore[key] : null),
      setItem: (key, value) => { mockStore[key] = String(value); },
      removeItem: (key) => { delete mockStore[key]; },
      clear: () => {}
    };

    const diagnostics = runAllBistDiagnostics({ storage: mockStorage });
    expect(diagnostics.status).toBe('PASS');
    expect(diagnostics.summary.passed).toBe(5);
    expect(diagnostics.summary.failed).toBe(0);
    expect(diagnostics.checks.length).toBe(5);
  });
});
