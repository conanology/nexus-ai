/**
 * Tests for buffer monitor module
 * @module @nexus-ai/core/buffer/__tests__/monitor.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BufferVideo } from '../types.js';

// Mock Firestore
const mockQueryDocuments = vi.fn();
const mockFirestoreClient = {
  queryDocuments: mockQueryDocuments,
};

vi.mock('../client.js', () => ({
  getSharedFirestoreClient: vi.fn(() => mockFirestoreClient),
  resetSharedClient: vi.fn(),
}));

// Import after mocking
import {
  getBufferCount,
  getBufferHealthStatus,
  getBufferSummaryForDigest,
  clearMonitorCache,
} from '../monitor.js';
import { BUFFER_THRESHOLDS } from '../types.js';

describe('Buffer Monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMonitorCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockBuffer = (
    id: string,
    createdDate: string,
    status: 'active' | 'deployed' | 'archived' = 'active',
    used: boolean = false
  ): BufferVideo => ({
    id,
    videoId: `video-${id}`,
    topic: `Topic ${id}`,
    title: `Title ${id}`,
    createdDate,
    used,
    deploymentCount: used ? 1 : 0,
    durationSec: 300,
    source: 'manual',
    evergreen: true,
    status,
  });

  // ==========================================================================
  // getBufferCount Tests
  // ==========================================================================

  describe('getBufferCount', () => {
    it('should return count of available buffers', async () => {
      const buffers = [
        createMockBuffer('bf-1', '2026-01-10T10:00:00.000Z'),
        createMockBuffer('bf-2', '2026-01-15T10:00:00.000Z'),
        createMockBuffer('bf-3', '2026-01-20T10:00:00.000Z'),
      ];
      mockQueryDocuments.mockResolvedValueOnce(buffers);

      const count = await getBufferCount();

      expect(count).toBe(3);
      expect(mockQueryDocuments).toHaveBeenCalledWith('buffer-videos', [
        { field: 'used', operator: '==', value: false },
        { field: 'status', operator: '==', value: 'active' },
      ]);
    });

    it('should return 0 when no buffers available', async () => {
      mockQueryDocuments.mockResolvedValueOnce([]);

      const count = await getBufferCount();

      expect(count).toBe(0);
    });

    it('should cache results for 5 minutes', async () => {
      vi.useFakeTimers();
      mockQueryDocuments.mockResolvedValue([
        createMockBuffer('bf-1', '2026-01-10T10:00:00.000Z'),
      ]);

      await getBufferCount();
      await getBufferCount();

      expect(mockQueryDocuments).toHaveBeenCalledTimes(1);

      // Advance less than 5 minutes
      vi.advanceTimersByTime(4 * 60 * 1000);
      await getBufferCount();
      expect(mockQueryDocuments).toHaveBeenCalledTimes(1);

      // Advance past 5 minutes total
      vi.advanceTimersByTime(2 * 60 * 1000);
      await getBufferCount();
      expect(mockQueryDocuments).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // getBufferHealthStatus Tests
  // ==========================================================================

  describe('getBufferHealthStatus', () => {
    it('should return healthy status when above warning threshold', async () => {
      const activeBuffers = [
        createMockBuffer('bf-1', '2026-01-10T10:00:00.000Z'),
        createMockBuffer('bf-2', '2026-01-15T10:00:00.000Z'),
        createMockBuffer('bf-3', '2026-01-20T10:00:00.000Z'),
      ];
      const deployedBuffers = [
        createMockBuffer('bf-4', '2026-01-05T10:00:00.000Z', 'deployed', true),
      ];
      const archivedBuffers = [
        createMockBuffer('bf-5', '2026-01-01T10:00:00.000Z', 'archived', true),
      ];

      mockQueryDocuments
        .mockResolvedValueOnce(activeBuffers)
        .mockResolvedValueOnce(deployedBuffers)
        .mockResolvedValueOnce(archivedBuffers);

      const health = await getBufferHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.availableCount).toBe(3);
      expect(health.deployedCount).toBe(1);
      expect(health.totalCount).toBe(5); // includes archived
      expect(health.belowWarningThreshold).toBe(false);
      expect(health.belowMinimumThreshold).toBe(false);
    });

    it('should return healthy status when at warning threshold (2 buffers)', async () => {
      // WARNING_COUNT is 2, "below" means < 2, so 2 available = healthy
      const activeBuffers = [
        createMockBuffer('bf-1', '2026-01-10T10:00:00.000Z'),
        createMockBuffer('bf-2', '2026-01-15T10:00:00.000Z'),
      ];
      mockQueryDocuments
        .mockResolvedValueOnce(activeBuffers)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // archived

      const health = await getBufferHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.availableCount).toBe(2);
      expect(health.belowWarningThreshold).toBe(false); // 2 is not below 2
      expect(health.belowMinimumThreshold).toBe(false);
    });

    it('should return critical status when at minimum threshold (1 buffer)', async () => {
      // MINIMUM_COUNT is 1, at minimum = critical (NFR5)
      const activeBuffers = [
        createMockBuffer('bf-1', '2026-01-10T10:00:00.000Z'),
      ];
      mockQueryDocuments
        .mockResolvedValueOnce(activeBuffers)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // archived

      const health = await getBufferHealthStatus();

      expect(health.status).toBe('critical');
      expect(health.availableCount).toBe(1);
      expect(health.belowWarningThreshold).toBe(true); // 1 < 2
      expect(health.belowMinimumThreshold).toBe(false); // 1 is not below 1
    });

    it('should return critical status when no buffers available', async () => {
      mockQueryDocuments
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // archived

      const health = await getBufferHealthStatus();

      expect(health.status).toBe('critical');
      expect(health.availableCount).toBe(0);
      expect(health.belowMinimumThreshold).toBe(true); // 0 < 1
    });

    it('should include lastChecked timestamp', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));
      mockQueryDocuments
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // archived

      const health = await getBufferHealthStatus();

      expect(health.lastChecked).toBe('2026-01-20T10:00:00.000Z');
    });
  });

  // ==========================================================================
  // getBufferSummaryForDigest Tests
  // ==========================================================================

  describe('getBufferSummaryForDigest', () => {
    it('should return complete summary for digest', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));

      const activeBuffers = [
        createMockBuffer('bf-1', '2026-01-05T10:00:00.000Z'),
        createMockBuffer('bf-2', '2026-01-10T10:00:00.000Z'),
        createMockBuffer('bf-3', '2026-01-15T10:00:00.000Z'),
      ];
      const deployedBuffers = [
        {
          ...createMockBuffer('bf-4', '2026-01-01T10:00:00.000Z', 'deployed', true),
          usedDate: '2026-01-20T06:00:00.000Z', // Deployed today
        },
      ];

      mockQueryDocuments
        .mockResolvedValueOnce(activeBuffers)
        .mockResolvedValueOnce(deployedBuffers);

      const summary = await getBufferSummaryForDigest('2026-01-20');

      expect(summary.date).toBe('2026-01-20');
      expect(summary.totalBuffers).toBe(4);
      expect(summary.availableBuffers).toBe(3);
      expect(summary.deployedToday).toBe(1);
      expect(summary.healthStatus).toBe('healthy');
      expect(summary.oldestBufferDate).toBe('2026-01-05T10:00:00.000Z');
    });

    it('should return oldest buffer date from available buffers', async () => {
      const activeBuffers = [
        createMockBuffer('bf-2', '2026-01-15T10:00:00.000Z'),
        createMockBuffer('bf-1', '2026-01-05T10:00:00.000Z'), // oldest
        createMockBuffer('bf-3', '2026-01-20T10:00:00.000Z'),
      ];
      mockQueryDocuments
        .mockResolvedValueOnce(activeBuffers)
        .mockResolvedValueOnce([]);

      const summary = await getBufferSummaryForDigest('2026-01-20');

      expect(summary.oldestBufferDate).toBe('2026-01-05T10:00:00.000Z');
    });

    it('should return undefined oldestBufferDate when no available buffers', async () => {
      mockQueryDocuments
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const summary = await getBufferSummaryForDigest('2026-01-20');

      expect(summary.oldestBufferDate).toBeUndefined();
    });

    it('should count deployed today correctly', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));

      const deployedBuffers = [
        {
          ...createMockBuffer('bf-1', '2026-01-01T10:00:00.000Z', 'deployed', true),
          usedDate: '2026-01-20T06:00:00.000Z', // Deployed today
        },
        {
          ...createMockBuffer('bf-2', '2026-01-02T10:00:00.000Z', 'deployed', true),
          usedDate: '2026-01-19T14:00:00.000Z', // Deployed yesterday
        },
        {
          ...createMockBuffer('bf-3', '2026-01-03T10:00:00.000Z', 'deployed', true),
          usedDate: '2026-01-20T14:00:00.000Z', // Deployed today
        },
      ];

      mockQueryDocuments
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(deployedBuffers);

      const summary = await getBufferSummaryForDigest('2026-01-20');

      expect(summary.deployedToday).toBe(2);
    });

    it('should work with thresholds constants', async () => {
      // Verify we use the actual threshold values
      expect(BUFFER_THRESHOLDS.MINIMUM_COUNT).toBe(1);
      expect(BUFFER_THRESHOLDS.WARNING_COUNT).toBe(2);
    });
  });
});
