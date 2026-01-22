/**
 * Queue manager for NEXUS-AI topic retry system
 *
 * Provides CRUD operations for queued topics stored in Firestore.
 * Queued topics are failed topics that will be retried on the next
 * pipeline run to maintain content continuity.
 *
 * @module @nexus-ai/core/queue/manager
 */

import { createLogger } from '../observability/logger.js';
import { NexusError } from '../errors/index.js';
import { getSharedFirestoreClient } from '../buffer/client.js';
import {
  type QueuedTopic,
  QUEUE_MAX_RETRIES,
  QUEUED_TOPICS_COLLECTION,
} from '../buffer/types.js';

const logger = createLogger('nexus.core.queue.manager');

/**
 * Get Firestore client (uses shared instance from buffer module)
 */
function getFirestoreClient() {
  return getSharedFirestoreClient();
}

// =============================================================================
// Date Utilities
// =============================================================================

/**
 * Get tomorrow's date in YYYY-MM-DD format
 */
function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// =============================================================================
// Queue Operations
// =============================================================================

/**
 * Queue a failed topic for retry on the next day
 *
 * This is called when a pipeline fails after a topic has been selected.
 * The topic is saved to Firestore for retry on the next day's pipeline run.
 *
 * @param topic - The topic string that failed
 * @param failureReason - Error code from the failure
 * @param failureStage - Stage where failure occurred
 * @param originalDate - YYYY-MM-DD when originally attempted
 * @returns The queued topic ID (target retry date)
 *
 * @example
 * ```typescript
 * const id = await queueFailedTopic(
 *   'AI Model Achieves Breakthrough',
 *   'NEXUS_TTS_TIMEOUT',
 *   'tts',
 *   '2026-01-20'
 * );
 * // id = '2026-01-21' (tomorrow's date)
 * ```
 */
export async function queueFailedTopic(
  topic: string,
  failureReason: string,
  failureStage: string,
  originalDate: string
): Promise<string> {
  const client = getFirestoreClient();
  const targetDate = getTomorrowDate();
  const now = new Date().toISOString();

  const queuedTopic: QueuedTopic = {
    topic,
    failureReason,
    failureStage,
    originalDate,
    queuedDate: now,
    retryCount: 0,
    maxRetries: QUEUE_MAX_RETRIES,
    status: 'pending',
  };

  try {
    await client.setDocument(QUEUED_TOPICS_COLLECTION, targetDate, queuedTopic);

    logger.info(
      {
        targetDate,
        topic,
        failureReason,
        failureStage,
        originalDate,
      },
      'Topic queued for retry'
    );

    return targetDate;
  } catch (error) {
    logger.error({ error, topic, failureReason }, 'Failed to queue topic');
    throw NexusError.critical(
      'NEXUS_QUEUE_TOPIC_SAVE_FAILED',
      `Failed to queue topic: ${(error as Error).message}`,
      'queue'
    );
  }
}

/**
 * Get queued topic for a specific date
 *
 * @param date - Target date in YYYY-MM-DD format
 * @returns Queued topic or null if not found
 *
 * @example
 * ```typescript
 * const topic = await getQueuedTopic('2026-01-21');
 * if (topic && topic.retryCount < topic.maxRetries) {
 *   // Process the queued topic
 * }
 * ```
 */
export async function getQueuedTopic(date: string): Promise<QueuedTopic | null> {
  const client = getFirestoreClient();

  try {
    const queuedTopic = await client.getDocument<QueuedTopic>(
      QUEUED_TOPICS_COLLECTION,
      date
    );

    if (queuedTopic) {
      logger.debug({ date, topic: queuedTopic.topic }, 'Queued topic found');
    }

    return queuedTopic;
  } catch (error) {
    logger.error({ error, date }, 'Failed to get queued topic');
    throw NexusError.critical(
      'NEXUS_QUEUE_TOPIC_NOT_FOUND',
      `Failed to get queued topic for ${date}: ${(error as Error).message}`,
      'queue'
    );
  }
}

/**
 * Get all pending queued topics
 *
 * @returns Array of queued topics with status 'pending'
 */
export async function getQueuedTopics(): Promise<QueuedTopic[]> {
  const client = getFirestoreClient();

  try {
    const topics = await client.queryDocuments<QueuedTopic>(
      QUEUED_TOPICS_COLLECTION,
      [{ field: 'status', operator: '==', value: 'pending' }]
    );

    logger.debug({ count: topics.length }, 'Listed pending queued topics');

    return topics;
  } catch (error) {
    logger.error({ error }, 'Failed to list queued topics');
    throw NexusError.critical(
      'NEXUS_QUEUE_TOPIC_NOT_FOUND',
      `Failed to list queued topics: ${(error as Error).message}`,
      'queue'
    );
  }
}

/**
 * Clear (remove) a queued topic from the queue
 *
 * Call this when a queued topic is successfully processed.
 *
 * @param date - Target date in YYYY-MM-DD format
 *
 * @example
 * ```typescript
 * // After successfully processing a queued topic
 * await clearQueuedTopic('2026-01-21');
 * ```
 */
export async function clearQueuedTopic(date: string): Promise<void> {
  const client = getFirestoreClient();

  try {
    await client.deleteDocument(QUEUED_TOPICS_COLLECTION, date);

    logger.info({ date }, 'Queued topic cleared');
  } catch (error) {
    logger.error({ error, date }, 'Failed to clear queued topic');
    throw NexusError.critical(
      'NEXUS_QUEUE_TOPIC_CLEAR_FAILED',
      `Failed to clear queued topic for ${date}: ${(error as Error).message}`,
      'queue'
    );
  }
}

