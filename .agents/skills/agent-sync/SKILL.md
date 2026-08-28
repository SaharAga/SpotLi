---
name: agent-sync
description: Check in on the Codex <-> Claude <-> Antigravity collaboration workflow (docs/AGENT_SYNC.md), read another agent's latest responses/critiques, ground verification in live code AND the working tree, update the action board and sync-state header, and post a reply. Use when the user asks to sync, check, or reply among Codex, Claude, and Antigravity, or asks to coordinate next steps with another agent.
inputs:
  - The other agent's latest response, sync-state header, and open action-board items
  - Local repository ground truth: committed history (git log), the working tree (git status / git diff — uncommitted work from the other agent is real signal, not noise), PROJECT_STATE.md, AGY_TASKS.md, source code
outputs:
  - Grounded answers to the other agent's questions, with file:line citations
  - Updated Collaborative Action Board (IDs, owners, status, priority)
  - Updated Sync State header (see below) so the next reader knows whose turn it is without reading the whole file
  - Concise user briefing
---

# Agent Sync (Codex <-> Claude <-> Antigravity)

Codex, Claude, and Antigravity collaborate **asynchronously** using `docs/AGENT_SYNC.md` and route automatic turns through `docs/AGENT_SYNC_STATE.json`. Each agent must use its exact identity; Codex must never write itself as Claude. The skill is symmetric: the active agent reads the addressed message, verifies it, replies, and routes the next turn to one specific recipient. Sahar remains the escalation owner.

## Why this exists (read before skipping steps)

The two failure modes seen in practice:
1. **Silence is ambiguous.** If the doc hasn't changed since your last write, that could mean "the other agent hasn't been invoked yet" or "the other agent looked and had nothing to add." Without an explicit marker, every check requires re-reading the entire file to be sure nothing was missed — and it's still ambiguous. Fix: **always** update the Sync State header (below) on every write, so a glance answers "is anything waiting on me."
2. **Work happens outside the doc.** An agent can make real progress (edit files, add a hook, half-finish a fix) without ever writing a line in `AGENT_SYNC.md`. Checking only the doc's text will miss it entirely. Fix: **always** check `git status --short` and `git diff` for uncommitted changes, not just `git log`/`git fetch` for committed ones, before concluding "no update from the other agent."

## Sync State header (required, keep at the top of the doc)

Every write to `docs/AGENT_SYNC.md` must update this block:

```markdown
## 🔄 Sync State
- **Awaiting response from:** <Codex | Claude | Antigravity | Sahar | nobody — all clear>
- **Last updated by:** <Codex | Claude | Antigravity> — <ISO-ish timestamp>
- **Open blockers:** <SYNC-IDs that are 🔴/⏳ and need a specific person to act, or "none">
```

This is the first thing to read and the last thing to write. If you're updating the doc and the answer to "who's blocked next" changed, update this block — don't leave a stale "awaiting X" after X has already been answered.

## Protocol & Procedure

1. **Ground truth first, doc second:**
   - `git fetch origin` — check for new commits/branches from the other agent.
   - `git status --short` and `git diff` — check the working tree for uncommitted changes from the other agent. Uncommitted work is real progress; treat it as a reply even if no text was written to the doc, and say so explicitly when you note it ("found uncommitted X, no doc entry — verifying directly").
   - Read the Sync State header, then the latest entries in `docs/AGENT_SYNC.md`.

2. **Verify claims against ground truth — never take a status label at face value:**
   - A task marked "Done" in the action board, in `AGY_TASKS.md`, or in `PROJECT_STATE.md` must be spot-checked against the actual source before you rely on it or repeat the claim. Cite what you checked (file:line, a command you ran, a test you executed).
   - If a claim doesn't hold up, say so plainly and correct the board entry — don't quietly go along with a stale status.

3. **Formulate your response:**
   - Answer the other agent's open questions directly, with file:line citations, not general advice.
   - Update the **Collaborative Action Board**: every row needs an ID, a real owner (not "TBD" once anyone is actually assigned), a status (✅ Done / 🔄 In Discussion / ⏳ Pending / 🔴 Blocked), and a priority.
   - If you're opening a new question that needs the other agent's input, mark it clearly as a question in your entry (not just a status update) so it isn't missed on the next pass — and reflect it in the Sync State header's "Awaiting response from."
   - If you're closing out a question that was asked of you, say so explicitly (don't just let it go silently unanswered) — the other side needs to see it was actually addressed, not just that time passed.

4. **Update the Sync State header** to reflect the new state after your write.

5. **Summarize for the user:** 3-5 sentences — what changed, what's now blocked on whom, and any explicit go/no-go decision you need from the human before proceeding (especially anything destructive: force-push, history rewrite, deleting data, revoking credentials).
