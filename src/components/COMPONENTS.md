# Components

Reference map of `src/components/`, for orienting quickly rather than re-discovering wiring by
reading `App.jsx` each time. All components are function components; every modal follows the same
`isOpen`/`onClose` pattern, renders its shell through the shared **`Modal`** primitive, and is
registered once in `App.jsx`'s `MODALS` array — which renders each of them inside a single
`<ErrorBoundary compact>` so one modal crashing doesn't take down the rest of the app.

Every modal is loaded on demand: `App.jsx` reaches each one through `React.lazy` and a
`Suspense` boundary inside its `ErrorBoundary`, and does not render it at all until it is first
opened. A modal is therefore *not* mounted while closed — it used to be, with `isOpen={false}` —
so any effect a modal wants to run must be guarded on `isOpen` (they all already are). Once
opened it stays mounted for the rest of the session, so re-opening never re-suspends and never
discards in-progress form state.

## Shell / always-mounted

- **`Navbar`** — app chrome: the top bar plus the two nav surfaces it owns (`SideNavDrawer`,
  `BottomNav`) and the add action sheet. Its hamburger and header "+" are `hidden lg:flex` —
  on a phone both jobs belong to `BottomNav`. The header hairline and app mark read the
  ambient `--chrome-*` tokens (see below).
- **`BottomNav`** — mobile (`lg:hidden`) fixed tab bar: Status / Insights / **+** / Lockers /
  Account, with the add FAB in the centre. Carries only destinations you return to; the other
  nine drawer entries stay in `SideNavDrawer`, now opened from its Account tab. Plain flex row
  with no physical direction classes, so RTL mirrors for free. Mounted by `Navbar` because
  `Navbar` already owns the drawer and action sheet its tabs open.
- **`SideNavDrawer`** — slide-out nav. Opened by the `Navbar` hamburger on desktop and by
  `BottomNav`'s Account tab on mobile.
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
- **`ErrorBoundary`** — class component; wraps each modal (`compact` prop) with an `onReset` that
  closes just that modal, so one broken modal doesn't blank the page. Applied once, in the
  `MODALS.map()` in `App.jsx`, and once more inside `Modal` around the dialog's content.
- **`Modal`** — the one modal shell. Owns the portal (into `document.body`), the backdrop and
  click-to-dismiss, Escape (routed to the topmost dialog only), the focus trap, initial focus and
  focus restore to the trigger, the reference-counted scroll lock (on `<html>` and `<body>` both — `<html>`'s `overflow-x: clip`
  makes it the viewport scroller, so a body-only lock did nothing), `role="dialog"` /
  `aria-modal` / labelling, and the named z-layer stack (`MODAL_LAYERS`: `base` / `gate` / `top`)
  that replaced hand-picked z-indexes. Per-dialog appearance comes in as `className` /
  `overlayClassName` and is composed over the shared shell with `clsx` + `tailwind-merge`, so a
  caller's `bg-black/60` replaces the default backdrop rather than stacking on top of it.
- **`ModalLoadingFallback`** — the `Suspense` fallback for a dialog whose chunk is still in
  flight: a portalled backdrop and a spinner, and deliberately *not* a `<Modal>`. A `Modal` here
  would capture and then release focus a frame before the real dialog captured it again, and
  would drop the shared scroll-lock refcount to zero in between.
- **`InstallPwaBanner`** — PWA install prompt banner, self-contained (owns its own
  dismissal/storage state).
- **`LegalConsentGate`** — blocking overlay for any signed-in user whose stored
  `legalAcceptedVersion` doesn't match `LEGAL_VERSION`; not a modal opened by user action, it
  gates the whole app until accepted.

## Package CRUD

- **`AddEditPackageModal`** — the add/edit form; also where Smart-Import autofill correction
  detection lives (editing a field Smart Import just filled, before saving, logs to
  `parseCorrectionService`).
- **`PackageDetailModal`** — full shipment detail + interactive timeline, integrates `CourierActionHub` for driver communication.
- **`CourierActionHub`** — quick courier driver response hub: template switcher, dynamic variable interpolation (`{gateCode}`, `{pickupCode}`, `{tracking}`), custom message CRUD (create/edit/delete/hide presets), and WhatsApp/SMS launch triggers.
- **`DeleteConfirmDialog`** — generic delete confirmation, reused wherever a package delete needs
  confirming.
- **`SmartImportModal`** — paste/screenshot ingestion flow: tries the deterministic
  `smartParser.js` first, falls back to the AI Cloud Function (`aiParseService.js`) when nothing
  matches or the input is a screenshot. Maps the AI response into the same shape the regex parser
  returns so the rest of the component (and `AddEditPackageModal`) don't need to know which path
  produced a result.
- **`IngestionGuideModal`** — shipment ingestion & sync center: manages Gmail OAuth sync (`connectGmail`), Outlook auto-forwarding (`requestOutlookForwardingSetup`), private, rotatable ingestion email addresses (`fetchIngestionToken` + `buildIngestionEmailAddress`), and provider-specific forwarding setup guides.

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
- **`AdminFeedbackModal`** — admin-only feedback inspector; a thin wrapper over
  `AdminDashboardModal`, which is built on `Modal` (full-screen below `lg`, fixed height above it).

## Adding a new modal

0. Keep every side effect guarded on `isOpen`. The component is not mounted until its first
   open, and code that assumed a mount-on-load will not run when it expects to.
1. Write an `isOpen`/`onClose` component whose top-level element is `<Modal>`, passing the panel's
   own classes as `className` and any backdrop deviation as `overlayClassName`. Do not hand-roll a
   `fixed inset-0` overlay, a z-index, an Escape handler, or a focus trap — `Modal` owns all of
   those, and a second copy is how they drifted apart in the first place.
2. Give it an id in `MODAL` in `App.jsx`, a `lazyModal(() => import('./components/X'), 'X')`
   binding beside the others (the `import()` specifier must stay a string literal or Rollup
   cannot split it), and an entry in the `MODALS` array. The array's order is render order, and
   therefore the stacking order for two dialogs open at once.
3. Open it with `openModal(MODAL.X, payload)` and close it with `closeModal(MODAL.X)` — the modal
   router (`useModalRouter`) is the single source of truth for what is open, replacing the
   per-modal `isXOpen` booleans and their companion state.
4. Pass `onShowToast` down for user-facing messages rather than owning toast state.
