# CODEX.md — Deliveree Onboarding Guide for Codex & AI Agents

Welcome to **Deliveree** (`/home/sahar/Deliveree`). This document is the single-source-of-truth onboarding and operational guide for OpenAI Codex and autonomous AI agents working in this repository.

---

## 1. Project Overview & Mental Model

Deliveree is a **bilingual (Hebrew RTL / English LTR) Progressive Web App (PWA)** for tracking packages across Israeli domestic couriers and global shipping carriers in a unified dashboard.

- **Stack**: React 19, Vite 8, Tailwind CSS 4, Vitest 4, Zod 4, Firebase SDK v12 (Auth, Firestore, Cloud Functions).
- **Client Architecture**: Offline-first, client-only Single Page Application (SPA).
- **Cloud Backend**: Google Cloud Firestore + Firebase Authentication + Node.js 22 Cloud Functions (for Gmail sync, webhook ingestion, and Gemini AI parsing).
- **Live Carrier Coverage**: Real-time upstream tracking is currently integrated with **Israel Post** (`src/services/carrierApiProxy.js`). All other carriers are recognized/normalized but labeled "manual tracking" until upstream APIs are integrated.

---

## 2. Directory Structure & Key Files

```
Deliveree/
├── .agents/                 # Multi-agent SDLC skills, protocols, and workflows
├── .changes/                # Changeset declarations for PRs (see .changes/README.md)
├── .github/workflows/       # CI/CD workflows (ci.yml, health-check.yml)
├── functions/               # Node 22 Firebase Cloud Functions
│   ├── src/                 # parseWithAi, gmailPushHandler, gmailBackfill, inboundEmailHandler
│   ├── package.json         # Cloud Functions dependencies & scripts
│   └── vitest.config.js     # Cloud Functions test configuration
├── public/                  # Static assets, PWA manifest, service worker (sw.js)
├── scripts/                 # Automation scripts (release, version-utils, secrets check, triage)
├── src/
│   ├── components/          # React presentation layer (~40 UI components & lazy modals)
│   ├── constants/           # Shared constants (version, carriers, legal, status codes)
│   ├── context/             # React Contexts (AuthContext, etc.)
│   ├── data/                # Static data & locker locations
│   ├── hooks/               # Custom React hooks (usePackages, useCarrierLookup, etc.)
│   ├── i18n/                # Bilingual translations (he.js, en.js, translations.js)
│   ├── schemas/             # Zod schemas (packageSchema.js)
│   ├── services/            # Storage, Firebase, tracking, carrier proxies, sync queue
│   ├── types/               # Type definitions & status mappings (carriers.js, stages.js)
│   ├── utils/               # Pure utility functions (smartParser, storage, crypto, bist)
│   ├── App.jsx              # Main application shell and modal registry
│   └── main.jsx             # React DOM entrypoint & Service Worker registration
├── AGENTS.md                # Multi-agent framework, quality gates, and operational facts
├── CLAUDE.md                # Claude Code onboarding guide
├── CODEX.md                 # This onboarding document
├── package.json             # Root dependencies and scripts
└── firestore.rules          # Cloud Firestore security rules
```

---

## 3. Module Layering & Import Boundaries

Module layering is strictly enforced by `.oxlintrc.json` on CI. Violations will fail the build:

```
[ components/ · hooks/ · context/ · App.jsx ]  <-- Presentation & UI state
                     │
                     ▼
             [ services/ ]                     <-- Firebase, Network, Storage Adapters
                     │
                     ▼
 [ utils/ · types/ · schemas/ · constants/ · i18n/ · data/ ] <-- Pure Leaves
```

### Strict Layering Rules:
1. **Leaves** (`utils/`, `types/`, `schemas/`, `constants/`, `i18n/`, `data/`) **MUST NEVER** import `services/`, `components/`, `hooks/`, or `context/`.
2. **Services** (`services/`) **MUST NEVER** import `components/`, `hooks/`, or `context/`.
3. **Circular Dependencies**: `import/no-cycle` is enabled repo-wide (`error`).
4. **Encapsulation**: Import from module entry points/public APIs, not nested private files.

