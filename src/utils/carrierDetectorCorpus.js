/**
 * Deterministic characterization corpus for `detectCarrier`.
 *
 * This corpus exists to lock carrier-detection behaviour in place. It mixes
 * real examples taken from the existing test suite and the mock dataset with a
 * systematic sweep over digit lengths, prefixes and country suffixes, so that
 * ordering/priority/checksum decisions are all exercised.
 *
 * Consumed by carrierDetector.characterization.test.js together with the
 * committed snapshot in __fixtures__/carrierDetection.snapshot.json.
 */

import { CARRIER_LIST } from '../types/carriers.js';

const REAL_EXAMPLES = [
  // Israel Post / UPU S10
  'RS123456789IL', 'RS948219481IL', 'RS948219483IL', 'RS777777777IL',
  'RR123456789IL', 'CP123456789IL', 'EA123456789US', 'EE123456789US',
  'RN123456789GB', 'RM123456789GB', 'LZ123456789CN', 'RB123456789CN',
  'XX123456789XX', 'AB12345678IL', '1234567890123IL', 'ABCDEFGIL',
  // Israeli couriers
  'CH10849201', 'CT99482019', 'CHT10029482', 'CH1084920123456',
  'BOX920194', 'BX1084920', 'BOXABC123', 'BOX12345',
  'HFD90481029', 'EP10849201', '512345678', '5123456789',
  'TPZ84920194', 'YDM8492019', '712345678',
  'CRG9104821', 'CARGO123456', 'GP94820194', 'GET12345678',
  'FC84920194', '4123456789', 'OR94820194', 'ORN12345678',
  'BAR1094821', '912345678', 'ZZ9482019', 'ZIG123456',
  // Global
  'LP00582910482CN', 'CAINIAO123456789', 'AE109482019482', 'CN12345678901',
  'YT2109849201948201', 'YT210984920194820123',
  '4PX30004928194', 'FPX30004928194',
  '1Z999AA10123456784', '1Z9999999999999999',
  '9400100000000000000000', '9205590164917312345612',
  '920559016491731234561',
  // Checksum-PASSING inputs.
  '9400100000000000000006', '9205590164917312345615',
  'RN123456785GB',
  'UY894729184YP', 'VR123456789YP', 'LP12345678901234YP', 'ABCDEFGHYP',
  '3094829104', '4829104821', 'JJD018492019482019', 'GM1029384756102938',
  '794820194821', '784920194821', '123456789012345',
  // Formatting / noise variants
  '1Z 999 999 99 9999 9999', 'rs123456789il', ' RS123456789IL ',
  'RS-948-219-481-IL', 'YT_2109849201948201',
  // Non-matching / adversarial
  '', '   ', 'NON_EXISTENT', 'UNKNOWN_XYZ_999', 'TRACK12345678',
  '!!!', '0', 'A', 'AB', '#$%^&*', 'ABCDEFGHIJKLMNOP'
];

/** Systematic sweep: every digit length 1..24 for each leading digit 0..9. */
function digitSweep() {
  const out = [];
  for (let lead = 0; lead <= 9; lead++) {
    for (let len = 1; len <= 24; len++) {
      out.push(String(lead) + '1234567890123456789012345'.slice(0, len - 1));
    }
  }
  return out;
}

/** Systematic sweep: two-letter prefixes with digits and country suffixes. */
function alphaSweep() {
  const prefixes = ['AA', 'CH', 'CT', 'EP', 'GP', 'OR', 'ZZ', 'YT', 'LP', 'CN', 'AE', 'BX', 'FC', 'UY', 'VR', 'RS'];
  const suffixes = ['', 'IL', 'GB', 'US', 'CN', 'YP', 'XX'];
  const out = [];
  for (const p of prefixes) {
    for (const digits of ['12345678', '123456789', '1234567890', '123456789012345678']) {
      for (const s of suffixes) out.push(p + digits + s);
    }
  }
  return out;
}

/** Every documented per-carrier sample, plus a lowercase variant of each. */
function carrierSamples() {
  const out = [];
  for (const c of CARRIER_LIST) {
    if (!c.sample) continue;
    out.push(c.sample, c.sample.toLowerCase());
  }
  return out;
}

/** @type {string[]} de-duplicated, order-stable corpus */
export const DETECTION_CORPUS = Array.from(
  new Set([...REAL_EXAMPLES, ...carrierSamples(), ...digitSweep(), ...alphaSweep()])
);
