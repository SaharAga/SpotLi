import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('./agent-sync-channel.mjs', import.meta.url));

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'agent-sync-channel-'));
  return join(directory, 'state.json');
}

function run(state, ...args) {
  const output = execFileSync(process.execPath, [CLI, ...args, '--state', state], { encoding: 'utf8' });
  return JSON.parse(output);
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('agent-sync-channel', () => {
  it('enforces one outstanding turn and supports acknowledgement', () => {
    const statePath = fixture();
    run(statePath, 'init', '--max-turns', '4', '--ttl-minutes', '5');
    const sent = run(statePath, 'send', '--from', 'Codex', '--to', 'Antigravity', '--entry', 'SYNC-10');

    assert.equal(sent.status, 'waiting');
    assert.equal(sent.sequence, 1);
    assert.equal(sent.recipient, 'Antigravity');
    assert.throws(() => run(statePath, 'send', '--from', 'Codex', '--to', 'Antigravity', '--entry', 'SYNC-11'));

    const acknowledged = run(statePath, 'ack', '--by', 'Antigravity');
    assert.equal(acknowledged.status, 'idle');
    assert.equal(acknowledged.requiresResponse, false);
  });

  it('keeps Codex and Claude as distinct routable agents', () => {
    const statePath = fixture();
    run(statePath, 'init');
    const sent = run(statePath, 'send', '--from', 'Claude', '--to', 'Codex', '--entry', 'SYNC-CLAUDE-1');

    assert.equal(sent.sender, 'Claude');
    assert.equal(sent.recipient, 'Codex');
  });

  it('wakes the addressed watcher after an atomic state update', async () => {
    const statePath = fixture();
    run(statePath, 'init', '--ttl-minutes', '5');
    const child = spawn(process.execPath, [
      CLI, 'watch', '--recipient', 'Claude', '--idle-timeout-seconds', '5', '--state', statePath
    ]);
    const exitPromise = waitForExit(child);

    await new Promise((resolve) => setTimeout(resolve, 100));
    run(statePath, 'send', '--from', 'Antigravity', '--to', 'Claude', '--entry', 'SYNC-12');
    const result = await exitPromise;

    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).type, 'message');
  });

  it('stops watchers on pause and records an explicit reason', () => {
    const statePath = fixture();
    run(statePath, 'init');
    const paused = run(statePath, 'pause', '--by', 'Sahar', '--reason', 'not needed');

    assert.equal(paused.enabled, false);
    assert.equal(paused.status, 'paused');
    assert.match(paused.stopReason, /not needed/);
    assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).status, 'paused');

    try {
      execFileSync(process.execPath, [CLI, 'watch', '--recipient', 'Claude', '--state', statePath], { encoding: 'utf8' });
      throw new Error('expected watcher to exit non-zero');
    } catch (error) {
      assert.equal(error.status, 3);
      assert.equal(JSON.parse(error.stdout).type, 'paused');
    }
  });
});
