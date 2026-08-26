import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./firebase', () => ({
  db: null,
  isFirebaseConfigured: false
}));

import * as feedbackService from './feedbackService';

const {
  validateAndSanitizeFeedback,
  submitFeedback,
  flushOfflineFeedbackQueue,
  getOfflineFeedbackCount,
  getLocalFeedbackHistory,
  mergeFeedbackSources,
  OFFLINE_FEEDBACK_QUEUE_KEY,
} = feedbackService;

describe('FeedbackService Unit & Resilience Test Suite', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    vi.restoreAllMocks();

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => mockStorage[key] || null),
      setItem: vi.fn((key, value) => {
        mockStorage[key] = String(value);
      }),
      removeItem: vi.fn((key) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      })
    });
  });

  describe('screenshot attachments', () => {
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

    it('keeps a valid image data URL on the payload', () => {
      const result = validateAndSanitizeFeedback({ message: 'bug', screenshot: validPng });
      expect(result.screenshot).toBe(validPng);
    });

    it('omits the field entirely when no screenshot is supplied', () => {
      const result = validateAndSanitizeFeedback({ message: 'bug' });
      expect('screenshot' in result).toBe(false);
    });

    it('drops non-image and non-data-URL values instead of throwing', () => {
      for (const bad of ['https://evil.example/x.png', 'data:text/html;base64,PHNjcmlwdD4=', 'nope', '', 42, {}, null]) {
        const result = validateAndSanitizeFeedback({ message: 'bug', screenshot: bad });
        expect('screenshot' in result).toBe(false);
      }
    });

    it('drops an oversized screenshot rather than losing the written feedback', () => {
      const huge = `data:image/png;base64,${'A'.repeat(800_000)}`;
      const result = validateAndSanitizeFeedback({ message: 'still here', screenshot: huge });
      expect('screenshot' in result).toBe(false);
      expect(result.message).toBe('still here');
    });

    it('survives submitFeedback without being mangled by PII redaction', async () => {
      // redactPII would otherwise rewrite digit runs inside the base64 payload.
      const digitHeavy = `data:image/jpeg;base64,${'0123456789'.repeat(40)}`;
      const result = await submitFeedback({ message: 'see screenshot', screenshot: digitHeavy });
      expect(result.feedback.screenshot).toBe(digitHeavy);
    });
  });

  describe('mergeFeedbackSources', () => {
    it('returns items newest-first across both sources', () => {
      const merged = mergeFeedbackSources(
        [{ id: 'c1', timestamp: '2026-08-20T10:00:00.000Z' }],
        [{ id: 'l1', timestamp: '2026-08-22T10:00:00.000Z' }]
      );
      expect(merged.map(i => i.id)).toEqual(['l1', 'c1']);
    });

    it('dedupes by id and lets the cloud copy win', () => {
      const merged = mergeFeedbackSources(
        [{ id: 'same', message: 'from cloud', timestamp: '2026-08-22T10:00:00.000Z' }],
        [{ id: 'same', message: 'stale local', timestamp: '2026-08-22T10:00:00.000Z' }]
      );
      expect(merged).toHaveLength(1);
      expect(merged[0].message).toBe('from cloud');
      expect(merged[0].source).toBe('cloud');
    });

    it('tags each item with its originating source', () => {
      const merged = mergeFeedbackSources(
        [{ id: 'c1', timestamp: '2026-08-21T10:00:00.000Z' }],
        [{ id: 'l1', timestamp: '2026-08-20T10:00:00.000Z' }]
      );
      expect(merged.find(i => i.id === 'c1').source).toBe('cloud');
      expect(merged.find(i => i.id === 'l1').source).toBe('local');
    });

    it('tolerates empty, nullish, and non-array inputs', () => {
      expect(mergeFeedbackSources([], [])).toEqual([]);
      expect(mergeFeedbackSources(null, undefined)).toEqual([]);
      expect(mergeFeedbackSources('nope', 42)).toEqual([]);
    });

    it('skips entries without an id rather than throwing', () => {
      const merged = mergeFeedbackSources(
        [{ timestamp: '2026-08-22T10:00:00.000Z' }],
        [{ id: 'l1', timestamp: '2026-08-21T10:00:00.000Z' }]
      );
      expect(merged.map(i => i.id)).toEqual(['l1']);
    });

    it('does not throw when timestamps are missing', () => {
      const merged = mergeFeedbackSources([{ id: 'a' }], [{ id: 'b' }]);
      expect(merged).toHaveLength(2);
    });
  });

  describe('validateAndSanitizeFeedback', () => {
    it('throws on nullish or invalid input payloads', () => {
      expect(() => validateAndSanitizeFeedback(null)).toThrow();
      expect(() => validateAndSanitizeFeedback(undefined)).toThrow();
      expect(() => validateAndSanitizeFeedback('not-an-object')).toThrow();
      expect(() => validateAndSanitizeFeedback([])).toThrow();
    });

    it('throws if message is empty or whitespace-only', () => {
      expect(() => validateAndSanitizeFeedback({ message: '' })).toThrow();
      expect(() => validateAndSanitizeFeedback({ message: '   ' })).toThrow();
    });

    it('sanitizes XSS payloads and script tags from feedback message', () => {
      const result = validateAndSanitizeFeedback({
        message: 'Broken UI <script>alert("hacked")</script> on package card',
        rating: 4
      });

      expect(result.message).not.toContain('<script>');
      expect(result.message).not.toContain('alert');
      expect(result.message).toContain('Broken UI');
    });

    it('redacts sensitive PII like Israeli phone numbers and email addresses', () => {
      const result = validateAndSanitizeFeedback({
        message: 'Contact me at 054-1234567 or user@example.com for driver details',
        rating: 5
      });

      expect(result.message).not.toContain('054-1234567');
      expect(result.message).not.toContain('user@example.com');
      expect(result.message).toContain('[REDACTED_PERSONAL_INFO]');
    });

    it('validates rating within 1-5 range and defaults invalid values to 5', () => {
      const low = validateAndSanitizeFeedback({ message: 'Low rating test', rating: -2 });
      expect(low.rating).toBe(5);

      const validHigh = validateAndSanitizeFeedback({ message: 'High rating test', rating: 5 });
      expect(validHigh.rating).toBe(5);

      const invalidType = validateAndSanitizeFeedback({ message: 'Unknown type', type: 'exploit_type' });
      expect(invalidType.type).toBe('bug');

      const featureType = validateAndSanitizeFeedback({ message: 'New feature', type: 'feature' });
      expect(featureType.type).toBe('feature');

      const praiseType = validateAndSanitizeFeedback({ message: 'Awesome app', type: 'praise' });
      expect(praiseType.type).toBe('praise');
    });
  });

  describe('submitFeedback & Offline Queueing', () => {
    it('successfully queues and records offline feedback when Firestore is offline', async () => {
      vi.stubGlobal('navigator', { onLine: false });

      const submission = await submitFeedback({
        type: 'bug',
        message: 'Bluetooth receipt printer disconnects during package handover',
        rating: 3,
        user: 'Driver #42'
      });

      expect(submission.success).toBe(true);
      expect(getOfflineFeedbackCount()).toBe(1);
      
      const localHistory = getLocalFeedbackHistory();
      expect(localHistory.length).toBe(1);
      expect(localHistory[0].message).toContain('Bluetooth receipt printer');
    });

    it('handles offline state properly and enqueues payload', async () => {
      vi.stubGlobal('navigator', { onLine: false });

      const submission = await submitFeedback({
        type: 'feature',
        message: 'Add dark mode toggle to navigation drawer',
        rating: 5
      });

      expect(submission.success).toBe(true);
      expect(submission.syncedToCloud).toBe(false);
      expect(getOfflineFeedbackCount()).toBe(1);
    });

    it('retains queued items if still offline during flush', async () => {
      const initialQueue = [
        {
          id: 'fb-test-1',
          status: 'pending',
          type: 'bug',
          message: 'Item while offline',
          rating: 2,
          timestamp: new Date().toISOString()
        }
      ];
      mockStorage[OFFLINE_FEEDBACK_QUEUE_KEY] = JSON.stringify(initialQueue);
      vi.stubGlobal('navigator', { onLine: false });

      const flushResult = await flushOfflineFeedbackQueue();
      expect(flushResult.flushed).toBe(0);
      expect(flushResult.remaining).toBe(1);
      expect(getOfflineFeedbackCount()).toBe(1);
    });
  });
  describe('offline backlog flush', () => {
    const buildQueue = (n) => Array.from({ length: n }, (_, i) => ({
      id: `fb-batch-${i}`,
      status: 'pending',
      type: 'bug',
      message: `Queued item ${i}`,
      rating: 3,
      timestamp: new Date(2026, 0, 1, 0, i).toISOString()
    }));

    it('writes the local history once for the whole batch, not once per item', async () => {
      const queue = buildQueue(25);
      mockStorage[OFFLINE_FEEDBACK_QUEUE_KEY] = JSON.stringify(queue);
      vi.stubGlobal('navigator', { onLine: true });

      const result = await flushOfflineFeedbackQueue();
      expect(result.flushed).toBe(25);
      expect(result.remaining).toBe(0);

      const historyWrites = localStorage.setItem.mock.calls.filter(
        ([key]) => key === feedbackService.LOCAL_FEEDBACK_HISTORY_KEY
      );
      expect(historyWrites).toHaveLength(1);
    });

    it('produces the same history order the per-item loop produced', async () => {
      const queue = buildQueue(3);
      mockStorage[OFFLINE_FEEDBACK_QUEUE_KEY] = JSON.stringify(queue);
      vi.stubGlobal('navigator', { onLine: true });

      await flushOfflineFeedbackQueue();

      const history = getLocalFeedbackHistory();
      // Each item was unshifted in queue order, so the last queued item ends up first.
      expect(history.map(item => item.id)).toEqual(['fb-batch-2', 'fb-batch-1', 'fb-batch-0']);
      expect(history.every(item => item.syncedToCloud === true)).toBe(true);
    });

    it('replaces an existing history entry in place rather than duplicating it', async () => {
      mockStorage[feedbackService.LOCAL_FEEDBACK_HISTORY_KEY] = JSON.stringify([
        { id: 'fb-batch-0', message: 'stale', syncedToCloud: false }
      ]);
      mockStorage[OFFLINE_FEEDBACK_QUEUE_KEY] = JSON.stringify(buildQueue(2));
      vi.stubGlobal('navigator', { onLine: true });

      await flushOfflineFeedbackQueue();

      const history = getLocalFeedbackHistory();
      expect(history.filter(item => item.id === 'fb-batch-0')).toHaveLength(1);
      expect(history.find(item => item.id === 'fb-batch-0').syncedToCloud).toBe(true);
    });

    it('caps the history at its maximum after a large drain', async () => {
      mockStorage[OFFLINE_FEEDBACK_QUEUE_KEY] = JSON.stringify(buildQueue(80));
      vi.stubGlobal('navigator', { onLine: true });

      await flushOfflineFeedbackQueue();

      expect(getLocalFeedbackHistory()).toHaveLength(50);
    });
  });
  describe('bounded upload concurrency', () => {
    const { mapWithConcurrency, FLUSH_CONCURRENCY } = feedbackService;

    it('overlaps work but never exceeds the bound', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      const items = Array.from({ length: 20 }, (_, i) => i);

      const results = await mapWithConcurrency(items, FLUSH_CONCURRENCY, async (item) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return item * 2;
      });

      // The serial loop this replaces never had more than one in flight; firing
      // all 20 at once would make uploadToFirestore's single 2.5s budget cover
      // the whole queue and push every payload's bytes out in one tick.
      expect(maxInFlight).toBeGreaterThan(1);
      expect(maxInFlight).toBe(FLUSH_CONCURRENCY);
      expect(FLUSH_CONCURRENCY).toBeLessThan(items.length);
      expect(results).toHaveLength(20);
      expect(results.map(r => r.value)).toEqual(items.map(i => i * 2));
    });

    it('keeps results in input order regardless of completion order', async () => {
      const items = [30, 10, 20];
      const results = await mapWithConcurrency(items, 3, async (delay) => {
        await new Promise((resolve) => setTimeout(resolve, delay / 10));
        return delay;
      });
      expect(results.map(r => r.value)).toEqual([30, 10, 20]);
    });

    it('isolates a rejection instead of abandoning the rest', async () => {
      const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      });
      expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
      expect(results[1].reason).toBeInstanceOf(Error);
      expect(results[2].value).toBe(3);
    });

    it('handles an empty input without hanging', async () => {
      await expect(mapWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
    });
  });

  describe('validateScreenshot format tolerance', () => {
    it('accepts standard base64 png, jpeg, jpg, and webp images', () => {
      expect(feedbackService.validateScreenshot('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
      expect(feedbackService.validateScreenshot('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
      expect(feedbackService.validateScreenshot('data:image/jpg;base64,/9j/4AAQSkZJRg==')).toBe('data:image/jpg;base64,/9j/4AAQSkZJRg==');
      expect(feedbackService.validateScreenshot('data:image/webp;base64,UklGRg==')).toBe('data:image/webp;base64,UklGRg==');
      expect(feedbackService.validateScreenshot('  data:image/png;base64,iVBORw0KGgo=  ')).toBe('data:image/png;base64,iVBORw0KGgo=');
    });

    it('rejects invalid MIME types and non-data URLs', () => {
      expect(feedbackService.validateScreenshot('data:text/plain;base64,SGVsbG8=')).toBeNull();
      expect(feedbackService.validateScreenshot('https://example.com/image.png')).toBeNull();
      expect(feedbackService.validateScreenshot(null)).toBeNull();
      expect(feedbackService.validateScreenshot(12345)).toBeNull();
    });
  });

  describe('computeFeedbackAnalytics', () => {
    it('returns empty schema when given empty or invalid input', () => {
      const stats = feedbackService.computeFeedbackAnalytics([]);
      expect(stats.total).toBe(0);
      expect(stats.bugCount).toBe(0);
      expect(stats.featureCount).toBe(0);
      expect(stats.praiseCount).toBe(0);
      expect(stats.averageRating).toBe(0);
      expect(stats.weeklyTrends).toEqual([]);
      expect(stats.versionTrends).toEqual([]);
    });

    it('computes aggregated counts, ratings, and breakdowns accurately', () => {
      const feedbacks = [
        { id: '1', type: 'bug', rating: 3, appVersion: '0.15.0', timestamp: '2026-08-01T12:00:00Z' },
        { id: '2', type: 'bug', rating: 2, appVersion: '0.15.0', timestamp: '2026-08-02T12:00:00Z' },
        { id: '3', type: 'feature', rating: 5, appVersion: '0.16.0', timestamp: '2026-08-10T12:00:00Z' },
        { id: '4', type: 'praise', rating: 5, appVersion: '0.16.0', timestamp: '2026-08-11T12:00:00Z' }
      ];

      const stats = feedbackService.computeFeedbackAnalytics(feedbacks);
      expect(stats.total).toBe(4);
      expect(stats.bugCount).toBe(2);
      expect(stats.featureCount).toBe(1);
      expect(stats.praiseCount).toBe(1);
      expect(stats.averageRating).toBe(3.8); // (3+2+5+5)/4 = 3.75 -> 3.8
      expect(stats.ratingDistribution[5]).toBe(2);
      expect(stats.ratingDistribution[3]).toBe(1);
      expect(stats.ratingDistribution[2]).toBe(1);

      // Version trends
      expect(stats.versionTrends).toHaveLength(2);
      const v15 = stats.versionTrends.find(v => v.version === '0.15.0');
      const v16 = stats.versionTrends.find(v => v.version === '0.16.0');
      expect(v15.bug).toBe(2);
      expect(v15.avgRating).toBe(2.5);
      expect(v16.bug).toBe(0);
      expect(v16.feature).toBe(1);
      expect(v16.praise).toBe(1);
      expect(v16.avgRating).toBe(5);
    });
  });
});
