# Changelog

All notable changes to Deliveree will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Versioning convention (established 2026-08-22)**: standard `MAJOR.MINOR.PATCH` — MINOR bumps for new user-facing features/capabilities, PATCH bumps for bug fixes. `MAJOR` stays `0` while in alpha. (A non-standard 4th segment, e.g. `0.6.2.14`–`0.6.2.18`, crept in for a stretch of hotfix releases without being a deliberate decision — retired as of `0.7.0`. See `AGENT_SYNC.md`, 2026-08-22, for the discussion.)

## [0.37.6] - 2026-09-16

### Fixed
- Stopped push notifications firing for changes the user made themselves. Editing
a package's status, correcting a pickup point, or refreshing tracking in the app
sent a notification back to the person who had just done it; pushes now go out
only for updates written by the Gmail sync and forwarded-email pipelines, matching
how new-package notifications have always been scoped.

## [0.37.5] - 2026-09-15

### Fixed
- Focus Logistics (פוקוס) is now a recognised carrier instead of "Other /
Universal". It is identified from the distribution-company phrasing its SMS uses
and from focuslogistics.co.il — deliberately not from the tracking number, which
is seven bare digits and would otherwise claim order numbers and PINs across
every other carrier's messages.

- Push notifications are now written in your language only. Every notification
used to carry both halves — "החבילה נמסרה! | Package Delivered!" — regardless of
which language you had chosen. A notification is a one-line interruption on a
lock screen, and half of it was going to a language you did not pick.

The language comes from your account preference, which now also records the
language detected on first run rather than only an explicit change in Settings —
without that, anyone on an English device who never opened the language picker
was sent Hebrew.

## [0.37.4] - 2026-09-15

### Fixed
- Added a developer tool that ranks the Hebrew delivery phrasings in a real SMS
export and reports which ones the parser cannot stage. It runs entirely offline,
normalizes every message before counting anything, and never writes a raw
message to its output.

- Smart Import reads six more ways an Israeli courier says what happened to a
package. Collecting at a post-office counter, a courier closing the job, and a
request to rate the delivery are all read as delivered; a parcel handed to a
pickup point is ready for collection rather than delivered; a courier asking to
hand it over today is out for delivery; and a failed delivery attempt is flagged
instead of looking like normal transit.

None of these use the word נמסר, so all seven of the measured stage misses —
across Israel Post, Cheetah, Tapuz, Buzzr and Bar — reported "in transit".
Measured delivery-stage accuracy on the held-out corpus goes from 81% to 100%.

## [0.37.3] - 2026-09-15

### Fixed
- Smart Import names the shop, not the courier, on two more common Israeli SMS
shapes. A message reading "מספר משלוח 4046309 מ- LA BEAUTE הגיע לחברת ההפצה
'פוקוס'" was titled "פוקוס" — the distribution company, which the message
quotes — with no merchant at all. The merchant is now read whether it comes
before or after the tracking number, and a quoted name introduced as a delivery
company is no longer mistaken for the item.

Also fixes a guard that dropped any single-word shop of eight letters or more.

- Correcting a package's delivery stage after Smart Import now counts as a parse
correction. The parser guesses the stage and the form lets you change it, but
`status` was in neither the correction allowlist nor the training snapshot, so
every one of those fixes was recorded nowhere — the same blind spot that let a
delivered SMS ship as "in transit" without any signal reaching us.

## [0.37.2] - 2026-09-15

### Fixed
- Smart Import now reads two things it was missing from Israeli courier SMS.

A package is recognised as delivered when the message says so with words
between the noun and the verb — "חבילה מSeestarz online מספר 48094292 נמסרה"
was filed as still in transit, because the two had to be adjacent. A handover
to the courier ("נמסרה לשליח") and a negation ("לא נמסרה", "טרם נמסרה") still
are not deliveries.

The merchant is read from the sentence rather than looked up in a catalogue, so
a small shop the app has never heard of is named on the package instead of
"Package 48094292".

The accuracy harness now scores delivery stage and merchant, not just the
tracking number. It reported the reported SMS as a clean pass because the only
thing it measured — the ID — was correct.

- Fixed the Smart Import confirm button doing nothing. A tracking number the
deterministic parser rates "probable" — the common Israeli-courier case, an
identifier with no check digit and no carrier URL — was displayed under
"Successfully extracted shipping details" with "Add this Package to Tracker"
permanently inert, and nothing on screen said why. Reported from a real Tapuz
delivery SMS. The button also now looks disabled when it is.

Smart Import also tells you when the number already belongs to a package you
track, so a follow-up SMS reads as an update to that package rather than
looking like it will add a duplicate. The badge and its explanation were
already written; `App` never passed the package list to the modal, so they
could never appear. Saving already merged rather than duplicating — this is
the half that says so before you commit.

## [0.37.1] - 2026-09-15

### Fixed
- Refreshing a package that came back with no tracking data now says which of
three things happened, instead of blaming the carrier for all of them. A
shipment the tracking network has no record of yet reads "no tracking record
yet — try again later"; "live tracking isn't available for this carrier" is now
reserved for carriers that genuinely have no feed; and a lookup that could not
run says so rather than claiming the carrier is unsupported.

