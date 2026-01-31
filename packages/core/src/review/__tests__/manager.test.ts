/**
 * Tests for review queue manager module
 * @module @nexus-ai/core/review/__tests__/manager.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReviewItem, AddReviewItemInput } from '../types.js';

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

vi.mock('../../buffer/client.js', () => ({
  getSharedFirestoreClient: vi.fn(() => mockFirestoreClient),
  resetSharedClient: vi.fn(),
}));

// Mock crypto for UUID generation
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-12345'),
}));

// Import after mocking
import {
  addToReviewQueue,
  getReviewQueue,
  getReviewItem,
  resolveReviewItem,
  dismissReviewItem,
  getPendingReviewCount,
  hasPendingCriticalReviews,
  getPendingCriticalReviews,
  skipTopic,
  requeueTopicFromReview,
  approveTopicWithModifications,
} from '../manager.js';
import { REVIEW_QUEUE_COLLECTION } from '../types.js';

describe('Review Queue Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-22T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // addToReviewQueue Tests
  // ==========================================================================

  describe('addToReviewQueue', () => {
    const validInput: AddReviewItemInput = {
      type: 'pronunciation',
      pipelineId: '2026-01-22',
      stage: 'pronunciation',
      item: { unknownTerms: ['GPT-4o', 'LLaMA'] },
      context: { scriptExcerpt: 'test excerpt' },
    };

    it('should add a review item to the queue', async () => {
      mockSetDocument.mockResolvedValueOnce(undefined);

      const id = await addToReviewQueue(validInput);

      expect(id).toBe('test-uuid-12345');
      expect(mockSetDocument).toHaveBeenCalledTimes(1);
      expect(mockSetDocument).toHaveBeenCalledWith(
        REVIEW_QUEUE_COLLECTION,
        'test-uuid-12345',
        expect.objectContaining({
          id: 'test-uuid-12345',
          type: 'pronunciation',
          pipelineId: '2026-01-22',
          stage: 'pronunciation',
          status: 'pending',
          resolution: null,
          resolvedAt: null,
          resolvedBy: null,
          createdAt: '2026-01-22T10:00:00.000Z',
        })
      );
    });

    it('should include item and context in the review item', async () => {
      mockSetDocument.mockResolvedValueOnce(undefined);

      await addToReviewQueue(validInput);

      expect(mockSetDocument).toHaveBeenCalledWith(
        REVIEW_QUEUE_COLLECTION,
        'test-uuid-12345',
        expect.objectContaining({
          item: { unknownTerms: ['GPT-4o', 'LLaMA'] },
          context: { scriptExcerpt: 'test excerpt' },
        })
      );
    });

    it('should throw NexusError on Firestore failure', async () => {
      mockSetDocument.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(addToReviewQueue(validInput)).rejects.toMatchObject({
        code: 'NEXUS_REVIEW_ITEM_SAVE_FAILED',
      });
    });

    it('should handle quality type review items', async () => {
      mockSetDocument.mockResolvedValueOnce(undefined);

      const qualityInput: AddReviewItemInput = {
        type: 'quality',
        pipelineId: '2026-01-22',
        stage: 'script-gen',
        item: { wordCount: 800, expectedMin: 1200, expectedMax: 1800 },
        context: { scriptExcerpt: 'short script' },
      };

      await addToReviewQueue(qualityInput);

      expect(mockSetDocument).toHaveBeenCalledWith(
        REVIEW_QUEUE_COLLECTION,
        'test-uuid-12345',
        expect.objectContaining({
          type: 'quality',
          stage: 'script-gen',
        })
      );
    });

    it('should handle controversial type review items', async () => {
      mockSetDocument.mockResolvedValueOnce(undefined);

      const controversialInput: AddReviewItemInput = {
        type: 'controversial',
        pipelineId: '2026-01-22',
        stage: 'news-sourcing',
        item: { topic: { title: 'Election News' }, matchedKeywords: ['election'] },
        context: { sourceUrl: 'https://example.com' },
      };

      await addToReviewQueue(controversialInput);

      expect(mockSetDocument).toHaveBeenCalledWith(
        REVIEW_QUEUE_COLLECTION,
        'test-uuid-12345',
        expect.objectContaining({
          type: 'controversial',
          stage: 'news-sourcing',
        })
      );
    });
  });

  // ==========================================================================
  // getReviewQueue Tests
  // ==========================================================================

  describe('getReviewQueue', () => {
    const mockItems: ReviewItem[] = [
      {
        id: 'item-1',
        type: 'pronunciation',
        pipelineId: '2026-01-22',
        stage: 'pronunciation',
        item: {},
        context: {},
        createdAt: '2026-01-22T09:00:00.000Z',
        status: 'pending',
        resolution: null,
        resolvedAt: null,
        resolvedBy: null,
      },
      {
        id: 'item-2',
        type: 'quality',
        pipelineId: '2026-01-22',
        stage: 'script-gen',
        item: {},
        context: {},
        createdAt: '2026-01-22T09:30:00.000Z',
        status: 'pending',
        resolution: null,
        resolvedAt: null,
        resolvedBy: null,
      },
    ];

    it('should return all items when no filters provided', async () => {
      mockQueryDocuments.mockResolvedValueOnce(mockItems);

      const result = await getReviewQueue();

      expect(result).toHaveLength(2);
      expect(mockQueryDocuments).toHaveBeenCalledWith(REVIEW_QUEUE_COLLECTION, []);
    });

    it('should filter by status', async () => {
      mockQueryDocuments.mockResolvedValueOnce([mockItems[0]]);

      const result = await getReviewQueue({ status: 'pending' });

      expect(result).toHaveLength(1);
      expect(mockQueryDocuments).toHaveBeenCalledWith(REVIEW_QUEUE_COLLECTION, [
        { field: 'status', operator: '==', value: 'pending' },
      ]);
    });

    it('should filter by type', async () => {
      mockQueryDocuments.mockResolvedValueOnce([mockItems[0]]);

      const result = await getReviewQueue({ type: 'pronunciation' });

      expect(result).toHaveLength(1);
      expect(mockQueryDocuments).toHaveBeenCalledWith(REVIEW_QUEUE_COLLECTION, [
        { field: 'type', operator: '==', value: 'pronunciation' },
      ]);
    });

    it('should filter by multiple criteria', async () => {
      mockQueryDocuments.mockResolvedValueOnce([mockItems[0]]);

      const result = await getReviewQueue({ status: 'pending', type: 'pronunciation' });

      expect(result).toHaveLength(1);
      expect(mockQueryDocuments).toHaveBeenCalledWith(REVIEW_QUEUE_COLLECTION, [
        { field: 'status', operator: '==', value: 'pending' },
        { field: 'type', operator: '==', value: 'pronunciation' },
      ]);
    });

    it('should filter by pipelineId', async () => {
      mockQueryDocuments.mockResolvedValueOnce(mockItems);

      await getReviewQueue({ pipelineId: '2026-01-22' });

      expect(mockQueryDocuments).toHaveBeenCalledWith(REVIEW_QUEUE_COLLECTION, [
        { field: 'pipelineId', operator: '==', value: '2026-01-22' },
      ]);
    });

    it('should return empty array when no matches', async () => {
      mockQueryDocuments.mockResolvedValueOnce([]);

      const result = await getReviewQueue({ status: 'resolved' });

      expect(result).toEqual([]);
    });

    it('should throw on query failure', async () => {
      mockQueryDocuments.mockRejectedValueOnce(new Error('Query failed'));

      await expect(getReviewQueue()).rejects.toMatchObject({
        code: 'NEXUS_REVIEW_QUEUE_QUERY_FAILED',
      });
    });
  });

  // ==========================================================================
  // getReviewItem Tests
  // ==========================================================================

  describe('getReviewItem', () => {
    const mockItem: ReviewItem = {
      id: 'item-1',
      type: 'pronunciation',
      pipelineId: '2026-01-22',
      stage: 'pronunciation',
      item: {},
      context: {},
      createdAt: '2026-01-22T09:00:00.000Z',
      status: 'pending',
      resolution: null,
      resolvedAt: null,
      resolvedBy: null,
    };

    it('should return review item by ID', async () => {
      mockGetDocument.mockResolvedValueOnce(mockItem);

      const result = await getReviewItem('item-1');

      expect(result).toEqual(mockItem);
      expect(mockGetDocument).toHaveBeenCalledWith(REVIEW_QUEUE_COLLECTION, 'item-1');
    });

    it('should return null if item not found', async () => {
      mockGetDocument.mockResolvedValueOnce(null);

      const result = await getReviewItem('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw on retrieval failure', async () => {
      mockGetDocument.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(getReviewItem('item-1')).rejects.toMatchObject({
        code: 'NEXUS_REVIEW_ITEM_NOT_FOUND',
      });
    });
  });

  // ==========================================================================
  // resolveReviewItem Tests
  // ==========================================================================

  describe('resolveReviewItem', () => {
    const mockPendingItem: ReviewItem = {
      id: 'item-1',
      type: 'pronunciation',
      pipelineId: '2026-01-22',
      stage: 'pronunciation',
      item: {},
      context: {},
      createdAt: '2026-01-22T09:00:00.000Z',
      status: 'pending',
      resolution: null,
      resolvedAt: null,
      resolvedBy: null,
    };

    it('should resolve a pending review item', async () => {
      mockGetDocument.mockResolvedValueOnce(mockPendingItem);
      mockUpdateDocument.mockResolvedValueOnce(undefined);

      await resolveReviewItem('item-1', 'Added pronunciations', 'operator@test.com');

      expect(mockUpdateDocument).toHaveBeenCalledWith(REVIEW_QUEUE_COLLECTION, 'item-1', {
        status: 'resolved',
        resolution: 'Added pronunciations',
        resolvedAt: '2026-01-22T10:00:00.000Z',
        resolvedBy: 'operator@test.com',
      });
    });

    it('should throw if item not found', async () => {
      mockGetDocument.mockResolvedValueOnce(null);

      await expect(
        resolveReviewItem('nonexistent', 'resolution', 'operator')
      ).rejects.toMatchObject({
        code: 'NEXUS_REVIEW_ITEM_NOT_FOUND',
      });
    });

    it('should throw if item already resolved', async () => {
      const resolvedItem = { ...mockPendingItem, status: 'resolved' as const };
      mockGetDocument.mockResolvedValueOnce(resolvedItem);

      await expect(
        resolveReviewItem('item-1', 'resolution', 'operator')
      ).rejects.toMatchObject({
        code: 'NEXUS_REVIEW_ITEM_ALREADY_RESOLVED',
      });
    });

    it('should throw if item already dismissed', async () => {
      const dismissedItem = { ...mockPendingItem, status: 'dismissed' as const };
      mockGetDocument.mockResolvedValueOnce(dismissedItem);

      await expect(
        resolveReviewItem('item-1', 'resolution', 'operator')
      ).rejects.toMatchObject({
        code: 'NEXUS_REVIEW_ITEM_ALREADY_RESOLVED',
      });
    });
  });

  // ==========================================================================
  // dismissReviewItem Tests
  // ==========================================================================

  describe('dismissReviewItem', () => {
    const mockPendingItem: ReviewItem = {
      id: 'item-1',
      type: 'pronunciation',
      pipelineId: '2026-01-22',
      stage: 'pronunciation',
      item: {},
      context: {},
      createdAt: '2026-01-22T09:00:00.000Z',
      status: 'pending',
      resolution: null,
      resolvedAt: null,
      resolvedBy: null,
    };

    it('should dismiss a pending review item', async () => {
      mockGetDocument.mockResolvedValueOnce(mockPendingItem);
      mockUpdateDocument.mockResolvedValueOnce(undefined);

      await dismissReviewItem('item-1', 'False positive', 'operator@test.com');

      expect(mockUpdateDocument).toHaveBeenCalledWith(REVIEW_QUEUE_COLLECTION, 'item-1', {
        status: 'dismissed',
        resolution: 'False positive',
        resolvedAt: '2026-01-22T10:00:00.000Z',
        resolvedBy: 'operator@test.com',
      });
    });

    it('should throw if item not found', async () => {
      mockGetDocument.mockResolvedValueOnce(null);

      await expect(
        dismissReviewItem('nonexistent', 'reason', 'operator')
      ).rejects.toMatchObject({
        code: 'NEXUS_REVIEW_ITEM_NOT_FOUND',
      });
    });

    it('should throw if item already resolved', async () => {
      const resolvedItem = { ...mockPendingItem, status: 'resolved' as const };
      mockGetDocument.mockResolvedValueOnce(resolvedItem);

      await expect(
        dismissReviewItem('item-1', 'reason', 'operator')
      ).rejects.toMatchObject({
        code: 'NEXUS_REVIEW_ITEM_ALREADY_RESOLVED',
      });
    });
  });

  // ==========================================================================
  // getPendingReviewCount Tests
  // ==========================================================================

  describe('getPendingReviewCount', () => {
    it('should return count of pending items', async () => {
      mockQueryDocuments.mockResolvedValueOnce([
        { id: '1', status: 'pending' },
        { id: '2', status: 'pending' },
        { id: '3', status: 'pending' },
      ]);

      const count = await getPendingReviewCount();

      expect(count).toBe(3);
    });

    it('should return 0 when no pending items', async () => {
      mockQueryDocuments.mockResolvedValueOnce([]);

      const count = await getPendingReviewCount();

      expect(count).toBe(0);
    });
  });

  // ==========================================================================
  // hasPendingCriticalReviews Tests
  // ==========================================================================

  describe('hasPendingCriticalReviews', () => {
    it('should return true if pending pronunciation items exist', async () => {
      mockQueryDocuments.mockResolvedValueOnce([
        { id: '1', type: 'pronunciation', status: 'pending' },
      ]);

      const result = await hasPendingCriticalReviews();

      expect(result).toBe(true);
    });

    it('should return true if pending quality items exist', async () => {
      mockQueryDocuments.mockResolvedValueOnce([
        { id: '1', type: 'quality', status: 'pending' },
      ]);

      const result = await hasPendingCriticalReviews();

      expect(result).toBe(true);
    });

    it('should return false if only controversial items exist', async () => {
      mockQueryDocuments.mockResolvedValueOnce([
        { id: '1', type: 'controversial', status: 'pending' },
      ]);

      const result = await hasPendingCriticalReviews();

      expect(result).toBe(false);
    });

    it('should return false if no pending items', async () => {
      mockQueryDocuments.mockResolvedValueOnce([]);

      const result = await hasPendingCriticalReviews();

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // getPendingCriticalReviews Tests
  // ==========================================================================

  describe('getPendingCriticalReviews', () => {
    it('should return only pronunciation and quality items', async () => {
      mockQueryDocuments.mockResolvedValueOnce([
        { id: '1', type: 'pronunciation', status: 'pending' },
        { id: '2', type: 'quality', status: 'pending' },
        { id: '3', type: 'controversial', status: 'pending' },
        { id: '4', type: 'topic', status: 'pending' },
      ]);

      const result = await getPendingCriticalReviews();

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.type)).toEqual(['pronunciation', 'quality']);
    });

    it('should return empty array if no critical items', async () => {
      mockQueryDocuments.mockResolvedValueOnce([
        { id: '1', type: 'controversial', status: 'pending' },
      ]);

      const result = await getPendingCriticalReviews();

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // skipTopic Tests
  // ==========================================================================

  describe('skipTopic', () => {
    const mockTopicItem: ReviewItem = {
      id: 'topic-1',
      type: 'controversial',
      pipelineId: '2026-01-22',
      stage: 'news-sourcing',
      item: { topic: { title: 'Test Topic' } },
      context: {},
      createdAt: '2026-01-22T09:00:00.000Z',
      status: 'pending',
      resolution: null,
      resolvedAt: null,
      resolvedBy: null,
    };

    it('should mark topic as skipped', async () => {
      mockGetDocument.mockResolvedValueOnce(mockTopicItem);
      mockUpdateDocument.mockResolvedValueOnce(undefined);

      await skipTopic('topic-1', 'operator@test.com');

      expect(mockUpdateDocument).toHaveBeenCalledWith(REVIEW_QUEUE_COLLECTION, 'topic-1', {
        status: 'resolved',
        resolution: 'Topic skipped - will not cover',
        resolvedAt: '2026-01-22T10:00:00.000Z',
        resolvedBy: 'operator@test.com',
      });
    });
  });

  // ==========================================================================
  // requeueTopicFromReview Tests
  // ==========================================================================

  describe('requeueTopicFromReview', () => {
    const mockTopicItem: ReviewItem = {
      id: 'topic-1',
      type: 'controversial',
      pipelineId: '2026-01-22',
      stage: 'news-sourcing',
      item: { topic: { title: 'Test Topic' } },
      context: {},
      createdAt: '2026-01-22T09:00:00.000Z',
      status: 'pending',
      resolution: null,
      resolvedAt: null,
      resolvedBy: null,
    };

    it('should resolve review item with requeue message', async () => {
      mockGetDocument
        .mockResolvedValueOnce(mockTopicItem) // For type check
        .mockResolvedValueOnce(mockTopicItem); // For resolve
      mockUpdateDocument.mockResolvedValueOnce(undefined);

      await requeueTopicFromReview('topic-1', '2026-01-25', 'operator@test.com');

      expect(mockUpdateDocument).toHaveBeenCalledWith(REVIEW_QUEUE_COLLECTION, 'topic-1', {
        status: 'resolved',
        resolution: 'Topic requeued for 2026-01-25',
        resolvedAt: '2026-01-22T10:00:00.000Z',
        resolvedBy: 'operator@test.com',
      });
    });

    it('should throw if review item type is not topic-related', async () => {
      const pronunciationItem = { ...mockTopicItem, type: 'pronunciation' as const };
      mockGetDocument.mockResolvedValueOnce(pronunciationItem);

      await expect(
        requeueTopicFromReview('topic-1', '2026-01-25', 'operator')
      ).rejects.toMatchObject({
        code: 'NEXUS_REVIEW_ITEM_SAVE_FAILED',
      });
    });

    it('should throw if review item not found', async () => {
      mockGetDocument.mockResolvedValueOnce(null);

      await expect(
        requeueTopicFromReview('nonexistent', '2026-01-25', 'operator')
      ).rejects.toMatchObject({
        code: 'NEXUS_REVIEW_ITEM_NOT_FOUND',
      });
    });
  });

  // ==========================================================================
  // approveTopicWithModifications Tests
  // ==========================================================================

  describe('approveTopicWithModifications', () => {
    const mockTopicItem: ReviewItem = {
      id: 'topic-1',
      type: 'controversial',
      pipelineId: '2026-01-22',
      stage: 'news-sourcing',
      item: { topic: { title: 'Test Topic' } },
      context: {},
      createdAt: '2026-01-22T09:00:00.000Z',
      status: 'pending',
      resolution: null,
      resolvedAt: null,
      resolvedBy: null,
    };

    it('should resolve with modifications note', async () => {
      mockGetDocument.mockResolvedValueOnce(mockTopicItem);
      mockUpdateDocument.mockResolvedValueOnce(undefined);

      await approveTopicWithModifications(
        'topic-1',
        'Removed political references',
        'operator@test.com'
      );

      expect(mockUpdateDocument).toHaveBeenCalledWith(REVIEW_QUEUE_COLLECTION, 'topic-1', {
        status: 'resolved',
        resolution: 'Approved with modifications: Removed political references',
        resolvedAt: '2026-01-22T10:00:00.000Z',
        resolvedBy: 'operator@test.com',
      });
    });
  });
});
