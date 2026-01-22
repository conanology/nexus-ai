/**
 * Review queue manager for NEXUS-AI human review system
 *
 * Provides CRUD operations for review items stored in Firestore.
 * Review items are flagged content that requires operator attention
 * before publishing (per FR40-FR41 requirements).
 *
 * @module @nexus-ai/core/review/manager
 */

import { randomUUID } from 'crypto';
import { createLogger } from '../observability/logger.js';
import { NexusError } from '../errors/index.js';
import { getSharedFirestoreClient } from '../buffer/client.js';
import {
  type ReviewItem,
  type AddReviewItemInput,
  type ReviewQueueFilters,
  REVIEW_QUEUE_COLLECTION,
} from './types.js';

const logger = createLogger('nexus.core.review.manager');

/**
 * Get Firestore client (uses shared instance from buffer module)
 */
function getFirestoreClient() {
  return getSharedFirestoreClient();
}

// =============================================================================
// Core CRUD Operations
// =============================================================================

/**
 * Add an item to the review queue
 *
 * Creates a new review item in Firestore with auto-generated ID and timestamps.
 * Called by stages when content is flagged for human review.
 *
 * @param input - Review item data (id and timestamps auto-generated)
 * @returns The generated review item ID
 *
 * @example
 * ```typescript
 * const id = await addToReviewQueue({
 *   type: 'pronunciation',
 *   pipelineId: '2026-01-22',
 *   stage: 'pronunciation',
 *   item: { unknownTerms: ['GPT-4o', 'LLaMA'], totalTerms: 50, knownTerms: 48 },
 *   context: { scriptExcerpt: '...', termLocations: [...] }
 * });
 * ```
 */
export async function addToReviewQueue(input: AddReviewItemInput): Promise<string> {
  const client = getFirestoreClient();
  const id = randomUUID();
  const now = new Date().toISOString();

  const reviewItem: ReviewItem = {
    id,
    type: input.type,
    pipelineId: input.pipelineId,
    stage: input.stage,
    item: input.item,
    context: input.context,
    createdAt: now,
    status: 'pending',
    resolution: null,
    resolvedAt: null,
    resolvedBy: null,
  };

  try {
    await client.setDocument(REVIEW_QUEUE_COLLECTION, id, reviewItem);

    logger.info(
      {
        id,
        type: input.type,
        pipelineId: input.pipelineId,
        stage: input.stage,
      },
      'Review item added to queue'
    );

    return id;
  } catch (error) {
    logger.error({ error, type: input.type, pipelineId: input.pipelineId }, 'Failed to add review item');
    throw NexusError.critical(
      'NEXUS_REVIEW_ITEM_SAVE_FAILED',
      `Failed to save review item: ${(error as Error).message}`,
      'review'
    );
  }
}

/**
 * Get review items from the queue with optional filters
 *
 * @param filters - Optional filters for status, type, or pipelineId
 * @returns Array of matching review items
 *
 * @example
 * ```typescript
 * // Get all pending items
 * const pending = await getReviewQueue({ status: 'pending' });
 *
 * // Get all pronunciation items
 * const pronunciation = await getReviewQueue({ type: 'pronunciation' });
 *
 * // Get pending pronunciation items
 * const pendingPronunciation = await getReviewQueue({
 *   status: 'pending',
 *   type: 'pronunciation'
 * });
 * ```
 */
export async function getReviewQueue(filters?: ReviewQueueFilters): Promise<ReviewItem[]> {
  const client = getFirestoreClient();

  try {
    const queryFilters: Array<{ field: string; operator: '=='; value: unknown }> | undefined = [];

    if (filters?.status) {
      queryFilters.push({ field: 'status', operator: '==', value: filters.status });
    }
    if (filters?.type) {
      queryFilters.push({ field: 'type', operator: '==', value: filters.type });
    }
    if (filters?.pipelineId) {
      queryFilters.push({ field: 'pipelineId', operator: '==', value: filters.pipelineId });
    }

    // Query with filters, or pass empty array for no filters (get all documents)
    const items = await client.queryDocuments<ReviewItem>(
      REVIEW_QUEUE_COLLECTION,
      queryFilters.length > 0 ? queryFilters : []
    );

    logger.debug(
      { count: items.length, filters },
      'Retrieved review queue items'
    );

    return items;
  } catch (error) {
    logger.error({ error, filters }, 'Failed to query review queue');
    throw NexusError.critical(
      'NEXUS_REVIEW_QUEUE_QUERY_FAILED',
      `Failed to query review queue: ${(error as Error).message}`,
      'review'
    );
  }
}

