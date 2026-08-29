import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('Firestore anonymous telemetry rules contract', () => {
  it('allowlists fields and rejects mutable telemetry documents', () => {
    expect(rules).toContain("request.resource.data.keys().hasOnly([\n          'id', 'status', 'type', 'message', 'rating', 'isAnonymous'");
    expect(rules).toContain("request.resource.data.keys().hasOnly([\n          'id', 'signature', 'componentName', 'message', 'appVersion'");
    expect(rules).toContain("request.resource.data.keys().hasOnly([\n          'source', 'confidence', 'editedFields', 'timestamp'");
    expect(rules).toMatch(/request\.resource\.data\.signature\.size\(\) > 0/);
    expect(rules).toContain("(png|jpe?g|webp|gif)(;[a-z0-9=_-]+)*;base64,");
    expect(rules).toMatch(/request\.resource\.data\.screenWidth is number[\s\S]*?screenWidth <= 10000/);
    expect(rules).toMatch(/request\.resource\.data\.screenHeight is number[\s\S]*?screenHeight <= 10000/);
    expect(rules).toMatch(/request\.resource\.data\.userAgent is string[\s\S]*?userAgent\.size\(\) <= 300/);
    expect(rules).toMatch(/match \/feedback\/\{feedbackId\}[\s\S]*?allow update, delete: if false;/);
    expect(rules).toMatch(/match \/crashReports\/\{crashId\}[\s\S]*?allow update, delete: if false;/);
    expect(rules).toMatch(/match \/parseCorrections\/\{docId\}[\s\S]*?allow update, delete: if false;/);
  });
});
