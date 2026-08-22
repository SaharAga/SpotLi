# Smart Ingestion & AI Parsing — Phased Plan

**Status**: Approved, Phase 1A starting. Tracked as `TASK-24A`–`TASK-24E` in [AGY_TASKS.md](../AGY_TASKS.md). Origin: `SYNC-11` discussion in [AGENT_SYNC.md](../AGENT_SYNC.md) (2026-08-22), joint Claude/Antigravity plan, approved by Sahar.

## Why

Sahar tested the existing paste-based smart-import feature (`SmartImportModal.jsx` → `parseSmartText`) on real courier messages during a review session — none parsed. Root cause (confirmed by reading `smartParser.js`): the parser only matches exact label words (`tracking:`, `מספר מעקב`) and a fixed set of courier regexes; it doesn't extract tracking numbers from the URLs that most real courier SMS/emails actually contain (e.g. `israelpost.co.il/item/RR123...IL`, `hfd.co.il/?t=...`).

Separately, Sahar wants the primary import path to be **automatic** — packages should appear from forwarded courier emails without the user clicking "add" at all. Paste-based import becomes the fallback for anything automatic ingestion misses. This also surfaced a previously-scoped but unbuilt feature: pasting a **screenshot/image** (not just text) into the import flow, since courier notifications often arrive inside apps/emails where copying text is inconvenient.

## Phases

### Phase 1A — Client-side parser upgrade (free, no server, immediate)
Expand `smartParser.js`'s `extractTrackingCandidates` to pull tracking numbers out of URLs (query params and path segments) for known courier domains, not just labeled text. Zero cost, ships independently of everything below. Owner: Antigravity.

### Phase 1B — Serverless AI parsing engine
One Firebase Cloud Function (`parseDeliveryPayload`), shared by both automatic ingestion (1C) and the paste fallback (Phase 3). Accepts text or image, returns structured fields via an LLM/vision model call, validated against the existing Zod package schema. Auth-gated, per-user daily rate limit enforced server-side.

**Model choice — cost estimate (2026-08-22 research)**:
Gemini 2.0 Flash (originally discussed) was shut down 2026-06-01. Current options:

| Model | Input $/M tokens | Output $/M tokens |
|---|---|---|
| Gemini 3 Flash (Preview) | $0.50 | $3.00 |
| Gemini 3.1 Flash-Lite (GA) | $0.25 | $1.50 |

Both support native multimodal (text/image) input with a 1M-token context window. Recommend **Gemini 3.1 Flash-Lite** — GA (not preview, more stable for a production path) and half the cost.

**Per-parse cost estimate** (rough, image token count assumed ~1,290 tokens/screenshot based on standard Gemini image tiling — not yet verified against 3.1 Flash-Lite's actual tokenizer, verify before committing):
- Text parse (~500 input + ~200 output tokens): **~$0.0004** (~0.04¢)
- Image parse (~1,600 input + ~200 output tokens): **~$0.0007** (~0.07¢)

**Monthly cost at alpha scale**:
- Worst case (20 users, hitting a 20-parses/day cap every day, 30 days): ~12,000 parses/month ≈ **~$6/month**
- Realistic use (20 users, ~2-3 parses/day each): ~1,500/month ≈ **~$1/month**

**Conclusion: cost is a non-issue at alpha scale even with a generous rate limit.** The per-user daily cap (proposed: 20/day, see Abuse Prevention below) exists to bound worst-case/abuse cost, not because expected spend is meaningful. Re-estimate before any wider rollout beyond friends/family, since cost scales linearly with users and Flash-Lite pricing may change (it's a relatively new GA model as of this writing).

**Open item**: exact image tokenization for Gemini 3.1 Flash-Lite specifically wasn't confirmed (estimate borrowed from general Gemini image-tiling conventions) — verify against Google's current docs before Phase 1B implementation, cost conclusion is unlikely to change materially either way.

Owner: Claude/Antigravity joint.

### Phase 2 (TASK-24C) — Email forwarding ingestion pipeline
Dedicated inbound parsing email address. User sets up a forwarding rule (one-click guided setup on Android, manual instructions on iPhone). Inbound mail webhook (candidates: CloudMailin, SendGrid, Postmark, or a Firebase Extension) receives forwarded mail, routes the body through Phase 1B, auto-upserts the parsed package into the user's Firestore `packages` collection. No user click required — this is the primary import path.

**Why forwarding, not Gmail API/OAuth, for now**: no OAuth consent screen (lower trust bar for alpha testers who are friends/family), narrower scope (server only ever sees emails the user explicitly forwards, not full inbox read access), and reuses the same Phase 1B server component. Gmail API push (Phase 4) is a zero-touch upgrade path once forwarding proves the parsing engine works well on real volume — no point building the harder integration before validating what it depends on.

Owner: Joint/Claude.

### Phase 3 (TASK-24D) — Paste-based fallback (text + image)
`SmartImportModal.jsx` gains image paste/drop support. Free parser (Phase 1A) runs first by default — zero cost, zero third-party calls. Only if it fails (or for image input specifically, where free OCR is expected to be less reliable — mixed fonts/languages/screenshot layouts) does the UI offer an opt-in "✨ Enhance with AI" action that invokes Phase 1B. This keeps default cost near-zero and defers the image-privacy question naturally (nothing leaves the device unless the user actively opts in per item — disclaimer UI: "Screenshot analyzed securely to extract delivery details").

Positioned in the UI as the fallback for anything Phase 2's automatic ingestion missed, not the primary import method.

Owner: Antigravity.

### Phase 4 (TASK-24E) — Deferred, post-alpha: Gmail API / push ingestion
Replace forwarding with Gmail API OAuth + push (watch) notifications for fully zero-touch setup — no forwarding rule needed, catches emails from before setup too. Explicitly deferred until Phase 2 proves parsing accuracy/volume on real forwarded traffic.

## Abuse Prevention & Privacy

- Per-user daily cap on LLM-backed parses (proposed: 20/day), enforced server-side in the Cloud Function.
- Inbound-webhook rate limiting by sender/source to prevent the forwarding address being spammed.
- Opt-in disclaimer UI for screenshot upload to a third-party model API — image privacy question (PII in screenshots reaching a third party) is deferred to Sahar's decision before Phase 3 ships the image path, per his request during planning.

## Explicitly out of scope for this effort
- Gmail/Outlook OAuth (Phase 4, deferred).
- General inbox scanning/reading beyond what's explicitly forwarded.
- Any change to `TASK-23-SCANNER` (camera barcode scanning) — separate, unrelated backlog item.