---

## 4. Subsystems & Architecture Deep Dive

### 4.1 Storage Architecture & Partitioning
- **Primary Storage**: `src/services/deliveryService.js` reads/writes package lists to browser `localStorage`.
- **Partitioning**: Keyed per user: `deliveree_packages_<userId>` (signed-in) or `deliveree_packages_guest` (unauthenticated guest).
- **Safe I/O**: Always use `readJSON` / `writeJSON` from `src/utils/storage.js`. Never call raw `localStorage.setItem` directly without handling quota errors.
- **Cloud Sync**: `src/services/cloudStorageAdapter.js` synchronizes local package state with Firestore `packages/{uid}` for authenticated users.
- **Offline Mutation Queue**: `src/services/syncQueueService.js` records mutations while offline and replays them with idempotency keys upon reconnection.
- **Note on IndexedDB**: `idbStorageAdapter.js` was deprecated and removed in `v0.15.3`. Do not re-introduce or import it.

### 4.2 Package Validation & Repair
- **Single Source of Truth**: `src/schemas/packageSchema.js` (`parsePackageList`) provides schema parsing, sanitization, and repair-on-read.
- **Prototype Pollution Guard**: Strips dangerous keys (`__proto__`, `constructor`, `prototype`). Unknown valid custom fields are preserved.
- **No Silent Truncation**: Oversized lists report an `overflow` flag rather than silently discarding records.

### 4.3 Tracking & Carrier Routing
- **Network Boundary**: `src/services/carrierApiProxy.js` is the **ONLY** module permitted to make HTTP calls to courier APIs.
- **Rate Limiting & Cooldown**: `src/services/trackingService.js` layers cache management, 60s cooldowns, and checkpoint merging.
- **Safe Carrier Lookups**: **NEVER** use `CARRIERS[id]` directly (`CARRIERS['constructor']` returns `Object.prototype.constructor`). Always use `getCarrier(id)` from `src/types/carriers.js`.

### 4.4 Smart Import & Ingestion
- **Deterministic Regex Parser**: `src/utils/smartParser.js` parses tracking numbers, couriers, and order descriptions from raw text/SMS with zero latency and no cloud calls.
- **AI Fallback**: When deterministic parsing finds nothing or when parsing screenshot images, `src/services/aiParseService.js` delegates to the `parseWithAi` Cloud Function (Gemini model).
- **Correction Tracking**: Editing an autofilled field logs to `/parseCorrections` (field names only, no PII) via `src/services/parseCorrectionService.js` to continuously tune parser regexes.

### 4.5 Modals & UI Lifecycle
- All modals are defined in `src/components/` and registered in `MODALS` in `src/App.jsx`.
- Modals are lazy-loaded via `React.lazy` and `Suspense`, rendered inside dedicated `<ErrorBoundary compact>` wrappers.
- The shared `Modal` component manages body scroll-locking, focus trapping, `Escape` key routing, and z-index layer stacks (`MODAL_LAYERS`: `base`, `gate`, `top`).

### 4.6 Gmail Integration & Inbound Webhook Gateway
- **Gmail OAuth**: Server-side read-only OAuth (`gmail.readonly`) stored securely in `gmailConnections/{uid}`.
- **Push Sync**: Google Cloud Pub/Sub triggers `gmailPushHandler` on new email arrival.
- **Backfill**: `gmailBackfill` scans up to 30 days of historical shipment emails.
- **Inbound Webhook**: `inboundEmailHandler` Cloud Function parses forwarded tracking emails from CloudMailin.

---

## 5. Development Commands & Toolchain

### Essential Commands
```bash
# Install dependencies
npm ci

# Set up local environment
cp .env.example .env.local

# Start Vite dev server (http://localhost:5173)
npm run dev

# Run full test suite (Node environment)
npm test

# Run linter
npm run lint

# Production build (requires VITE_FIREBASE_* env vars)
npm run build

# Preview production build locally
npm run preview
```

### Targeted Testing
```bash
# Run a specific test file
npx vitest run src/utils/smartParser.test.js

# Run tests matching a regex pattern or test name
npx vitest run -t "smartParser"

# Run Cloud Functions tests
cd functions && npm test
```

