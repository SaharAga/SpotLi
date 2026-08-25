import { submitFeedback } from './feedbackService';

const SESSION_SEEN_KEY = 'deliveree_crash_seen_v1';
const MAX_REPORTS_PER_SESSION = 20;
const MAX_MESSAGE_CHARS = 1500;
const MAX_STACK_LINES = 6;

/**
 * Cheap non-cryptographic string hash for deduplication signatures only —
 * never used for anything security-sensitive.
 * @param {string} str
 * @returns {string}
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/**
 * @param {unknown} error
 * @param {string} [componentName]
 * @returns {{ signature: string, message: string }}
 */
export function buildCrashReport(error, componentName) {
  const name = error?.name || 'Error';
  const rawMessage = error?.message ? String(error.message) : String(error ?? 'Unknown error');
  const stack = typeof error?.stack === 'string' ? error.stack : '';
  const stackLines = stack.split('\n').slice(0, MAX_STACK_LINES).join('\n');

  const header = componentName
    ? `[${componentName}] ${name}: ${rawMessage}`
    : `${name}: ${rawMessage}`;
  const message = `${header}\n${stackLines}`.slice(0, MAX_MESSAGE_CHARS);

  // Dedup signature: component + error name + message, not the stack — the
  // same logical crash can carry a slightly different stack across builds
  // (minified line numbers) while still being the same bug.
  const signature = hashString(`${componentName || ''}|${name}|${rawMessage}`);

  return { signature, message };
}

function getSeenSignatures() {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markSeen(seen) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Ignore — dedup is a nicety, not a correctness requirement.
  }
}

/**
 * Reports a caught or uncaught error as an anonymous crash report, reusing
 * the existing /feedback pipeline (validation, PII redaction, offline queue,
 * sync) rather than a parallel one. Deduplicated per browser tab session so
 * a repeating render-loop error can't flood Firestore — at most one report
 * per distinct (component, error name, message) signature per session, and
 * a hard cap on total reports per session regardless of how many distinct
 * errors occur.
 *
 * Never throws — a failure to report a crash must not itself crash the app.
 *
 * @param {unknown} error
 * @param {{ componentName?: string }} [options]
 * @returns {Promise<void>}
 */
export async function reportCrash(error, { componentName } = {}) {
  try {
    const seen = getSeenSignatures();
    if (seen.size >= MAX_REPORTS_PER_SESSION) return;

    const { signature, message } = buildCrashReport(error, componentName);
    if (seen.has(signature)) return;

    seen.add(signature);
    markSeen(seen);

    await submitFeedback({
      type: 'crash',
      message,
      rating: 1
    });
  } catch (reportingError) {
    console.warn('[crashReportService] Failed to report crash:', reportingError);
  }
}

let isGlobalHandlerAttached = false;

/**
 * Installs window-level handlers to catch errors React's ErrorBoundary can't
 * see — thrown outside a render (event handlers, timers, async callbacks)
 * and unhandled promise rejections. Idempotent; safe to call multiple times.
 */
export function initGlobalCrashReporting() {
  if (typeof window === 'undefined' || isGlobalHandlerAttached) return;

  window.addEventListener('error', (event) => {
    if (event?.error) {
      reportCrash(event.error, { componentName: 'window' });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportCrash(event?.reason, { componentName: 'unhandledrejection' });
  });

  isGlobalHandlerAttached = true;
}
