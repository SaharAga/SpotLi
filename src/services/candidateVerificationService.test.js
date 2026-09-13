import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./carrierApiProxy', () => ({
  fetchLiveCarrierTracking: vi.fn(),
  isLiveTrackingConfirmed: vi.fn(),
  UNTRACKED_REASONS: { UNSUPPORTED: 'carrier-unsupported', UNAVAILABLE: 'carrier-unavailable' }
}));

const { fetchLiveCarrierTracking, isLiveTrackingConfirmed } = await import('./carrierApiProxy');
const { verifyCandidate, shouldVerify, findConfirmedCandidate } = await import('./candidateVerificationService');

beforeEach(() => {
  vi.clearAllMocks();
  isLiveTrackingConfirmed.mockReturnValue(true);
});

describe('shouldVerify', () => {
  it('asks only about candidates the parser is unsure of', () => {
    expect(shouldVerify({ status: 'probable' }, 'israel-post')).toBe(true);
    expect(shouldVerify({ status: 'uncertain' }, 'israel-post')).toBe(true);
    expect(shouldVerify({ status: 'verified' }, 'israel-post')).toBe(false);
    expect(shouldVerify({ status: 'none' }, 'israel-post')).toBe(false);
  });

  it('never asks about a carrier with no integration', () => {
    isLiveTrackingConfirmed.mockReturnValue(false);
    expect(shouldVerify({ status: 'probable' }, 'chita')).toBe(false);
  });
});

describe('verifyCandidate', () => {
  it('confirms a number the carrier knows about', async () => {
    fetchLiveCarrierTracking.mockResolvedValue({ tracked: true });
    await expect(verifyCandidate('RS736102941IL', 'israel-post')).resolves.toBe('confirmed');
  });

  it('reports not-found when a working integration has no such shipment', async () => {
    fetchLiveCarrierTracking.mockResolvedValue({ tracked: false, reason: 'carrier-unsupported' });
    await expect(verifyCandidate('RS736102941IL', 'israel-post')).resolves.toBe('not-found');
  });

  it('does not treat an upstream failure as evidence the number is fake', async () => {
    fetchLiveCarrierTracking.mockResolvedValue({ tracked: false, reason: 'carrier-unavailable' });
    await expect(verifyCandidate('RS736102941IL', 'israel-post')).resolves.toBe('unavailable');
  });

  it('never throws when the lookup rejects', async () => {
    fetchLiveCarrierTracking.mockRejectedValue(new Error('network down'));
    await expect(verifyCandidate('RS736102941IL', 'israel-post')).resolves.toBe('unavailable');
  });

  it('skips the network entirely when offline', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });

    await expect(verifyCandidate('RS736102941IL', 'israel-post')).resolves.toBe('unavailable');
    expect(fetchLiveCarrierTracking).not.toHaveBeenCalled();

    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete globalThis.navigator;
  });
});

describe('findConfirmedCandidate', () => {
  it('returns the first candidate the carrier confirms', async () => {
    fetchLiveCarrierTracking
      .mockResolvedValueOnce({ tracked: false, reason: 'carrier-unsupported' })
      .mockResolvedValueOnce({ tracked: true });

    const result = await findConfirmedCandidate([
      { value: 'RS111111111IL', status: 'probable', carrierCandidates: ['israel-post'] },
      { value: 'RS736102941IL', status: 'probable', carrierCandidates: ['israel-post'] }
    ]);

    expect(result).toEqual({ trackingNumber: 'RS736102941IL', carrier: 'israel-post' });
  });

  it('stops at the first confirmation rather than checking the rest', async () => {
    fetchLiveCarrierTracking.mockResolvedValue({ tracked: true });

    await findConfirmedCandidate([
      { value: 'RS736102941IL', status: 'probable', carrierCandidates: ['israel-post'] },
      { value: 'RS111111111IL', status: 'probable', carrierCandidates: ['israel-post'] }
    ]);

    expect(fetchLiveCarrierTracking).toHaveBeenCalledTimes(1);
  });

  it('caps outbound requests so a long paste cannot fan out', async () => {
    fetchLiveCarrierTracking.mockResolvedValue({ tracked: false, reason: 'carrier-unsupported' });

    const many = Array.from({ length: 10 }, (_, i) => ({
      value: `RS00000000${i}IL`,
      status: 'uncertain',
      carrierCandidates: ['israel-post']
    }));

    expect(await findConfirmedCandidate(many)).toBeNull();
    expect(fetchLiveCarrierTracking).toHaveBeenCalledTimes(3);
  });

  it('returns null without any lookup when nothing is worth asking about', async () => {
    const result = await findConfirmedCandidate([
      { value: 'RS736102941IL', status: 'verified', carrierCandidates: ['israel-post'] }
    ]);
    expect(result).toBeNull();
    expect(fetchLiveCarrierTracking).not.toHaveBeenCalled();
  });

  it('falls back to the message-level carrier when a candidate has none', async () => {
    fetchLiveCarrierTracking.mockResolvedValue({ tracked: true });

    const result = await findConfirmedCandidate(
      [{ value: '123456789', status: 'uncertain', carrierCandidates: ['other'] }],
      'israel-post'
    );

    expect(result).toEqual({ trackingNumber: '123456789', carrier: 'israel-post' });
  });
});
