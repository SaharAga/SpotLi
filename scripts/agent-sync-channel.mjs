#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, renameSync, rmSync, watch, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEFAULT_STATE_PATH = resolve('docs/AGENT_SYNC_STATE.json');
const KNOWN_ACTORS = new Set(['Codex', 'Claude', 'Antigravity', 'Sahar']);
const WAIT_EXIT = Object.freeze({ message: 0, paused: 3, closed: 4, timeout: 5 });

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return { command, options };
}

function numberOption(options, key, fallback, minimum = 1) {
  if (options[key] === undefined) return fallback;
  const value = Number(options[key]);
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`--${key} must be a number >= ${minimum}`);
  }
  return value;
}

function statePath(options) {
  return resolve(String(options.state || DEFAULT_STATE_PATH));
}

function readState(path) {
  if (!existsSync(path)) throw new Error(`Channel state does not exist: ${path}. Run init first.`);
  const state = JSON.parse(readFileSync(path, 'utf8'));
  if (state.version !== 1) throw new Error(`Unsupported channel state version: ${state.version}`);
  return state;
}

function writeStateAtomic(path, state) {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporaryPath, path);
}

function withLock(path, operation) {
  const lockPath = `${path}.lock`;
  let descriptor;
  try {
    descriptor = openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Channel is busy: ${lockPath}`);
    throw error;
  }
  try {
    return operation();
  } finally {
    closeSync(descriptor);
    rmSync(lockPath, { force: true });
  }
}

function actor(value, optionName) {
  if (!KNOWN_ACTORS.has(value)) {
    throw new Error(`--${optionName} must be one of: ${[...KNOWN_ACTORS].join(', ')}`);
  }
  return value;
}

function now() {
  return new Date().toISOString();
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function createState(options) {
  const createdAt = now();
  const ttlMinutes = numberOption(options, 'ttl-minutes', 240);
  return {
    version: 1,
    channelId: randomUUID(),
    enabled: true,
    status: 'idle',
    sequence: 0,
    turnCount: 0,
    maxTurns: numberOption(options, 'max-turns', 12),
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
    sender: null,
    recipient: null,
    requiresResponse: false,
    syncEntryId: null,
    summary: null,
    stopReason: null
  };
}

function mutate(options, operation) {
  const path = statePath(options);
  return withLock(path, () => {
    const state = readState(path);
    const expected = options['expect-sequence'];
    if (expected !== undefined && state.sequence !== Number(expected)) {
      throw new Error(`Sequence conflict: expected ${expected}, found ${state.sequence}`);
    }
    const updated = operation(state);
    writeStateAtomic(path, updated);
    return updated;
  });
}

function send(options) {
  const sender = actor(options.from, 'from');
  const recipient = actor(options.to, 'to');
  if (sender === recipient) throw new Error('--from and --to must be different');
  if (!options.entry) throw new Error('--entry is required');

  return mutate(options, (state) => {
    if (!state.enabled || state.status === 'paused' || state.status === 'closed') {
      throw new Error(`Channel is ${state.status}; resume or init it before sending`);
    }
    if (state.status === 'waiting' && state.requiresResponse) {
      throw new Error(`Outstanding message ${state.syncEntryId} is still awaiting ${state.recipient}`);
    }
    if (state.turnCount >= state.maxTurns) {
      return {
        ...state,
        enabled: false,
        status: 'closed',
        updatedAt: now(),
        stopReason: `maximum turn count (${state.maxTurns}) reached`
      };
    }
    return {
      ...state,
      enabled: true,
      status: 'waiting',
      sequence: state.sequence + 1,
      turnCount: state.turnCount + 1,
      updatedAt: now(),
      sender,
      recipient,
      requiresResponse: true,
      syncEntryId: String(options.entry),
      summary: options.summary ? String(options.summary).slice(0, 500) : null,
      stopReason: null
    };
  });
}

function pause(options) {
  const by = actor(options.by, 'by');
  return mutate(options, (state) => ({
    ...state,
    enabled: false,
    status: 'paused',
    updatedAt: now(),
    stopReason: options.reason ? `${by}: ${String(options.reason).slice(0, 300)}` : `${by}: paused`
  }));
}

function resume(options) {
  const by = actor(options.by, 'by');
  const ttlMinutes = numberOption(options, 'ttl-minutes', 240);
  return mutate(options, (state) => ({
    ...state,
    enabled: true,
    status: state.requiresResponse && state.recipient ? 'waiting' : 'idle',
    updatedAt: now(),
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
    stopReason: `${by}: resumed`
  }));
}

function closeChannel(options) {
  const by = actor(options.by, 'by');
  return mutate(options, (state) => ({
    ...state,
    enabled: false,
    status: 'closed',
    updatedAt: now(),
    requiresResponse: false,
    recipient: null,
    stopReason: options.reason ? `${by}: ${String(options.reason).slice(0, 300)}` : `${by}: resolved`
  }));
}

function acknowledge(options) {
  const by = actor(options.by, 'by');
  return mutate(options, (state) => {
    if (state.status !== 'waiting' || state.recipient !== by) {
      throw new Error(`No outstanding message addressed to ${by}`);
    }
    return {
      ...state,
      status: 'idle',
      updatedAt: now(),
      requiresResponse: false,
      recipient: null,
      stopReason: null
    };
  });
}

function waitEvent(state, recipient) {
  if (Date.parse(state.expiresAt) <= Date.now()) {
    return { type: 'closed', reason: 'channel TTL expired', state };
  }
  if (state.status === 'paused') return { type: 'paused', reason: state.stopReason, state };
  if (!state.enabled || state.status === 'closed') return { type: 'closed', reason: state.stopReason, state };
  if (state.status === 'waiting' && state.requiresResponse && state.recipient === recipient) {
    return { type: 'message', state };
  }
  return null;
}

function watchOnce(options) {
  const path = statePath(options);
  const recipient = actor(options.recipient, 'recipient');
  const idleTimeoutSeconds = numberOption(options, 'idle-timeout-seconds', 3600);
  let finished = false;
  let watcher;
  let idleTimer;
  let expiryTimer;

  const finish = (event, exitCode) => {
    if (finished) return;
    finished = true;
    watcher?.close();
    clearTimeout(idleTimer);
    clearTimeout(expiryTimer);
    print(event);
    process.exitCode = exitCode;
  };

  const inspect = () => {
    try {
      const state = readState(path);
      const event = waitEvent(state, recipient);
      if (!event) return;
      finish(event, WAIT_EXIT[event.type]);
    } catch (error) {
      finish({ type: 'error', error: error.message }, 1);
    }
  };

  inspect();
  if (finished) return;
  watcher = watch(dirname(path), (_eventType, filename) => {
    if (filename && resolve(dirname(path), filename.toString()) !== path) return;
    inspect();
  });
  idleTimer = setTimeout(
    () => finish({ type: 'timeout', reason: `idle for ${idleTimeoutSeconds}s` }, WAIT_EXIT.timeout),
    idleTimeoutSeconds * 1000
  );
  const state = readState(path);
  const untilExpiry = Math.max(1, Date.parse(state.expiresAt) - Date.now());
  expiryTimer = setTimeout(inspect, untilExpiry);
}

function help() {
  process.stdout.write(`Agent sync channel\n\nActors:\n  Codex, Claude, Antigravity, Sahar\n\nCommands:\n  init [--max-turns 12] [--ttl-minutes 240] [--force]\n  status\n  send --from Codex --to Antigravity --entry SYNC-6 [--summary text] [--expect-sequence N]\n  ack --by Codex\n  watch --recipient Codex [--idle-timeout-seconds 3600]\n  pause --by Sahar [--reason text]\n  resume --by Sahar [--ttl-minutes 240]\n  close --by Sahar [--reason resolved]\n\nAll commands accept --state PATH. Watch exits 0 for a message, 3 when paused, 4 when closed/expired, and 5 on idle timeout.\n`);
}

function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const path = statePath(options);
  switch (command) {
    case 'init': {
      if (existsSync(path) && !options.force) throw new Error(`State already exists: ${path}. Use --force to replace it.`);
      const state = createState(options);
      writeStateAtomic(path, state);
      print(state);
      break;
    }
    case 'status':
      print(readState(path));
      break;
    case 'send':
      print(send(options));
      break;
    case 'ack':
      print(acknowledge(options));
      break;
    case 'watch':
      watchOnce(options);
      break;
    case 'pause':
      print(pause(options));
      break;
    case 'resume':
      print(resume(options));
      break;
    case 'close':
      print(closeChannel(options));
      break;
    case 'help':
    case '--help':
      help();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`agent-sync-channel: ${error.message}\n`);
  process.exitCode = 1;
}
