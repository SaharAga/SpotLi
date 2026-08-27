# Agent Sync (Antigravity ↔ Claude)

Shared, versioned handoff log between the two agents working this repo. There is no live
channel between us — each agent only sees this file when invoked (via the `agent-sync` skill,
`.agents/skills/agent-sync/SKILL.md`, or manually). Committing this file (as of 2026-08-25 it's
no longer gitignored) is what makes it actually shared — before that it only existed locally and
never crossed sessions or machines.

## How to read this file (freshness check)

1. Read **Sync State** below. If `Awaiting response from` doesn't name you, you can usually stop
   there.
2. Any entry not marked `OPEN` needs no action — `ANSWERED` and `SUPERSEDED` entries are kept for
   record, not as a to-do list.
3. Before acting on an `OPEN` entry, re-verify its claim against current code — an entry can go
   stale between being written and being read even if nothing marked it `SUPERSEDED` yet. If it's
   no longer true, mark it `SUPERSEDED` yourself and say why, rather than silently ignoring it.

## Entry format

Every entry needs all of these — an entry missing a status or a verification is not trustworthy:

```markdown
### SYNC-<n>: <short title>
- **Written by:** Antigravity | Claude — <ISO-ish timestamp>
- **Against:** <commit sha or version, e.g. 0.15.6 / 87290ce>
- **Status:** OPEN | ANSWERED | SUPERSEDED
- **Owner of next action:** Antigravity | Claude | Sahar | none
- **Claim:** <what you found/did>
- **Verified via:** <file:line, command run, or test executed — never just a status label>
```

## 🔄 Sync State

- **Awaiting response from:** Sahar (GCP console configuration: OAuth Web Client ID/Secret, Pub/Sub topic & push subscription, and secrets deployment)
- **Last updated by:** Antigravity — 2026-08-27
- **Open blockers:** none in code; awaiting manual GCP console setup to activate live push sync

## Log

### SYNC-2: Gmail OAuth 2.0 (`gmail.readonly`) & Real-Time Push Sync Implemented
- **Written by:** Antigravity — 2026-08-27
- **Against:** f315456 (PR #92)
- **Status:** ANSWERED
- **Owner of next action:** Sahar (GCP setup)
- **Claim:** Successfully replaced fragile forwarding-scrape with robust server-side Google OAuth (`gmail.readonly`), `users.watch()` + Pub/Sub push notification listener (`gmailPushHandler`), 30-day historical order backfill (`gmailBackfill`), and scheduled weekly watch renewal (`gmailWatchRenewal`).
  - Tokens are isolated in `gmailConnections/{uid}` with a strict deny-all in `firestore.rules` (only Firebase Admin SDK in Cloud Functions can access).
  - Clean disconnect flow revokes Google token, stops watch subscription, and deletes the connection record.
  - Fixed infinite render loop in `IngestionGuideModal.jsx` by removing unmemoized `user` object reference from `useEffect` dependencies, and resolved React Hook ordering rules.
  - Tests: 84/84 root suites (783 tests), 6/6 functions suites (54 tests) pass with 100% success rate, lint 0 errors.
- **Verified via:** `npm test`, `(cd functions && npm test)`, and `npm run lint` all exiting 0. PR #92 merged cleanly into `main`.

### SYNC-1: Sync doc re-established as a tracked file
- **Written by:** Claude — 2026-08-25
- **Against:** 87290ce (v0.15.6)
- **Status:** ANSWERED
- **Owner of next action:** none
- **Claim:** `docs/AGENT_SYNC.md` was gitignored, so nothing written here by either agent ever
  reached the other unless copy-pasted by Sahar. Un-gitignored it and consolidated the
  `.agents/` persona-role scratch directories (`orchestrator/`, `challenger*/`, `explorer_*/`,
  `reviewer_1-3/`, `auditor*/`, `sentinel/`, `victory_auditor/`, `worker_qa/`, `implementer_1/`,
  `broker/`, `schemas/`) down to the reusable pieces: `.agents/subagents/subagents.json` (the
  real subagent→skill roster) and `.agents/skills/*` (the actual knowledge docs each subagent
  loads). Those scratch dirs held only single-run session artifacts (`BRIEFING.md`/`DISPATCH.md`
  /`handoff.md`/`progress.md`/`report.md`), not durable knowledge — freshness/bias-avoidance
  comes from each subagent starting a genuinely fresh context per invocation, not from a
  persisted "character" file.
- **Verified via:** read every file in each removed directory; `.agents/broker/messageQueue.js`
  and `.agents/schemas/messageValidator.js` had zero consumers outside their own test files
  (`grep -rl messageValidator|messageQueue` across `scripts/` and `.agents/` returned only their
  own test files); `.agents/worker_qa/software-verification-and-qa.md` was a stale duplicate of
  `.agents/skills/software-verification-and-qa/SKILL.md` (diffed, confirmed divergent/older).
  Also fixed `subagents.json` referencing a nonexistent `modern-web-guidance` skill (not present
  under `.agents/skills/`) on the `ui_ux_architect` and `ui_ux_specialist` entries.
