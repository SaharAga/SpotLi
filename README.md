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
| `npm run dev:device` | Dev server **and** open the phone preview (below) |
| `npm run build` | Production build to `dist/` (requires env vars) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest suite |
| `npm run lint` | Run oxlint |

`npm run prepare` (runs automatically on `npm install`) points git at
`.githooks/`, which includes a pre-commit scan for accidentally committed
secrets (`scripts/pre_commit_secrets_check.js`).

### Phone preview

```bash
npm run dev:device
```

Opens `devtools/preview.html`, which renders the running app in two phone
bezels side by side — Hebrew RTL and English LTR — with theme, device-size and
ambient-mood controls. It iframes the dev server, so hot reload applies to both
frames and a change appears in under a second. This is the loop for UI work;
you should not need a staging deploy to see how something looks.

It must be served over http. Opening the file directly (`file://…`) gives the
frames nothing to point at — the page detects that and tells you, rather than
rendering two black rectangles. It also lives outside the Vite entry graph, so
`npm run build` never emits it and it cannot ship.

## Architecture

- **UI**: React 19 + Tailwind CSS 4, entry point `src/App.jsx`.
- **Storage**: layered — `localStorage` (`src/services/deliveryService.js`)
  is the baseline, and `cloudStorageAdapter.js` syncs to Firestore for signed-in users.
  `syncQueueService.js` queues writes made while offline and replays them
  with idempotency keys once connectivity returns.
- **Tracking**: `carrierApiProxy.js` is the only place that talks to a
  carrier's servers; `trackingService.js` layers rate limiting and
  checkpoint merging on top of it.
- **Auth**: `src/context/AuthContext.jsx`, backed by Firebase Authentication
  (Google, email/password).
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

## AI-assisted import (Cloud Functions)