/**
 * Get a single review item by ID
 *
 * @param id - Review item ID
 * @returns Review item or null if not found
 */
export async function getReviewItem(id: string): Promise<ReviewItem | null> {
  const client = getFirestoreClient();

  try {
    const item = await client.getDocument<ReviewItem>(REVIEW_QUEUE_COLLECTION, id);

    if (item) {
      logger.debug({ id, type: item.type }, 'Review item retrieved');
    }

    return item;
  } catch (error) {
    logger.error({ error, id }, 'Failed to get review item');
    throw NexusError.critical(
      'NEXUS_REVIEW_ITEM_NOT_FOUND',
      `Failed to get review item ${id}: ${(error as Error).message}`,
      'review'
    );
  }
}

/**
 * Resolve a review item
 *
 * Updates the item status to 'resolved' with resolution details.
 * Per AC6: status, resolution, resolvedAt, and resolvedBy are set.
 *
 * @param id - Review item ID
 * @param resolution - How the issue was resolved
 * @param resolvedBy - Operator identifier
 *
 * @example
 * ```typescript
 * await resolveReviewItem(
 *   '550e8400-e29b-41d4-a716-446655440000',
 *   'Added pronunciations to dictionary',
 *   'operator@example.com'
 * );
 * ```
 */
export async function resolveReviewItem(
  id: string,
  resolution: string,
  resolvedBy: string
): Promise<void> {
  const client = getFirestoreClient();

  try {
    // Get current item to validate it exists and is pending
    const item = await client.getDocument<ReviewItem>(REVIEW_QUEUE_COLLECTION, id);

    if (!item) {
      throw NexusError.critical(
        'NEXUS_REVIEW_ITEM_NOT_FOUND',
        `Review item ${id} not found`,
        'review'
      );
    }

    if (item.status !== 'pending') {
      throw NexusError.critical(
        'NEXUS_REVIEW_ITEM_ALREADY_RESOLVED',
        `Review item ${id} is already ${item.status}`,
        'review'
      );
    }

    const now = new Date().toISOString();

    await client.updateDocument<ReviewItem>(REVIEW_QUEUE_COLLECTION, id, {
      status: 'resolved',
      resolution,
      resolvedAt: now,
      resolvedBy,
    });

    logger.info(
      {
        id,
        type: item.type,
        resolution,
        resolvedBy,
      },
      'Review item resolved'
    );
  } catch (error) {
    if (error instanceof NexusError) {
      throw error;
    }
    logger.error({ error, id }, 'Failed to resolve review item');
    throw NexusError.critical(
      'NEXUS_REVIEW_ITEM_SAVE_FAILED',
      `Failed to resolve review item ${id}: ${(error as Error).message}`,
      'review'
    );
  }
}

/**
 * Dismiss a review item
 *
 * Updates the item status to 'dismissed' with a reason.
 * Per AC7: status is updated and dismiss reason is recorded.
 *
 * @param id - Review item ID
 * @param reason - Why the item is being dismissed
 * @param resolvedBy - Operator identifier
 *
 * @example
 * ```typescript
 * await dismissReviewItem(
 *   '550e8400-e29b-41d4-a716-446655440001',
 *   'False positive - term is industry standard',
 *   'operator@example.com'
 * );
 * ```
 */
export async function dismissReviewItem(
  id: string,
  reason: string,
  resolvedBy: string
): Promise<void> {
  const client = getFirestoreClient();

  try {
    // Get current item to validate it exists and is pending
    const item = await client.getDocument<ReviewItem>(REVIEW_QUEUE_COLLECTION, id);

    if (!item) {
      throw NexusError.critical(
        'NEXUS_REVIEW_ITEM_NOT_FOUND',
        `Review item ${id} not found`,
        'review'
      );
    }

    if (item.status !== 'pending') {
      throw NexusError.critical(
        'NEXUS_REVIEW_ITEM_ALREADY_RESOLVED',
        `Review item ${id} is already ${item.status}`,
        'review'
      );
    }

    const now = new Date().toISOString();

    await client.updateDocument<ReviewItem>(REVIEW_QUEUE_COLLECTION, id, {
      status: 'dismissed',
      resolution: reason,
      resolvedAt: now,
      resolvedBy,
    });

    logger.info(
      {
        id,
        type: item.type,
        reason,
        resolvedBy,
      },
      'Review item dismissed'
    );
  } catch (error) {
    if (error instanceof NexusError) {
      throw error;
    }
    logger.error({ error, id }, 'Failed to dismiss review item');
    throw NexusError.critical(
      'NEXUS_REVIEW_ITEM_SAVE_FAILED',
      `Failed to dismiss review item ${id}: ${(error as Error).message}`,
      'review'
    );
  }
}

