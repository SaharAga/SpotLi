/**
 * Admin allowlist.
 *
 * Gates the Alpha Feedback Inspector, which reads every tester's submitted
 * feedback. Kept in sync with the `isAdmin()` helper in `firestore.rules` —
 * the rules are the real enforcement; this constant only controls what the UI
 * offers, so changing it alone grants nothing.
 *
 * Matching is on the *verified* email rather than a UID: Firebase will not
 * issue a verified token for an address already owned by another account, and
 * an email is readable/auditable in a way an opaque UID is not.
 */
export const ADMIN_EMAILS = ['saharaga97@gmail.com'];

/**
 * Returns true when the given user profile is an allowlisted admin.
 *
 * @param {{ email?: string, emailVerified?: boolean } | null | undefined} user
 * @returns {boolean}
 */
export function isAdminUser(user) {
  if (!user || typeof user.email !== 'string') return false;
  if (!user.emailVerified) return false;
  return ADMIN_EMAILS.includes(user.email.trim().toLowerCase());
}
