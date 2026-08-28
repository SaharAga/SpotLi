# Automatic Agent Sync Channel

This channel removes the human from ordinary three-way handoffs among Codex, Claude Code, and Antigravity while keeping `docs/AGENT_SYNC.md` as the auditable conversation record. It is deliberately turn-based: only one response can be outstanding, and the state file contains a pointer to the relevant `SYNC-*` entry rather than the full discussion.

Identity names are exact and must not be conflated:

- **Codex** — the OpenAI Codex desktop/CLI agent.
- **Claude** — Claude Code.
- **Antigravity** — the Antigravity agent.
- **Sahar** — the human controller and escalation owner.

## What this does—and does not do

`scripts/agent-sync-channel.mjs` provides a safe shared mailbox and an event-driven, one-shot watcher. A watcher consumes no model tokens and sleeps in the operating system until `docs/AGENT_SYNC_STATE.json` changes.

The utility does not know how to launch Codex or Antigravity. Each environment must connect a successful watcher exit to its own “invoke agent with the agent-sync skill” action. This separation avoids storing executable commands in the shared state and prevents one agent from causing arbitrary shell execution on the other side.

## One-time start

From the repository root, initialize a four-hour session with a twelve-message safety cap:

```bash
node scripts/agent-sync-channel.mjs init --force --max-turns 12 --ttl-minutes 240
```

Start one monitor in each agent environment:

```bash
# Codex side
node scripts/agent-sync-channel.mjs watch --recipient Codex --idle-timeout-seconds 14400

# Claude Code side
node scripts/agent-sync-channel.mjs watch --recipient Claude --idle-timeout-seconds 14400

# Antigravity side
node scripts/agent-sync-channel.mjs watch --recipient Antigravity --idle-timeout-seconds 14400
```

The watcher is intentionally one-shot. When it exits `0`, the environment should invoke its agent with a prompt equivalent to:

> Run the repository agent-sync workflow. Read the message referenced by `docs/AGENT_SYNC_STATE.json`, verify it against the working tree, reply in `docs/AGENT_SYNC.md`, acknowledge the received message, then send the new `SYNC-*` entry to the other agent through the channel. If no response is required, close the channel.

After the agent finishes, the environment starts the watcher again. A platform scheduler, task runner, or short supervisor loop can do that restart; do not restart on paused, closed, or timeout exit codes unless explicitly desired.

## Agent turn protocol

The responding agent first acknowledges the message it consumed:

```bash
node scripts/agent-sync-channel.mjs ack --by Codex
```

After writing and verifying its new entry in `docs/AGENT_SYNC.md`, it sends the pointer to the other side:

```bash
node scripts/agent-sync-channel.mjs send \
  --from Codex \
  --to Antigravity \
  --entry SYNC-7 \
  --summary "Deployment boundary correction requested"
```

Use `--expect-sequence N` when an integration reads the current sequence before writing and wants optimistic concurrency protection.

## Stopping and resource controls

There are four stop mechanisms:

1. **Resolved:** close the conversation permanently. Both watchers exit with code `4`.

   ```bash
   node scripts/agent-sync-channel.mjs close --by Sahar --reason "Plan approved"
   ```

2. **Pause:** stop temporarily while preserving an outstanding message. Both watchers exit with code `3`.

   ```bash
   node scripts/agent-sync-channel.mjs pause --by Sahar --reason "No agent work this week"
   ```

   Resume with a fresh TTL:

   ```bash
   node scripts/agent-sync-channel.mjs resume --by Sahar --ttl-minutes 240
   ```

3. **TTL:** the channel automatically expires after the configured lifetime. A sleeping watcher wakes at expiry and exits with code `4`.

4. **Idle watcher timeout:** an individual watcher exits with code `5` after `--idle-timeout-seconds`. This does not alter shared channel state.

`Ctrl-C` also stops an individual watcher immediately. While a watcher is idle it uses no API/model calls; the only retained resources are one small Node process and one filesystem watch handle. The message cap prevents an accidental endless agent loop.

## Exit-code contract

| Code | Meaning | Supervisor action |
| ---: | --- | --- |
| `0` | Message addressed to this agent | Invoke agent once, then restart watcher after the turn |
| `1` | Invalid state or command error | Stop and inspect stderr |
| `3` | Channel paused | Stop; wait for explicit resume |
| `4` | Channel closed or TTL expired | Stop |
| `5` | Watcher idle timeout | Stop, or restart only if monitoring is still wanted |

## Operational safeguards

- `docs/AGENT_SYNC.md` remains authoritative; the JSON file only routes turns.
- Only `Codex`, `Claude`, `Antigravity`, and `Sahar` are valid actors.
- Only one outstanding message is allowed.
- Writes use a lock file and atomic rename.
- Summaries are capped at 500 characters; sensitive prompts or user data belong nowhere in the routing state.
- The channel never executes commands received from the shared file.
- Human approval remains required for destructive actions, credentials, external communication, and material product decisions.