/**
 * Increment retry count for a queued topic
 *
 * Returns the updated topic, or null if max retries exceeded
 * (in which case the topic is marked as abandoned).
 *
 * @param date - Target date in YYYY-MM-DD format
 * @returns Updated queued topic, or null if max retries reached
 *
 * @note This function uses a read-then-update pattern without a Firestore
 * transaction. In practice, only one pipeline runs per day so concurrent
 * access is unlikely. If concurrent access becomes possible, consider
 * implementing a Firestore transaction to prevent race conditions.
 * TODO: Consider using Firestore transaction for atomic read-modify-write
 *
 * @example
 * ```typescript
 * const updated = await incrementRetryCount('2026-01-21');
 * if (updated === null) {
 *   // Topic was abandoned (max retries reached)
 * }
 * ```
 */
export async function incrementRetryCount(
  date: string
): Promise<QueuedTopic | null> {
  const client = getFirestoreClient();

  try {
    // Get current state
    const topic = await client.getDocument<QueuedTopic>(
      QUEUED_TOPICS_COLLECTION,
      date
    );

    if (!topic) {
      logger.warn({ date }, 'Cannot increment retry count: topic not found');
      return null;
    }

    const newRetryCount = topic.retryCount + 1;

    // Check if max retries exceeded
    if (newRetryCount >= topic.maxRetries) {
      // Mark as abandoned instead of deleting
      await client.updateDocument<QueuedTopic>(QUEUED_TOPICS_COLLECTION, date, {
        status: 'abandoned',
        retryCount: newRetryCount,
      });

      logger.warn(
        {
          date,
          topic: topic.topic,
          retryCount: newRetryCount,
          maxRetries: topic.maxRetries,
        },
        'Topic abandoned after max retries'
      );

      return null;
    }

    // Increment retry count and mark as processing
    await client.updateDocument<QueuedTopic>(QUEUED_TOPICS_COLLECTION, date, {
      retryCount: newRetryCount,
      status: 'processing',
    });

    const updated: QueuedTopic = {
      ...topic,
      retryCount: newRetryCount,
      status: 'processing',
    };

    logger.info(
      {
        date,
        topic: topic.topic,
        retryCount: newRetryCount,
        maxRetries: topic.maxRetries,
      },
      'Retry count incremented'
    );

    return updated;
  } catch (error) {
    logger.error({ error, date }, 'Failed to increment retry count');
    throw NexusError.critical(
      'NEXUS_QUEUE_TOPIC_SAVE_FAILED',
      `Failed to increment retry count for ${date}: ${(error as Error).message}`,
      'queue'
    );
  }
}

/**
 * Requeue a topic to a new target date
 *
 * Used when a topic needs to be moved to a different date (e.g., weekend skip).
 *
 * @param currentDate - Current target date in YYYY-MM-DD format
 * @param newDate - New target date in YYYY-MM-DD format
 *
 * @example
 * ```typescript
 * // Move topic from Saturday to Monday
 * await requeueTopic('2026-01-25', '2026-01-27');
 * ```
 */
export async function requeueTopic(
  currentDate: string,
  newDate: string
): Promise<void> {
  const client = getFirestoreClient();

  try {
    // Get current topic
    const topic = await client.getDocument<QueuedTopic>(
      QUEUED_TOPICS_COLLECTION,
      currentDate
    );

    if (!topic) {
      throw NexusError.critical(
        'NEXUS_QUEUE_TOPIC_NOT_FOUND',
        `Cannot requeue: topic not found for ${currentDate}`,
        'queue'
      );
    }

    // Create new entry with updated queued date
    const requeuedTopic: QueuedTopic = {
      ...topic,
      queuedDate: new Date().toISOString(),
      status: 'pending',
    };

    // Save to new date
    await client.setDocument(QUEUED_TOPICS_COLLECTION, newDate, requeuedTopic);

    // Delete from old date
    await client.deleteDocument(QUEUED_TOPICS_COLLECTION, currentDate);

    logger.info(
      {
        currentDate,
        newDate,
        topic: topic.topic,
      },
      'Topic requeued to new date'
    );
  } catch (error) {
    if (error instanceof NexusError) {
      throw error;
    }
    logger.error({ error, currentDate, newDate }, 'Failed to requeue topic');
    throw NexusError.critical(
      'NEXUS_QUEUE_TOPIC_SAVE_FAILED',
      `Failed to requeue topic from ${currentDate} to ${newDate}: ${(error as Error).message}`,
      'queue'
    );
  }
}

/**
 * Mark a queued topic as processing
 *
 * @param date - Target date in YYYY-MM-DD format
 */
export async function markTopicProcessing(date: string): Promise<void> {
  const client = getFirestoreClient();

  try {
    await client.updateDocument<QueuedTopic>(QUEUED_TOPICS_COLLECTION, date, {
      status: 'processing',
    });

    logger.debug({ date }, 'Topic marked as processing');
  } catch (error) {
    logger.error({ error, date }, 'Failed to mark topic as processing');
    throw NexusError.critical(
      'NEXUS_QUEUE_TOPIC_SAVE_FAILED',
      `Failed to mark topic as processing for ${date}: ${(error as Error).message}`,
      'queue'
    );
  }
}

/**
 * Check if there is a queued topic for today
 *
 * @returns Queued topic if exists and pending, null otherwise
 */
export async function checkTodayQueuedTopic(): Promise<QueuedTopic | null> {
  const today = getTodayDate();
  const topic = await getQueuedTopic(today);

  if (topic && topic.status === 'pending') {
    return topic;
  }

  return null;
}
