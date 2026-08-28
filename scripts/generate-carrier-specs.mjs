#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARRIERS, DETECTION_RULES } from '../src/types/carriers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SRC_OUT = path.join(ROOT_DIR, 'src/types/carrierSpecs.generated.json');
const FUNCTIONS_OUT = path.join(ROOT_DIR, 'functions/src/carrierSpecs.generated.json');

/**
 * Extract hostname/domain from a URL safely.
 * @param {string} [urlString]
 * @returns {string|null}
 */
function extractDomain(urlString) {
  if (!urlString) return null;
  try {
    const url = new URL(urlString);
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Normalize checksum field to canonical spec:
 * 'upu-s10' | 'mod10-31' | 'not-applicable'
 * @param {string|null} checksum
 * @returns {'upu-s10' | 'mod10-31' | 'not-applicable'}
 */
function normalizeChecksum(checksum) {
  if (checksum === 'upu-s10') return 'upu-s10';
  if (checksum === 'mod10-31') return 'mod10-31';
  return 'not-applicable';
}

const carriersExport = {};

for (const [id, carrier] of Object.entries(CARRIERS)) {
  if (id === 'other') continue;

  const domains = new Set();
  const websiteDomain = extractDomain(carrier.website);
  if (websiteDomain) domains.add(websiteDomain);

  if (typeof carrier.getTrackingUrl === 'function') {
    const trackDomain = extractDomain(carrier.getTrackingUrl('SAMPLE123'));
    if (trackDomain) domains.add(trackDomain);
  }

  if (typeof carrier.fallbackTrackingUrl === 'function') {
    const fallbackDomain = extractDomain(carrier.fallbackTrackingUrl('SAMPLE123'));
    if (fallbackDomain && !fallbackDomain.includes('17track.net')) {
      domains.add(fallbackDomain);
    }
  }

  carriersExport[id] = {
    id: carrier.id,
    name: carrier.name,
    hebrewName: carrier.hebrewName,
    website: carrier.website || null,
    country: carrier.country || 'Global',
    domains: Array.from(domains).sort(),
    patterns: (carrier.patterns || []).map((p) => ({
      source: p.re.source,
      flags: p.re.flags,
      confidence: p.confidence || 'medium',
      checksum: normalizeChecksum(p.checksum),
      priority: p.priority ?? 1000
    }))
  };
}

const rulesExport = DETECTION_RULES.map((r) => ({
  carrierId: r.carrier.id,
  source: r.re.source,
  flags: r.re.flags,
  confidence: r.confidence || 'medium',
  checksum: normalizeChecksum(r.checksum),
  priority: r.priority ?? 1000
}));

// We do not include a dynamic timestamp so the generated JSON is deterministic across builds
const spec = {
  version: '2.0.0',
  carriers: carriersExport,
  rules: rulesExport
};

const jsonContent = JSON.stringify(spec, null, 2) + '\n';

// Ensure directories exist
fs.mkdirSync(path.dirname(SRC_OUT), { recursive: true });
fs.mkdirSync(path.dirname(FUNCTIONS_OUT), { recursive: true });

fs.writeFileSync(SRC_OUT, jsonContent, 'utf-8');
fs.writeFileSync(FUNCTIONS_OUT, jsonContent, 'utf-8');

console.log(`[generate-carrier-specs] Successfully generated:\n  - ${SRC_OUT}\n  - ${FUNCTIONS_OUT}`);
