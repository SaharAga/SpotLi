/**
 * The ingestion pipelines that write packages on the user's behalf, without
 * them looking at the app.
 *
 * Both push triggers gate on this list, from opposite directions:
 * `newPackagePush` reads a package's creation `source`, `updatePackagePush`
 * reads the `lastUpdateSource` marker stamped on the patch. A value that is
 * absent, unknown, or cleared by the client is never automated — the guard
 * fails closed, because a missing push is a smaller harm than a push about
 * something the user just did themselves.
 */
export const AUTOMATED_SOURCES = Object.freeze([
  'gmail_sync',
  'gmail_sync_order_status',
  'gmail_sync_ai',
  'email_forwarding'
]);

const AUTOMATED_SOURCE_SET = new Set(AUTOMATED_SOURCES);

/**
 * @param {unknown} source
 * @returns {boolean}
 */
export function isAutomatedSource(source) {
  return typeof source === 'string' && AUTOMATED_SOURCE_SET.has(source);
}
