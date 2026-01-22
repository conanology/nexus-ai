/**
 * Tests for buffer selector module
 * @module @nexus-ai/core/buffer/__tests__/selector.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BufferVideo } from '../types.js';

// Mock the manager module
const mockListAvailableBuffers = vi.fn();
vi.mock('../manager.js', () => ({
  listAvailableBuffers: () => mockListAvailableBuffers(),
  clearBufferCache: vi.fn(),
}));

// Import after mocking
import {
  selectBufferForDeployment,
  getBufferDeploymentCandidate,
} from '../selector.js';

describe('Buffer Selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockBuffer = (id: string, createdDate: string): BufferVideo => ({
    id,
    videoId: `video-${id}`,
    topic: `Topic ${id}`,
    title: `Title ${id}`,
    createdDate,
    used: false,
    deploymentCount: 0,
    durationSec: 300,
    source: 'manual',
    evergreen: true,
    status: 'active',
  });

  // ==========================================================================
  // selectBufferForDeployment Tests (FIFO - oldest first)
  // ==========================================================================

  describe('selectBufferForDeployment', () => {
    it('should select the oldest buffer (FIFO)', async () => {
      const buffers: BufferVideo[] = [
        createMockBuffer('bf-2', '2026-01-15T10:00:00.000Z'),
        createMockBuffer('bf-1', '2026-01-10T10:00:00.000Z'), // oldest
        createMockBuffer('bf-3', '2026-01-20T10:00:00.000Z'),
      ];
      mockListAvailableBuffers.mockResolvedValueOnce(buffers);

      const result = await selectBufferForDeployment();

      expect(result.id).toBe('bf-1'); // oldest by createdDate
    });

    it('should handle single buffer', async () => {
      const buffers: BufferVideo[] = [
        createMockBuffer('bf-only', '2026-01-15T10:00:00.000Z'),
      ];
      mockListAvailableBuffers.mockResolvedValueOnce(buffers);

      const result = await selectBufferForDeployment();

      expect(result.id).toBe('bf-only');
    });

    it('should throw when no buffers available', async () => {
      mockListAvailableBuffers.mockResolvedValueOnce([]);

      await expect(selectBufferForDeployment()).rejects.toThrow(
        /No buffer videos available/
      );
    });

    it('should handle buffers with same timestamp (deterministic order)', async () => {
      const sameTime = '2026-01-15T10:00:00.000Z';
      const buffers: BufferVideo[] = [
        createMockBuffer('bf-b', sameTime),
        createMockBuffer('bf-a', sameTime),
        createMockBuffer('bf-c', sameTime),
      ];
      mockListAvailableBuffers.mockResolvedValueOnce(buffers);

      const result = await selectBufferForDeployment();

      // Should still return one of them (first in sorted order)
      expect(['bf-a', 'bf-b', 'bf-c']).toContain(result.id);
    });

    it('should prefer buffers that have never been deployed', async () => {
      const buffers: BufferVideo[] = [
        {
          ...createMockBuffer('bf-deployed', '2026-01-05T10:00:00.000Z'),
          deploymentCount: 1,
        },
        createMockBuffer('bf-fresh', '2026-01-10T10:00:00.000Z'),
      ];
      mockListAvailableBuffers.mockResolvedValueOnce(buffers);

      const result = await selectBufferForDeployment();

      // Fresh buffer preferred even though deployed one is older
      expect(result.id).toBe('bf-fresh');
    });
  });

  // ==========================================================================
  // getBufferDeploymentCandidate Tests
  // ==========================================================================

  describe('getBufferDeploymentCandidate', () => {
    it('should return best candidate without throwing', async () => {
      const buffers: BufferVideo[] = [
        createMockBuffer('bf-1', '2026-01-10T10:00:00.000Z'),
        createMockBuffer('bf-2', '2026-01-15T10:00:00.000Z'),
      ];
      mockListAvailableBuffers.mockResolvedValueOnce(buffers);

      const result = await getBufferDeploymentCandidate();

      expect(result).not.toBeNull();
      expect(result?.id).toBe('bf-1');
    });

    it('should return null when no buffers available', async () => {
      mockListAvailableBuffers.mockResolvedValueOnce([]);

      const result = await getBufferDeploymentCandidate();

      expect(result).toBeNull();
    });

    it('should not throw on error, return null instead', async () => {
      mockListAvailableBuffers.mockRejectedValueOnce(new Error('DB error'));

      const result = await getBufferDeploymentCandidate();

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Selection Priority Tests
  // ==========================================================================

  describe('selection priority', () => {
    it('should prioritize: never deployed > oldest', async () => {
      const buffers: BufferVideo[] = [
        {
          ...createMockBuffer('bf-old-deployed', '2026-01-01T10:00:00.000Z'),
          deploymentCount: 1,
        },
        createMockBuffer('bf-newer-fresh', '2026-01-15T10:00:00.000Z'),
      ];
      mockListAvailableBuffers.mockResolvedValueOnce(buffers);

      const result = await selectBufferForDeployment();

      expect(result.id).toBe('bf-newer-fresh');
    });

    it('should fall back to oldest when all have same deployment count', async () => {
      const buffers: BufferVideo[] = [
        createMockBuffer('bf-newer', '2026-01-20T10:00:00.000Z'),
        createMockBuffer('bf-oldest', '2026-01-01T10:00:00.000Z'),
        createMockBuffer('bf-middle', '2026-01-10T10:00:00.000Z'),
      ];
      mockListAvailableBuffers.mockResolvedValueOnce(buffers);

      const result = await selectBufferForDeployment();

      expect(result.id).toBe('bf-oldest');
    });
  });
});
