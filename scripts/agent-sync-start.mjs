#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const PID_FILE = resolve('.agent-sync-watchers.json');
const VALID_AGENTS = ['Codex', 'Claude', 'Antigravity', 'all'];

function parseArgs(argv) {
  const options = { agent: 'all', ttlMinutes: 240, maxTurns: 12 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--agent' && argv[i + 1]) options.agent = argv[++i];
    else if (arg === '--ttl-minutes' && argv[i + 1]) options.ttlMinutes = Number(argv[++i]);
    else if (arg === '--max-turns' && argv[i + 1]) options.maxTurns = Number(argv[++i]);
    else if (arg === '--help') {
      console.log(`Usage: node scripts/agent-sync-start.mjs [options]
Options:
  --agent <Codex|Claude|Antigravity|all>   Target agent monitor to start (default: all)
  --ttl-minutes <number>                  Session TTL in minutes (default: 240)
  --max-turns <number>                    Safety max turns cap (default: 12)
  --help                                  Show this help message`);
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

function saveRunningWatchers(watchers) {
  writeFileSync(PID_FILE, JSON.stringify(watchers, null, 2), 'utf8');
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function initChannel(ttlMinutes, maxTurns) {
  const initCmd = spawn('node', [
    'scripts/agent-sync-channel.mjs',
    'init',
    '--force',
    '--ttl-minutes',
    String(ttlMinutes),
    '--max-turns',
    String(maxTurns)
  ], { stdio: 'inherit' });

  return new Promise((resolvePromise) => {
    initCmd.on('exit', (code) => {
      if (code === 0) {
        console.log(`[AgentSync] Channel initialized (TTL: ${ttlMinutes}m, MaxTurns: ${maxTurns})`);
      }
      resolvePromise(code === 0);
    });
  });
}

function startWatcher(agentName, watchers) {
  if (watchers[agentName] && isProcessAlive(watchers[agentName])) {
    console.log(`[AgentSync] Watcher for ${agentName} is already running (PID: ${watchers[agentName]}).`);
    return;
  }

  const logDir = resolve('.agent-sync-logs');
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  const child = spawn('node', [
    'scripts/agent-sync-channel.mjs',
    'watch',
    '--recipient',
    agentName,
    '--idle-timeout-seconds',
    '14400'
  ], {
    detached: true,
    stdio: 'ignore'
  });

  child.unref();
  watchers[agentName] = child.pid;
  console.log(`[AgentSync] Started background watcher for ${agentName} (PID: ${child.pid}).`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  
  if (!VALID_AGENTS.includes(options.agent)) {
    console.error(`Invalid agent: ${options.agent}. Choose from: ${VALID_AGENTS.join(', ')}`);
    process.exit(1);
  }

  await initChannel(options.ttlMinutes, options.maxTurns);

  const watchers = loadRunningWatchers();
  const agentsToStart = options.agent === 'all' 
    ? ['Codex', 'Claude', 'Antigravity'] 
    : [options.agent];

  for (const agent of agentsToStart) {
    startWatcher(agent, watchers);
  }

  saveRunningWatchers(watchers);
  console.log('[AgentSync] All requested agent sync watchers active.');
}

main();
