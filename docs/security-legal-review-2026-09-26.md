# Security & Legal Review — 2026-09-26

**Scope:** Cloud Functions, `firestore.rules`, client data flows, and the three legal
documents (Privacy Policy, Terms of Use, Accessibility Statement), checked against
the code on `main` @ `0.40.0`. Legal focus: Israel.

> ⚠️ Not legal advice. The legal items below are consistency fixes (the documents
> now describe what the code actually does) plus Israeli-law points worth
> confirming with a qualified Israeli lawyer.

Supersedes the still-open parts of [`legal-review-2026-08-23.md`](legal-review-2026-08-23.md)
that concern account deletion and third-party disclosure.

---

## Fixed in this change

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| S1 | 🔴 High | **Account deletion left Gmail connected.** `deleteUserAccountAndData` never called `gmailDisconnect`: the refresh token (plaintext, `gmailConnections`) survived, the watch kept renewing, and push sync kept writing packages under the deleted uid. Push tokens, usage counters, `usageEvents`, `gmailAiOutcomes` were also left behind. Privacy Policy §14 promised they were purged. | New callable `deleteAccountData` (`functions/src/accountDeletion.js`) disconnects Gmail and purges every uid-linked document the client can't reach. The client awaits it *before* deleting the Auth user, and aborts on failure so deletion can be retried. |
| S2 | 🟠 Medium | **Ingestion address = raw Firebase uid.** Anyone who learned `inbox+usr_<uid>@…` could inject packages (fake pickup location / phone / locker code → phishing) into that user's list; sender unverified; uid not rotatable. Webhook would also create docs under non-existent uids. | Address now carries a random 96-bit token (`ingestionTokens/{token}`, client access denied). User can regenerate it from the ingestion guide; the old one stops working immediately. Legacy uid addresses still work **only** for existing users who have never been issued a token (migration), and never for uids with no user doc. |
| S3 | 🟠 Medium | **17TRACK webhook only reached the first 100 users** (`users.limit(100)`): everyone else never received pushed updates. | Paginates through all users. |
| S4 | 🟡 Low | `featureUsage` accepted anonymous writes under any doc ID → unlimited rows could inflate adoption stats. | Rule now requires the ID to be exactly `{feature}_{identity}_{date}`. |
| S5 | 🟡 Low | Inbound-email webhook echoed internal `err.message` to the caller. | Generic error only. |

## Legal documents — code vs. text (fixed)

Updated in both `src/constants/legal.js` (in-app) and `public/*.html` (public pages),
Hebrew and English. `LEGAL_VERSION` → `2026-09-26.1` (re-prompts signed-in users).

- **17TRACK is automatic, not on refresh.** `registerTrackingNumber` enrols every new
  signed-in package; the policy said data went to carriers only "when you refresh".
- **Browser-direct fallback.** When the proxy fails, the browser may call a carrier
  (e.g. Israel Post) directly, exposing the user's IP; the policy said "server-to-server".
- **Gmail → Gemini.** Low-confidence Gmail messages (subject + ≤5,000 chars) go to
  Gemini (`gmailAiFallback.js`). Now disclosed in the Limited Use section.
- **Email subjects are stored** in package notes (Gmail ≤80 chars, forwarding ≤100);
  the documents said raw email was "immediately discarded".
- **Undisclosed data:** feature-usage markers (uid or random device id), `usageEvents`
  (uid), the `deliveree_anon_id` localStorage key, the forwarding-address token.
- **Transfer abroad** (Privacy Protection (Transfer of Data to Databases Abroad)
  Regulations, 5761-2001): server functions run in `us-central1`; now disclosed. The
  Firestore storage region is **not** recorded in the repo, so the text says
  "outside Israel, including the United States" rather than naming it.
- **Breach notification** duty under the Data Security Regulations, 5777-2017, now stated.
- **Deletion section** lists exactly what is purged and what is not (feature markers
  roll off within two days; 17TRACK keeps its own copy).
- **Terms — jurisdiction.** Exclusive Tel Aviv venue in a consumer standard contract is
  presumed unfair (Standard Contracts Law §4(9)). Now: Israeli courts, without limiting
  the consumer's right to sue in any competent court.
