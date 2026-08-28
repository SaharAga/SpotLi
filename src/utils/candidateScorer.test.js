import { describe, it, expect } from 'vitest';
import {
  evaluateChecksum,
  calculateLabelProximity,
  detectFalsePositiveFlags,
  checkUrlDomainMatch,
  computeCandidateScore,
  classifyConfidenceTier,
  extractAndScoreCandidates
} from './candidateScorer.js';

describe('candidateScorer Unit Tests', () => {
  describe('evaluateChecksum', () => {
    it('returns pass for valid UPU-S10 tracking numbers', () => {
      // RS948219481IL: 94821948 -> weights [8,6,4,2,3,5,9,7]
      // 9*8 + 4*6 + 8*4 + 2*2 + 1*3 + 9*5 + 4*9 + 8*7 = 72+24+32+4+3+45+36+56 = 272
      // 272 % 11 = 8. 11 - 8 = 3 != 1. (let's check a known valid one)
      // RN123456789GB (12345678 -> 1*8+2*6+3*4+4*2+5*3+6*5+7*9+8*7 = 8+12+12+8+15+30+63+56 = 204. 204%11 = 6. 11-6 = 5 != 9)
      // Let's create a known valid S10:
      // digits: 0 0 0 0 0 0 0 0 -> sum = 0, rem = 0, check = 11 -> 5.
      // So "RR000000005IL" is a valid S10 code!
      expect(evaluateChecksum('RR000000005IL', 'upu-s10')).toBe('pass');
    });

    it('returns fail for invalid UPU-S10 check digit', () => {
      expect(evaluateChecksum('RR000000001IL', 'upu-s10')).toBe('fail');
    });

    it('returns not-applicable for carriers without check digits', () => {
      expect(evaluateChecksum('CH12345678', 'not-applicable')).toBe('not-applicable');
    });
  });

  describe('calculateLabelProximity', () => {
    it('returns high proximity score when keyword is immediately preceding', () => {
      const text = 'מספר מעקב: CH10928491';
      const score = calculateLabelProximity(text, 11, 21);
      expect(score).toBeGreaterThan(0.8);
    });

    it('returns 0 when keyword is absent or far away', () => {
      const text = 'This is a long sentence with lots of arbitrary words without any indicator CH10928491';
      const score = calculateLabelProximity(text, text.indexOf('CH10928491'), text.length);
      expect(score).toBe(0);
    });
  });

  describe('detectFalsePositiveFlags', () => {
    it('detects phone numbers', () => {
      const flags = detectFalsePositiveFlags('0541234567');
      expect(flags).toContain('phone_number');
    });

    it('detects dates and prices', () => {
      expect(detectFalsePositiveFlags('2026-08-28')).toContain('date_or_price');
      expect(detectFalsePositiveFlags('99.90 ₪')).toContain('date_or_price');
    });

    it('detects OTP code when surrounded by verification keywords', () => {
      const text = 'קוד אימות לחשבונך הינו 849201 לתשומת לבך';
      const flags = detectFalsePositiveFlags('849201', text, text.indexOf('849201'), text.indexOf('849201') + 6);
      expect(flags).toContain('otp_code');
    });
  });

  describe('classifyConfidenceTier', () => {
    it('classifies verified for high scoring format match with no checksum failure', () => {
      const cand = { formatMatch: true, checksum: 'pass', falsePositiveFlags: [] };
      expect(classifyConfidenceTier(0.90, cand)).toBe('verified');
    });

    it('demotes to uncertain if false positive flag is present', () => {
      const cand = { formatMatch: true, checksum: 'not-applicable', falsePositiveFlags: ['phone_number'] };
      expect(classifyConfidenceTier(0.50, cand)).toBe('uncertain');
    });
  });

  describe('extractAndScoreCandidates', () => {
    it('extracts and ranks Israel Post tracking candidate correctly', () => {
      const text = 'שלום, החבילה שלך נשלחה! מספר מעקב: RR000000005IL דרך דואר ישראל';
      const candidates = extractAndScoreCandidates(text);

      expect(candidates.length).toBeGreaterThan(0);
      const top = candidates[0];
      expect(top.value).toBe('RR000000005IL');
      expect(top.carrierCandidates).toContain('israel-post');
      expect(top.checksum).toBe('pass');
      expect(top.score).toBeGreaterThanOrEqual(0.85);
    });

    it('penalizes OTP codes and phone numbers in incoming text', () => {
      const text = 'קוד אימות 123456 נשלח למספר 0541234567';
      const candidates = extractAndScoreCandidates(text);

      for (const cand of candidates) {
        expect(cand.score).toBeLessThan(0.65);
      }
    });
  });
});
