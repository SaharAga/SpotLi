# Changelog

All notable changes to Deliveree will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Versioning convention (established 2026-08-22)**: standard `MAJOR.MINOR.PATCH` — MINOR bumps for new user-facing features/capabilities, PATCH bumps for bug fixes. `MAJOR` stays `0` while in alpha. (A non-standard 4th segment, e.g. `0.6.2.14`–`0.6.2.18`, crept in for a stretch of hotfix releases without being a deliberate decision — retired as of `0.7.0`. See `AGENT_SYNC.md`, 2026-08-22, for the discussion.)

## [0.15.1] - 2026-08-23

### Fixed
- **Google sign-in failing with "Could not load the secure sign-in helper."**
  Root cause: the app is served from `deliveree-app-2a938.web.app`, but
  `authDomain` was `deliveree-app-2a938.firebaseapp.com`. `signInWithPopup`
  loads a helper iframe at `https://<authDomain>/__/auth/iframe`, so a
  mismatched authDomain makes that iframe **cross-origin** — its
  cookies/storage are third-party, which Chrome's 3P-cookie phase-out,
  Safari ITP, and in-app webviews all block. The iframe then can't relay the
  auth result and sign-in dies. `authDomain` now resolves to the page's own
  hostname whenever the app is served from one of the project's Firebase
  Hosting domains (Hosting serves `/__/auth/*` from every site in the
  project), making the iframe first-party; any other origin (custom domain,
  localhost, tests) still uses the configured value.

  This same fix landed once before in `9470547` and was reverted 8 minutes
  later in `dffebf6` — the code was correct, but the Google Cloud OAuth
  client only allowed the `.firebaseapp.com` redirect URI, so changing
  origins broke sign-in a different way. **Both console entries are required
  for this to work** (see the comment on `resolveAuthDomain`):
  - Firebase Console → Authentication → Settings → Authorized domains:
    `deliveree-app-2a938.web.app`
  - Google Cloud Console → Credentials → Web OAuth client → Authorized
    redirect URIs: `https://deliveree-app-2a938.web.app/__/auth/handler`

  Extracted as a pure `resolveAuthDomain(hostname, configuredDomain)` with
  unit tests, including a guard against lookalike domains (`notweb.app`,
  `evil-firebaseapp.com`) being treated as our own origin.

## [0.15.0] - 2026-08-23

_Unifies the Settings pilot's design language across the entire app,
instead of keeping it scoped to one modal — per explicit direction that
the dark navy+gold pairing (colors included) and the light theme's
layout/font precision (blue accent kept, not gold) should be the app's
one design language, not two coexisting ones._

### Changed
- **App-wide color retint** (`index.css`): the same `--color-slate-*`/
  `--color-blue-*` custom properties every component already reads via
  standard Tailwind classes (`bg-slate-900`, `text-blue-400`, etc. — the
  same mechanism the 0.11.0 indigo redesign used) are retinted again:
  - **Dark theme**: slate hue shifted from indigo (H284) to navy (H255,
    matching the Settings pilot's `--stg-*` dark values), and the blue
    accent scale replaced with gold (H~55-78) — the app's one dark accent
    now, not a second color living only in Settings.
  - **Light theme**: slate follows the same navy hue shift, but the accent
    scale is now *explicitly* diverged from dark instead of shared — light
    keeps the original indigo-blue accent rather than adopting gold, per
    the explicit "layout/font, not colors" direction for light mode.
  - No component files needed changes for this — it's the same token
    indirection already in place app-wide.
- **`--font-sans` set to Atkinson Hyperlegible** (falls back to Inter),
  matching the Settings pilot's font. Only affects Latin/English text —
  Hebrew keeps Rubik unchanged, since Atkinson Hyperlegible has no Hebrew
  glyphs and the app is Hebrew-first.
- **Settings light theme's accent** (`--stg-accent`/`--stg-accent-soft` in
  `.light .settings-theme`) changed from gold to the app's exact
  `--color-blue-600`/`--color-blue-100` values, so Settings and the rest
  of the app now use identically-sourced blue in light mode.

### Fixed
- **`sanitizeAuthError`'s fallback code-extraction regex** was reading
  *any* `auth/xxx`-shaped substring out of a raw error message — including
  Firebase's own auth-helper iframe URL path (`.../__/auth/iframe`), which
  is not a real error code at all. That produced the misleading
  "Authentication error (auth/iframe)" message reported after 0.14.0: not
  a genuine Firebase error code, just a URL fragment being mislabeled as
  one. Tightened the regex to exclude matches preceded by another `/`, and
  added a specific, actionable message for the iframe-load-failure case
  (the most likely real cause — third-party cookies/storage blocked by
  browser privacy settings or an ad/tracker blocker) instead of the
  generic fallback.