Reported from a real Tapuz parcel: its 8-digit number was sent to 17TRACK in
auto-detect mode, came back with no record, and the app told the user Tapuz is
unsupported — a permanent-sounding claim about the carrier, from an answer about
that one shipment.

## [0.37.0] - 2026-09-15

### Added
- The add/edit package form fits on a phone screen now. It asked for sixteen
fields at once — fourteen of them optional — in a single scroll that ran to
1,878px inside a 633px window, with Cancel and Add to Tracking at the very
bottom, so submitting meant travelling the whole form. The two required fields,
the carrier and the status stay in view; order details, pickup and locker
details, and the store return window fold into sections that open on a tap, and
the action row is pinned to the bottom where it is always reachable. A section
that already holds something opens itself — editing a package, a Smart Import
prefill, or a one-tap auto-fill that lands afterwards — so nothing is ever
hidden behind a closed door. The form also fills the screen: it carried a
75vh cap sized for a desktop dialog, which left a dead band below the fields on
a phone.

### Fixed
- Packages sync to the cloud again. Firestore refuses a package write outright if
it carries any field the security rules do not name, and the client was sending
two: `isDemo`, which the schema puts on every package, and `location`, which
the merge path wrote and nothing ever read. Any package that went through a
merge — every auto-ingested package, every status update from an email or SMS —
was therefore rejected with "Missing or insufficient permissions", retried five
times, and dead-lettered, which is why changes made on one device stopped
reaching the others. `isDemo` is now allowed by the rules, the dead `location`
field is gone, and unknown fields are dropped at the cloud boundary rather than
refusing the whole document — they still survive locally, which is what they
were preserved for. Changes already stranded can be replayed from the admin
dashboard's Retry button.

- Fixed a property-based test that generated Israel Post tracking numbers with
random UPU S10 check digits and asserted the parser must extract them. Only
about one in eleven verified, so the test contradicted the parser's deliberate
refusal of an unlabeled number whose check digit fails — failing at random
whenever fast-check also drew a prefix Israel Post actually issues. The
generator now appends the correct check digit, and a new test holds it to the
real validator so the two cannot drift apart.

- On iPhone the sign-in screen now offers installing the app first. iOS gives a
home-screen app its own storage, separate from Safari, so anyone who signs in
through the browser and installs afterwards has to sign in a second time — the
app's own install hint lived in the post-sign-up wizard, which is exactly too
late to prevent that. The note appears above the sign-in options, only on an
iPhone that has not installed yet, and only as advice: the form underneath
stays usable for anyone who prefers the browser. Android and desktop share a
session between the browser and the installed app, so they are not shown it.
The install steps themselves are now one component shared with the install
banner rather than a second copy.

## [0.36.0] - 2026-09-15

### Added
- Changes that permanently failed to sync can now be recovered. The admin
dashboard's Sync Queue Health card previously showed only a count of
dead-lettered mutations — each one a change the user made that never reached
the cloud — with no way to see what they were or to try again; the service had
a retry function, but nothing called it. The card now lists each failure with
what it touched and the error that stopped it, and a Retry button puts it back
in the queue with a fresh retry budget.

### Fixed
- Signing in with Google now works in the installed app on iPhone. Added to the
home screen, the Google button spun forever: iOS opens the provider page in a
context the app cannot reach, so the popup sign-in never completed and never
failed either — and because nothing was thrown, the existing fallback to the
redirect flow could not fire. An installed app now takes the redirect flow from
the start, in any display mode a manifest can ask for; a browser tab keeps
using the popup. The check that tells those apart is now one helper rather than
a condition repeated per component.

- Changes made on one device now reach the others even after a failed sync. The
offline queue only ever replayed on an offline-to-online transition or when a
new change was queued, so a mutation that failed while *online* — a Firestore
hiccup, an expired token — was never retried by anything: no `online` event
fires when the page never left the network, and the offline banner (the only
place with a manual sync button) is hidden whenever you are online. The queue
stopped there silently, and the devices quietly disagreed about the package
list. Pending work now replays when the app starts, once sign-in has been
restored, and whenever the app returns to the foreground. Retry budgets are
unchanged, so a mutation that genuinely cannot succeed still lands in the
dead-letter queue rather than retrying forever.

- A Tapuz SMS is now filed under the order number it quotes instead of the
session token in its link. Two faults compounded in one real message: "נקלטה
בתפוז" ("received at Tapuz") matched the rule meant to catch a shop saying an
order has been received but not yet shipped, which stopped the order-number
scan from ever running; and the tracking link's 36-character CRM token was then
accepted as the tracking number, because any path segment containing a digit
was trusted on a carrier's own domain. A courier saying it has taken the parcel
in now counts as a shipment when the message links to that courier, while a
shop's identical wording still does not, and a path segment longer than any
real tracking format has to match a carrier rule to be believed. The practical
effect is that a parcel announced twice — once by email, once by SMS — is
recognised as the package already in the list rather than added a second time.

## [0.35.0] - 2026-09-14