### Pre-commit Secrets Check
Git hooks are automatically configured in `.githooks/` by `npm run prepare`. `scripts/pre_commit_secrets_check.js` will block commits containing API keys, private tokens, or credential strings.

---

## 6. Critical Gotchas & Non-Negotiable Invariants

1. **Carrier Lookup Safety**:
   - ❌ `const carrier = CARRIERS[carrierId] || CARRIERS['other'];`
   - ✅ `const carrier = getCarrier(carrierId);`
2. **Valid Statuses vs Stages**:
   - `src/types/stages.js` (`STAGES`) lists display stages and excludes `exception` and `archived`.
   - The canonical list of all valid statuses is in `src/utils/packageValidator.js` (`VALID_STATUSES`).
3. **App Version Source**:
   - **DO NOT** hardcode version strings in application code.
   - Version is read from `__APP_VERSION__` (injected from `package.json` by Vite/Vitest) in `src/constants/version.js`.
4. **Firestore BOLA Invariant**:
   - All Firestore security rules for user-owned collections must enforce:
     `resource.data.userId == auth.uid && request.resource.data.userId == auth.uid`
5. **Bilingual RTL/LTR Symmetry**:
   - Always use CSS logical properties (e.g. `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `border-s-*`) instead of directional properties (`ml-*`, `mr-*`, `left-*`, `right-*`).
6. **Mobile Touch Target Requirement**:
   - Interactive buttons and inputs must maintain a minimum touch target of **48x48px**.
7. **Local Production Build Requirements**:
   - `npm run build` checks for non-empty `VITE_FIREBASE_*` variables. For local build verification without production credentials, pass dummy values:
     ```bash
     VITE_FIREBASE_API_KEY=x VITE_FIREBASE_AUTH_DOMAIN=x VITE_FIREBASE_PROJECT_ID=x \
     VITE_FIREBASE_STORAGE_BUCKET=x VITE_FIREBASE_MESSAGING_SENDER_ID=x \
     VITE_FIREBASE_APP_ID=x npx vite build
     ```
8. **Known Flaky Timing Tests**:
   - `adversarialStress.test.js` and `adversarialP0Audit.test.js` assert wall-clock durations (`toBeLessThan(100)`). If a loaded CPU runner fails one of these under heavy load, check if it was purely a wall-clock spike.
9. **Linter Warning Policy**:
   - `npm run lint` uses `oxlint`. The four `react-perf/jsx-no-new-*` rules run at `warn` as an informational backlog. Do not run `oxlint -D warnings`.

---

## 7. Change Declarations & Release Workflow

Deliveree enforces that **every PR touching shipped code (`src/`, `functions/`, `firestore.rules`) must declare its change.**

### Declaring a Change via Changeset (Preferred)
Create a new file in `.changes/<branch-or-feature-slug>.md`:
```markdown
---
type: patch
---

Fixed carrier lookup fallback handling when carrierId is invalid.
```
- `type: patch` — Bugfixes, refactors, internal improvements.
- `type: minor` — New user-facing features or major enhancements.
- `type: major` — Reserved for breaking milestones.

### Releasing
```bash
# Automated version resolution from changesets
npm run release

# Or specify a target version
npm run release 0.19.0
```
`npm run release` aggregates `.changes/`, updates `CHANGELOG.md`, bumps `package.json`, and deletes the consumed changeset files. Only version-bumping commits on `main` trigger automatic deployment to Firebase Hosting.

---

## 8. Coordination & Multi-Agent Guidelines

When collaborating alongside other autonomous agents or engineers:
- **Ownership Ledger**: Check **GitHub Issue #64** before modifying files. Claim your files and respect other agents' working sets.
- **Quality Gates**:
  1. Static Lint: `npm run lint` (exit code 0).
  2. Typecheck / Contracts: Verified Zod schemas and TypeScript types.
  3. Automated Tests: `npm test` (100% pass rate).
  4. Production Build: `npm run build` (zero build errors).
  5. Security: Zero hardcoded secrets, zero BOLA flaws in `firestore.rules`.
