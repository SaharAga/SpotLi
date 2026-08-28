import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Carrier Specs Parity and Invariants', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const srcSpecPath = path.join(rootDir, 'src/types/carrierSpecs.generated.json');
  const functionsSpecPath = path.join(rootDir, 'functions/src/carrierSpecs.generated.json');

  it('both generated spec files exist and are non-empty', () => {
    expect(fs.existsSync(srcSpecPath)).toBe(true);
    expect(fs.existsSync(functionsSpecPath)).toBe(true);

    const srcContent = fs.readFileSync(srcSpecPath, 'utf-8');
    const functionsContent = fs.readFileSync(functionsSpecPath, 'utf-8');

    expect(srcContent.length).toBeGreaterThan(100);
    expect(functionsContent.length).toBeGreaterThan(100);
  });

  it('both generated spec files have exact SHA-256 parity', () => {
    const srcContent = fs.readFileSync(srcSpecPath, 'utf-8');
    const functionsContent = fs.readFileSync(functionsSpecPath, 'utf-8');

    const srcHash = crypto.createHash('sha256').update(srcContent).digest('hex');
    const functionsHash = crypto.createHash('sha256').update(functionsContent).digest('hex');

    expect(srcHash).toBe(functionsHash);
  });

  it('contains valid carriers, rules, and canonical checksum types', () => {
    const spec = JSON.parse(fs.readFileSync(functionsSpecPath, 'utf-8'));
    expect(spec.version).toBe('2.0.0');
    expect(typeof spec.carriers).toBe('object');
    expect(Array.isArray(spec.rules)).toBe(true);
    expect(spec.rules.length).toBeGreaterThan(10);

    const validChecksums = new Set(['upu-s10', 'mod10-31', 'not-applicable']);

    for (const rule of spec.rules) {
      expect(typeof rule.carrierId).toBe('string');
      expect(typeof rule.source).toBe('string');
      expect(validChecksums.has(rule.checksum)).toBe(true);
      expect(typeof rule.priority).toBe('number');
      // Verify RegExp can be reconstructed without syntax errors
      expect(() => new RegExp(rule.source, rule.flags)).not.toThrow();
    }
  });
});
