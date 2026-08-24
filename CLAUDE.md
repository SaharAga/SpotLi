# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Deliveree is a bilingual (Hebrew RTL / English LTR) Progressive Web App for tracking packages
across Israeli couriers and global shipping carriers. It's offline-first (IndexedDB + a sync
queue), optionally syncs to Firebase for signed-in users, and can ingest tracking numbers from
pasted text, SMS, or the PWA share target.

Live tracking coverage is currently limited to Israel Post (`src/services/carrierApiProxy.js`);
every other carrier is detected/displayed but shown as "manual tracking" rather than faked.

## Commands

```bash
npm ci
cp .env.example .env.local   # fill in VITE_FIREBASE_* — dev runs without them, build does not

npm run dev                  # Vite dev server, http://localhost:5173
npm run build                # production build to dist/ (fails if Firebase env vars missing)
npm run lint                 # oxlint
npm test                     # vitest run (Node environment by default)
```

Run a single test file: `npx vitest run src/utils/smartParser.test.js`
Run tests matching a name: `npx vitest run -t "some test name"`

Cloud Functions (`functions/`) have their own `package.json`/`vitest.config.js` — `cd functions`
before running its lint/test/build.

`npm run prepare` (runs on `npm install`) points git at `.githooks/`, which pre-commit-scans for
accidentally committed secrets (`scripts/pre_commit_secrets_check.js`). Don't bypass it.

## Architecture

- **UI**: React 19 + Tailwind CSS 4, entry point `src/App.jsx`.
- **Storage — layered**: `src/services/deliveryService.js` (localStorage baseline) →
  `idbStorageAdapter.js` (offline persistence) → `cloudStorageAdapter.js` (Firestore sync for
  signed-in users). `syncQueueService.js` queues writes made while offline and replays them with
  idempotency keys once connectivity returns.
- **Tracking**: `carrierApiProxy.js` is the *only* place that talks to a carrier's servers;
  `trackingService.js` layers rate limiting and checkpoint merging on top of it.
- **Auth**: `src/context/AuthContext.jsx`, backed by Firebase Authentication (Google, Apple,
  Facebook, email/password).
- **Data model & validation**: `src/schemas/packageSchema.js` (Zod) is defense-in-depth only —
  `firestore.rules` is the actual enforcement and must be kept in sync with it.
- **Smart Import**: `src/utils/smartParser.js` is a deterministic regex parser tried first;
  `functions/parseWithAi` (Gemini, callable Cloud Function) is the fallback when the deterministic
  parser finds nothing, and the only path at all for screenshots. The client never needs to know
  which one produced a result — both return the same shape.
- **Mis-parse detection**: editing a Smart-Import-filled field before saving logs to
  `/parseCorrections` (field names only, no values) via `parseCorrectionService.js`. Users who
  opt into AI training (separate, unchecked-by-default consent) additionally get actual
  before/after values logged to `trainingExamples` via `trainingDataService.js` — never
  screenshot images, and deleted immediately if the opt-in is turned off.
- **Legal consent**: `LegalConsentGate` blocks any signed-in user whose stored
  `legalAcceptedVersion` doesn't match `LEGAL_VERSION` (`src/constants/legal.js`). Bump
  `LEGAL_VERSION` whenever the ToU/Privacy Policy substance changes to re-prompt everyone.
- **App Check**: optional (`VITE_RECAPTCHA_V3_SITE_KEY`); when unset, `src/services/firebase.js`
  simply never initializes it. It's what allows `/feedback` to accept unauthenticated writes
  safely — see README "Abuse protection" for the enable sequence (must stay in that order:
  register → observe metrics → only then enforce).

## Testing conventions

- Vitest runs in a **Node** environment by default. Component tests needing a DOM use the
  `*.dom.test.jsx` naming convention and opt into jsdom per-file via a
  `/** @vitest-environment jsdom */` pragma at the top of the file, using `@testing-library/react`.
- Property-based tests (`fast-check`) cover the smart-text parser, the privacy sanitizer, and the
  IndexedDB adapter — prefer that style over hand-picked example tables when adding coverage for
  parsing/sanitizing logic.
- Tests are co-located with implementation (`*.test.js`, `*.test.jsx`), not in a separate tree,
  except `src/tests/integration/`.

## Working conventions

- `carrierApiProxy.js` is a boundary: don't add carrier HTTP calls anywhere else.
- Client-side Zod schemas (`src/schemas/`) and `firestore.rules` encode the same invariants
  twice, deliberately — when changing one, check whether the other needs the matching change.
- Firestore security (BOLA): writes must enforce
  `resource.data.userId == auth.uid && request.resource.data.userId == auth.uid`. See
  `firestore.rules` comments for per-collection rationale before touching them.
- This is a client-only PWA with no backend beyond Firebase/Cloud Functions — don't introduce
  ASVS-L2/L3-style backend-auth patterns unless a real backend is actually added.
- Bilingual RTL(Hebrew)/LTR(English) UI: use CSS logical properties, not left/right-specific
  ones, so layout mirrors correctly between the two.
- Mobile touch targets must stay ≥ 48×48px.
- `functions/src/config.js` pins the Gemini model ID — it's reviewed periodically against
  Google's current model list, not left to silently rot when a model is retired.

## Agent framework (`.agents/`)

This repo also carries a separate multi-agent orchestration setup, documented in `AGENTS.md`
(gate pipeline: Developer → Code Review + Security Audit in parallel → QA Verifier). That governs
a different, subagent-driven workflow with its own skills under `.agents/skills/` — it doesn't
change any of the commands or architecture above, but if you're operating as one of those named
subagent roles, `AGENTS.md` is the fuller spec.

## CI/Deployment

`.github/workflows/ci.yml`: lint → test → build on every push/PR to `main`; on `main` only, and
gated behind the `FIREBASE_HOSTING_ENABLED` repo variable, deploys to Firebase Hosting and pushes
`firestore.rules`. `VITE_FIREBASE_*` values come from repository variables (public client
identifiers, not secrets). `functions/` deploy is manual (`firebase deploy --only functions`) —
not yet wired into CI, since it needs the Gemini secret and Blaze plan set up first.

`.github/workflows/health-check.yml` runs daily: verifies the deployed site matches `main`'s
`package.json` version and that `firestore.rules` deploys idempotently.
