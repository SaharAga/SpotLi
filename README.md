# Deliveree

Deliveree is a bilingual (Hebrew RTL / English LTR) Progressive Web App for
tracking packages across Israeli couriers and global shipping carriers from a
single dashboard. It works offline-first (IndexedDB + a sync queue), syncs
across devices for signed-in users via Firebase, and can ingest tracking
numbers from pasted text, SMS, or the PWA share target.

**Live tracking coverage:** currently limited to Israel Post. Every other
carrier is detected and displayed, but has no upstream data source yet — the
app labels those packages "manual tracking" rather than inventing status
updates for them. See `src/services/carrierApiProxy.js`.

## Prerequisites

- Node.js 22+
- A Firebase project (Firestore + Authentication enabled) if you want cloud
  sync and sign-in. Without one, the app still runs fully offline against
  local storage.

## Setup

```bash
npm ci
cp .env.example .env.local   # fill in your Firebase project's values
npm run dev                  # http://localhost:5173
```

`.env.example` documents all six required `VITE_FIREBASE_*` variables and
where to find them in the Firebase console. `npm run dev` runs without them —
sign-in and cloud sync are simply disabled — but `npm run build` (a
production build) fails loudly if any are missing, so a misconfigured build
can never ship silently pointed at the wrong project.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` (requires env vars) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest suite |
| `npm run lint` | Run oxlint |

`npm run prepare` (runs automatically on `npm install`) points git at
`.githooks/`, which includes a pre-commit scan for accidentally committed
secrets (`scripts/pre_commit_secrets_check.js`).

## Architecture

- **UI**: React 19 + Tailwind CSS 4, entry point `src/App.jsx`.
- **Storage**: layered — `localStorage` (`src/services/deliveryService.js`)
  is the baseline, `idbStorageAdapter.js` backs offline persistence, and
  `cloudStorageAdapter.js` syncs to Firestore for signed-in users.
  `syncQueueService.js` queues writes made while offline and replays them
  with idempotency keys once connectivity returns.
- **Tracking**: `carrierApiProxy.js` is the only place that talks to a
  carrier's servers; `trackingService.js` layers rate limiting and
  checkpoint merging on top of it.
- **Auth**: `src/context/AuthContext.jsx`, backed by Firebase Authentication
  (Google, Apple, Facebook, email/password).
- **Data model & validation**: `src/schemas/packageSchema.js` (Zod), mirrored
  server-side by `firestore.rules` — the rules are the actual enforcement,
  the client schema is defense in depth.

## Testing

```bash
npm test
```

Vitest runs the full suite in a Node environment by default; component tests
that need a DOM (`*.dom.test.jsx`) opt into jsdom per-file via a
`/** @vitest-environment jsdom */` pragma, using `@testing-library/react`.
Property-based tests (via `fast-check`) cover the smart-text parser, the
privacy sanitizer, and the IndexedDB adapter.

## Abuse protection (App Check)

The `/feedback` collection accepts writes from anyone who has the project's
(public) API key, by design — testers submit feedback without an account.
[Firebase App Check](https://firebase.google.com/docs/app-check) is what
actually closes that off: it rejects requests that don't come from a real
build of this app, without requiring sign-in. It's optional — unset,
`src/services/firebase.js` simply never initializes it, exactly as before.

To turn it on:

1. Create a reCAPTCHA v3 site key at
   [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin) for
   this app's domain(s).
2. In Firebase console → **App Check**, register the web app with that key.
3. Set `VITE_RECAPTCHA_V3_SITE_KEY` (local `.env.local`, and as a repository
   variable for CI/production — see Deployment below).
4. Watch the **App Check** metrics tab for a few days with enforcement still
   *off*, to confirm real traffic is getting verified tokens.
5. Only then flip **Enforce** for Cloud Firestore in App Check settings.
   Enforcing before step 4 can lock out real users if the key or domain
   registration is wrong.

For local development, `firebase.js` auto-registers a debug token
(`FIREBASE_APPCHECK_DEBUG_TOKEN`) whenever a site key is set and Vite is in
dev mode; the token is logged to the browser console on first run — add it
under App Check → **Debug tokens** in the Firebase console.

## Deployment

CI (`.github/workflows/ci.yml`) runs on every push/PR to `main`: lint → test
→ build, then, on `main` only and gated behind the `FIREBASE_HOSTING_ENABLED`
repository variable, deploys the built app to Firebase Hosting and pushes
`firestore.rules` to the project. The build step reads the six
`VITE_FIREBASE_*` values from repository variables (Settings → Secrets and
variables → Actions → Variables) — they're public client identifiers, not
secrets, but are kept out of the repo so nothing ever has to be committed.

To deploy by hand:

```bash
npm run build
firebase deploy --only hosting,firestore:rules
```

## Security

`firestore.rules` is the source of truth for who can read or write what —
see its comments for the per-collection rationale. App Check (above) is the
other half of the story for collections that intentionally allow
unauthenticated writes. Report a vulnerability by opening a private
conversation with the maintainer rather than a public issue.
