import { describe, it, expect, vi, beforeEach } from 'vitest';

const callableMock = vi.fn();
const httpsCallableMock = vi.fn(() => callableMock);

vi.mock('firebase/functions', () => ({
  httpsCallable: httpsCallableMock
}));

// Test env has no Firebase config, so the real './firebase' module always
// exports null instances — mock it so the "configured and signed in" path
// is actually reachable in these tests, matching the pattern used by
// feedbackService.test.js for the same underlying reason.
vi.mock('./firebase', () => ({
  functionsInstance: { fake: 'functions-instance' },
  auth: { currentUser: { uid: 'user-1' } }
}));

const { parseWithAi } = await import('./aiParseService');

describe('parseWithAi', () => {
  beforeEach(() => {
    callableMock.mockReset();
    httpsCallableMock.mockClear();
  });

  it('calls the parseWithAi callable with the given payload', async () => {
    callableMock.mockResolvedValue({
      data: { trackingNumber: 'RS1IL', carrier: 'israel-post', confidence: 'high' }
    });

    const result = await parseWithAi({ mode: 'text-fallback', text: 'RS1IL' });

    expect(httpsCallableMock).toHaveBeenCalledWith({ fake: 'functions-instance' }, 'parseWithAi');
    expect(callableMock).toHaveBeenCalledWith({ mode: 'text-fallback', text: 'RS1IL' });
    expect(result).toEqual({
      success: true,
      data: { trackingNumber: 'RS1IL', carrier: 'israel-post', confidence: 'high' }
    });
  });

  it('maps a resource-exhausted error to rateLimited', async () => {
    callableMock.mockRejectedValue({ code: 'functions/resource-exhausted', message: 'Daily limit reached' });

    const result = await parseWithAi({ mode: 'text-fallback', text: 'x' });

    expect(result).toEqual({ success: false, rateLimited: true, error: 'Daily limit reached' });
  });

  it('maps an unauthenticated error to unavailable', async () => {
    callableMock.mockRejectedValue({ code: 'functions/unauthenticated', message: 'nope' });

    const result = await parseWithAi({ mode: 'text-fallback', text: 'x' });

    expect(result).toEqual({ success: false, unavailable: true, error: 'Sign in to use AI-assisted parsing.' });
  });

  it('reports any other failure as a plain error without throwing', async () => {
    callableMock.mockRejectedValue(new Error('network blip'));

    const result = await parseWithAi({ mode: 'image', imageBase64: 'QUJD' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('network blip');
    expect(result.rateLimited).toBeUndefined();
    expect(result.unavailable).toBeUndefined();
  });
});

describe('parseWithAi when Firebase is not configured', () => {
  it('returns unavailable without calling the callable at all', async () => {
    callableMock.mockClear();
    vi.resetModules();
    vi.doMock('./firebase', () => ({ functionsInstance: null, auth: null }));
    const { parseWithAi: parseWithAiUnconfigured } = await import('./aiParseService');

    const result = await parseWithAiUnconfigured({ mode: 'text-fallback', text: 'x' });

    expect(result).toEqual({
      success: false,
      unavailable: true,
      error: 'AI parsing is not available right now.'
    });
    expect(callableMock).not.toHaveBeenCalled();
  });
});

describe('parseWithAi — timeout', () => {
  it('gives up rather than leaving the caller waiting forever', async () => {
    vi.useFakeTimers();

    // A callable that never settles — what App Check being unable to mint a
    // token looks like from here: the request is never sent, and nothing
    // server-side ever times it out.
    callableMock.mockImplementation(() => new Promise(() => {}));

    const pending = parseWithAi({ mode: 'text-fallback', text: 'hello' });
    await vi.advanceTimersByTimeAsync(36000);

    await expect(pending).resolves.toMatchObject({ success: false, unavailable: true });
    vi.useRealTimers();
  });
});
