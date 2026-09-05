/**
 * One place where every Cloud Function callable is invoked.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * `httpsCallable` waits for an App Check token *before* it sends anything, and
 * the Firebase SDK puts no timeout on that wait. When App Check cannot mint a
 * token the call never fails — it simply never resolves. Nothing server-side
 * is involved, so a function's own `timeoutSeconds` never applies, and the UI
 * cannot tell that state apart from a slow response.
 *
 * That is not hypothetical. In production every callable in the app hung
 * indefinitely — Smart Import's "trying AI parsing" and the account screen's
 * "Checking status…" alike — and Cloud Run logs recorded no requests at all,
 * because none were ever sent. Only `parseWithAi` enforces App Check
 * server-side, yet `gmailConnectionStatus` hung the same way, which is what
 * proved the block was client-side and common to all of them.
 *
 * A timeout added to one call site would have fixed one spinner and left the
 * rest. The bound belongs here, at the single boundary every callable crosses.
 */

import { functionsInstance } from './firebase';

/**
 * Default ceiling. Deliberately longer than the longest server-side timeout in
 * `functions/src/index.js` (30s), so this never pre-empts a call that is
 * genuinely running — it only catches calls that were never sent.
 */
export const CALLABLE_TIMEOUT_MS = 35000;

/** Thrown when the wait is bounded rather than the server responding. */
export class CallableTimeoutError extends Error {
  constructor(name, ms) {
    super(`Callable "${name}" did not respond within ${ms}ms`);
    this.name = 'CallableTimeoutError';
    this.callableName = name;
    this.timeoutMs = ms;
  }
}

/**
 * Invokes a callable with a bounded wait.
 *
 * Rejects with `CallableTimeoutError` rather than resolving to a sentinel, so
 * each caller keeps its own failure handling — some surface a message, some
 * fall back to a manual path — instead of this module guessing for them.
 *
 * @param {string} name callable function name
 * @param {unknown} [payload]
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ data: unknown }>}
 */
export async function callFunction(name, payload, { timeoutMs = CALLABLE_TIMEOUT_MS } = {}) {
  if (!functionsInstance) {
    throw new Error('Cloud Functions are not configured.');
  }

  const { httpsCallable } = await import('firebase/functions');
  const callable = httpsCallable(functionsInstance, name);

  let timer;
  try {
    return await Promise.race([
      callable(payload),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new CallableTimeoutError(name, timeoutMs)), timeoutMs);
      })
    ]);
  } finally {
    // The losing promise keeps running either way; clearing the timer just
    // stops a pending handle holding the event loop open in tests.
    clearTimeout(timer);
  }
}

/**
 * True when an error came from the bound above rather than from the function.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isCallableTimeout(err) {
  return err instanceof CallableTimeoutError || err?.name === 'CallableTimeoutError';
}