### Added
- The admin dashboard's System tab now reports whether App Check is actually
working on this device: verified, configured but rejected, not configured at
all, or still checking — each with what to do about it. Every other signal App
Check gives requires a desktop browser (a console warning, the network tab, the
Firebase console's charts), so on a phone there was no way to tell a working
install from a silently broken one. A rejected key also names the hostname it
was rejected for, which is usually the answer: the origin is missing from the
key's allowed-domains list.

## [0.34.3] - 2026-09-14

### Fixed
- App Check now says why it isn't working. The reCAPTCHA Enterprise site key was
the one configuration value read straight from the environment without being
trimmed, so a newline picked up from pasting it into a repository variable
would have been passed to the provider verbatim — the same mistake that once
broke Google sign-in through `authDomain`, and harder to spot here because
nothing fails loudly: `initializeAppCheck` returns successfully whether or not
the key is usable, and a key the provider rejects simply never produces a
token. The key is cleaned like every other config value now, and a whitespace
only key reads as unset so the existing "not configured" warning prints. On top
of that, a production build asks for a token once at startup and warns, naming
the current hostname, when it cannot get one — turning a silent failure (zero
verified requests, an empty console) into a message that says where to look.

## [0.34.2] - 2026-09-14

### Fixed
- Smart Import now reads a Hebrew shipment number written without the word
"מספר". A real courier SMS opening "משלוח 19611199 מI-HERB" parsed to no
tracking number at all and had to be entered by hand: every labelled Hebrew
pattern required מספר after the noun, and a bare eight-digit run matches no
carrier format, so the generic token scan discarded it as noise. Hebrew drops
מספר as readily as English drops "number" — the noun running straight into the
value is now accepted, exactly as "order 8471293" already was. The no-label
form takes six characters minimum and no intervening words, so a street number
or a shekel amount beside "משלוח" is not mistaken for a shipment id.

- A package created from an email now shows the shop that actually sent it. Store
detection concatenated the sender and the whole message body and took the first
signature that matched anywhere, so a stray word in a footer outranked the
address the mail came from — a SEESTARZ shipping notice containing the word
"bug" was filed as an order from BUG, the Israeli electronics chain, and the
"bug" signature had no word boundary at all so "debug" matched it too. The
sender is now consulted first, and a sender the signature list has never heard
of contributes its own display name rather than losing to a body scan.

- A package created from a shipping email is now named after the item that was
shipped. The title came from the subject line, so "Shipping update for order
469417" became the unhelpful "update for"; when the email lists what is in the
shipment, that item name is used instead. The list is read both as separate
lines and as the single collapsed run of text an HTML body arrives as, and a
lone size or colour line is skipped rather than mistaken for the product.

## [0.34.1] - 2026-09-14

### Fixed
- The account-deletion promise now matches what deletion actually does. The
Privacy Policy already noted that feedback is anonymous and cannot be deleted
per account, but said nothing about crash reports, which are collected the same
way — and the Account screen contradicted the policy outright, offering to
"Delete Account & Wipe All Data" and reporting "Account and all data wiped
permanently". Both categories are now named in the policy, in Hebrew and
English, along with the fact that neither carries a name, email address or
account identifier; the button and its confirmation say package data, which is
what they delete. LEGAL_VERSION is bumped, so signed-in users are asked to
accept the revised policy.

## [0.34.0] - 2026-09-14

### Added
- A package filed under the wrong carrier now gets corrected by the tracking
network instead of keeping the guess forever. The app already asks 17TRACK on
every refresh, including the one fired automatically when a package is added —
but its identification was discarded twice over: the Cloud Function echoed back
whichever carrier id the client had sent rather than the one detected, and the
client never wrote a carrier into the refreshed package at all. Both now carry
it. A carrier only inferred from a tracking number's shape is replaced by what
17TRACK reports; a carrier the number names itself (RS…IL, 1Z…) or one the user
chose is left alone. When 17TRACK names a courier absent from our catalogue —
Tapuz, and most of the Israeli last mile — the name is kept and shown while the
package stays manually tracked, rather than inventing an id for it.

### Fixed
- Smart Import no longer files a delivered Hebrew SMS as still in transit, and no
longer names a carrier it only guessed. A real H&M Israel dispatch message
("נמסרה חבילה שמספרה …", delivered by Tapuz) came in as "in transit" from
"DHL Express": every Hebrew delivered-phrase the parser knew was subject-first
("החבילה נמסרה") while this courier writes verb-first, and the bare ten-digit
number matched DHL and Aramex equally, with the first of the two winning. An
all-digit number that several carriers claim now resolves to "Other" rather
than to whichever matched first — a letter-bearing id such as Yanwen's UB…YP or
Cainiao's LP…CN still identifies its carrier as before.

## [0.33.1] - 2026-09-14

### Fixed
- App Check now initializes in the production build. `firebase.js` only calls
`initializeAppCheck` when `VITE_RECAPTCHA_V3_SITE_KEY` is set at build time, and
that repository variable had never been added — so every request for the first
seven days of monitoring arrived with no App Check token at all (0 verified out
of 4.4k, 100% "outdated client"). Nothing in the client changed; the key is now
configured, so the shipped bundle starts presenting tokens and the App Check
metrics become meaningful. Enforcement stays off until verified traffic shows up
there, per the rollout sequence in README — turning it on against tokenless
traffic would have rejected every request, including real users'.

## [0.33.0] - 2026-09-13

### Added
- Live tracking now actually reaches every carrier. The client refused the lookup
outright unless a carrier had a hand-written client-side adapter — four of
them — so twelve Israeli couriers, Cheetah and HFD among them, reported "live
tracking isn't available" without the Cloud Function that holds the 17TRACK key
ever being asked about a single one. The proxy already accepted any carrier and
already omitted the catalogue code when it had none, which is 17TRACK's
auto-detect mode; nothing was reaching it. Every carrier is now queried, and an
untracked answer is the outcome of a real lookup rather than a local refusal.
The detail screen no longer claims tracking is unavailable for a carrier it is
about to query — it distinguishes a confirmed integration from one resting on
auto-detect, and says a refresh will still try.

### Fixed
- Insights no longer shows a Multi-Currency Spending Breakdown. The card totalled
what you had spent per currency, but nothing in the app records a package's
price — there is no price field on the add/edit form, the smart parser never
extracts one, and the schema has no such field — so it could only ever show a
figure when a price happened to appear in a note or title and a regex caught
it. In practice it was four zeroes and an apology, on a screen about deliveries
rather than spending. `extractPackageValue` stays for a future per-package
customs-threshold hint, which is the one place a package's declared value
actually matters here.

- Pages are now only as tall as what they show, and stop clipping content at the
bottom. Three separate things made the end of a screen look broken: the page
footer sat underneath the fixed mobile tab bar, so 153px of height carried a
copyright line and the carrier list no phone user could reach, below a gap that
read as the page having run out early — it is desktop-only now, where there is
no tab bar. Every full-screen modal reserved 4.5rem for that tab bar even on
the drill-down screens (package detail, add, smart import) where the bar is
deliberately unmounted to give them full height, so those lost 72px to a bar
that was not there and clipped early against a dead band; the reservation now
follows the bar's actual presence. And on desktop the Feedback button covered
the end of the footer text, cutting the carrier list mid-word.

## [0.32.0] - 2026-09-13

### Added
- Add contextual education in AuthModal for guest users clicking Gmail sync, highlight Google Sign-In, and protect private email forwarding address in IngestionGuideModal behind authentication to prevent un-routed delivery webhooks.

- Enhance Israeli locker and pickup ergonomics on package cards: direct 1-tap navigation launcher modal with Waze, Google Maps, Apple Maps, and Moovit options, prominent 1-tap PIN copy button and full-screen locker mode trigger, high-contrast shelf number badge, and timer cleanup lifecycle fixes.

- Disambiguate generic Israeli postal phrasing from named courier brands in smartParser (raising carrier detection accuracy to 100.0% on held-out corpus), expose normalized pickupCode on parser return, add Israeli locker quick sample to SmartImportModal with 2x2 grid, and display locker PIN in the parsed preview card before ingestion.

- Implement multi-package pickup bundling and cluster ergonomics: add interactive cluster indicator button to package cards for co-located parcels, render a top-level bundled pickup banner on the dashboard for 1-tap PIN modal access, display active pickup points grouped at the top of the Locker Map Locator with consolidated package lists, enhance FullScreenLockerModal with stacked PINs and high-contrast theme-aware sunlight visibility, and add 404 resilience to Gmail push history processing.

- Enhance authenticated user flows and dashboard ergonomics: verify Google sign-in button contrast across themes in AuthModal, display personalized forwarding addresses in IngestionGuideModal with multi-provider setup guides, verify real user registration and PostAuthSetupWizard integration, enhance SideNavDrawer profile card styling with high-contrast palette tokens in light and dark modes, and add comprehensive DOM tests for authenticated drawer navigation.

### Fixed
- Added 404 and 410 entity handling to `gmailPushHandler.js` so deleted messages, discarded drafts, or spam do not abort real-time Gmail push notification batches or block stored historyId advancement.

- Enhance PackageCard action menu WAI-ARIA accessibility, opaque popup layering, swipe contrast, and Toast high-contrast action button.

- Add high-contrast sticky OfflineBanner component with real-time sync queue tracking, automatic replay recovery notification, and bilingual WAI-ARIA status support.

- Enhance ActivityModal timeline with contextual checkpoint stage icons, rich detail descriptions, accessible event labels, and DOM test suite.

- Refactor AnalyticsModal to eliminate hardcoded facade fallbacks, add directional BiDi text isolation for numbers/currencies, provide carrier distribution empty states, and add DOM test coverage.

- Enhance ExportModal with WAI-ARIA radiogroups, 1-tap clipboard copying with animated feedback and timeout cleanup, BiDi number containment, and full DOM integration test coverage.

- Enhance FeedbackModal with WAI-ARIA radiogroups, >=48px rating touch targets, light/dark contrast safety tokens, BiDi text containment, and 10 DOM integration tests.

- Enhance AccountModal and AccountSettingsRows with WAI-ARIA radiogroup/radio semantics, associate delete confirmation label with input, add aria-label to backup import input, fix guest empty Account section header, wrap version in bdi containment, and add scroller bottom padding.

- Enhance AboutModal and LegalDocumentModal with inner scroll flex container, WAI-ARIA labelledBy accessibility, responsive mobile close button, BiDi isolation on version and diagnostics, and 8 DOM integration tests.

- Polish Welcome & Onboarding Tour modal (`OnboardingModal.jsx`):
- Added `labelledBy="onboarding-slide-title"` to `Modal` dialog and matched `id="onboarding-slide-title"` on heading.
- Upgraded slide indicators to accessible WAI-ARIA `role="tablist"` and `role="tab"` with `aria-selected`, `aria-controls`, and localized `aria-label` ("Slide X of Y").
- Marked slide body container as `role="tabpanel"` linked to active tab via `aria-labelledby`.
- Isolated numbers, courier codes, tracking identifiers (`#AMZ-9382`, `#CH-4821`, `CH-849201`, `48291`, `B-14`, `7 3 9 1 0`) in `<bdi dir="ltr">` elements to prevent BiDi inversion in Hebrew RTL.
- Hardened light mode and dark mode theme tokens across all 4 slide illustration cards and status badges (`text-emerald-700 dark:text-emerald-400`, `text-amber-600 dark:text-amber-400`, `text-blue-600 dark:text-blue-400`, `bg-blue-50 dark:bg-blue-950/40`), ensuring full WCAG AAA contrast in both modes.
- Expanded unit test suite in `OnboardingModal.test.jsx` covering ARIA semantics, direct tab selection, dialog labelling, and BiDi containment (12 passing tests).

- Polish Automatic Shipment Ingestion guide (`IngestionGuideModal.jsx`):
- Added WAI-ARIA `role="tablist"` and `role="tab"` with `aria-selected` and `aria-controls` to interactive provider tabs (Gmail, Outlook, iCloud, Yahoo), and associated `role="tabpanel"` on step details container.
- Added 1-tap "Copy Filter" (`העתק מסנן` / `Copy Filter`) button next to the Boolean forwarding filter query with clipboard checkmark feedback and automatic timer teardown on unmount.
- Wrapped private ingestion email and filter query in `<bdi dir="ltr">` / `dir="ltr"` preventing Hebrew RTL punctuation or parenthesis inversions.
- Added accessible dialog labelling (`labelledBy="ingestion-guide-title"`) and localized `aria-label` on the back button (`חזרה` / `Back`).
- Expanded unit tests in `IngestionGuideModal.test.jsx` covering dialog ARIA landmarks, tablist semantics, filter copying, email copying, and QR code section controls.

- Fix Hebrew RTL pickup PIN digit reversal, add dialog labelling, bdi isolation for tracking and shelf codes, and accessible action labels in FullScreenLockerModal.

- Add dialog labelling, localized close button, BiDi isolation for destination and GPS coordinates, and WAI-ARIA group semantics to NavigationChoiceModal.

- Modernize AutoArchivePromptModal with first-class slate theme tokens, header close button, and 48px touch targets.

- Add dialog labelling, 48px touch targets on copy buttons, RTL route arrow mirroring, and BiDi containment in PackageDetailModal.

- Smart Import Modal (`SmartImportModal.jsx`, `Primitives.jsx`):
- Connected `labelledBy="smart-import-title"` to `<Modal>` and added `titleId="smart-import-title"` to `ModalHeader` to establish WAI-ARIA dialog title association.
- Enclosed tracking numbers, locker pickup codes, shelf numbers, and screenshot metadata within `<bdi dir="ltr">` elements to prevent number and hyphen inversion in Hebrew RTL layouts.
- Replaced light mode washed-out colors with theme-aware tokens (`text-emerald-600 dark:text-emerald-400`, `text-amber-600 dark:text-amber-300`, `text-blue-600 dark:text-blue-400`, and `bg-emerald-500/10 dark:bg-emerald-950/40`) ensuring WCAG AAA contrast in both light and dark themes.
- Enforced >= 48px touch targets on the manual switch link, report wrong button, and screenshot remove button with explicit accessible labels.
- Added directional arrow mirroring in Hebrew RTL layouts (`rtl:rotate-180`).
- Expanded DOM integration tests to verify dialog labelling, title ID linking, `<bdi dir="ltr">` containment, and >= 48px touch targets.

- Legal Document Modal (`LegalDocumentModal.jsx`, `LegalDocumentModal.dom.test.jsx`):
- Purged unused `X` import.
- Enclosed updated timestamp within `<bdi dir="auto">` to eliminate BiDi parenthesis and date flipping in Hebrew RTL viewports.
- Enforced >= 48px touch targets on header back button and footer close button (`min-h-[48px] min-w-[80px]`).
- Verified dialog `aria-labelledby="legal-doc-title"` linkage to document title heading.
- Created comprehensive DOM test suite `src/components/LegalDocumentModal.dom.test.jsx` (6 tests covering Terms of Use, Privacy Policy, Hebrew RTL localization, close actions, and touch targets).

- Add/Edit Package Modal (`AddEditPackageModal.jsx`, `AddEditPackageModal.dom.test.jsx`):
- Purged unused `X`, `Package` (lucide-react), and `STAGES` imports.
- Added dialog labelling via `labelledBy="add-edit-package-title"` and `titleId="add-edit-package-title"` on `<ModalHeader>`.
- Wrapped detected locker PIN in `<bdi dir="ltr">` and duplicate package title in `<bdi dir="auto">` to eliminate BiDi text inversion.
- Upgraded status stage selector to WAI-ARIA `role="radiogroup"` with `aria-label` and `role="radio"` with dynamic `aria-checked` states.
- Enhanced theme contrast tokens for live intelligence badges (`text-blue-700 dark:text-blue-300`, `text-emerald-700 dark:text-emerald-300`, `text-amber-700 dark:text-amber-300`) and 1-tap auto-fill button.
- Added DOM test coverage verifying dialog accessible labelling, radiogroup semantics, PIN bdi isolation, and >= 48px touch targets.

- Admin Telemetry Dashboard Modal (`AdminDashboardModal.jsx`, `AdminScreenshotLightbox.jsx`, `AdminDashboardModal.test.jsx`):
- Purged unused `X` icon import.
- Added dialog accessible labelling via `aria-labelledby="admin-dashboard-title"` on `<div role="dialog">` and `id="admin-dashboard-title"` on heading.
- Cleanly grouped header action controls (`Refresh` and `Back`) into a dedicated flex row, ensuring consistent alignment across LTR and RTL.
- Refactored tab navigation to WAI-ARIA `role="tablist"` with `role="tab"`, `id="admin-tab-*"`, `aria-selected`, and `aria-controls="admin-panel-*"` mapped to the active `role="tabpanel"`.
- Isolated app versions, device screen geometries, and timestamps with `<bdi dir="ltr">` and `<bdi dir="auto">` to eliminate BiDi punctuation and numeral inversion in Hebrew RTL mode.
- Corrected feedback search input touch target ergonomics (`min-h-[48px]`) and layout mirroring (`ps-9 pe-3`).
- Enhanced theme contrast tokens for version badges and tab indicators (`text-indigo-600 dark:text-indigo-300`, `text-slate-500 dark:text-slate-400`).
- Expanded test suite with DOM tests for dialog labelling, tablist semantics, and touch targets (5/5 passing).

- Delete Confirmation Dialog (`DeleteConfirmDialog.jsx`, `DeleteConfirmDialog.dom.test.jsx`):
- Added WAI-ARIA dialog accessible labelling and description linkages (`labelledBy="delete-confirm-title"` and `describedBy="delete-confirm-description"`).
- Attached `initialFocusRef` to the Cancel ("Keep Package") button to safeguard against accidental destructive keypresses.
- Added a dedicated top-corner Close (`X`) button with localized `aria-label={language === 'he' ? 'סגור' : 'Close'}` and `min-h-[48px] min-w-[48px]` touch targets.
- Enforced strict $\ge 48\text{px}$ touch targets across all interactive buttons (`min-h-[48px] px-4 py-2.5`) with focus rings for keyboard navigation.
- Added support for safe BiDi package title rendering via `<bdi dir="auto">` when provided.
- Created comprehensive DOM test suite in `DeleteConfirmDialog.dom.test.jsx` covering ARIA dialog contracts, BiDi containment, action callbacks, and touch target constraints (7/7 tests passing).

- Courier Action Hub (`CourierActionHub.jsx`):
- Added WAI-ARIA `role="tablist"` with `aria-label` on the template selector grid.
- Added `role="tab"`, `id="courier-tab-*"`, `aria-selected`, and `aria-controls="courier-message-preview"` to each template button.
- Added `id="courier-message-preview"`, `role="tabpanel"`, `aria-labelledby`, and `tabIndex={0}` to the message preview box.
- Wrapped message preview text and template label in `<bdi dir="auto">` to prevent RTL punctuation and word-order inversion in Hebrew mode.
- Added `aria-label` attributes to Restore presets, Add new response, Close editor, Edit active message, and Delete/Remove buttons.
- Enforced $\ge 48\text{px}$ touch targets across the Restore button (`min-h-[48px] min-w-[48px]`), custom template editor title input (`min-h-[48px]`), form Cancel and Save buttons (`min-h-[48px]`), and the editor Close (`X`) button (`min-h-[48px] min-w-[48px]`).
- Applied `rtl:scale-x-[-1]` to Send (WhatsApp), ExternalLink (SMS), and RotateCcw (restore presets) icons for natural RTL mirroring.
- Added `aria-label` to Gate code inline input.

- Accessibility hardening for `FeatureNudgeBanner`, `FirstTimeEmptyState`, and `InstallPwaBanner`:

**FeatureNudgeBanner**:
- Banner root upgraded to `role="region"` with `aria-label` matching nudge title for landmark navigation.
- Decorative icon container and arrow icons marked `aria-hidden="true"`.
- Suppress-permanently button gains explicit `aria-label`.
- Close X icon marked `aria-hidden="true"`.

**FirstTimeEmptyState**:
- Header Sparkles badge icon marked `aria-hidden="true"`.
- All three tile icon containers (`Mail`, `MessageSquareText`, `Sparkles`) marked `aria-hidden="true"`.
- Added `id` to each tile `<h3>` and `<p>` description elements.
- Gmail, SMS, and Demo CTA buttons gain `aria-describedby` linking to their tile description paragraph.
- Arrow icons and Plus icon in buttons marked `aria-hidden="true"`.

**InstallPwaBanner**:
- Added `type="button"` to all three main banner buttons (Dismiss X, Install App, Not Now).
- Enforced `min-h-[48px]` on Install App and Not Now buttons (previously ~34px).
- Added `aria-label` to Install App and Not Now buttons.
- Enlarged Dismiss X button to `min-h-[48px] min-w-[48px]`.
- `Download` icon inside Install button marked `aria-hidden="true"`.
- iOS guide modal promoted to `role="dialog"` + `aria-modal="true"` + `aria-labelledby="ios-guide-title"`.
- `<h3>` in guide gets `id="ios-guide-title"`.
- Guide close X button gains `type="button"`, `aria-label`, `min-h-[48px] min-w-[48px]`.
- Got It button gains `type="button"` and `min-h-[48px]`.
- Step number badge `<span>` elements and inline icons (`Share`, `PlusSquare`, `Smartphone`) marked `aria-hidden="true"`.

New DOM tests: 17 new tests across `FeatureNudgeBanner.dom.test.jsx`, `FirstTimeEmptyState.dom.test.jsx`, and `InstallPwaBanner.dom.test.jsx`.

- Accessibility and keyboard navigation polish for `PackageCard` and `FilterBar`:

**PackageCard**:
- Made the main card container keyboard accessible with `role="button"`, `tabIndex={0}`, `onKeyDown` handling (`Enter`/`Space`), and a descriptive `aria-label` detailing title and status.
- Added explicit `type="button"` to all overflow menu and action buttons.
- Added explicit `aria-label` attributes to menu actions (Copy tracking, Locker mode, Carrier link, Pin, Edit, Archive, Delete) and pickup navigation.
- Added `aria-hidden="true"` to decorative Lucide icons across status badges, action buttons, and countdown chips.

**FilterBar**:
- Added `type="button"` to the search clear button and filter panel toggle button.
- Added `aria-pressed` states on filter panel view mode buttons (Grid/Table) and status options.
- Linked Carrier and Sort selects to their corresponding `<label>` elements via `id` and `htmlFor`.
- Wrapped grouped controls in `role="group"` with `aria-labelledby` attributes.

**Tests**:
- Added `FilterBar.dom.test.jsx` (5 tests covering clear button, chips aria-pressed, filters panel toggle, view mode switching, and Escape key dismissal).

- Enhance Smart Import and Package Card pickup ergonomics: add automatic smooth scrolling to parsed candidates on mobile viewports, display extracted pickup PINs in candidate preview cards, add Israeli Boxit locker sample SMS, and fix light-mode text contrast on package PIN and shelf badges to exceed WCAG AAA standards.

- Enhance Locker Map Locator and operating hours contrast: replace inverted palette violations with theme-aware slate tokens for pickup package badges, upgrade operating hours status badges (open, closed, holiday, closing soon) to high-contrast WCAG AAA theme-aware classes, and resolve low-contrast warning banner text in light mode.

- Enhance FilterBar accessible labels, tooltip descriptors, and PackageTable high-contrast urgent status badges and touch targets.

## [0.31.1] - 2026-09-13

### Fixed
- The empty-state onboarding no longer asks you to connect a Gmail account you
have already connected. Its Gmail tile rendered unconditionally, under a
"Recommended" badge, because the component was never given any account state —
so a signed-in user with Gmail syncing and nothing yet delivered was told to
set up the thing that was already running. The tile is now omitted once Gmail
is connected. The Gmail *nudge* banner had a second form of the same bug: it
read the connection flag but left it out of its memo's dependencies, so the
server's answer arriving after first paint never reached it.

## [0.31.0] - 2026-09-13

### Added
- Fixed light mode rendering headings as white-on-white. The light theme inverts
the slate scale, so a literal `text-white` never flipped — the onboarding hero,
every first-run card title, and the push-alerts nudge were invisible to anyone
whose device was set to light.

Fixed closing a dialog being able to navigate the user out of the app. The modal
router mutated browser history from inside a `setStack` updater, which React
re-invokes, so one close fired two `history.back()` calls and walked past the
app's own entry. History now holds a single sentinel that cannot drift from the
stack, and Back closes exactly one screen at a time.

Gave the service worker real offline support. It shipped a bare network
passthrough that cached nothing, while `main.jsx` deleted every cache on every
boot (it matched against a version string frozen since 0.6.0), so the app had no
offline availability at all. The worker now precaches the shell, serves
navigations network-first with a cached fallback, and no longer force-reloads
every open tab — the existing "update available" prompt applies the update
instead.

Insights no longer reports 100% on-time over a list of overdue packages. Both
rates counted only delivered shipments, so one sitting weeks past its promised
date registered nowhere; an overdue package is now a miss in both.

Fixed the package detail header: the carrier gradient painted at full strength
because `bg-opacity-10` was removed in Tailwind v4 (Israel Post turned an
ordinary package's header solid red), and the Edit button was clipped off-screen
at 390px.

Fixed the auto-generated package title storing a truncated tracking number with
a literal ellipsis — that string is the package's name and is interpolated into
the WhatsApp/SMS message sent to a courier.

Account → Date format now actually changes how dates render; it was stored and
cloud-synced but never read. The auto-archive confirm button no longer relies on
an undefined `bg-primary` utility, and the demo banner no longer quotes a URL
query parameter at the user.

Finished landing `ready_for_pickup` as a real delivery status. The parser
returned it for a Hebrew "ממתינה לאיסוף" pickup SMS and four components plus
~20 tests already branched on it, but it was missing from `VALID_STATUSES` and
from the `firestore.rules` allowlist — so it could never be saved and a pasted
pickup notice landed on "Order Placed". It now has display metadata, transition
rules, a filter bucket and a stepper position, and Smart Import sets the stage
the message actually describes.

- The package list now leads with the package. Titles were clamped to one line
beside a status badge that repeats across most rows, leaving about seven
characters — "Sony WH-1000XM5 Headphones" rendered as "Sony W…" — while the
expected date was squeezed to "A…" and the carrier to a single pixel. Titles get
two lines, the date and carrier no longer truncate to nothing.

The first screen shows packages again. The install prompt and the feature nudge
could both be up at once and, stacked with the demo bar, KPI row, search and
filter chips, pushed every package below the fold; only one promotional banner
shows at a time now. The Feedback button no longer covers the last card, and the
filter chips fade at the edge instead of being sliced mid-word, so it reads as
scrollable rather than broken.

The Account screen is one screen again. The bottom-bar tab rendered its own copy
outside the modal router, with a different set of rows from the one the rest of
the app opened, and pushed no history entry — so the Android back gesture left
the app instead of closing the sheet. Removing the duplicate also un-blocked its
code splitting: the entry bundle drops from 57.4 kB to 48.4 kB gzipped.

The service worker has tests, covering the shell precache, offline fallback and
the update opt-in. A SessionStart hook installs `functions/` dependencies, which
the root install does not reach.

### Fixed
- Hardened carrier tracking proxy with daily rate-limiting guards and sealed the `carrierUsage` collection in Firestore rules. Prioritized header tokens in inbound email webhook, resolved `qs` dependency vulnerabilities in functions, and added comprehensive adversarial penetration test suites.

- Package cards are a little shorter — the padding and inter-row gap a two-line
title cost are given back, without losing any of the information the two lines
were added to show.

- Added guards against the class of bug that broke light mode. A static contract
test now rejects a literal `text-white` on a surface that inverts between themes
(with an allowlist for the genuine exceptions, which stays honest — a stale
entry fails the test too) and rejects utilities Tailwind v4 removed, such as
`bg-opacity-*`, which emit no CSS and fail silently. ThemeContext gained its
first tests, and `renderWithTheme` joins `renderWithLanguage` so components can
be rendered in a pinned theme. CLAUDE.md now states the invariant all of this
protects: theming is a palette inversion, so slate tokens flip between themes
and literal white/black ink does not.

## [0.30.0] - 2026-09-12

### Added
- Transitioned onboarding into an account-first gated flow with direct Sign In in header, Google/Email/Demo options on completion, and seamless hand-off to the authenticated setup wizard.

- Added welcoming Hero Overview slide as Slide 1 of OnboardingModal ("All Your Deliveries in One Smart Place") with dedicated "See How It Works" CTA, and enabled direct 1-click Google authentication from the onboarding tour to eliminate blank-state friction.

- Added two-phase hybrid onboarding (visual 3-slide cold-start tour and post-auth delivery setup wizard), an interactive first-time empty state with live demo package simulation, and a non-spammy contextual feature adoption engine with permanent suppression controls.

### Fixed
- Restored dynamic authDomain resolution for staging preview channels to keep authentication same-origin and preserved direct user gesture context for Google sign-in in OnboardingModal.

- Resolved Firebase Auth same-origin domain dynamically to current hosting channel hostname to prevent cross-origin blank page stalls on staging, and aligned server-side OAuth error redirects with the client origin to prevent unwanted production redirects.

- Synchronize server-verified Gmail connection status with localStorage in getGmailConnectionStatus, App startup, and useFeatureNudges to eliminate false-positive "Connect Gmail" adoption banners.

- Added Firebase Hosting rewrite for `/gmailOAuthCallback` Cloud Function to prevent blank page on OAuth return, added client-side safeguard route handling in `App.jsx`, and enhanced `PostAuthSetupWizard` with clear copy explaining the dedicated one-time Google permission for mailbox auto-ingestion.

- Enhanced `OnboardingModal` with full-width primary action buttons (`w-full`), added `flushBottom` prop to `Modal` to eliminate artificial mobile bottom spacing, and upgraded slide layout and typography with larger fonts, bolder headlines, and richer preview cards.

- Ensure PostAuthSetupWizard stretches flush to viewport bottom on mobile via flushBottom={true}, center body content vertically, and make footer navigation full-width.

- Removed `pinTag: true` from `/gmailOAuthCallback` rewrite in `firebase.json` so Firebase Hosting deploys route traffic to the deployed function without unintentionally attempting to rebuild and redeploy Cloud Functions during Hosting channel deploys.

- Reverted authDomain dynamic resolution back to canonical Firebase authDomain to resolve Google OAuth 400 redirect_uri_mismatch error.

## [0.29.0] - 2026-09-11

### Added
- Added instant Undo action on package archiving toast, handled stale dynamic import chunk errors with automatic single reload recovery, and guarded crash reporting against test-mode telemetry pollution.

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
