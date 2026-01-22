/**
 * Tests for queue manager module
 * @module @nexus-ai/core/queue/__tests__/manager.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { QueuedTopic } from '../../buffer/types.js';

// Mock Firestore
const mockSetDocument = vi.fn();
const mockGetDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockDeleteDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockFirestoreClient = {
  setDocument: mockSetDocument,
  getDocument: mockGetDocument,
  updateDocument: mockUpdateDocument,
  deleteDocument: mockDeleteDocument,
  queryDocuments: mockQueryDocuments,
};

vi.mock('../../buffer/client.js', () => ({
  getSharedFirestoreClient: vi.fn(() => mockFirestoreClient),
  resetSharedClient: vi.fn(),
}));

// Import after mocking
import {
  queueFailedTopic,
  getQueuedTopic,
  getQueuedTopics,
  clearQueuedTopic,
  incrementRetryCount,
  requeueTopic,
  markTopicProcessing,
  checkTodayQueuedTopic,
} from '../manager.js';

describe('Queue Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // queueFailedTopic Tests
  // ==========================================================================

  describe('queueFailedTopic', () => {
    it('should queue a topic for the next day', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));
      mockSetDocument.mockResolvedValueOnce(undefined);

      const result = await queueFailedTopic(
        'AI Model Breakthrough',
        'NEXUS_TTS_TIMEOUT',
        'tts',
        '2026-01-20'
      );

      expect(result).toBe('2026-01-21'); // Tomorrow
      expect(mockSetDocument).toHaveBeenCalledTimes(1);
      expect(mockSetDocument).toHaveBeenCalledWith(
        'queued-topics',
        '2026-01-21',
        expect.objectContaining({
          topic: 'AI Model Breakthrough',
          failureReason: 'NEXUS_TTS_TIMEOUT',
          failureStage: 'tts',
          originalDate: '2026-01-20',
          retryCount: 0,
          maxRetries: 2,
          status: 'pending',
        })
      );
    });

    it('should include ISO timestamp for queuedDate', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T15:30:00.000Z'));
      mockSetDocument.mockResolvedValueOnce(undefined);

      await queueFailedTopic(
        'Topic X',
        'NEXUS_RENDER_FAILED',
        'render',
        '2026-01-20'
      );

      expect(mockSetDocument).toHaveBeenCalledWith(
        'queued-topics',
        '2026-01-21',
        expect.objectContaining({
          queuedDate: '2026-01-20T15:30:00.000Z',
        })
      );
    });

    it('should throw NexusError on Firestore failure', async () => {
      mockSetDocument.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(
        queueFailedTopic('Topic', 'ERROR', 'stage', '2026-01-20')
      ).rejects.toMatchObject({
        code: 'NEXUS_QUEUE_TOPIC_SAVE_FAILED',
      });
    });
  });

  // ==========================================================================
  // getQueuedTopic Tests
  // ==========================================================================

  describe('getQueuedTopic', () => {
    const mockQueuedTopic: QueuedTopic = {
      topic: 'Test Topic',
      failureReason: 'NEXUS_TTS_TIMEOUT',
      failureStage: 'tts',
      originalDate: '2026-01-19',
      queuedDate: '2026-01-19T20:00:00.000Z',
      retryCount: 0,
      maxRetries: 2,
      status: 'pending',
    };

    it('should return queued topic for date', async () => {
      mockGetDocument.mockResolvedValueOnce(mockQueuedTopic);

      const result = await getQueuedTopic('2026-01-20');

      expect(result).toEqual(mockQueuedTopic);
      expect(mockGetDocument).toHaveBeenCalledWith('queued-topics', '2026-01-20');
    });

    it('should return null if no topic exists', async () => {
      mockGetDocument.mockResolvedValueOnce(null);

      const result = await getQueuedTopic('2026-01-20');

      expect(result).toBeNull();
    });

    it('should throw on Firestore error', async () => {
      mockGetDocument.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(getQueuedTopic('2026-01-20')).rejects.toMatchObject({
        code: 'NEXUS_QUEUE_TOPIC_NOT_FOUND',
      });
    });
  });

  // ==========================================================================
  // getQueuedTopics Tests
  // ==========================================================================

  describe('getQueuedTopics', () => {
    it('should return all pending topics', async () => {
      const topics: QueuedTopic[] = [
        {
          topic: 'Topic 1',
          failureReason: 'ERROR1',
          failureStage: 'tts',
          originalDate: '2026-01-18',
          queuedDate: '2026-01-18T20:00:00.000Z',
          retryCount: 0,
          maxRetries: 2,
          status: 'pending',
        },
        {
          topic: 'Topic 2',
          failureReason: 'ERROR2',
          failureStage: 'render',
          originalDate: '2026-01-19',
          queuedDate: '2026-01-19T20:00:00.000Z',
          retryCount: 1,
          maxRetries: 2,
          status: 'pending',
        },
      ];
      mockQueryDocuments.mockResolvedValueOnce(topics);

      const result = await getQueuedTopics();

      expect(result).toHaveLength(2);
      expect(mockQueryDocuments).toHaveBeenCalledWith('queued-topics', [
        { field: 'status', operator: '==', value: 'pending' },
      ]);
    });

    it('should return empty array if no pending topics', async () => {
      mockQueryDocuments.mockResolvedValueOnce([]);

      const result = await getQueuedTopics();

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // clearQueuedTopic Tests
  // ==========================================================================

  describe('clearQueuedTopic', () => {
    it('should delete topic from queue', async () => {
      mockDeleteDocument.mockResolvedValueOnce(undefined);

      await clearQueuedTopic('2026-01-20');

      expect(mockDeleteDocument).toHaveBeenCalledWith('queued-topics', '2026-01-20');
    });

    it('should throw on delete failure', async () => {
      mockDeleteDocument.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(clearQueuedTopic('2026-01-20')).rejects.toMatchObject({
        code: 'NEXUS_QUEUE_TOPIC_CLEAR_FAILED',
      });
    });
  });

  // ==========================================================================
  // incrementRetryCount Tests
  // ==========================================================================

  describe('incrementRetryCount', () => {
    it('should increment retry count and return updated topic', async () => {
      const existingTopic: QueuedTopic = {
        topic: 'Test Topic',
        failureReason: 'ERROR',
        failureStage: 'tts',
        originalDate: '2026-01-19',
        queuedDate: '2026-01-19T20:00:00.000Z',
        retryCount: 0,
        maxRetries: 2,
        status: 'pending',
      };
      mockGetDocument.mockResolvedValueOnce(existingTopic);
      mockUpdateDocument.mockResolvedValueOnce(undefined);

      const result = await incrementRetryCount('2026-01-20');

      expect(result).toEqual({
        ...existingTopic,
        retryCount: 1,
        status: 'processing',
      });
      expect(mockUpdateDocument).toHaveBeenCalledWith('queued-topics', '2026-01-20', {
        retryCount: 1,
        status: 'processing',
      });
    });

    it('should return null and mark abandoned when max retries reached', async () => {
      const existingTopic: QueuedTopic = {
        topic: 'Test Topic',
        failureReason: 'ERROR',
        failureStage: 'tts',
        originalDate: '2026-01-19',
        queuedDate: '2026-01-19T20:00:00.000Z',
        retryCount: 1,
        maxRetries: 2,
        status: 'processing',
      };
      mockGetDocument.mockResolvedValueOnce(existingTopic);
      mockUpdateDocument.mockResolvedValueOnce(undefined);

      const result = await incrementRetryCount('2026-01-20');

      expect(result).toBeNull(); // Max retries reached
      expect(mockUpdateDocument).toHaveBeenCalledWith('queued-topics', '2026-01-20', {
        status: 'abandoned',
        retryCount: 2,
      });
    });

    it('should return null if topic not found', async () => {
      mockGetDocument.mockResolvedValueOnce(null);

      const result = await incrementRetryCount('2026-01-20');

      expect(result).toBeNull();
      expect(mockUpdateDocument).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // requeueTopic Tests
  // ==========================================================================

  describe('requeueTopic', () => {
    const existingTopic: QueuedTopic = {
      topic: 'Weekend Topic',
      failureReason: 'ERROR',
      failureStage: 'tts',
      originalDate: '2026-01-24',
      queuedDate: '2026-01-24T20:00:00.000Z',
      retryCount: 0,
      maxRetries: 2,
      status: 'pending',
    };

    it('should move topic to new date', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-25T10:00:00.000Z'));
      mockGetDocument.mockResolvedValueOnce(existingTopic);
      mockSetDocument.mockResolvedValueOnce(undefined);
      mockDeleteDocument.mockResolvedValueOnce(undefined);

      await requeueTopic('2026-01-25', '2026-01-27');

      // Should save to new date
      expect(mockSetDocument).toHaveBeenCalledWith(
        'queued-topics',
        '2026-01-27',
        expect.objectContaining({
          topic: 'Weekend Topic',
          queuedDate: '2026-01-25T10:00:00.000Z',
          status: 'pending',
        })
      );

      // Should delete from old date
      expect(mockDeleteDocument).toHaveBeenCalledWith('queued-topics', '2026-01-25');
    });

    it('should throw if topic not found at current date', async () => {
      mockGetDocument.mockResolvedValueOnce(null);

      await expect(requeueTopic('2026-01-25', '2026-01-27')).rejects.toMatchObject({
        code: 'NEXUS_QUEUE_TOPIC_NOT_FOUND',
      });
    });
  });

  // ==========================================================================
  // markTopicProcessing Tests
  // ==========================================================================

  describe('markTopicProcessing', () => {
    it('should update status to processing', async () => {
      mockUpdateDocument.mockResolvedValueOnce(undefined);

      await markTopicProcessing('2026-01-20');

      expect(mockUpdateDocument).toHaveBeenCalledWith('queued-topics', '2026-01-20', {
        status: 'processing',
      });
    });
  });

  // ==========================================================================
  // checkTodayQueuedTopic Tests
  // ==========================================================================

  describe('checkTodayQueuedTopic', () => {
    it('should return pending topic for today', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T08:00:00.000Z'));

      const todayTopic: QueuedTopic = {
        topic: 'Today Topic',
        failureReason: 'ERROR',
        failureStage: 'tts',
        originalDate: '2026-01-19',
        queuedDate: '2026-01-19T20:00:00.000Z',
        retryCount: 0,
        maxRetries: 2,
        status: 'pending',
      };
      mockGetDocument.mockResolvedValueOnce(todayTopic);

      const result = await checkTodayQueuedTopic();

      expect(result).toEqual(todayTopic);
      expect(mockGetDocument).toHaveBeenCalledWith('queued-topics', '2026-01-20');
    });

    it('should return null if topic is not pending', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T08:00:00.000Z'));

      const processingTopic: QueuedTopic = {
        topic: 'Processing Topic',
        failureReason: 'ERROR',
        failureStage: 'tts',
        originalDate: '2026-01-19',
        queuedDate: '2026-01-19T20:00:00.000Z',
        retryCount: 1,
        maxRetries: 2,
        status: 'processing',
      };
      mockGetDocument.mockResolvedValueOnce(processingTopic);

      const result = await checkTodayQueuedTopic();

      expect(result).toBeNull();
    });

    it('should return null if no topic exists for today', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T08:00:00.000Z'));
      mockGetDocument.mockResolvedValueOnce(null);

      const result = await checkTodayQueuedTopic();

      expect(result).toBeNull();
    });
  });
});