## [0.14.0] - 2026-08-23

_Removes a broken sign-in option, fixes a real RTL toggle-switch bug, and
simplifies the filter bar down to search + one filters panel per user
feedback on 0.13.0._

### Fixed
- **RTL toggle-switch thumb rendering outside its track** (`AccountModal`'s
  `Switch`) — the old markup positioned the thumb with a `peer-checked:
  after:translate-x-full` / `rtl:peer-checked:after:-translate-x-full`
  pair: two same-specificity rules where source order decides the winner,
  which broke silently in RTL. Rewritten to position the thumb directly
  from the `checked` prop via logical `inset-inline-start` (`start-[2px]`
  / `start-[22px]`) instead — correct in both directions with no `rtl:`
  variant needed.
- **Removed the Apple sign-in button** (`AuthModal`) — it was never wired
  up in Firebase/Apple Developer (added in an earlier, unrelated PR months
  before this session), so it could only ever fail for anyone who clicked
  it. Google remains as the one working OAuth option, now full-width.

### Changed
- **`FilterBar` simplified**: the "one line" from 0.13.0 was technically
  one row but still five separate controls (search, status, carrier, sort)
  crowded into it. Now it's just a search bar plus a single "Filters"
  button that opens a small panel (status list with counts, carrier, sort)
  — refresh and the grid/table toggle stay as icon buttons beside it. The
  bar itself can never overflow or need scrolling, at any width.

## [0.13.0] - 2026-08-23

_Settings pilot redesign + a genuine one-line FilterBar._

### Changed
- **`FilterBar` is now a true single row**: search, status, carrier, and
  sort all live in one `flex` row with `overflow-x-auto` as the mobile
  fallback (horizontal scroll, never a second line) instead of a primary
  row + secondary row. The previous two-row compact layout (0.12.0) didn't
  actually satisfy "one line."