- **Accessibility statement** (reg. 35, Service Accessibility Adjustments Regulations
  2013): softened "fully conforms" to a self-assessment, removed the pinned WCAG version,
  added known limitations, and added coordinator name/phone and review-date fields.

## Follow-ups fixed (second pass)

| # | Finding | Fix |
|---|---------|-----|
| F1 | Gmail refresh tokens stored unencrypted | AES-256-GCM at the storage boundary (`functions/src/tokenCipher.js`, `gmailAuth.js`), key in the `GMAIL_TOKEN_KEY` secret, owner uid as AAD so a ciphertext can't be moved onto another user's doc. Legacy plaintext tokens still read, and `gmailWatchRenewal` re-encrypts them on its next daily run. |
| F2 | Gmail Pub/Sub push authenticated by a `?token=` query secret | Verifies the Google-signed OIDC token from an authenticated push subscription (`functions/src/pubsubPushAuth.js`): signature, audience, issuer, service account. The query token stays accepted until `GMAIL_PUSH_REQUIRE_OIDC=true`. |
| F3 | 17TRACK webhook walked every user per event | One collection-group query on `packages.trackingNumber` (`firestore.indexes.json`, now deployed by CI with the rules). Falls back to the paged walk while the index is missing or building. |
| F4 | `npm audit` (functions): 4 moderate (`uuid`) | `googleapis` 144 → 182 (+ explicit `google-auth-library` 11). The last path (`firebase-admin` → storage → `gaxios@6`) has no upstream fix yet, so an `overrides` entry pins its `uuid` to 11.1.1; `gaxios` only calls `v4()`, which is unchanged. `npm audit`: 0. |
| F5 | CSP allowed `script-src 'unsafe-inline'` | Inline scripts moved to `public/boot.js` (index.html) and `public/legal-page.js` (legal pages; `onclick` → listeners). The CSP no longer allows inline script. It isn't applied to Firebase's reserved `/__/**` paths (Google-served auth handler), so sign-in can't be broken by it. Verified in Chromium against a production build: no script-src violations. |

## Action required before the next release

- [ ] Fill in the accessibility coordinator **name** and **phone** and the **date of the
      last accessibility review**: `ACCESSIBILITY_COORDINATOR` in `src/constants/legal.js`,
      the review-date `[TODO]` in the same file, and the matching `[TODO]`s in
      `public/accessibility.html`.
- [ ] **Before merging** (functions deploy on merge): create the token-encryption key.
      Deploys fail while a declared secret is missing.
      `openssl rand -base64 32 | firebase functions:secrets:set GMAIL_TOKEN_KEY --data-file=-`
      Keep a copy somewhere safe: losing it means every user must reconnect Gmail.
- [ ] Deploy functions (`deleteAccountData`, `ingestionAddress`) **together with or before**
      the hosting release, since the client now awaits `deleteAccountData`.
- [ ] After the first deploy, check Google sign-in on staging (the CSP change is the one
      thing tests can't cover end to end).
- [ ] Optional, to finish F2: enable authentication on the Gmail Pub/Sub push subscription
      (a service account with no other roles), set `GMAIL_PUSH_OIDC_AUDIENCE` and
      `GMAIL_PUSH_SERVICE_ACCOUNT` in `functions/.env`, confirm pushes still arrive, then
      set `GMAIL_PUSH_REQUIRE_OIDC=true` and remove `?token=` from the endpoint URL.
- [ ] Optional: confirm the Firestore location (Firebase console → Firestore → Data) and
      name it in the Privacy Policy.

## Still open

- **QR code in the ingestion guide** loads from `api.qrserver.com`, which `img-src` in
  the CSP doesn't allow (broken in production), and sends the app origin to a third
  party. Consider generating it locally.
- **CSP `img-src`** blocks Firestore's `www.google.com/images/cleardot.gif`
  connectivity probe (seen during the F5 browser check; pre-existing, harmless noise).
- **Feedback/crash reports** remain undeletable per user by design (no uid). This is
  disclosed.
- **Minimum age 16:** Israeli law has no data-protection-specific age of consent;
  confirm with counsel whether 16 (vs. 18 under the Legal Capacity Law) fits.
