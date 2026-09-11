# Changelog

All notable changes to Deliveree will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Versioning convention (established 2026-08-22)**: standard `MAJOR.MINOR.PATCH` — MINOR bumps for new user-facing features/capabilities, PATCH bumps for bug fixes. `MAJOR` stays `0` while in alpha. (A non-standard 4th segment, e.g. `0.6.2.14`–`0.6.2.18`, crept in for a stretch of hotfix releases without being a deliberate decision — retired as of `0.7.0`. See `AGENT_SYNC.md`, 2026-08-22, for the discussion.)

## [0.28.2] - 2026-09-11

### Fixed
- Filtered promotional and developer onboarding emails from automatic tracking ingestion, and preserved service worker Web Push subscriptions across version releases instead of unregistering them.

## [0.28.1] - 2026-09-11

### Fixed
- Fixed cross-device sync and persistence failures for packages ingested from Gmail or email by allowlisting `source`, `confidence`, `lockerPin`, `orderNumber`, and `schemaVersion` in Firestore security rules and package schemas.

## [0.28.0] - 2026-09-10

### Added
- Integrated official 17TRACK API (v2.2) aggregator proxy in Firebase Cloud Functions for WAF-protected couriers (Israel Post, GCX, DHL, FedEx, UPS, Cainiao) and added direct open adapter for GAASH Worldwide.

- Trigger background live tracking refresh on package creation, enrich generic package titles from item names or cross-email order correlation (Tier 1 in-memory match with multi-parcel protection, Tier 2 on-demand confirmation lookup), preserve order numbers across schemas, and instruct Gemini to extract product names.

- Added global-to-domestic carrier handover tracking and deduplication (uniting AliExpress/Cainiao with local courier tracking numbers without duplicate cards), direct live tracking adapters for Exelot and Cainiao, shelf number (מדף / bin index) extraction across retail pickup SMS messages and Israel Post API, and updated Firestore security rules.

- Rebranded application from Deliveree to SpotLi (spotliapp.com) across HTML metadata, PWA manifests, bilingual i18n copy, legal terms, UI components, Cloud Functions push/email ingestion, agent skills, SDLC rules, documentation, and automation tooling while preserving backward compatibility for existing client storage keys and email domains. Finalized the 3D Spotlight app icon and multi-resolution logo asset suite for PWA, iOS, Android, and web favicons.