- **Settings (`AccountModal`) restyled** around a blind design-tool pass
  run specifically for a settings/preferences page (independent of the
  0.11.0 dashboard redesign's indigo palette): trust-navy + gold accent,
  Atkinson Hyperlegible (an accessibility-first typeface), sharper
  `rounded-lg`/`rounded-xl` radii instead of `rounded-2xl`/`rounded-3xl`.
  Scoped via a new `.settings-theme` class + `--stg-*` custom properties
  (`index.css`) that only apply inside this modal — the rest of the app is
  untouched, since this is a pilot for the palette, not yet a decided
  app-wide direction. All existing functionality (profile, notifications,
  preferences, data export, danger zone, about) preserved exactly; only
  the styling changed.
- Added Atkinson Hyperlegible to the Google Fonts `<link>` in `index.html`.

## [0.12.0] - 2026-08-23

_Follow-up pass on the 0.11.0 dashboard redesign, closing the gap between it
and the comparison mockup it drew from: a compact filter bar, a decluttered
package card, symmetric 4-tile stats, and a fix for the desktop card grid
leaving large empty gaps with few results._

### Changed
- **`FilterBar`** rebuilt around a compact primary row (one status dropdown
  + search, replacing a 7-button pill row that wrapped across two lines) with
  carrier/sort/refresh/view-mode demoted to a smaller secondary row. The
  dropdown's options are the same higher-level buckets used by the new
  4-tile stats (all/transit/attention/delivered/archived); the finer
  in_transit vs. out_for_delivery split is still visible per-package (card
  badge, detail-modal stepper), just not a top-level filter anymore.
- **`StatsCards`** reduced from 5 tiles to 4 (`grid-cols-2 lg:grid-cols-4`,
  no more odd-tile mobile spanning hack) by merging in_transit +
  out_for_delivery into one "Transit" tile and customs + exception into one
  "Attention" tile — matches the 4-tile grouping from the comparison mockup
  and keeps the KPI row a clean, symmetric grid.
- **`PackageCard`** action row cut from 7 always-visible icons to 2
  (refresh, mark-delivered) plus one overflow menu holding the rest (copy
  tracking #, open carrier link, pin/unpin, edit, archive, delete) — the
  whole card was already the "view details" tap target, so the previous
  row was pure visual clutter. A pinned package now shows a small pin badge
  on its leading icon instead of a dedicated always-visible pin button.
- **Desktop package grid**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (a
  fixed column count) replaced with `grid-cols-[repeat(auto-fit,minmax(320px,1fr))]`.
  `auto-fit` collapses unused column tracks to `0fr`, so 1–2 filtered
  results stretch to fill the row on a wide screen instead of sitting in a
  fixed-width card next to a large empty gap.

### Investigated, not changed
- Consulted the third-party `ui-ux-pro-max` design-linter tool (per its own
  request) on the compact filter/list pattern, card-grid empty-space
  handling, and Settings page orientation/layout. Its database returned
  only generic, non-Deliveree-specific guidelines (debounce search inputs,
  avoid `overflow-hidden` clipping, avoid horizontal scroll) and zero
  matches for "settings page layout" specifically — the concrete changes
  above are original design judgment, not tool output. Settings
  (`AccountModal`) itself was reviewed and left as-is: its nav-rail-left +
  content-right pattern (collapsing to a horizontal tab strip on mobile)
  is already a standard, RTL-correct settings layout with no structural
  issue found.

## [0.11.0] - 2026-08-23

_Dashboard redesign: an indigo-black dark theme, solid surfaces in place of
the previous glassmorphism, and a denser package-list layout, based on
elements the user liked from a blind design-system mockup generated by a
third-party design tool (`ui-ux-pro-max-cli`) — not a copy of the mockup's
light theme or its own component code, just its color palette and layout
density applied to Deliveree's existing components._

### Changed
- **Dark theme retinted** from slate-blue (H 265) to indigo-violet (H 284) —
  `--color-slate-*` and `--color-blue-*` custom properties in `index.css`
  only, so every existing Tailwind utility using those tokens picks up the
  new hue automatically. The `.light` theme's slate tokens were retinted to
  match; `.dark`'s blue accent chroma was raised at the 400/500/600 steps for
  a brighter, more eye-catching accent.
- **Solid surfaces replace semi-transparent glassmorphism** on the dashboard:
  `StatsCards`, `PackageCard`, `PackageTable`, and `FilterBar` now use opaque
  `bg-slate-900`/`bg-slate-950` backgrounds instead of `bg-slate-900/50` +
  `backdrop-blur-xl`, per user feedback that the mockup's solid surfaces
  "catch the eye more" than translucency. Scoped to these four dashboard
  components, not swept across every modal in the app.
- **`StatsCards`** tiles: removed the decorative gradient/glow-blur div,
  added an always-visible colored left-edge stripe per stat, count text now
  uses tabular-nums and a slightly less heavy weight.
- **`PackageCard`** restructured to two compact rows (icon + title + tracking
  info + status pill; then date + all quick actions on one line) so more
  packages are visible at a glance without a scroll — the full transfer
  history remains available in the existing package-details modal, which
  this change does not touch; only the card's own mini-timeline preview was
  removed.
- **`FilterBar`**/**`PackageTable`**: mechanical opacity/blur removal only,
  no functional changes.

## [0.10.2] - 2026-08-23

_Found by running the `ui-ux-pro-max` design/accessibility skill's checklist
against the actual code, not just describing what should be true._

### Fixed
- **Toasts were invisible to screen readers** (`Toast.jsx`) — content
  appeared/disappeared with no `role`/`aria-live`, so nothing announced it.
  Error toasts now use `role="alert"` (assertive); success/info use
  `role="status"` (polite).
- **`prefers-reduced-motion` was never respected anywhere** — the app's
  `animate-fade-in`/`animate-bounce-in`/`animate-pulse-subtle` etc. always
  played regardless of the OS setting. Added one global override in
  `index.css` rather than a `motion-reduce:` variant on every animated
  element individually.

### Noted, not fixed this round
- Text-input focus indicators (`focus:outline-none` paired only with
  `focus:border-blue-500`) are a visible but weaker-than-ideal focus signal
  — a border color change rather than a ring. Below best practice, not
  urgent enough to bundle here.

## [0.10.1] - 2026-08-23

_Response to a structured contract review of `legal.js`
(`docs/legal-review-2026-08-23.md`) — several findings were the review
catching the draft describing behavior the code didn't actually have._

### Fixed
- **Two more stale hardcoded version badges** (`Navbar.jsx`, `AuthModal.jsx`)
  — the same class of bug as the `index.html` one fixed in `0.8.0`, just
  missed because that fix was scoped to the specific bug reported rather
  than a full sweep. Both now read from `APP_VERSION`.
- **Account deletion race condition**: the Firestore purge was fire-and-
  forget with a 2s timeout, and the Auth user was deleted regardless of
  whether it finished — a slow connection or large package list could
  leave orphaned data no client could ever reach again once the uid was
  gone. Now fully awaited, in order, before the Auth user is deleted; a
  failure at either step throws instead of being swallowed into a false
  "success" toast.
- **PII redaction now actually runs** before pasted text leaves the device
  for Google's Gemini API (`aiParseService.js`), and before any opted-in
  training example is stored (`trainingDataService.js`) — using the
  existing `privacySanitizer.js` that `feedbackService.js` already relied
  on, just not wired into these two newer paths. Not applied to
  `trackingNumber`/`carrier` (a legitimate tracking number can look like a
  redactable credit-card-length number, and it's the one field this
  dataset needs to stay correct) or to screenshots (redacting an image
  before sending it would defeat the point of reading it — a known,
  disclosed residual gap, not fixed here).

### Changed
- **`legal.js` rewritten** to close gaps the review found between what the
  draft claimed and what the code does — added a real limitation-of-
  liability/warranty-disclaimer/governing-law set (previously entirely
  absent), corrected the "guest data never leaves your device" and "we
  don't share with anyone except..." claims to match what
  `carrierApiProxy.js`/`trackingService.js` actually do (tracking numbers
  go to Israel Post/HFD/Cheetah/BoxIt/Cainiao/17Track regardless of sign-in
  state), and scoped the service to Israel-only for now rather than carry
  an unresolved EU representative question. `LEGAL_VERSION` bumped, so
  every signed-in user is re-prompted by `LegalConsentGate`.

### Known gaps (flagged in `legal.js`'s own header, not fixed this round)
- `/feedback` is deliberately anonymous (no uid stored, by original
  design) and therefore can't currently be deleted per-account — a real
  contradiction with the account-deletion promise that needs a decision
  (change the anonymity design, or narrow the promise), not a quick fix.
- No formal international-transfer safeguard is documented for the
  Cainiao/17Track (China-based) carrier calls beyond their own terms.
- Israeli Security Regulations (2017) paperwork — a database-definitions
  document, security classification, incident register — doesn't exist.
- This is still an individual operating personally, not a registered
  entity; every liability clause in `legal.js` is a mitigation, not a fix
  for that underlying exposure.

## [0.10.0] - 2026-08-23

### Added
- **Legal consent & AI-training opt-in**: registration now requires
  accepting the Terms of Use / Privacy Policy (`src/constants/legal.js`,
  `LegalDocumentModal`), plus a separate, unchecked-by-default checkbox to
  opt in to AI-training data collection. OAuth sign-ins (Google/Apple/
  Facebook) have no form step, so a blocking `LegalConsentGate` catches
  those — and any pre-existing account — on first login after this shipped.
  Changeable anytime from Account Settings → Profile.
- **Real training data for opted-in users** (`trainingExamples` collection,
  `src/services/trainingDataService.js`): unlike the existing field-names-
  only `parseCorrections` signal, opted-in users' actual pasted text and
  before/after correction values are stored, tied to their account — the
  first real dataset for improving the Smart Import parser beyond the
  built-in regex patterns. Text only, never the screenshot image. This data
  has no separate retention timer: turning the opt-in off, or deleting the
  account, deletes it immediately (`AuthContext.updateAiTrainingOptIn`,
  `deleteUserAccountAndData`) — enforced both client-side and by
  `firestore.rules` (`aiTrainingOptIn` re-checked server-side on write).

### Note
- `src/constants/legal.js` is a working draft, not a lawyer-reviewed
  document — see the file's own header comment. Get real legal review
  (Israeli Privacy Protection Law Amendment 13 in particular) before
  relying on it as a binding agreement.

## [0.9.0] - 2026-08-23

### Added
- **AI-assisted Smart Import**: a new Cloud Function (`functions/`, this
  app's first backend component) fills two gaps — a Gemini-backed fallback
  for pasted text the deterministic parser can't handle, and the only way
  to extract tracking details from a pasted/attached screenshot at all
  (previously not possible in any form). Requires sign-in and App Check;
  guarded by per-user and global daily call caps plus payload size limits.
  See README.md "AI-assisted import" for the full design and required
  one-time setup (Gemini secret, Blaze plan) before it's live.
- **Mis-parse detection**: a Smart Import result that's confidently wrong
  looked identical to a correct one until now. An implicit signal logs
  which fields a user edits after auto-fill, before saving
  (`parseCorrections`, field names only — never values); an explicit
  "this wasn't right?" button on the result routes through the existing
  feedback pipeline instead of a second reporting system.

## [0.8.0] - 2026-08-23

_Four PRs (#16–#19) merged after 0.7.0 without a version bump — this entry
covers all of them in one pass so the gap doesn't leave an untraceable range
in the history. Separately, `index.html` turned out to carry its own
independent hardcoded version string (for a cache-purge check) that had
drifted from `version.js` for months without anyone noticing — `version.js`
and `index.html` now both derive from `package.json` at build time instead
of duplicating the value (see `vite.config.js`/`vitest.config.js`)._

_Going forward: **every PR that changes `src/**` must bump `package.json`'s
`version` field** — the one place left to bump — enforced by CI (the
"Require Version Bump" job in `ci.yml`) rather than left to memory._

### Fixed
- **#16** — Tester feedback is now actually readable by admins: added an
  allowlisted admin check (`src/constants/admin.js`, mirrored by
  `firestore.rules`), and `AdminFeedbackModal` now reads the real Firestore
  `/feedback` collection instead of only local-browser history.
- **#18** — Live tracking no longer fabricates checkpoints or delivery
  estimates for carriers with no real upstream integration (previously all
  carriers except Israel Post). Untracked packages now say so explicitly
  instead of showing invented data.

### Added
- **#17** — Feedback submissions can include an attached screenshot
  (client-side downscale/compress, capped and validated server-side).
- **#19** — Firebase App Check wiring (`ReCaptchaV3Provider`), optional and
  gated on `VITE_RECAPTCHA_V3_SITE_KEY` — inert until configured.

### Changed
- **#18** — Firebase config no longer has hardcoded fallback values; a
  production build now fails loudly if any `VITE_FIREBASE_*` variable is
  missing, instead of silently defaulting to the production project.
- **#18** — CI now deploys `firestore.rules` alongside Hosting, so the live
  rules can't silently drift from what's in the repo.
- **#19** — Extracted `src/hooks/usePackages.js` from `App.jsx`: package-list
  state, demo mode, and the storage-reconciliation effects (cross-tab sync,
  Firestore subscription, guest/user load) now live in one testable hook.

### Removed
- **#18** — `simulateCarrierTracking`, ~500 lines of mock tracking data
  generation reachable only by its own tests.

## [0.7.0] - 2026-08-22

_Note: entries for 0.3.0-alpha through 0.6.2.17 were not recorded in this file — version bumps happened in `package.json`/`version.js` without a matching changelog entry. Not backfilled here; see git log for that history._

### Changed
- Removed Telegram integration from all app-facing code (feedback relay, package-status alerts, Settings UI) — kept ops/daemon scripts untouched.
- Consolidated the 3 separate add-package entry points into 1.
- Wired `syncQueueService.enqueue()` into the real package CRUD path in `App.jsx`/`AuthContext.jsx` — offline mutations (add/update/delete) now actually go through the sync queue and dead-letter handling instead of writing directly and silently dropping on failure.

### Planned
- Smart ingestion & AI parsing overhaul (automatic email-forwarding ingestion + AI-enhanced paste fallback) — see `docs/plans/2026-08-22-smart-ingestion-ai-parsing.md`.

---

## [0.2.0-alpha] - 2026-08-19

### Added
- **Firestore Security Rules Lockdown**: Granular zero-trust path rules restricting package access exclusively to verified `request.auth.uid` owners (`/users/{userId}/packages/{packageId}`).
- **Zod Runtime Validation**: Comprehensive schemas in `packageValidator.js` providing rigorous parsing, input sanitization, and defensive boundary protection.
- **Account & GDPR Data Deletion Modal**: Dedicated settings UI supporting complete user data wiping and GDPR export features.
- **PWA Auto-Update Lifecycle**: Service Worker update detection with user notification prompt and instant skip-waiting reload.
- **Cloud Firestore Feedback Collection**: Integrated user feedback mechanism capturing structured bug reports, ratings, and diagnostic payloads directly to Firestore `/feedback` with local cache fallback.
- **iOS Safe Area Inset Support**: Full viewport handling with `viewport-fit=cover` and dynamic notch/home bar bottom/top padding.
- **Unit Testing Suite**: High-coverage Vitest suites verifying schema validation, store synchronization, and versioning baselines.

### Changed
- Refactored `AccountModal` and `FeedbackModal` to dynamically bind to canonical `APP_VERSION`.
- Updated PWA Cache identifier to `deliveree-cache-v0.2.0-alpha`.

---

## [0.1.0-alpha] - 2026-08-15

### Added
- **Core MVP**: Multi-carrier tracking for Israel Post, DHL, FedEx, UPS, AliExpress, and domestic carriers.
- **Local Persistence**: Offline-first reactive package state management with local storage and cloud sync capabilities.
- **Bilingual Hebrew/English Support**: Full RTL/LTR responsive UI with interactive timeline rendering.
- **PWA Capabilities**: Installable Progressive Web App with offline asset caching.
