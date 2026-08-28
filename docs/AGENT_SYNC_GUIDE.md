# Quick Guide: Multi-Agent Sync Channel (Codex ↔ Claude ↔ Antigravity)

This guide provides simple, single-command operations for starting, monitoring, and stopping multi-agent collaboration across **Codex**, **Claude Code**, and **Antigravity**.

---

## 1. Quick Operator Commands (For Sahar)

| Action | Command | What it does |
| :--- | :--- | :--- |
| **Start All Monitors** | `npm run sync:start` | Initializes the channel (TTL 4h, max 12 turns) and starts background watchers for Codex, Claude, and Antigravity. |
| **Start Specific Agent** | `node scripts/agent-sync-start.mjs --agent Antigravity` | Starts the watcher monitor only for a specific agent. |
| **Check Channel Status** | `npm run sync:status` | Displays who holds the current turn, active message ID, and remaining TTL. |
| **Pause Sync** | `npm run sync:stop` | Safely stops background watchers and marks channel state as paused. |
| **Close Sync Permanently** | `node scripts/agent-sync-stop.mjs --close --reason "Sprint complete"` | Closes the channel permanently. |

---

## 2. How the Channel Operates

```
[Agent Writes Entry in docs/AGENT_SYNC.md] 
       │
       ▼
[Agent Runs: node scripts/agent-sync-channel.mjs send --from X --to Y --entry SYNC-N]
       │
       ▼
[docs/AGENT_SYNC_STATE.json updated atomically]
       │
       ▼
[Background Watcher for Y wakes up with Exit Code 0]
       │
       ▼
[Y's environment invokes Agent Y with the agent-sync skill]
       │
       ▼
[Y runs: node scripts/agent-sync-channel.mjs ack --by Y]
```

---

## 3. How Each Agent Interprets the Channel

### For Antigravity:
- When activated, Antigravity uses the `agent-sync` skill ([SKILL.md](file:///.agents/skills/agent-sync/SKILL.md)).
- Inspects `docs/AGENT_SYNC_STATE.json` and `docs/AGENT_SYNC.md`.
- Acknowledges turn: `node scripts/agent-sync-channel.mjs ack --by Antigravity`.
- Gathers ground truth (`git status`, `git diff`, code files), formulates reply in `docs/AGENT_SYNC.md`, and sends response:
  ```bash
  node scripts/agent-sync-channel.mjs send --from Antigravity --to Codex --entry SYNC-N --summary "..."
  ```

### For Claude Code:
- Wakes upon watcher exit code `0` (`--recipient Claude`).
- Acknowledges turn: `node scripts/agent-sync-channel.mjs ack --by Claude`.
- Replies in `docs/AGENT_SYNC.md` and routes turn to Antigravity or Codex.

### For Codex:
- Wakes upon watcher exit code `0` (`--recipient Codex`).
- Acknowledges turn: `node scripts/agent-sync-channel.mjs ack --by Codex`.
- Replies in `docs/AGENT_SYNC.md` and routes turn to Antigravity or Claude.

---

## 4. Operational Safety Guards
- **No Token Consumption While Idle**: Watchers sleep on OS filesystem events and consume zero model tokens.
- **Safety Turn Cap**: Default cap of 12 turns prevents infinite message ping-pong loops.
- **Auditable Truth**: `docs/AGENT_SYNC.md` remains the permanent, version-controlled conversation record.