### Fixed
- Cut the interaction latency that made the UI feel unfinished. Every control now
has an immediate press state (the app had removed the platform tap highlight
without replacing it) and `touch-action: manipulation`, which drops the
browser's wait-for-a-double-tap delay before firing click. The ~100
`transition-all` declarations became a `transition-ui` utility that names only
compositor-friendly properties, so an unrelated style change no longer schedules
a layout pass. `backdrop-filter` came off the surfaces that animate or repaint
on every scroll frame — the header and bottom nav are already 90–95% opaque, so
the large blur radius was paying full cost for a near-invisible effect. Tab
switches now jump to the top instead of smooth-scrolling while the list is
re-rendering underneath. The one remaining infinite animation loop in the
always-on UI (the update banner's bounce) is now a one-shot.

## [0.27.0] - 2026-09-07

### Added
- Enhanced package card swipe interactions with iOS Mail/Gmail-style dynamic color tracks for live visual feedback when swiping to archive or delete. Added the `returned_to_sender` package lifecycle status across models, validation rules, carrier extraction, and UI badges. Smoothly modernized modal, banner, and bottom-sheet transitions with hardware-accelerated animations and spring easings.

### Fixed
- Fixed `returned_to_sender` packages failing to sync to the cloud. The status was
added to the client's `VALID_STATUSES` but not to the `validStatuses` allowlist in
`firestore.rules`, which is the actual enforcement — so a package that reached that
status was stored locally and then rejected by Firestore, silently dropping it from
cloud sync for signed-in users. Added a contract test that fails whenever the two
lists drift apart.

- Fixed automatic push notifications never arriving. Three independent faults
each broke the chain on their own: `AccountModal` passed `user?.uid` to every
push call, but the auth profile exposes the Firebase uid as `id`, so
subscriptions were never persisted server-side; `subscribeToPush` was only
reachable from the "enable notifications" button, which is hidden once
permission is granted, so an already-permitted device could never register;
and the service worker read `packageId` only from `data.data`, while the Cloud
Functions send it at the top level, giving every notification the same tag so
each one replaced the last. Push preferences now reflect a genuinely reachable
subscription rather than permission alone, and the notification settings show
which stage of the chain — server key, browser subscription, server
registration — is actually failing.

## [0.26.1] - 2026-09-05

### Fixed
- Restored AI-assisted import. App Check could not issue a token in production,
so the function rejected every request and both AI text parsing and screenshot
parsing were unavailable. Sign-in, the daily call caps and the payload size
limits all still apply.

- Add autonomous synthetic delivery message training generator and benchmark testbench across 16+ carriers; add Orian dashed tracking format, E-Cargo, and Exelot carrier specs with official domains (including gpkg.to); calibrate candidate scorer and tie-breaker so courier waybills outrank merchant order numbers.

- Align Privacy Policy and Terms of Use with current app architecture: declare Google OAuth `gmail.readonly` scope in public policy HTML, remove legacy IndexedDB references in favor of localStorage, and clarify Israel Post live tracking queries versus outbound carrier portal links.

- Email sync no longer adds packages it cannot track. An order-confirmation
email with no carrier tracking number used to create a card showing a store
name, an empty tracking number and a full delivery-stage tracker, with nothing
tying it to the order it came from. The shipping email that carries a real
tracking number creates the package instead.

## [0.26.0] - 2026-09-05

### Added
- Smart Import now confirms uncertain tracking numbers with the carrier before
falling back to AI parsing. For Israel Post, asking whether a number resolves
to a real shipment settles the ambiguity outright instead of guessing at it —
and skips the AI call entirely when it succeeds.

- Smart Import now reads Israel Post's full range of tracking formats. Domestic
items (RU0126608087Z, MB0121596516Y), counter-issued items (YY00370128005) and
inbound registered mail from any country (RE…SE, RT…HK, RS…NL) were previously
unreadable — only codes ending in IL were recognised. On a real 19,000-message
inbox this took Israel Post messages read confidently from 259 to 485.

- Smart Import now reads the way couriers actually write. Messages phrased
"חבילה מ<חנות> מספר 47911656" or "הזמנתך שמספרה AP35428006" — the shipment
noun, the store, then the number — were previously missed entirely, as were
Israel Post mailbox items whose code ends in any distributor letter. Measured
against a real 19,000-message inbox, 131 more delivery messages are now read.

- Smart Import now ignores tracking-number-shaped text in promotional and survey
messages, recognises carriers by their regional and Israeli hosts (dhl.co.il,
israelpost.co.il, aramex.co.il and others), and no longer treats a path
segment on an unrelated website as a courier confirmation. When the AI
fallback and the offline parser independently agree on a number, that
agreement now counts.

- Made Smart Import substantially more accurate at detecting tracking numbers.
The parser no longer treats invoice numbers, parking fines, customer numbers
and URL path ids as shipments, and it now reads tracking numbers that carriers
print in spaced groups (UPS's `1Z 999 AA1 01 2345 6784`, Israel Post labels).
Global carriers (DHL, FedEx, UPS, USPS, Aramex, Royal Mail, Cainiao) are now
recognised by name in English notifications, not just Hebrew ones.

### Fixed
- Smart Import no longer spins forever when AI parsing cannot start. The call
now gives up after 35 seconds and tells you to enter the details manually,
instead of leaving a "trying AI parsing" spinner on screen indefinitely.

- Fixed every screen that could hang forever waiting on a Cloud Function. Smart
Import's "trying AI parsing" and the account screen's "Checking status…" both
sat indefinitely in production because the call was never actually sent. All
five callables now give up and report a failure instead of spinning.

- Fixed a data-loss bug where cloud sync could delete packages off a signed-in
user's device (#91).

The Firestore listener queried with `orderBy("updatedAt", "desc")`. Firestore
omits documents that lack the field an `orderBy` names, so any package stored
without an `updatedAt` was simply absent from the snapshot — not deleted, just
not returned. The reconcile then treated "absent from the snapshot" as "no
longer exists" and dropped the local copy, and the listener persisted that
result to localStorage, destroying the records.

The query no longer orders server-side (ordering is presentation, and must
never decide which records exist), and reconciling a snapshot can no longer
shrink what is on disk: packages missing from a snapshot are kept and the
near-miss is logged. Deletions continue to travel through tombstones. The
`getPackages` path already had an equivalent guard; the listener, which is what
actually runs during a session, did not.

- Remediated comprehensive design, UI/UX, and accessibility issues: consolidated AccountModal and AccountSheet into a single responsive modal without nested portals or legacy tokens, moved PWA banner to a top banner, hid BottomNav and FAB during sub-modals, hid the floating feedback button when inside the feedback modal or sub-modals, unified StatsCards 4-column layout and FilterBar chips, and improved RTL mirroring and WCAG 2.2 touch targets.

- Adds `npm run review:messages`, a local tool that runs your own SMS export
through the parser and reports which delivery messages it fails to read,
grouped by sender. Nothing is uploaded and output is PII-redacted by default.

- Smart Import now reads messages that contain invisible formatting characters —
the bidi marks Hebrew senders' phones insert around Latin tracking numbers,
non-breaking spaces from HTML emails, and irregular spacing — which previously
caused the tracking number to be missed entirely. Adds a robustness test suite
that generates ~1,000 noisy variants of every known message.

- Smart Import now recognises the order number as the tracking number when a
courier uses one number for both — Tapuz among them — provided the message
says the parcel has shipped. Checkout receipts and "we'll update when it
ships" notices, which use near-identical wording, are still ignored.

- Fixed three faults found in real courier messages: Hebrew carrier names
written with a typographic apostrophe (צ’יטה) were not recognised, Israel
Post's "מהיר לתיבה" mailbox format (MA…N8) matched nothing at all, and a
shortlink in the message could outrank the tracking number printed beside it.
Adds the cheetahint and zig-zag hosts.

- Fixed four detection faults found in a real courier message: "מס מעקב"
without an apostrophe was not recognised as a tracking label, WhatsApp contact
links had their phone numbers read as tracking numbers, Cargo was not
recognised by its bare brand name or its cargo-ship.co.il domain, and an
opaque token from a tracking URL could outrank the tracking number the message
actually shows you.

- Hardened Cloud Functions endpoints with fail-closed webhook/push tokens, eliminated unmanaged root Firestore package writes, patched CSV injection leading-whitespace vectors, validated service worker notification click targets, updated LegalConsentGate to re-prompt on legal updates, and aligned Terms of Use and Privacy Policy with full capability disclosures and comprehensive limitation of liability.

- Smart Import now reads Tapuz tracking links. Their notifications use a
`tracking_number` parameter on tapuzdelivery.com and issue short mixed-case
codes, none of which were recognised — and the code's capitalisation is now
preserved, since upper-casing it produces a number their tracking page does
not accept.

- Smart Import no longer guesses a carrier from how many digits a tracking number
has. An Israeli courier's job number was being filed under DHL or FedEx purely
because it was ten or twelve digits long; when nothing in the message names a
carrier, the package is now saved with the carrier left unknown. Also reads
numbers labelled "שליחות", which Bar Group and others use.

## [0.25.0] - 2026-09-04

### Added
- Rebuild the Account tab as one list, and make the feedback rating optional.

- Settings are merged into the Account tab instead of opening a "Settings"
  screen that carried its own six-item rail — a menu inside a menu.
- Every setting is the same 52px row (label, current value, chevron), built
  from shared `SettingRow`/`Toggle` primitives. Choices open a picker rather
  than embedding native selects, whose per-platform height and styling were
  why the settings read as a different product.
- Notifications, account deletion and profile each get their own page.
- Back navigation is a single leading-edge arrow everywhere; the close X is
  gone from inner pages, and `ModalHeader` no longer tries to show both.
- Removed the `defaultCarrier` preference: it was written and sanitised but
  never read by anything.
- Feedback no longer pre-selects five stars or requires a rating. Unrated
  reports omit the field entirely; `firestore.rules` accepts feedback without
  a `rating` and still bounds it to 1..5 when present.

- New Activity tab: one feed of everything that moved on your packages, newest
first and grouped by day — the question you open a tracking app for between
checks. It replaces Pickup Points in the bottom bar, which was backed by four
fixed locations; pickup points are still under Account and on any package that
has one.

Tab destinations no longer carry a Close button on mobile, since the bar itself
is the way out.

- Added a mobile bottom tab bar (Status / Insights / + / Lockers / Account) and
moved the drawer trigger off the top-left corner on phones, where it was the
worst reach for a thumb; the hamburger and header "+" are now desktop-only.

Added ambient state chrome: one derived value tints the header wash, the header
hairline, the app mark and the bottom-nav hairline amber when something needs
collecting today and rose when a package is held at customs or has stalled.
Shipped alongside removing three infinite `animate-*` loops — the pinging
attention dot, the out-for-delivery badge pulse, and the header logo glow —
which carried the same signal a pixel at a time and never stopped competing.

Language now follows the browser/OS on first run instead of always defaulting to
Hebrew, matching how theme has always honoured `prefers-color-scheme`. An
explicit toggle still pins the choice.

Fixed the toast and PWA install banner pinning to the bottom-right in Hebrew as
well as English, and raised `.min-h-touch` from 44px to the 48px the project's
own accessibility spec mandates.

- On a phone, every screen is now a real page rather than a card floating over
the package list — full width, full height, no backdrop. Short confirmations
like "delete this package?" stay as small dialogs, where taking over the whole
screen would hide the very thing you are deciding about.

The Account tab opens a proper account screen with grouped sections instead of
the old thirteen-item side drawer.

- Reworked the home screen. The four equal KPI tiles are now one focal number —
whatever actually needs you — with the rest stepping down from it, so the screen
leads somewhere instead of asking you to read all four. Search has its own
full-width row rather than sharing one line with the filter, refresh and both
view toggles, and the view toggles moved to the end of a second row.

- Significantly improved email tracking and Smart Import accuracy: added full package lifecycle progression and deduplication, Schema.org/JSON-LD parsing with ESP redirect unwrapping (SendGrid, Klaviyo, AliExpress, Shein), parity extraction for Hebrew/English pickup locations and locker PINs, multi-package disaggregation per email, two-stage grounded screenshot OCR in Gemini, and automated push notifications on status and pickup location updates.

- The bottom bar now stays on screen wherever you go, and the tab you are on is
highlighted — so Insights, Lockers and Account read as places you navigated to
rather than windows that opened on top of your packages. The bar is the way
back, so the duplicate "Close" button on those screens is gone on mobile.

- The bottom bar now behaves like real tabs: tapping one takes you to that
screen instead of stacking another on top, and tapping Status returns you to
your packages. The add sheet no longer sits under the bar, and the pickup
points list is no longer squeezed to a single row on a phone.

- Interface text now scales with your browser and OS text-size setting across the
whole app. Every size was previously pinned in pixels, so raising your text size
produced a half-scaled interface where labels, badges and metadata stayed tiny.

Removed the animations that ran forever — a pulsing "closes soon" badge, pulsing
open/closed dots, pinging progress markers, a throbbing locker-screen icon and
the header logo glow. Each duplicated something already shown by colour, shape
or text. Spinners that report work actually in progress are unchanged.

The package detail view now fits a phone screen without its header overflowing.

### Fixed
- The settings screen now uses the same colours as the rest of the app. It had
been built against its own parallel palette, so it read as a slightly different
product — a different navy, different borders, a different muted grey.

- The glow behind the app mark now follows the ambient state colour instead of
staying a fixed indigo. In the "needs collecting" and "held at customs" states
the fixed halo sat behind an amber or rose mark and overpowered it, so the
header read as the wrong colour at a glance.

- App Check now uses reCAPTCHA Enterprise instead of the classic v3 provider,
which Firebase has deprecated and no longer accepts for new web registrations.
Enforcement is still off; this only lets the client obtain tokens.

- Added a regression test driving the real "mark delivered" -> auto-archive prompt -> confirm/decline path through the App, covering the class of bug fixed in #60 (part of #91).

- Resolved open user feedback and tracker issues: persisted user sort order selection (#133), disambiguated offline from online failure toasts in feedback submissions (#132), fixed carrier dropdown bidi label scrambling in Hebrew RTL (#137), prevented mobile drawer snap-back and locked background scrolling (#136), suppressed phone number misclassifications and improved AliExpress/Cainiao URL and domestic tracking extraction (#134), extracted delivery dates and status cues during smart text ingestion (#135), deduplicated deliveryService.exportData into exportRawToJSON (#91), and clarified anonymous feedback retention during account deletion (#25).

- Fixed the package row menu (the three-dots button) opening invisibly. It was
being clipped by the card's own frame, then drawn underneath the install banner
and the bottom bar. It now renders in full, and flips upward when there isn't
room below instead of disappearing behind the tab bar.

- The package detail screen now leads with where your package actually is. The
progress stepper and key dates moved to the top, above pickup details, courier
actions and the return window — you used to scroll past four blocks to reach
the status. Nothing was removed; only the order changed.

- The alpha feedback button is visible again — it had been sitting behind the
bottom bar since the bar was added, so on a phone it could not be seen or
tapped. The Insights screen also no longer shows a close button on mobile,
matching the other tabs.

- Fixed Gmail sync spamming a separate untracked package card for every
follow-up email in an order's lifecycle (order confirmed, shipped, out for
delivery, delivery issue, ...) when no carrier tracking number was found. A
follow-up email for a store already represented by one of these order-status
packages now updates that package's status instead of creating a duplicate.

- Protected inbound email webhook against unauthenticated forging by requiring a shared `INBOUND_EMAIL_TOKEN` secret query parameter, resolving Strix security finding CWE-306.

- Added a `?lang=he|en` URL override for the interface language, so a link can
carry the language it should open in (useful for sharing a bug report in the
language it happens in). It takes precedence over the stored preference for
that view without rewriting it.

- Dates now follow your local calendar rather than UTC. Israel is UTC+2/+3, so
between midnight and 02:00/03:00 the app treated "today" as yesterday — a
package added at 01:00 was dated a day early, delivery and return deadlines were
off by one, and an SMS saying a parcel arrives "tomorrow" resolved to the wrong
day. Analytics aggregation keys stay on UTC deliberately, so historical counts
remain comparable.

- The add-package and smart-import screens now use the same header, spacing and
controls as the rest of the app, and their last two undersized buttons were
brought up to the 48px minimum.

- Every button, icon button and control in the app is now at least 48x48px, the
size the project's accessibility spec has always required. The only remaining
smaller target is an inline text link, which the standard exempts.

## [0.24.0] - 2026-09-02

### Added
- Added real-time Web Push notifications for packages automatically detected
from Gmail sync or forwarded email — the client already had subscription
code and a service worker push handler with nothing on the server ever
sending to them; this wires up the missing half. A Firestore trigger fires
whenever an automated ingestion source creates a new package, sending a
push to every device the user has subscribed on. Not sent for packages the
user creates themselves (manual add, Smart Import), since they're already
looking at the app when they do that. Requires a one-time VAPID keypair
setup (see README "Automated Email Ingestion & Gmail Sync") — the app and
Gmail sync work fine without it, push notifications just never activate.

## [0.23.0] - 2026-09-02

### Added
- Cloud Functions now deploy automatically on every merge to main (reusing
the same Firebase service account CI already uses for Hosting/Firestore
rules), instead of requiring a manual `firebase deploy --only functions`.
This was previously left out of CI pending the Gemini secret and Blaze
plan being set up — both have been in place for a while (Gmail AI sync has
been live in production), so the gap was just never revisited.

- Gmail auto-sync now falls back to the Gemini AI parser (already used by Smart
Import) when the deterministic parser finds a tracking-number candidate but
isn't confident enough to create a package unattended, instead of silently
discarding it. The AI fallback runs behind a cheap sender/keyword gate and its
own daily and per-sync-run rate limits, separate from Smart Import's budget,
so a busy inbox can't exhaust either feature's allowance. Every miss and every
AI resolution/decline is now logged (sender domain + subject shape only, no
email body) to a new `gmailParseInsights` collection so recurring misses can
be turned into new deterministic regex rules, and `usageEvents` now records
outcome counts for Gmail backfills, live syncs, and watch renewals as a
starting point for feature-usage analytics.

- Instrumented feature-adoption tracking (Phase 3 of #117, using Phase 2's
pipeline): Analytics, Export, Smart Import modals and an `_app_active`
session baseline via a shared `useFeatureUsage` hook; Gmail-sync connect
and Web Share Target import at their existing App.jsx entry points; PWA
install acceptance. Also added: crash reports now dedupe by a random
per-browser-session id (distinct sessions hit vs. raw occurrences) shown
in the admin Crash Monitor tab, and a live "Sync Queue Health" card
(pending mutations, oldest pending age, dead-lettered count) in the admin
System tab, reading the existing offline sync queue read-only. Engagement/
retention and friction/abandonment signals from the original Phase 3 scope
are deferred — see the tracking issue for why.

- Added a privacy-preserving feature-adoption pipeline (Phase 2 of #117):
`featureUsageService.js` records a per-day, per-identity row (deduped, no
content beyond the feature id and date — identity lives only in the
document ID, never as content) to a new `featureUsage` collection nobody,
including admin, can read back. A daily scheduled Cloud Function
(`featureAdoptionRollup`) counts unique rows per feature into
`featureAdoptionStats` and deletes the raw rows immediately after, so
identity-shaped data never accumulates. The admin dashboard's new
"Feature Adoption" tab shows each feature's adoption rate against an
`_app_active` baseline over the trailing 30 days. No features are
instrumented yet — that's Phase 3.

- The Gmail-sync AI fallback now gets an implicit false-positive signal: if a
user deletes, or corrects the carrier/tracking number of, a package the AI
fallback created within the last 72 hours, that outcome is logged
(carrier + confidence band + which fields changed only, never a tracking
number or free text) to a new `gmailAiOutcomes` collection — closing the
gap where `gmailParseInsights` recorded what Gemini said but never whether
it was right.

- Added the Phase 4 piece of the analytics roadmap (#117): a new
`gmail-detection-auto-improvement` agent skill and its data-access script
(`scripts/detection_insights.mjs`) that read `gmailParseInsights`,
`gmailAiOutcomes`, and `smartImportAttempts` for recurring
regex-miss/false-positive patterns and propose a concrete
regex/threshold change as a draft pull request — never merged, never
marked ready for review, by design. Not activated as a running schedule
yet; see the skill's own "Scheduling" section for why.

- Added Smart Import miss-rate telemetry: every Smart-Import-filled save is
now logged (source, confidence, carrier, whether it was corrected — never
the tracking number or any other value) to a new `smartImportAttempts`
collection, giving `parseCorrections` the denominator it never had. The
admin dashboard's Parser tab now shows overall miss rate and a per-carrier
breakdown, so which carrier's email/text format needs regex work next is
visible instead of guessed. Part of the analytics roadmap in #117.

### Fixed
- Fixed the first-ever `gmailConnectionStatus` Cloud Function deploy failing its
container healthcheck — its 128MiB memory allocation was too tight for a
Node 22 2nd-gen function pulling in the Firebase Admin SDK, so it never
finished booting within the startup timeout. Bumped to 256MiB, matching
every sibling `onCall` handler. Also passes `--force` on the CI deploy so
the one-time Artifact Registry cleanup-policy confirmation prompt doesn't
fail the non-interactive deploy.

- Fixed the Gmail connect button still showing "Connect Gmail" after a real,
working connection (packages backfilled fine, but the status check never
even reached the server). `getGmailConnectionStatus()` was bailing out
locally on a bare `auth.currentUser` read, which can still be null for a
moment after a fresh page load or PWA relaunch even once the app's own
sign-in state is otherwise ready — it now lets the callable's own
auth-token flow (which properly waits on Auth SDK readiness) handle it
instead.

- Added a real server-side rate limit (5 calls/user/day, 500/day globally) on
the `gmailBackfill` Cloud Function, on top of the existing UI guard. The UI
guard only stops accidental double-clicks from the connect button — the
callable itself was reachable by any signed-in client directly with no limit
at all, so a user could repeatedly re-trigger their own 30-day inbox scan
and burn Gmail API quota regardless of the AI-fallback budget, which was
already capped separately.

- Fixed the Gmail connect button in the Automated Shipment Ingestion modal
briefly showing "Connect Gmail" right after a successful OAuth connection,
instead of reflecting the real connection state. The button now shows a
"Checking status..." state while the server-verified connection status is
being fetched, and the check now retries shortly after the modal opens to
cover the case where Firebase Auth hasn't finished rehydrating the signed-in
user yet after the full-page OAuth redirect back into the app.

- Fixed `gmailParseInsights` (Gmail-sync AI fallback telemetry) logging a
raw tracking number in two places despite claiming to be anonymized: the
subject line was truncated but not redacted (subjects frequently contain
the tracking number itself), and the regex's top candidate value was
logged directly. Subjects are now redacted of any token-shaped text before
truncation, and only the candidate's carrier guess/score are logged, never
its value.

- Fixed Gmail auto-sync connecting from the staging Hosting channel silently
redirecting back to production after Google's consent screen, so the
connection never appeared to succeed where the user actually started it. The
OAuth `state` param now carries the verified originating origin (production,
or a named Hosting channel like `staging`, validated against an allowlist for
this Firebase project) through the redirect round trip, instead of always
redirecting back to a fixed production URL.

- The Gmail connect button no longer restarts the OAuth flow when Gmail is
already connected. Since only one Gmail account can be linked per user and
reconnecting re-runs the 30-day inbox backfill scan, clicking it while
already connected now just shows an info toast telling the user to
disconnect first, instead of silently burning Gmail API and AI-fallback
quota re-scanning an inbox that was already scanned.

## [0.22.4] - 2026-08-30

### Fixed
- Restored staging deploys on every merge to `main` for pre-release visibility — a prior change had over-corrected this to only fire on release commits, alongside production. Now: staging deploys on every ordinary merge, and skips only on the release-only commit itself (since it carries no code the preceding merge didn't already deploy there), which instead goes straight to production.

## [0.22.3] - 2026-08-30

### Fixed
- Fixed production/staging deploy silently skipping on every release commit since the previous release. GitHub's implicit `success()` on a job's `if:` walks the whole transitive dependency chain, not just direct `needs:` — with lint/test legitimately skipped (not failed) on a release-only commit, that implicit check broke and deploy never ran despite `is_release` correctly evaluating true.

## [0.22.2] - 2026-08-30

### Fixed
- `actions/upload-artifact@v4` silently drops dotfiles/dot-directories unless `include-hidden-files: true` is set, so `public/.well-known/` never actually reached production despite firebase.json's ignore config being correct — that was the real cause of the Strix domain-verification file being unreachable.

- CI no longer re-runs lint/test/functions tests on the release commit produced by `npm run release` — that commit only touches `package.json`/`CHANGELOG.md`/`.changes/`, and the PR that preceded it already ran the full suite against this exact code. Also fixed staging deploy firing on every push to `main` instead of only on the release commit alongside production.

## [0.22.1] - 2026-08-30

### Fixed
- Fixed Firebase Hosting's `**/.*` ignore glob excluding the entire `.well-known/` directory (including `strix-verify.txt`), which caused those requests to fall through to the SPA rewrite and serve `index.html` instead.

## [0.22.0] - 2026-08-30

### Added
- Gmail sync no longer silently discards order-confirmation emails that name a
known store but carry no carrier tracking number (e.g. a marketplace order
number like AliExpress's). These now create a lower-confidence "order
status" package — built from the store and an explicit lifecycle phrase in
the email, never a fabricated tracking timeline — visually marked as "from
order confirmation" and kept structurally distinct from carrier-verified
packages.

### Fixed
- Fixed the Israeli holiday/Shabbat status check using UTC instead of local
Israel time (causing off-by-one closures near midnight), surfaced Gmail
watch-renewal failures in the Ingestion Guide instead of only logging them
server-side, added a `store` field and reconciled `pickupPhone`'s max length
between the package schema and Firestore rules, added a staleness warning
for the hardcoded Israeli holiday table, and bumped a couple of remaining
44px touch targets in the locker and navigation modals to the 48px minimum.

- Added a static domain-ownership verification file for the Strix pentest tool.

## [0.21.1] - 2026-08-30

### Fixed
- Israel Post live tracking now builds a full checkpoint timeline from the
itemtrace gateway's `itemhistory` field when it's returned as a list of
events, instead of collapsing every package to a single "last status"
checkpoint. Falls back to the previous single-checkpoint behavior when
`itemhistory` is a plain string or absent.

- Fixed Gmail sync silently going stale after the initial connect: the watch
renewal job now runs daily instead of weekly (a weekly schedule could miss
renewing a subscription entirely depending on which day it was created,
letting push notifications lapse with no error), and a status-update email
for a tracking number you already have now updates that package instead of
being dropped as a duplicate.

- Add PWA App Badging API, enhanced Web Push payload handling, bilingual package status change alerts, and test notification triggers in Account Settings (TASK-702).

## [0.21.0] - 2026-08-29

### Added
- Add direct shop manager / pickup point call button on pickup cards and locker modal (`pickupPhone` in schema & `extractPickupPhone` in `smartParser.js`).

- Add high-contrast Full-Screen Locker Mode (`FullScreenLockerModal.jsx`) with Screen Wake Lock API, oversized individual PIN digits, 1-tap PIN clipboard copy, instant "Mark as Collected" celebration with confetti, WhatsApp proxy sharing, and seamless modal integration.

- Added live store opening hours intelligence with a 3-tier resolution engine, real-time operating status badges, Israeli calendar notices (Erev Shabbat and Jewish holidays), and crowdsourced incorrect hours reporting.

- Add courier pickup location redirect detection in smart parser (`smartParser.js`), package schema extensions (`isRedirected`, `originalPickupLocation`), amber dashboard card badge, and detailed redirect warning banner in package details and locker modal.

- Add smart same-location package bundling (`locationBundling.js`), contextual sibling alerts in package details, multi-PIN vertical stacked cards in Full-Screen Locker Mode, and 1-tap batch collection.

- Added universal OS navigation deep linking and choice modal supporting Waze, Google Maps, Apple Maps, and Moovit, with 1-click preferred app memory and Account preferences management.

- Deliver Wave 1 tracking pipeline enhancements: 23-fixture Israeli and international courier SMS testbench (TASK-701), candidate evidence scoring calibration, pickup redirect detection, delivered state reversibility, package deletion UX, and characterization test parity.

### Fixed
- Prevented unattended email and Gmail package creation from non-verified detections, and grounded Smart Import AI selection to deterministic candidates.

- Fix package deletion payloads and make bulk package mutations durably queue before a single online replay.

- Reject unexpected or unbounded fields in anonymous Firestore telemetry writes, and align screenshot MIME validation with the client.

## [0.20.1] - 2026-08-29

### Fixed
- Fix package editing save mutation and state update in AddEditPackageModal and App.jsx, ensure return deadline fields persist correctly, and prevent any unintended save on cancel.

## [0.20.0] - 2026-08-29

### Added
- Overhaul email and inbound package parser to clean status boilerplates from titles, infer real-time package status (ready_for_pickup, out_for_delivery, delivered), fix 3-dots dropdown menu visibility on cards, add 1-click edit package action from detail view, and introduce custom courier response manager with preset library.

## [0.19.0] - 2026-08-28

### Added
- Implement candidate-constrained package detection v2.0.0, dual-boundary serializable carrier spec generation, canonical checksum validation, and stratified benchmarks.

- Replaced the Gmail auto-sync integration's forwarding-rule + confirmation-scraping
approach (which depended on guessing the shape of Google's unsupported
confirmation page and required the Restricted `gmail.settings.sharing` scope)
with standard read-only OAuth (`gmail.readonly`) backed by a server-side stored
refresh token, real-time delivery via Gmail `users.watch()` + Cloud Pub/Sub push,
and a one-time 30-day historical backfill on connect. No forwarding rule is ever
created in a user's mailbox. The manual CloudMailin forwarding address remains
available as the no-OAuth fallback, and Outlook's forwarding-rule flow is
unchanged.

- Refactored `usePackages` to use a `commit` based mutation system to prevent data loss in multi-tab offline scenarios.
Extracted `trackingCooldownMap` from `trackingService` into a standalone `rateLimiter` util to unblock dynamic lazy loading.
Extracted `LEGAL_VERSION` from `legal.js` to shrink initial load times and added code splitting for the legal terms.

- Overhaul email auto-detection speed, HTML tracking link extraction, multi-factor confidence scoring, OTP false-positive suppression, and synthetic data generation tooling for model fine-tuning.

- Implement Service Worker Web Push notification event handling and interactive notification click actions (TASK-13).

- Added Dual Deadline Tracking Engine (`TASK-22`):
- Pickup holding window countdown with urgent return-to-sender (RTS) warning for locker/store pickups (<24h / <48h).
- Store return policy window countdown (14/30-day refund periods) with return notes and 1-click quick setters for delivered packages.
- Integrated deadline countdown chips and badges into `PackageCard`, `PackageDetailModal`, and `AddEditPackageModal`.

- Added Courier 1-Click WhatsApp & SMS Quick Actions (`TASK-25`):
- Pre-filled message templates for Porch Drop, Gate/Entrance Code, Safe Place, and Proxy Pickup Authorization.
- 1-Click action triggers for WhatsApp, SMS, and clipboard copying with interactive preview and inline gate-code entry.
- Integrated into `PackageDetailModal` with full Hebrew RTL / English LTR bilingual symmetry.

- Redesigned the `PackageDetailModal` to introduce the "Ultimate Package Page".
Added support for tracking `pickupCode`, `pickupLocation`, and `pickupDeadline` directly in the local store and package schemas.
Added a prominent floating UI card to highlight the pickup code.
Added 1-tap navigation button, countdown timer for pickup deadlines, and quick WhatsApp proxy sharing.
Added manual inputs for pickup details in the `AddEditPackageModal`.

### Fixed
- Add gmail.settings.sharing scope to Google OAuth provider to ensure Gmail API grants permission to create and manage forwarding addresses.

- Add auto-confirmation for Google forwarding verification emails in Cloud Functions, poll for verification in client setup, and keep registered accounts visible in pending status with no ghost disappearances.

- Ensure connected email accounts are immediately added to the inboxes manager on OAuth success, add duplicate linking guards, add direct Google & Microsoft account permission links, and auto-verify Google forwarding URLs.

- Enable Gmail API in Google Cloud project, ensure setupGmailAutoForward error responses are surfaced directly to the user toast, and prevent accounts from getting stuck in pending state if Google API fails.

- Fixed mobile touch tap handling in SideNavDrawer by eliminating duplicate fixed backdrop overlay and ensuring navigation callbacks trigger before drawer dismissal.

- Persist and fetch user legal consent during Google OAuth login to avoid repeating the blocking terms gate, fix infinite re-render loop on unauthenticated modal, allow seamless Google sign-in when connecting Gmail, and ensure inbound Cloud Function writes to scoped user packages in Firestore.

- Fixed the Gmail connection status showing as stuck/duplicated by replacing
client-trusted localStorage writes with a server-verified status check
(`gmailConnectionStatus`), consolidated the OAuth redirect handling into one
place instead of two independent effects, granted the missing Cloud Run
invoker IAM binding for `gmailOAuthStart`/`gmailDisconnect`, gated the
ambiguous DHL/FedEx bare-digit tracking regexes behind a nearby carrier-name
check to stop them matching phone numbers, and surfaced the 30-day backfill's
scanned/saved counts (or its failure) in a toast instead of swallowing errors
silently.

- Refactor and harden scalability, maintainability, prototype pollution resilience, and storage key centralization:
- Centralized application constants (`APP_NAME`, `INGESTION_EMAIL_DOMAIN`, `APP_COPYRIGHT`) in `src/constants/app.js`.
- Centralized localStorage keys and domain key validator in `src/constants/storageKeys.js` (`STORAGE_KEYS`, `isAppStorageKey`).
- Replaced direct `CARRIERS[carrierId]` bracket lookups with safe `getCarrier(carrierId)` helper across UI components, schemas, and utility modules.
- Bounded local tombstones to 200 entries with LRU eviction in `CloudStorageAdapter` to prevent unbounded memory growth.
- Added WeakMap and Map memoization cache in `detectStore` to prevent repeated regex evaluations on unchanged objects and strings during render frames.
- Applied CSS rendering containment (`content-visibility: auto; contain-intrinsic-size: 140px;`) on `PackageCard` to optimize long list rendering performance.

- Request incremental Google OAuth consent with prompt consent to ensure Google displays the Gmail scope permissions dialog and grants Gmail forwarding access token.

- Add dedicated staging PWA manifest (manifest-staging.json) and high-res amber PNG/SVG icons so Staging installs with 'Deliveree (Stg)' and distinct amber app icon.

- Standardized menu item styling in SideNavDrawer (Export Center and Admin Dashboard now match standard row styling) and relocated Settings to the system utilities section at the bottom of the drawer.

- Add two-way Google and Gmail forwarding address deletion and token revocation upon unlinking in Deliveree, poll live verification status with pending/active badges, and simplify modal copy to remove unnecessary jargon.

## [0.18.3] - 2026-08-27

### Fixed
- Add public Privacy Policy and Terms of Service pages for Google Cloud OAuth verification compliance and public legal hosting.

## [0.18.2] - 2026-08-27

### Fixed
- Add CloudMailin live inbound email receiving integration and visual staging indicators (amber STAGING badge, icon, and title).

## [0.18.1] - 2026-08-27

### Fixed
- Add auto-reconciliation for legacy connected inboxes, permanently visible active inboxes manager, and dedicated 1-tap Unlink buttons.

## [0.18.0] - 2026-08-26

### Added
- Add 1-Click Outlook / Microsoft automated shipping ingestion, multi-account connect manager, and OS native back swipe history navigation support across all modals.

- Add real Google OAuth consent popup for Gmail forwarding permission and multi-email accounts management in the Ingestion Hub.

### Fixed
- Add automated Firebase Hosting staging channel deployment on every merge to main.

## [0.17.0] - 2026-08-26

### Added
- Added automatic, anonymous crash reporting: uncaught React render errors and unhandled
window/promise errors are now reported to their own `crashReports` Firestore collection (kept
separate from tester `/feedback` so a burst of automatic reports can never crowd it out), visible
grouped by distinct failure in the Alpha Feedback Inspector's new "Crashes" tab.

- Add dedicated Admin Dashboard & Telemetry Center with quality scorecard KPIs, version-by-version issue reduction trends, crash grouping monitor, smart parser telemetry, feedback screenshot lightbox viewer, and CSV/JSON export tools.

- Add 1-Click Gmail automated email forwarding connector, interactive visual setup guides for Gmail, Outlook, iCloud, and Yahoo, and inbound email webhook Cloud Function for real-time package ingestion.

- Enhanced Israeli & Global courier SMS intelligence, short URL unshortening support, and live ingestion UI badges.
- Expanded carrier definitions, detection rules, brand colors, and URL templates for Bar Distribution (`bar-distribution`), LionWheel (`lionwheel`), Buzzr (`buzzr`), Tapuz (`tapuz`), Cheetah (`chita`), and SHEIN (`shein`).
- Expanded store detection with bilingual Hebrew & English keywords for AliExpress, SHEIN, Amazon, iHerb, Temu, Zara, ASOS, KSP, and Ivory.
- Created `urlUnshortenerService` with short URL extraction and network resolution helpers.
- Added live detection badges (Store, Pickup Location, Locker PIN) and a 1-tap quick auto-fill action in `AddEditPackageModal`.
- Added a comprehensive 40-sample SMS corpus (`smsCorpus.js`) and characterization test suite with 100% precision.

### Fixed
- Stopped the analytics modal recomputing its metrics while closed, and made the
delivered-package transit duration shared between the two aggregators that need
it instead of derived twice. Offline backlogs now replay their independent
writes concurrently — feedback uploads under a bounded pool, and sync-queue
mutations for distinct packages — while mutations touching the same package
still replay strictly in queue order and the local feedback history is written
once per drain rather than once per item.

- Added `src/components/COMPONENTS.md`, a reference map of all components and how the modals are
wired in `App.jsx`, and refreshed the top-level `CLAUDE.md` to match the current codebase.

- Split every dialog out of the initial bundle with `React.lazy`, so the fourteen
modals in `App.jsx` are downloaded the first time one is opened rather than
before the package list can paint. The entry chunk drops from 538 kB to 179 kB
(144 kB to 52 kB gzipped), and the total JavaScript fetched on a cold load
falls by about 212 kB (46 kB gzipped).

- Wrap raw JSON backup in an export manifest with full scope ('all') and omit undeclared scope on filtered JSON reports.

- Made the Account tab's backup a raw JSON snapshot instead of a CSV, so it carries every field (including `titleHe`/`notesHe`, `checkpoints`, category and flags) and can actually be restored — the CSV it replaced had no importer at all. Renamed the Export Center's JSON option from "JSON Backup" to a scope-filtered export, since restoring a filtered file would have deleted every package outside that filter. Restore no longer truncates silently at 1,000 packages, and every CSV path now neutralises leading `=`, `+`, `-`, `@` and tab characters that spreadsheets would evaluate as formulas.

- Threaded `userId` through `deliveryService.importData` so imports under an authenticated user persist into the user's storage partition rather than the guest key (#56). Wrapped `exportToJSON` in a self-describing manifest containing schemaVersion, exportedAt, appVersion, scope, and packageCount, and updated `importData` to reject partial scope exports while preserving legacy bare-array restore compatibility (#57).

- Enforced module layering in lint: `import/no-cycle` is now an error, `utils/`,
`types/`, `schemas/`, `constants/` and `i18n/` may no longer import
`services/`, `components/`, `hooks/` or `context/`, and `services/` may no
longer import `components/`, `hooks/` or `context/`. Enabled the `react-perf`
rules at `warn` as a standing worklist.

- Scoped `importData` to the signed-in user at its call site. The service half shipped in #67, but `App.jsx` still called it with one argument, so `userId` defaulted to `null` and every restore landed in the guest partition regardless of who was signed in — leaving #56 closed while the bug was still live.

- Made every modal dismissable and navigable from the keyboard. A new shared
`Modal` primitive owns the portal, backdrop, Escape, focus trap, initial focus
and focus restore, body scroll lock, ARIA and the z-layer stack for all sixteen
dialogs, and a single `useModalRouter` `activeModal` stack replaced the dozen
`isXOpen` booleans and their companion state in `App.jsx`.

- Cut dashboard re-render work: the package list, table and KPI tiles are now
memoized behind stable handlers — including the mutators `usePackages` returns —
so typing in the search box no longer re-renders every card. The Web Share
Target handler runs once at startup rather than on every package change, which
also stops a `?tab=` shortcut from snapping the user back to that tab after
every edit. Status bucketing moved into a single `TAB_PREDICATES` table shared
by the filter and both counters, which had drifted apart.

## [0.15.13] - 2026-08-25

### Changed
- **Version bumps are no longer required in every PR.** The `require-version-bump`
  CI job became `require-change-declaration`: a PR that changes shipped code
  declares itself either with a changeset under `.changes/` (preferred) or with
  a direct version bump. `npm run release` collects the changesets, applies the
  highest bump they ask for, writes the changelog entry, and deletes the files
  it consumed — so a version marks a release again rather than counting pull
  requests.

  The old rule forced every PR to touch the same four files (`package.json`,
  both version-asserting tests, and `CHANGELOG.md`), which meant merging any one
  PR immediately conflicted every sibling PR in all four. Across a four-PR wave
  that cost a rebase round-trip per merge.

### Fixed
- **The version gate could let a PR move the version backwards.** It compared
  head and base only for inequality, so a PR carrying a *lower* version passed
  and would have regressed `main` on merge. It now rejects any bump that does
  not move forwards. This was hit for real when pre-allocated versions merged
  out of order, and was caught by hand rather than by CI.
- **The gate ignored `functions/` and `firestore.rules`.** Both change deployed
  behaviour and neither required a declaration. Both are now covered.
- **Two tests asserted a hardcoded version string** (`src/constants/version.test.js`,
  `src/components/AboutModal.test.jsx`), so every release had to edit them. They
  could only fail when someone bumped and forgot to update the test — which the
  CI gate already caught. They now compare `APP_VERSION` against `package.json`,
  which catches the failure that actually matters: the injected value drifting
  from the single place the version is defined.

### Added
- **Releases are now the only thing that deploys.** CI ships a push to `main`
  only when it changes `package.json`'s version, so an ordinary merge lands
  without deploying. Deploying every merge meant several deploys could share
  one version number, so "I'm on 0.15.12" stopped identifying a build — the
  property the version gate exists to protect in the first place.
- **`npm run release` accepts an explicit version and checks it twice.**
  `npm run release 0.16.0` must name a legal successor of the current version —
  from `0.6.4` only `0.6.5`, `0.7.0` or `1.0.0` — and must be at least as large
  as the changesets imply, naming the changesets that force a larger bump when
  it refuses. Deriving alone cannot catch a breaking change mislabelled
  `type: patch`; stating alone cannot catch a typo. Nothing is written when it
  refuses. Omitting the argument still derives the version from the changesets.
- **The pre-submit gate enforces the same successor rule.** A manual bump must
  be one of the three legal next versions, not merely larger — `0.6.4` to
  `0.9.0` skips minors and leaves a gap that means nothing.
  `scripts/version-utils.mjs` holds the rule once and is shared by the release
  script and CI, so the two cannot drift apart.

## [0.15.12] - 2026-08-25

### Fixed
- **The Account-tab backup now exports raw stored data (#42).** `#37` deduped
  the hand-rolled CSV onto the shared `exportToCSV`, which routes through
  `validatePackageList` — so the *backup* was repaired and capped: unknown
  carriers became `other`, unknown statuses became `in_transit`, empty dates
  became today, empty titles became `Untitled Package`, tracking numbers were
  uppercased/stripped or blanked to `UNTRACKED`, notes and titles were
  truncated, and the file stopped at 1,000 rows. A backup that cannot
  reconstruct what the user had is not a backup. Added
  `exportRawToCSV`/`formatRawPackageCSVRow`, which share the CSV formatting
  primitives (RFC 4180 quoting, UTF-8 BOM, `downloadBlob`, the `CSV_HEADERS`
  column order) but apply no repair pass and no row limit. The Hebrew/English
  column flip goes away with it: the raw formatter reads `title`/`notes`
  directly instead of `titleHe || title`.
- **Local save failures now reach the UI (#43).** `deliveryService.savePackages`
  returns a plain `{ ok, packages, error, overflow }` object instead of the
  validated array with non-enumerable status properties attached — those flags
  did not survive spread, `.map`, `JSON.stringify`, or a Firestore round trip,
  and because the signal was the *absence* of `ok`, a transformed array read as
  a failure on a **successful** save. `usePackages` now reads that status: it
  exposes `saveError`/`clearSaveError` and calls an optional `onSaveError`
  callback, and `App.jsx` consumes `saveError` to raise a bilingual error toast
  through the existing `showToast`/`Toast` path — so a quota-exceeded write is
  no longer indistinguishable from a successful one *on screen*, not merely in
  the hook's return value.
- **`notificationService.savePreferences` no longer reports false success
  (#43).** It ignored `writeJSON`'s `false` return and logged at `warn`, which
  was *less* failure visibility than before `#37`. Added
  `savePreferencesWithStatus` returning `{ ok, preferences, error }`, restored
  `console.error` on failure, and wired `AccountModal`'s notification toggles
  to show an error toast when the write is rejected.

- **Exports no longer strip unknown fields (#41, export half).** The three
  validated export paths in `exportUtils.js` (`exportToCSV`, `exportToJSON`,
  `generatePrintableSummary`) went through `validatePackageList`, whose
  `ALLOWED_PACKAGE_KEYS` whitelist erases any field outside the known set —
  exactly what the schema's `.catchall()` exists to preserve. They now use
  `parsePackageList`, the single validation entry point, which repairs the same
  fields and never truncates.

### Tests
- `AccountModal.test.jsx` rewritten: it now renders the real component and
  asserts which exporter the backup button calls. The previous version never
  imported, rendered, or mocked `AccountModal` — it called `exportToCSV`
  directly and asserted its own header list, so it would have passed
  identically against the pre-`#37` code. The stale test asserting inline
  row-building logic that no longer exists in the source was removed.
- New coverage for an unrepaired backup round trip, an uncapped export, and a
  simulated quota failure surfacing through `usePackages` and the
  notification-preferences path.

- New `src/App.saveFailure.dom.test.jsx` renders the real dashboard, rejects a
  `localStorage` write, and asserts the rendered `role="alert"` toast — an
  end-to-end check rather than a callback assertion, which would have passed
  while nothing consumed the signal. Verified against a negative control: with
  the `App.jsx` effect removed, the test fails.

## [0.15.10] - 2026-08-25

### Fixed
- **Restored the parser → detector integration coverage** deleted in `0.15.3`.
  `src/tests/integration/ingestionPipeline.integration.test.js` was removed
  wholesale because the dead IndexedDB adapter was its terminal sink, but only
  its last two steps used that adapter. Steps 1–3 were the repo's only
  assertion that `parseSmartText` → `detectCarrier` → `detectStore` compose on
  raw share text; the surviving unit suites feed each module hand-built inputs,
  so a change to `parseSmartText`'s output shape that broke `detectCarrier`'s
  input contract passed CI. The test is back with `deliveryService` as the
  sink, keeping the original Hebrew Israel Post SMS case.
- **De-flaked the wall-clock assertions** in `adversarialStress.test.js` and
  `adversarialP0Audit.test.js`. Tight per-iteration bounds (50–250ms) failed
  intermittently on loaded runners, training everyone to re-run red CI. The
  loops now assert behaviour per input and carry a single generous whole-loop
  ceiling; catastrophic backtracking costs seconds to minutes on these inputs,
  so the pathological-input protection is preserved while scheduler noise no
  longer trips it.
- **Closed the checksum corpus gap.** `carrierDetectorCorpus.js` had no input
  yielding `isValidChecksum: true` for USPS `mod10-31` or Royal Mail
  `upu-s10`, so the committed snapshot pinned only the failing branch of two of
  three validators and would not have caught a validator inversion. Added two
  valid IMpb numbers and one valid GB S10 with computed check digits, and
  regenerated the snapshot — every pre-existing entry is byte-identical.
## [0.15.8] - 2026-08-25

### Fixed
- **Exports no longer silently truncate at 1,000 packages** (#40).
  `validatePackageList` hard-sliced its input at 1,000 items while the storage
  path had already dropped its cap, so a user holding 1,200 packages had all
  1,200 persisted and every CSV/JSON/print export quietly cut to 1,000 rows.
  The slice is gone: the function now returns every valid record it is given.
  The 1,000 figure survives only as `PACKAGE_LIST_ADVISORY_LIMIT`, exposed via
  the new `isPackageListOverflowing()` helper for callers that want to warn.
  Fixed in the shared function rather than at each export call site, so every
  consumer inherits it.
- **The built-in diagnostics no longer certify a guarantee the app lost** (#40).
  `runMemoryBoundsSelfTest` asserted that lists were capped at 1,000 and passed
  by testing `validatePackageList` directly, certifying a property the
  application no longer had. It now asserts the opposite and true property —
  that a list of any size comes back in full — and reports `truncated` /
  `overAdvisoryLimit` in its details.
- **Live-tracking refreshes no longer erase `schemaVersion` and unknown fields**
  (#41). `trackingService.batchRefreshTracking` validated each refreshed record
  through `validatePackageSafe`, a `.strip()` schema that does not list
  `schemaVersion`, and wrote the stripped result back — so every refresh
  reverted a record to the 19 known keys. It now routes through `parsePackage`,
  the single repairing entry point, which preserves unknown fields and stamps
  `schemaVersion`.
- `validatePackage` (the legacy hand-rolled validator, still used by the export
  path) now carries `schemaVersion` through instead of dropping it.

## [0.15.7] - 2026-08-24

### Changed
- **Carrier detection now reads the carrier config table instead of restating it.**
  `detectCarrier` carried 21 hardcoded `if` branches whose regexes duplicated
  the `patterns` arrays in `src/types/carriers.js` verbatim, with the table's
  own patterns reached only as a fallback. The branches did encode three things
  the table couldn't express, so the table now expresses them: `patterns`
  entries are rules (`{ re, confidence, checksum, priority }`), giving
  per-rule confidence, explicit cross-carrier priority (Aramex's 11-digit rule
  still beats FedEx's 12-digit one), and per-pattern checksum selection via a
  named registry (`upu-s10`, `mod10-31`, `assume-valid`). All 21 branches are
  gone. Behavior-preserving: pinned by a committed 782-entry characterization
  snapshot generated from the previous implementation, byte-identical after the
  refactor, plus an offline differential run over 200k generated tracking
  numbers with zero divergences.
- **Live-tracking capability moved into the carrier table.** A hardcoded
  `LIVE_TRACKING_CARRIERS` array plus a per-carrier `queryIsraelPostLive`
  function became an optional `liveTracking: { endpoint, parse }` entry per
  carrier; adding a second live carrier is now a table entry rather than a new
  function and an array edit. The `tracked: false` / `UNTRACKED_REASONS`
  contract is unchanged — no failure path fabricates checkpoints.
- Added `getCarrier(id)`, encapsulating the `CARRIERS[x] || CARRIERS['other']`
  fallback repeated across the codebase, using an own-property lookup so a
  user-influenced carrier id can't reach `Object.prototype`.

### Performance
- `inferStageFromText` lowercased the entire status-keyword table on every
  call — once per checkpoint of every tracking response — though the table is a
  module-level literal that never changes. It is now pre-lowercased once at
  module scope.

## [0.15.6] - 2026-08-24

### Fixed
- **Unknown fields on stored packages were silently erased on every read and
  write.** Package validation rebuilt a fresh object from a fixed 19-key
  allowlist, so any field outside that list — including data written by a
  newer client or a partner import — was dropped without warning. Validation
  now preserves unrecognized fields while still stripping prototype-polluting
  keys (`__proto__`, `constructor`, `prototype`).
- **Two competing validators disagreed depending on the code path.** A strict
  Zod schema (which rejected malformed records) and a hand-rolled validator
  (which repaired them) both existed and were reached from different call
  sites. They are unified behind a single repairing schema with one entry
  point; the repair values (`Untitled Package`, `UNTRACKED`, `in_transit`,
  `other`, `Israel`) are unchanged. The circular import between the schema and
  the validator module is also gone.
- **The 1,000-package ceiling destroyed data.** Package lists were truncated at
  1,000 items on read, and the truncated list was written back on the next
  save — so package 1,001 disappeared permanently. Since archived packages
  never leave the list, this was reachable through ordinary long-term use.
  Lists are no longer truncated on the read/write path; an over-large list is
  reported to callers via an overflow flag instead.
- **Failed saves reported success.** `savePackages` caught the write exception,
  logged it, and returned the same value it returns on success, so callers
  believed a write had landed when localStorage was out of quota. Saves now
  report success or failure, and status updates, tracking refreshes, and data
  imports propagate that failure instead of claiming success.

### Added
- `schemaVersion` field on stored package records (defaulted to `1` for
  existing data), to make future record migrations explicit. This is a
  per-record data-format marker and is independent of the app version above.

## [0.15.5] - 2026-08-24

### Changed
- **Account tab's CSV backup now uses the shared, validated exporter.** The
  Account tab hand-rolled its own copy of the CSV writer, which had drifted
  from `exportUtils`. It now calls the shared `exportToCSV`, so the file it
  produces changes in three user-visible ways: rows end with RFC 4180 `\r\n`
  instead of `\n` (correct for Excel and strict CSV parsers), the export runs
  through the same validation as every other export, and the Title/Notes
  columns now prefer the Hebrew field (`titleHe`/`notesHe`) over the English
  one, matching the rest of the app instead of the reverse. The filename,
  the UTF-8 BOM for Hebrew in Excel, and the confirmation toasts are
  unchanged. Any column added to the shared schema from now on appears in
  this export automatically.

### Fixed
- **Date formatters were rebuilt on every render.** `formatDate` and
  `formatDateTime` constructed a fresh `Intl.DateTimeFormat` on each call —
  once per package card, table row, and checkpoint — so a list of 50
  packages re-created 50 formatters on every keystroke. Formatters are now
  cached per locale at module scope. Displayed dates are identical.

### Internal
- Added `todayISO()` in `dateUtils` and `readJSON`/`writeJSON` in a new
  `utils/storage.js`, replacing repeated `localStorage` guard/parse/warn
  boilerplate in `notificationService` and `ThemeContext`; extracted a
  single `downloadBlob()` used by both the CSV and JSON exporters. Stored
  values and fallback behavior are unchanged; `writeJSON` reports failure
  (e.g. quota exceeded) to its caller rather than discarding it silently.

## [0.15.3] - 2026-08-24

### Removed
- **Unused 4-tier IndexedDB storage adapter (`src/services/idbStorageAdapter.js`, 362 lines) and its test suites.**
  It had zero non-test importers. It also did not relieve localStorage quota
  pressure — `getPackages()` shadow-wrote the full package list back to
  localStorage on every read — and adopting it would have forced
  `deliveryService.getPackages()` from sync to async, breaking the `useState`
  lazy initializer in `usePackages.js`. It additionally carried a live bug:
  `memoryCache` was a per-partition `Map` while its TTL timestamp was a single
  module-global scalar shared across all partitions. Recoverable from git
  history as a design sketch.
- **Six zero-consumer values from the `AuthContext` context value**:
  `isGuestMode`, `authError`/`setAuthError`, `sendVerificationEmail`,
  `loginWithApple`, `loginWithFacebook`, and the re-export of
  `migrateGuestDataToUser`. The leftover `appleProvider`/`facebookProvider`
  plumbing went with them — Apple sign-in was deliberately dropped from the UI
  earlier because it was never configured. Error propagation is unchanged:
  `sanitizeAuthError` still wraps every thrown auth error. The module-level
  `migrateGuestDataToUser` export is untouched; only its context re-export was
  removed.

## [0.15.2] - 2026-08-24

### Fixed
- **Accent color hardcoded outside the theme system, silently breaking on any accent change.**
  Components mixed the themed `--color-blue-*` accent with Tailwind's
  stock, un-themed `indigo`/`purple` in gradients and glows (e.g.
  `from-blue-600 via-indigo-500 to-purple-600`), assuming all three sat in
  the same hue family. That assumption broke invisibly — `indigo`/`purple`
  never moved when the accent did, since they were never wired into
  `index.css`'s theme tokens. `--color-indigo-*` and `--color-purple-*` are
  now overridden per theme, coordinated with the accent, so every existing
  gradient/glow class stays one family with no JSX changes needed.
- Light and dark now share one accent hue (indigo, H~284) instead of two
  independent brand colors, each tuned per theme for contrast.

## [0.15.1] - 2026-08-24

### Fixed
- **Google sign-in broken by a stray newline in `VITE_FIREBASE_AUTH_DOMAIN`.**
  The CI repository variable's value carried a trailing CRLF (easy to
  introduce by pasting into a secrets/variables field). Firebase builds its
  OAuth helper iframe URL by string-concatenating `authDomain`, so the
  newline survived into the URL —
  `https://…firebaseapp.com%0D%0A/__/auth/iframe?…` — and the SDK rejected
  it with `Illegal url for new iframe`. Config values are now trimmed before
  reaching Firebase, so a whitespace-contaminated variable can't corrupt a
  URL again.

  This one hid well: **email/password sign-in kept working**, because that
  path calls `identitytoolkit.googleapis.com` with the API key and never
  touches `authDomain` — so only the Google button failed. It also surfaced
  as a generic auth error rather than a config problem, and two earlier
  guesses at the cause (an `auth/iframe` "error code" that was really a URL
  fragment, then a cross-origin `authDomain` theory) were both wrong. The
  actual diagnosis came from the raw `rawMsg` in the browser console.

### Added
- **Build-time guard against malformed Firebase config** (`vite.config.js`).
  The existing check only verified the `VITE_FIREBASE_*` variables were
  *present*; a production build now also fails if any of them contain
  whitespace or control characters. None of these values may legitimately
  contain whitespace, so whitespace is always a paste accident — and this
  turns the exact failure above from a silent production outage into a loud
  CI failure naming the offending variable. Verified by building with the
  real contaminated value (fails with a clear message) and with clean values
  (builds normally).

### Fixed
- **Google Fonts blocked by CSP** — `connect-src` was missing
  `fonts.googleapis.com`/`fonts.gstatic.com`, so the service worker's
  `fetch()` for every webfont was refused (`font-src` allows a browser's own
  font load, but a `fetch()` from the SW is governed by `connect-src`).
  Inter, Rubik, Open Sans and the newly-added Atkinson Hyperlegible were all
  silently falling back to system fonts in production. Both hosts added.

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