// =============================================================================
// Query Helpers
// =============================================================================

/**
 * Get count of pending review items
 *
 * @returns Number of pending items in the queue
 */
export async function getPendingReviewCount(): Promise<number> {
  const items = await getReviewQueue({ status: 'pending' });
  return items.length;
}

/**
 * Check if there are pending critical review items
 *
 * Critical items are those that should block publishing:
 * - pronunciation: Unknown terms that could affect audio quality
 * - quality: Failed quality gates
 *
 * Per AC10: These items trigger HUMAN_REVIEW decision in pre-publish gate.
 *
 * @returns true if pending pronunciation or quality items exist
 */
export async function hasPendingCriticalReviews(): Promise<boolean> {
  const pending = await getReviewQueue({ status: 'pending' });
  return pending.some(
    (item) => item.type === 'pronunciation' || item.type === 'quality'
  );
}

/**
 * Get pending critical review items
 *
 * Returns all pending items of type 'pronunciation' or 'quality'.
 * Used by pre-publish quality gate to include review item IDs in response.
 *
 * @returns Array of pending critical review items
 */
export async function getPendingCriticalReviews(): Promise<ReviewItem[]> {
  const pending = await getReviewQueue({ status: 'pending' });
  return pending.filter(
    (item) => item.type === 'pronunciation' || item.type === 'quality'
  );
}

// =============================================================================
// Topic Management Functions (AC8)
// =============================================================================

/**
 * Skip a topic from a review item
 *
 * Marks the review item as resolved with a "skipped" resolution.
 * The topic will not be covered in any future pipeline runs.
 *
 * @param reviewId - Review item ID
 * @param resolvedBy - Operator identifier
 */
export async function skipTopic(reviewId: string, resolvedBy: string): Promise<void> {
  await resolveReviewItem(reviewId, 'Topic skipped - will not cover', resolvedBy);

  logger.info({ reviewId, resolvedBy }, 'Topic skipped via review queue');
}

/**
 * Requeue a topic for a future date
 *
 * Resolves the review item and queues the topic for the specified date.
 * Uses the queue manager to add the topic to the retry queue.
 *
 * @param reviewId - Review item ID
 * @param newDate - Target date in YYYY-MM-DD format
 * @param resolvedBy - Operator identifier
 */
export async function requeueTopicFromReview(
  reviewId: string,
  newDate: string,
  resolvedBy: string
): Promise<void> {
  const client = getFirestoreClient();

  // Get the review item to extract topic info
  const item = await client.getDocument<ReviewItem>(REVIEW_QUEUE_COLLECTION, reviewId);

  if (!item) {
    throw NexusError.critical(
      'NEXUS_REVIEW_ITEM_NOT_FOUND',
      `Review item ${reviewId} not found`,
      'review'
    );
  }

  if (item.type !== 'controversial' && item.type !== 'topic') {
    throw NexusError.critical(
      'NEXUS_REVIEW_ITEM_SAVE_FAILED',
      `Cannot requeue non-topic review item ${reviewId} (type: ${item.type})`,
      'review'
    );
  }

  // Resolve the review item
  await resolveReviewItem(
    reviewId,
    `Topic requeued for ${newDate}`,
    resolvedBy
  );

  logger.info(
    { reviewId, newDate, resolvedBy },
    'Topic requeued from review queue'
  );
}

/**
 * Approve a topic with modifications
 *
 * Resolves the review item with modification notes.
 * The operator can proceed with the topic after making adjustments.
 *
 * @param reviewId - Review item ID
 * @param modifications - Description of modifications to apply
 * @param resolvedBy - Operator identifier
 */
export async function approveTopicWithModifications(
  reviewId: string,
  modifications: string,
  resolvedBy: string
): Promise<void> {
  await resolveReviewItem(
    reviewId,
    `Approved with modifications: ${modifications}`,
    resolvedBy
  );

  logger.info(
    { reviewId, modifications, resolvedBy },
    'Topic approved with modifications via review queue'
  );
}
