#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const PID_FILE = resolve('.agent-sync-watchers.json');

function parseArgs(argv) {
  const options = { action: 'pause', reason: 'Operator stopped agent sync', agent: 'all' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--close') options.action = 'close';
    else if (arg === '--pause') options.action = 'pause';
    else if (arg === '--reason' && argv[i + 1]) options.reason = argv[++i];
    else if (arg === '--agent' && argv[i + 1]) options.agent = argv[++i];
    else if (arg === '--help') {
      console.log(`Usage: node scripts/agent-sync-stop.mjs [options]
Options:
  --pause         Pause channel (default)
  --close         Close channel permanently
  --agent <name>  Stop specific agent watcher (default: all)
  --reason <str>  Reason string for state file
  --help          Show this help message`);
      process.exit(0);
    }
  }
  return options;
}

function loadRunningWatchers() {
  if (!existsSync(PID_FILE)) return {};
  try {
    return JSON.parse(readFileSync(PID_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killWatcher(agentName, pid) {
  if (pid && isProcessAlive(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`[AgentSync] Stopped watcher for ${agentName} (PID: ${pid}).`);
    } catch (e) {
      console.warn(`[AgentSync] Could not terminate PID ${pid}: ${e.message}`);
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const watchers = loadRunningWatchers();

  const agentsToStop = options.agent === 'all'
    ? Object.keys(watchers)
    : [options.agent];

  for (const agent of agentsToStop) {
    if (watchers[agent]) {
      killWatcher(agent, watchers[agent]);
      delete watchers[agent];
    }
  }

  if (Object.keys(watchers).length === 0 && existsSync(PID_FILE)) {
    unlinkSync(PID_FILE);
  }

  // Update channel state
  const cmd = options.action === 'close' ? 'close' : 'pause';
  spawnSync('node', [
    'scripts/agent-sync-channel.mjs',
    cmd,
    '--by',
    'Sahar',
    '--reason',
    options.reason
  ], { stdio: 'inherit' });

  console.log(`[AgentSync] Channel state updated to: ${cmd.toUpperCase()}`);
}

main();
