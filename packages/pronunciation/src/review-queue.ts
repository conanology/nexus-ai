/**
 * Review queue client for pronunciation terms
 *
 * Manages unknown pronunciation terms that require human review.
 * Items are stored in Firestore at review-queue/{id}
 *
 * @module @nexus-ai/pronunciation/review-queue
 */

import { FirestoreClient } from '@nexus-ai/core/storage';
import { NexusError } from '@nexus-ai/core/errors';
import { logger, CostTracker } from '@nexus-ai/core/observability';
import { withRetry } from '@nexus-ai/core/utils';
import { randomUUID } from 'node:crypto';

/**
 * Review queue item for pronunciation terms
 */
export interface ReviewQueueItem {
  /** Unique identifier */
  id: string;
  /** Type of review item (always "pronunciation" for this use case) */
  type: 'pronunciation';
  /** Pipeline ID (YYYY-MM-DD format) */
  pipelineId: string;
  /** The unknown term that needs pronunciation */
  item: string;
  /** Sentence or paragraph context where term was found */
  context: string;
  /** Review status */
  status: 'pending' | 'resolved' | 'rejected';
  /** Timestamp when item was created */
  createdAt: string;
  /** Optional: IPA pronunciation added by human reviewer */
  ipa?: string;
  /** Optional: SSML added by human reviewer */
  ssml?: string;
  /** Optional: Timestamp when item was resolved */
  resolvedAt?: string;
}

/**
 * Input for adding term to review queue
 */
export interface AddToReviewQueueInput {
  /** The unknown term */
  term: string;
  /** Sentence context where term was found */
  context: string;
  /** Pipeline ID (date: YYYY-MM-DD) */
  pipelineId: string;
}

/**
 * Review queue client for managing pronunciation review items
 */
export class ReviewQueueClient {
  private readonly firestore: FirestoreClient;
  private readonly collectionName = 'review-queue';
  private readonly log = logger.child({ component: 'nexus.pronunciation.review-queue' });
  private readonly FLAGGING_THRESHOLD = 3;

  /**
   * Create a new ReviewQueueClient
   *
   * @param projectId - Optional GCP project ID
   */
  constructor(projectId?: string) {
    this.firestore = new FirestoreClient(projectId);
  }

  /**
   * Add an unknown term to the review queue
   *
   * @param input - Review queue input with term, context, and pipeline ID
   * @returns Created review queue item
   */
  async addToReviewQueue(input: AddToReviewQueueInput): Promise<ReviewQueueItem> {
    const id = randomUUID();
    const item: ReviewQueueItem = {
      id,
      type: 'pronunciation',
      pipelineId: input.pipelineId,
      item: input.term,
      context: input.context,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    try {
      await withRetry(
        () => this.firestore.setDocument(this.collectionName, id, item),
        { stage: 'pronunciation' }
      );

      this.log.info({ term: input.term, pipelineId: input.pipelineId }, 'Added term to review queue');

      return item;
    } catch (error) {
      throw NexusError.critical(
        'NEXUS_REVIEW_QUEUE_WRITE_ERROR',
        `Failed to add term to review queue: ${input.term}`,
        'pronunciation',
        { term: input.term, error }
      );
    }
  }

  /**
   * Check if the number of unknown terms exceeds the flagging threshold
   *
   * @param unknownCount - Number of unknown terms found
   * @returns True if count exceeds threshold (>3), false otherwise
   */
  shouldFlagForReview(unknownCount: number): boolean {
    return unknownCount > this.FLAGGING_THRESHOLD;
  }

  /**
   * Get pending review queue items for a pipeline
   *
   * @param pipelineId - Pipeline ID to query
   * @returns Array of pending review items
   */
  async getPendingItems(pipelineId: string): Promise<ReviewQueueItem[]> {
    try {
      const { result } = await withRetry(
        () =>
          this.firestore.queryDocuments<ReviewQueueItem>(this.collectionName, [
            { field: 'pipelineId', operator: '==', value: pipelineId },
            { field: 'status', operator: '==', value: 'pending' },
          ]),
        { stage: 'pronunciation' }
      );

      return result;
    } catch (error) {
      this.log.error({ pipelineId, error }, 'Failed to query pending review items');
      throw NexusError.fromError(error, 'pronunciation');
    }
  }

  /**
   * Resolve a review queue item by adding it to the pronunciation dictionary
   *
   * This implements AC5: auto-add terms to dictionary once human provides IPA/SSML
   *
   * @param itemId - Review queue item ID to resolve
   * @param ipa - IPA pronunciation provided by human reviewer
   * @param ssml - Optional SSML (will be generated if not provided)
   * @param tracker - Optional CostTracker to record operation costs
   */
  async resolveReviewItem(
    itemId: string,
    ipa: string,
    ssml?: string,
    tracker?: CostTracker
  ): Promise<void> {
    try {
      this.log.info({ itemId, ipa }, 'Resolving review queue item');

      // Fetch the review item
      const { result: items } = await withRetry(
        () =>
          this.firestore.queryDocuments<ReviewQueueItem>(this.collectionName, [
            { field: 'id', operator: '==', value: itemId },
          ]),
        { stage: 'pronunciation' }
      );

      if (!items || items.length === 0) {
        throw NexusError.critical(
          'NEXUS_REVIEW_ITEM_NOT_FOUND',
          `Review queue item not found: ${itemId}`,
          'pronunciation',
          { itemId }
        );
      }

      const item = items[0];
      const { PronunciationClient } = await import('./pronunciation-client.js');
      const pronunciationClient = new PronunciationClient();

      // Add term to pronunciation dictionary
      await pronunciationClient.addTerm(
        {
          term: item.item,
          ipa,
          ssml,
          source: 'manual',
          verified: true,
        },
        tracker
      );

      // Update review queue item status
      await withRetry(
        () =>
          this.firestore.updateDocument<ReviewQueueItem>(this.collectionName, itemId, {
            status: 'resolved',
            ipa,
            ssml,
            resolvedAt: new Date().toISOString(),
          }),
        { stage: 'pronunciation' }
      );

      if (tracker) {
        tracker.recordApiCall('firestore-write', { output: 1 }, 0);
      }

      this.log.info(
        { itemId, term: item.item },
        'Review queue item resolved and added to dictionary'
      );
    } catch (error) {
      this.log.error({ itemId, error }, 'Failed to resolve review queue item');
      throw NexusError.fromError(error, 'pronunciation');
    }
  }
}