`functions/` (the app's only backend component) hosts `parseWithAi`, a
callable Cloud Function used two ways:

- **Text fallback**: when the deterministic parser (`src/utils/smartParser.js`)
  finds nothing in pasted text, `SmartImportModal` calls it as a fallback.
  Most pastes match a known pattern and never reach it.
- **Screenshots**: pasting/attaching a screenshot in Smart Import has no
  text to run the deterministic parser on at all, so it always goes through
  this function.

It runs on Gemini (currently `gemini-3.5-flash-lite`, see
`functions/src/config.js` — model IDs get retired on a real lifecycle,
Gemini 2.0 Flash shut down June 2026, so this is reviewed periodically
against [the current model list](https://ai.google.dev/gemini-api/docs/models)
rather than left to rot). Both the request and the whole response shape are
designed so the client never needs to know or care whether a result came
from the regex parser or the AI fallback.

**Cost guards** (`functions/src/guards.js`), layered rather than relying on
any single one: requires sign-in (unlike `/feedback`, there's no reason
this needs to work for a logged-out caller) and App Check; a per-user daily
call cap and a global daily cap, both enforced transactionally in Firestore
so concurrent calls can't race past them; and payload size caps on both
text and image inputs. None of this is a substitute for a
[GCP billing budget alert](https://cloud.google.com/billing/docs/how-to/budgets)
on the project — set one up regardless.

**Mis-parse detection**: an AI or regex result can be *confidently wrong*,
which looks identical to a correct one until someone notices. Two signals
close that gap — neither logs the actual parsed values, only which fields
were affected:
- *Implicit*: if a user edits a field Smart Import just auto-filled, before
  saving, that's logged to `/parseCorrections` (`AddEditPackageModal.jsx`,
  `src/services/parseCorrectionService.js`).
- *Explicit*: a "this wasn't right?" button on the Smart Import result
  routes through the existing feedback pipeline (`submitFeedback`) rather
  than a second reporting system.

**Setup** — required before any of this works, none of it done by CI:
1. A Gemini API key from [Google AI Studio](https://aistudio.google.com/) or
   Vertex AI, stored as a Cloud Functions secret (not a repo variable —
   this one's an actual secret):
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
2. The Firebase project must be on the **Blaze** (pay-as-you-go) plan —
   Cloud Functions cannot run on the free Spark plan at all.
3. App Check must be turned on (see above) — `parseWithAi` enforces it
   server-side, so the feature is inert without it regardless of the
   Gemini key.
4. Deploy:
   ```bash
   firebase deploy --only functions
   ```
   Not wired into CI's automatic deploy — unlike Hosting and Firestore
   rules, this needs the secret and the Blaze plan in place first, and a
   deploy step that fails on every single push until then is exactly the
   trap `firestore.rules` auto-deploy fell into earlier; add it to
   `ci.yml`'s `deploy-firebase` job once 1–3 above are done.

## Automated Email Ingestion & Gmail Sync

Deliveree supports two channels for automatic shipment tracking from emails:

1. **Direct Inbound Email Gateway (`functions/src/inboundEmailHandler.js`)**:
   - Every user gets a dedicated ingestion address (`233b362d7b331adfde6e+usr_<uid>@cloudmailin.net`).
   - Inbound shipment emails sent or forwarded to this address trigger CloudMailin's webhook, which parses carrier tracking numbers and auto-saves packages to Firestore.

2. **Gmail OAuth 2.0 & Real-Time Push Sync (`functions/src/gmail*`)**:
   - **1-Click Connect**: Redirect-based OAuth 2.0 flow with `gmail.readonly` scope.
   - **Real-Time Updates**: Integrates Gmail `users.watch()` with Cloud Pub/Sub push notifications (`gmailPushHandler`).
   - **Historical Backfill**: Automatically scans and deduplicates orders from the preceding 30 days upon connection (`gmailBackfill`).
   - **Token Isolation**: Refresh tokens are stored server-side only in `gmailConnections/{uid}` with a strict **deny-all** in `firestore.rules` (only accessible via Firebase Admin SDK).
   - **Watch Renewal**: Weekly Cloud Scheduler job (`gmailWatchRenewal`) automatically renews 7-day Gmail mailbox watches.

**Real-time push notification for new packages** (`functions/src/newPackagePush.js`,
`pushNotifications.js`): when either ingestion channel above creates a package, a Firestore
trigger on `users/{uid}/packages/{packageId}` sends a Web Push notification to every device the
user has subscribed on — so a new shipment shows up without opening the app. Not sent for
packages the user created themselves (manual add, Smart Import): those are scoped out by
`source`, since the user is already looking at the app when they create one.

**Setup** — required before push notifications work, none of it done by CI:
1. Generate a VAPID keypair once (from `functions/`):
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Store the private half as a Cloud Functions secret:
   ```bash
   firebase functions:secrets:set VAPID_PRIVATE_KEY
   firebase functions:secrets:set VAPID_PUBLIC_KEY
   ```
3. Set the public half as the `VITE_VAPID_PUBLIC_KEY` repository variable (same one used for
   `VITE_FIREBASE_*`) — it's not sensitive, just an EC public key, but the client build needs it
   to actually call `PushManager.subscribe()`.
4. Deploy `functions/` (see "Deployment" below) — without steps 1–3 the app and Gmail sync still
   work fine, push notifications just never get subscribed to or sent.

## Automated feedback/crash triage

A Claude Code agent, run on a schedule, reads new `/feedback` and `/crashReports` documents and
files GitHub issues for genuinely new, actionable problems — see
`.agents/skills/feedback-triage-and-action-items/SKILL.md` section 3 for the full protocol. It
never opens a PR on its own; a fix it judges safe and scoped is described in the issue for a human
to act on, since both collections accept anonymous, unauthenticated writes and that content must
never be able to drive a code change by itself.

**Setup**:
1. Firebase Console → Project Settings → Service Accounts → Generate new private key.
2. Set the resulting JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` (the whole file, as one string) in
   the environment the triage Routine runs in — this is a real secret, not a repo variable.
3. `npm run triage:fetch` to sanity-check locally (prints untriaged documents from both
   collections as JSON, or a clear error if the credential is missing/invalid).

This bypasses `firestore.rules` via the Admin SDK by design — the client-facing rules stay
untouched (still create-only, admin-read, no client update) regardless.

## Legal consent & AI-training opt-in

Registration (email/password) requires checking a mandatory box to accept
the Terms of Use and Privacy Policy (`src/constants/legal.js` — a working
draft, revised once against a structured contract-review pass
(`docs/legal-review-2026-08-23.md`) but still not lawyer-reviewed; see that
file's header for the known open gaps — anonymous `/feedback` can't
currently be deleted per-account, no formal international-transfer
safeguard for the China-based carrier calls, no Israeli Security
Regulations paperwork, and this is still an individual operating
personally rather than a registered entity). OAuth sign-in
(Google/Apple/Facebook) has no form step, so `LegalConsentGate` blocks any
signed-in user whose stored `legalAcceptedVersion` doesn't match the current
`LEGAL_VERSION` — new OAuth sign-ups and pre-existing accounts alike — until
they accept. Bump `LEGAL_VERSION` when the documents' substance changes to
re-prompt everyone.

A second, separate, unchecked-by-default checkbox opts in to AI-training
data collection: for opted-in users, a Smart Import correction stores the
actual pasted text and before/after field values (`trainingExamples`
collection, `src/services/trainingDataService.js`) instead of just the field
names `parseCorrections` logs for everyone else. Never the screenshot image.
Changeable anytime from Account Settings → Profile. This data has no
separate retention timer — turning the opt-in off, or deleting the account,
deletes it immediately, enforced both client-side and by `firestore.rules`
(the `aiTrainingOptIn` flag on the user's own profile doc is re-checked
server-side on every write).

## Deployment

> **Production is broken? See [docs/ROLLBACK.md](docs/ROLLBACK.md).** Do not
> roll back through CI — Firebase Hosting serves a previous release in seconds
> from the console. Note that Firestore rules do *not* roll back with hosting,
> and they reach production on every merge to `main`, not on release.

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

### Production health check

`.github/workflows/health-check.yml` runs daily (plus manual dispatch) and
checks two things `ci.yml` can't, since it never touches the live site after
deploying: that the deployed site's version actually matches `main`'s
`package.json`, and that `firestore.rules` deploys cleanly (idempotent — a
no-op when already in sync, and the same drift/permission check re-run
daily rather than only once at merge time). GitHub emails repo watchers by
default when a scheduled workflow fails, so a regression in either — like
the Firestore rules 403 in `TASK-27`, `docs/AGY_TASKS.md` — surfaces as a
fresh daily failure instead of one easy-to-miss red job on the merge commit
that caused it.

## Security

`firestore.rules` is the source of truth for who can read or write what —
see its comments for the per-collection rationale. App Check (above) is the
other half of the story for collections that intentionally allow
unauthenticated writes. Report a vulnerability by opening a private
conversation with the maintainer rather than a public issue.
