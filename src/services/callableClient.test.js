import { describe, it, expect, vi, beforeEach } from 'vitest';

const callableMock = vi.fn();
const httpsCallableMock = vi.fn(() => callableMock);

vi.mock('firebase/functions', () => ({ httpsCallable: httpsCallableMock }));
vi.mock('./firebase', () => ({ functionsInstance: {} }));

const { callFunction, isCallableTimeout, CallableTimeoutError, CALLABLE_TIMEOUT_MS } =
  await import('./callableClient');

beforeEach(() => {
  vi.clearAllMocks();
  httpsCallableMock.mockReturnValue(callableMock);
});

describe('callFunction', () => {
  it('returns the callable result when it responds', async () => {
    callableMock.mockResolvedValue({ data: { ok: true } });
    await expect(callFunction('gmailConnectionStatus')).resolves.toEqual({ data: { ok: true } });
  });

  it('gives up when the call never settles', async () => {
    vi.useFakeTimers();
    // What a blocked App Check token fetch looks like from here: the request
    // is never sent, so nothing server-side ever times it out.
    callableMock.mockImplementation(() => new Promise(() => {}));

    const pending = callFunction('parseWithAi', {}, { timeoutMs: 1000 });
    const assertion = expect(pending).rejects.toBeInstanceOf(CallableTimeoutError);
    await vi.advanceTimersByTimeAsync(1500);
    await assertion;

    vi.useRealTimers();
  });

  it('names the callable in the timeout, so a log says which one hung', async () => {
    vi.useFakeTimers();
    callableMock.mockImplementation(() => new Promise(() => {}));

    const pending = callFunction('gmailBackfill', undefined, { timeoutMs: 500 });
    const assertion = expect(pending).rejects.toMatchObject({ callableName: 'gmailBackfill' });
    await vi.advanceTimersByTimeAsync(900);
    await assertion;

    vi.useRealTimers();
  });

  it('passes a real function error through untouched', async () => {
    const err = Object.assign(new Error('nope'), { code: 'functions/unauthenticated' });
    callableMock.mockRejectedValue(err);
    await expect(callFunction('parseWithAi')).rejects.toBe(err);
  });

  it('distinguishes a timeout from any other failure', () => {
    expect(isCallableTimeout(new CallableTimeoutError('x', 1))).toBe(true);
    expect(isCallableTimeout(new Error('boom'))).toBe(false);
    expect(isCallableTimeout(undefined)).toBe(false);
  });

  it('defaults above the longest server-side timeout, so it never pre-empts real work', () => {
    // functions/src/index.js caps parseWithAi at 30s; this must sit above that
    // or a slow-but-working call would be reported as hung.
    expect(CALLABLE_TIMEOUT_MS).toBeGreaterThan(30000);
  });
});
