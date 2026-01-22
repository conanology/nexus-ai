/**
 * Tests for buffer manager module
 * @module @nexus-ai/core/buffer/__tests__/manager.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BufferVideo, CreateBufferInput } from '../types.js';

// Mock Firestore
const mockSetDocument = vi.fn();
const mockGetDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockFirestoreClient = {
  setDocument: mockSetDocument,
  getDocument: mockGetDocument,
  updateDocument: mockUpdateDocument,
  queryDocuments: mockQueryDocuments,
};

vi.mock('../client.js', () => ({
  getSharedFirestoreClient: vi.fn(() => mockFirestoreClient),
  resetSharedClient: vi.fn(),
}));

vi.mock('../monitor.js', () => ({
  clearMonitorCache: vi.fn(),
}));

// Import after mocking
import {
  createBufferVideo,
  getBufferById,
  listAvailableBuffers,
  deployBuffer,
  archiveBuffer,
  clearBufferCache,
} from '../manager.js';

describe('Buffer Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearBufferCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // createBufferVideo Tests
  // ==========================================================================

  describe('createBufferVideo', () => {
    const createInput: CreateBufferInput = {
      videoId: 'dQw4w9WgXcQ',
      topic: 'Top 5 AI Papers This Week',
      title: 'Top 5 AI Research Papers You Must Read',
      description: 'Weekly roundup of impactful papers',
      durationSec: 360,
      thumbnailPath: 'gs://nexus-ai/buffers/thumb.png',
      source: 'manual',
    };

    it('should create a buffer video with generated ID', async () => {
      mockSetDocument.mockResolvedValueOnce(undefined);

      const result = await createBufferVideo(createInput);

      expect(result.id).toMatch(/^bf-[a-f0-9-]+$/);
      expect(result.videoId).toBe('dQw4w9WgXcQ');
      expect(result.topic).toBe('Top 5 AI Papers This Week');
      expect(result.title).toBe('Top 5 AI Research Papers You Must Read');
      expect(result.used).toBe(false);
      expect(result.deploymentCount).toBe(0);
      expect(result.status).toBe('active');
      expect(result.evergreen).toBe(true);
    });

    it('should set createdDate to ISO timestamp', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));
      mockSetDocument.mockResolvedValueOnce(undefined);

      const result = await createBufferVideo(createInput);

      expect(result.createdDate).toBe('2026-01-15T10:00:00.000Z');
    });

    it('should persist buffer to Firestore', async () => {
      mockSetDocument.mockResolvedValueOnce(undefined);

      const result = await createBufferVideo(createInput);

      expect(mockSetDocument).toHaveBeenCalledTimes(1);
      expect(mockSetDocument).toHaveBeenCalledWith(
        'buffer-videos',
        result.id,
        expect.objectContaining({
          id: result.id,
          videoId: 'dQw4w9WgXcQ',
          status: 'active',
        })
      );
    });

    it('should handle minimal input without optional fields', async () => {
      const minimalInput: CreateBufferInput = {
        videoId: 'abc12345678', // Valid 11-character YouTube video ID
        topic: 'Test Topic',
        title: 'Test Title',
        durationSec: 300,
        source: 'auto',
      };
      mockSetDocument.mockResolvedValueOnce(undefined);

      const result = await createBufferVideo(minimalInput);

      expect(result.description).toBeUndefined();
      expect(result.thumbnailPath).toBeUndefined();
      expect(result.source).toBe('auto');
    });

    it('should reject invalid YouTube video ID', async () => {
      const invalidInput: CreateBufferInput = {
        videoId: 'invalid', // Not 11 characters
        topic: 'Test Topic',
        title: 'Test Title',
        durationSec: 300,
        source: 'manual',
      };

      await expect(createBufferVideo(invalidInput)).rejects.toThrow(
        /Invalid YouTube video ID/
      );
    });

    it('should reject title exceeding max length', async () => {
      const invalidInput: CreateBufferInput = {
        videoId: 'dQw4w9WgXcQ',
        topic: 'Test Topic',
        title: 'A'.repeat(101), // Exceeds 100 char limit
        durationSec: 300,
        source: 'manual',
      };

      await expect(createBufferVideo(invalidInput)).rejects.toThrow(
        /exceeds maximum length/
      );
    });

    it('should reject duration out of valid range', async () => {
      const tooShort: CreateBufferInput = {
        videoId: 'dQw4w9WgXcQ',
        topic: 'Test Topic',
        title: 'Test Title',
        durationSec: 30, // Below 60s minimum
        source: 'manual',
      };

      await expect(createBufferVideo(tooShort)).rejects.toThrow(
        /out of valid range/
      );
    });

    it('should throw on Firestore error', async () => {
      mockSetDocument.mockRejectedValueOnce(new Error('Firestore write failed'));

      await expect(createBufferVideo(createInput)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // getBufferById Tests
  // ==========================================================================

  describe('getBufferById', () => {
    const mockBuffer: BufferVideo = {
      id: 'bf-123',
      videoId: 'dQw4w9WgXcQ',
      topic: 'Test Topic',
      title: 'Test Title',
      createdDate: '2026-01-15T10:00:00.000Z',
      used: false,
      deploymentCount: 0,
      durationSec: 300,
      source: 'manual',
      evergreen: true,
      status: 'active',
    };

    it('should return buffer when found', async () => {
      mockGetDocument.mockResolvedValueOnce(mockBuffer);

      const result = await getBufferById('bf-123');

      expect(result).toEqual(mockBuffer);
      expect(mockGetDocument).toHaveBeenCalledWith('buffer-videos', 'bf-123');
    });

    it('should return null when not found', async () => {
      mockGetDocument.mockResolvedValueOnce(null);

      const result = await getBufferById('bf-nonexistent');

      expect(result).toBeNull();
    });

    it('should cache results for repeated calls', async () => {
      mockGetDocument.mockResolvedValueOnce(mockBuffer);

      const result1 = await getBufferById('bf-123');
      const result2 = await getBufferById('bf-123');

      expect(result1).toEqual(result2);
      expect(mockGetDocument).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache after TTL expires', async () => {
      vi.useFakeTimers();
      mockGetDocument.mockResolvedValue(mockBuffer);

      await getBufferById('bf-123');
      expect(mockGetDocument).toHaveBeenCalledTimes(1);

      // Advance time past cache TTL (5 minutes)
      vi.advanceTimersByTime(6 * 60 * 1000);

      await getBufferById('bf-123');
      expect(mockGetDocument).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // listAvailableBuffers Tests
  // ==========================================================================

  describe('listAvailableBuffers', () => {
    const availableBuffers: BufferVideo[] = [
      {
        id: 'bf-1',
        videoId: 'vid1',
        topic: 'Topic 1',
        title: 'Title 1',
        createdDate: '2026-01-10T10:00:00.000Z',
        used: false,
        deploymentCount: 0,
        durationSec: 300,
        source: 'manual',
        evergreen: true,
        status: 'active',
      },
      {
        id: 'bf-2',
        videoId: 'vid2',
        topic: 'Topic 2',
        title: 'Title 2',
        createdDate: '2026-01-15T10:00:00.000Z',
        used: false,
        deploymentCount: 0,
        durationSec: 360,
        source: 'auto',
        evergreen: true,
        status: 'active',
      },
    ];

    it('should return available buffers (used: false, status: active)', async () => {
      mockQueryDocuments.mockResolvedValueOnce(availableBuffers);

      const result = await listAvailableBuffers();

      expect(result).toHaveLength(2);
      expect(mockQueryDocuments).toHaveBeenCalledWith('buffer-videos', [
        { field: 'used', operator: '==', value: false },
        { field: 'status', operator: '==', value: 'active' },
      ]);
    });

    it('should return empty array when no buffers available', async () => {
      mockQueryDocuments.mockResolvedValueOnce([]);

      const result = await listAvailableBuffers();

      expect(result).toEqual([]);
    });

    it('should cache results', async () => {
      mockQueryDocuments.mockResolvedValueOnce(availableBuffers);

      await listAvailableBuffers();
      await listAvailableBuffers();

      expect(mockQueryDocuments).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after TTL', async () => {
      vi.useFakeTimers();
      mockQueryDocuments.mockResolvedValue(availableBuffers);

      await listAvailableBuffers();
      vi.advanceTimersByTime(6 * 60 * 1000);
      await listAvailableBuffers();

      expect(mockQueryDocuments).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // deployBuffer Tests
  // ==========================================================================

  describe('deployBuffer', () => {
    const mockBuffer: BufferVideo = {
      id: 'bf-123',
      videoId: 'dQw4w9WgXcQ',
      topic: 'Test Topic',
      title: 'Test Title',
      createdDate: '2026-01-15T10:00:00.000Z',
      used: false,
      deploymentCount: 0,
      durationSec: 300,
      source: 'manual',
      evergreen: true,
      status: 'active',
    };

    it('should deploy buffer and return success result', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T14:00:00.000Z'));
      mockGetDocument.mockResolvedValueOnce(mockBuffer);
      mockUpdateDocument.mockResolvedValueOnce(undefined);

      const result = await deployBuffer('bf-123', '2026-01-20');

      expect(result.success).toBe(true);
      expect(result.bufferId).toBe('bf-123');
      expect(result.videoId).toBe('dQw4w9WgXcQ');
      expect(result.scheduledTime).toBeDefined();
      expect(result.previousStatus).toBe('active');
      expect(result.newStatus).toBe('deployed');
    });

    it('should update buffer with used: true and usedDate', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T14:00:00.000Z'));
      mockGetDocument.mockResolvedValueOnce(mockBuffer);
      mockUpdateDocument.mockResolvedValueOnce(undefined);

      await deployBuffer('bf-123', '2026-01-20');

      expect(mockUpdateDocument).toHaveBeenCalledWith(
        'buffer-videos',
        'bf-123',
        expect.objectContaining({
          used: true,
          usedDate: '2026-01-20T14:00:00.000Z',
          status: 'deployed',
          deploymentCount: 1,
        })
      );
    });

    it('should fail if buffer not found', async () => {
      mockGetDocument.mockResolvedValueOnce(null);

      const result = await deployBuffer('bf-nonexistent', '2026-01-20');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail if buffer already deployed', async () => {
      const deployedBuffer: BufferVideo = { ...mockBuffer, status: 'deployed', used: true };
      mockGetDocument.mockResolvedValueOnce(deployedBuffer);

      const result = await deployBuffer('bf-123', '2026-01-20');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('should fail if buffer is archived', async () => {
      const archivedBuffer: BufferVideo = { ...mockBuffer, status: 'archived' };
      mockGetDocument.mockResolvedValueOnce(archivedBuffer);

      const result = await deployBuffer('bf-123', '2026-01-20');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('should clear available buffers cache after deployment', async () => {
      mockGetDocument.mockResolvedValue(mockBuffer);
      mockUpdateDocument.mockResolvedValue(undefined);
      mockQueryDocuments.mockResolvedValue([mockBuffer]);

      // Populate cache
      await listAvailableBuffers();
      expect(mockQueryDocuments).toHaveBeenCalledTimes(1);

      // Deploy clears cache
      await deployBuffer('bf-123', '2026-01-20');

      // Next list call should hit DB
      await listAvailableBuffers();
      expect(mockQueryDocuments).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // archiveBuffer Tests
  // ==========================================================================

  describe('archiveBuffer', () => {
    const mockBuffer: BufferVideo = {
      id: 'bf-123',
      videoId: 'dQw4w9WgXcQ',
      topic: 'Test Topic',
      title: 'Test Title',
      createdDate: '2026-01-15T10:00:00.000Z',
      used: false,
      deploymentCount: 0,
      durationSec: 300,
      source: 'manual',
      evergreen: true,
      status: 'active',
    };

    it('should archive buffer with retirementDate', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-25T10:00:00.000Z'));
      mockGetDocument.mockResolvedValueOnce(mockBuffer);
      mockUpdateDocument.mockResolvedValueOnce(undefined);

      await archiveBuffer('bf-123');

      expect(mockUpdateDocument).toHaveBeenCalledWith(
        'buffer-videos',
        'bf-123',
        expect.objectContaining({
          status: 'archived',
          retirementDate: '2026-01-25T10:00:00.000Z',
        })
      );
    });

    it('should throw if buffer not found', async () => {
      mockGetDocument.mockResolvedValueOnce(null);

      await expect(archiveBuffer('bf-nonexistent')).rejects.toThrow();
    });

    it('should clear cache after archiving', async () => {
      mockGetDocument.mockResolvedValue(mockBuffer);
      mockUpdateDocument.mockResolvedValue(undefined);
      mockQueryDocuments.mockResolvedValue([mockBuffer]);

      await listAvailableBuffers();
      await archiveBuffer('bf-123');
      await listAvailableBuffers();

      expect(mockQueryDocuments).toHaveBeenCalledTimes(2);
    });
  });
});
