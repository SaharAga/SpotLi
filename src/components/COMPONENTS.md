# Components

Reference map of `src/components/`, for orienting quickly rather than re-discovering wiring by
reading `App.jsx` each time. All components are function components; most modals follow the same
`isOpen`/`onClose` pattern and are wrapped individually in `<ErrorBoundary compact>` at their
mount point in `App.jsx` so one modal crashing doesn't take down the rest of the app.

## Shell / always-mounted

- **`Navbar`** — top bar: search, add/import/connect actions, language & theme toggles, opens
  `SideNavDrawer` on mobile.
- **`SideNavDrawer`** — mobile slide-out nav, mounted by `Navbar`.
- **`StatsCards`** — KPI row above the package list. Single-pass O(N) aggregation into 4 tiles
  (total, transit — collapses `in_transit`/`out_for_delivery`, attention — collapses
  `customs`/`exception`, delivered); finer-grained status still shows per-package elsewhere.
- **`FilterBar`** — status/carrier/search filtering above the list.
- **`PackageCard`** / **`PackageTable`** — the two package-list renderings (card grid vs. dense
  table); which one shows is a view-mode toggle in `App.jsx`.
- **`QuickTimeline`** — small inline status-stepper (`currentStatus` prop), used inside
  `PackageCard`/`PackageDetailModal` rather than mounted standalone.
- **`Toast`** — single floating notification, driven by `App.jsx`'s `showToast()`; all user-facing
  success/error messages across the app funnel through it.
- **`ErrorBoundary`** — class component; wraps most modals individually (`compact` prop) with an
  `onReset` that closes just that modal, so one broken modal doesn't blank the page.
- **`InstallPwaBanner`** — PWA install prompt banner, self-contained (owns its own
  dismissal/storage state).
- **`LegalConsentGate`** — blocking overlay for any signed-in user whose stored
  `legalAcceptedVersion` doesn't match `LEGAL_VERSION`; not a modal opened by user action, it
  gates the whole app until accepted.

## Package CRUD

- **`AddEditPackageModal`** — the add/edit form; also where Smart-Import autofill correction
  detection lives (editing a field Smart Import just filled, before saving, logs to
  `parseCorrectionService`).
- **`PackageDetailModal`** — full shipment detail + interactive timeline.
- **`DeleteConfirmDialog`** — generic delete confirmation, reused wherever a package delete needs
  confirming.
- **`SmartImportModal`** — paste/screenshot ingestion flow: tries the deterministic
  `smartParser.js` first, falls back to the AI Cloud Function (`aiParseService.js`) when nothing
  matches or the input is a screenshot. Maps the AI response into the same shape the regex parser
  returns so the rest of the component (and `AddEditPackageModal`) don't need to know which path
  produced a result.
- **`IngestionGuideModal`** — "how to get tracking numbers in" help/connect modal (SMS, share
  target, paste).

## Analytics / export

- **`AnalyticsModal`** — performance/analytics view over the package list.
- **`ExportModal`** — dedicated export center (CSV/JSON), backed by `utils/exportUtils.js`.
- **`LockerMapModal`** — interactive locker/pickup-point map.

## Auth / account

- **`AuthModal`** — sign-in/sign-up (Google OAuth, email/password — Apple/Facebook were removed,
  never configured). Email/password registration collects legal acceptance inline here;
  `LegalConsentGate` covers the OAuth path, which has no form step.
- **`AccountModal`** — signed-in user's account & personal settings, including the AI-training
  opt-in checkbox (`trainingDataService.js`).
- **`AboutModal`** — app/version info; also renders `LegalDocumentModal` for ToU/Privacy links.
- **`LegalDocumentModal`** — read-only ToU/Privacy Policy viewer, rendering `constants/legal.js`
  from the three call sites (registration checkboxes, `LegalConsentGate`, `AboutModal`) so they
  can't drift out of sync.

## Feedback

- **`FeedbackModal`** — alpha-tester feedback submission (`feedbackService.js`), including the
  Smart-Import "this wasn't right?" report path.
- **`AdminFeedbackModal`** — admin-only feedback inspector.

## Adding a new modal

Follow the existing pattern: an `isOpen`/`onClose` component mounted once in `App.jsx`, wrapped in
its own `<ErrorBoundary compact componentName="..." onReset={...}>`, with `onShowToast` passed
down for user-facing messages rather than the component owning its own toast state.
