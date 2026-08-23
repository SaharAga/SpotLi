import { HttpsError } from 'firebase-functions/v2/https';
import { assertAuthenticated, assertPayloadWithinLimits, checkAndIncrementUsage } from './guards.js';
import { parseWithGemini } from './gemini.js';

/**
 * Builds the onCall handler with its dependencies passed in, so tests can
 * supply a fake Firestore and a fake Gemini call instead of hitting real
 * infrastructure and a paid API on every test run.
 *
 * @param {{ db: FirebaseFirestore.Firestore, apiKey: string, parseFn?: typeof parseWithGemini }} deps
 */
export function createParseWithAiHandler({ db, apiKey, parseFn = parseWithGemini }) {
  return async function handler(request) {
    const userId = assertAuthenticated(request);
    const payload = request.data || {};
    assertPayloadWithinLimits(payload);

    const usage = await checkAndIncrementUsage(db, userId);
    if (!usage.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        usage.reason === 'user-limit'
          ? 'Daily AI-parse limit reached for your account — try again tomorrow.'
          : 'Daily AI-parse limit reached for Deliveree — try again tomorrow.'
      );
    }

    return parseFn(payload, apiKey);
  };
}
