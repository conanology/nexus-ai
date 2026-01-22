/**
 * Notification metrics and logging tests
 *
 * @module notifications/__tests__/metrics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NotificationChannelResult, NotificationMetrics } from '../types.js';

// Mock FirestoreClient
const mockSetDocument = vi.fn().mockResolvedValue(undefined);
const mockGetDocument = vi.fn().mockResolvedValue(null);

vi.mock('@nexus-ai/core/storage', () => ({
  FirestoreClient: vi.fn().mockImplementation(() => ({
    setDocument: mockSetDocument,
    getDocument: mockGetDocument,
  })),
}));

vi.mock('@nexus-ai/core', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mocks are set up
import {
  trackNotificationMetrics,
  logNotificationResults,
  getNotificationHistory,
  getAggregatedMetrics,
  resetMetricsAggregation,
  resetFirestoreClient,
} from '../metrics.js';

describe('Notification Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMetricsAggregation();
    resetFirestoreClient();
  });

  describe('trackNotificationMetrics', () => {
    it('should track successful Discord notification', () => {
      const metrics: NotificationMetrics[] = [
        {
          channel: 'discord',
          sent: true,
          latencyMs: 500,
          attempts: 1,
          timestamp: new Date().toISOString(),
        },
      ];

      trackNotificationMetrics('2026-01-22', metrics);

      const aggregated = getAggregatedMetrics();
      expect(aggregated.discord.sent).toBe(1);
      expect(aggregated.discord.failed).toBe(0);
    });

    it('should track failed email notification', () => {
      const metrics: NotificationMetrics[] = [
        {
          channel: 'email',
          sent: false,
          latencyMs: 2000,
          attempts: 3,
          timestamp: new Date().toISOString(),
        },
      ];

      trackNotificationMetrics('2026-01-22', metrics);

      const aggregated = getAggregatedMetrics();
      expect(aggregated.email.sent).toBe(0);
      expect(aggregated.email.failed).toBe(1);
    });

    it('should track multiple metrics at once', () => {
      const metrics: NotificationMetrics[] = [
        {
          channel: 'discord',
          sent: true,
          latencyMs: 300,
          attempts: 1,
          timestamp: new Date().toISOString(),
        },
        {
          channel: 'email',
          sent: true,
          latencyMs: 1000,
          attempts: 1,
          timestamp: new Date().toISOString(),
        },
      ];

      trackNotificationMetrics('2026-01-22', metrics);

      const aggregated = getAggregatedMetrics();
      expect(aggregated.discord.sent).toBe(1);
      expect(aggregated.email.sent).toBe(1);
    });

    it('should aggregate metrics across multiple calls', () => {
      trackNotificationMetrics('2026-01-21', [
        { channel: 'discord', sent: true, latencyMs: 400, attempts: 1, timestamp: new Date().toISOString() },
      ]);

      trackNotificationMetrics('2026-01-22', [
        { channel: 'discord', sent: true, latencyMs: 600, attempts: 1, timestamp: new Date().toISOString() },
      ]);

      const aggregated = getAggregatedMetrics();
      expect(aggregated.discord.sent).toBe(2);
      expect(aggregated.discord.avgLatencyMs).toBe(500); // (400 + 600) / 2
    });
  });

  describe('logNotificationResults', () => {
    it('should log results to Firestore', async () => {
      const discord: NotificationChannelResult = { sent: true, messageId: 'discord-123' };
      const email: NotificationChannelResult = { sent: true, messageId: 'email-456' };

      await logNotificationResults('2026-01-22', discord, email);

      expect(mockSetDocument).toHaveBeenCalledWith(
        'notifications',
        '2026-01-22',
        expect.objectContaining({
          pipelineId: '2026-01-22',
          discord: expect.objectContaining({ sent: true }),
          email: expect.objectContaining({ sent: true }),
        })
      );
    });

    it('should log failed notifications', async () => {
      const discord: NotificationChannelResult = { sent: false, error: 'Discord error' };
      const email: NotificationChannelResult = { sent: true };

      await logNotificationResults('2026-01-22', discord, email);

      expect(mockSetDocument).toHaveBeenCalledWith(
        'notifications',
        '2026-01-22',
        expect.objectContaining({
          discord: expect.objectContaining({ sent: false, error: 'Discord error' }),
        })
      );
    });

    it('should not throw on Firestore error', async () => {
      mockSetDocument.mockRejectedValueOnce(new Error('Firestore error'));

      const discord: NotificationChannelResult = { sent: true };
      const email: NotificationChannelResult = { sent: true };

      // Should not throw
      await expect(logNotificationResults('2026-01-22', discord, email)).resolves.not.toThrow();
    });
  });

  describe('getNotificationHistory', () => {
    it('should retrieve notification history from Firestore', async () => {
      const mockData = {
        pipelineId: '2026-01-22',
        discord: { sent: true },
        email: { sent: true },
        timestamp: '2026-01-22T14:00:00Z',
        metrics: [],
      };

      mockGetDocument.mockResolvedValueOnce(mockData);

      const history = await getNotificationHistory('2026-01-22');

      expect(history).toEqual(mockData);
      expect(mockGetDocument).toHaveBeenCalledWith('notifications', '2026-01-22');
    });

    it('should return null if document does not exist', async () => {
      mockGetDocument.mockResolvedValueOnce(null);

      const history = await getNotificationHistory('2026-01-22');

      expect(history).toBeNull();
    });

    it('should return null on Firestore error', async () => {
      mockGetDocument.mockRejectedValueOnce(new Error('Firestore error'));

      const history = await getNotificationHistory('2026-01-22');

      expect(history).toBeNull();
    });
  });

  describe('getAggregatedMetrics', () => {
    it('should return zeroes when no metrics tracked', () => {
      const aggregated = getAggregatedMetrics();

      expect(aggregated.discord.sent).toBe(0);
      expect(aggregated.discord.failed).toBe(0);
      expect(aggregated.discord.avgLatencyMs).toBe(0);
      expect(aggregated.email.sent).toBe(0);
      expect(aggregated.email.failed).toBe(0);
      expect(aggregated.email.avgLatencyMs).toBe(0);
    });

    it('should calculate average latency correctly', () => {
      trackNotificationMetrics('2026-01-21', [
        { channel: 'discord', sent: true, latencyMs: 200, attempts: 1, timestamp: new Date().toISOString() },
      ]);
      trackNotificationMetrics('2026-01-22', [
        { channel: 'discord', sent: true, latencyMs: 400, attempts: 1, timestamp: new Date().toISOString() },
      ]);
      trackNotificationMetrics('2026-01-23', [
        { channel: 'discord', sent: true, latencyMs: 600, attempts: 1, timestamp: new Date().toISOString() },
      ]);

      const aggregated = getAggregatedMetrics();
      expect(aggregated.discord.avgLatencyMs).toBe(400); // (200 + 400 + 600) / 3
    });
  });

  describe('resetMetricsAggregation', () => {
    it('should reset all metrics to zero', () => {
      trackNotificationMetrics('2026-01-22', [
        { channel: 'discord', sent: true, latencyMs: 500, attempts: 1, timestamp: new Date().toISOString() },
        { channel: 'email', sent: false, latencyMs: 2000, attempts: 3, timestamp: new Date().toISOString() },
      ]);

      resetMetricsAggregation();

      const aggregated = getAggregatedMetrics();
      expect(aggregated.discord.sent).toBe(0);
      expect(aggregated.discord.failed).toBe(0);
      expect(aggregated.email.sent).toBe(0);
      expect(aggregated.email.failed).toBe(0);
    });
  });
});
