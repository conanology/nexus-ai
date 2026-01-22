/**
 * Queue module for NEXUS-AI topic retry system
 *
 * Provides topic queue management for retry handling when pipelines fail.
 * Queued topics are stored in Firestore and processed on subsequent
 * pipeline runs to maintain content continuity.
 *
 * @module @nexus-ai/core/queue
 *
 * @example
 * ```typescript
 * import {
 *   queueFailedTopic,
 *   getQueuedTopic,
 *   clearQueuedTopic,
 *   incrementRetryCount,
 *   checkTodayQueuedTopic,
 * } from '@nexus-ai/core/queue';
 *
 * // Queue a failed topic for retry tomorrow
 * const targetDate = await queueFailedTopic(
 *   'AI Model Breakthrough',
 *   'NEXUS_TTS_TIMEOUT',
 *   'tts',
 *   '2026-01-20'
 * );
 *
 * // Check for queued topic on pipeline start
 * const queuedTopic = await checkTodayQueuedTopic();
 * if (queuedTopic && queuedTopic.retryCount < queuedTopic.maxRetries) {
 *   // Use queued topic instead of fresh sourcing
 *   const updated = await incrementRetryCount(targetDate);
 *   // ... process topic ...
 *   await clearQueuedTopic(targetDate);
 * }
 * ```
 */

// Re-export types and constants from buffer module
export {
  QUEUE_MAX_RETRIES,
  QUEUED_TOPICS_COLLECTION,
  QUEUED_TOPIC_STATUSES,
  isValidQueuedTopicStatus,
  type QueuedTopic,
  type QueuedTopicStatus,
} from '../buffer/types.js';

// Re-export path helper
export { getQueuedTopicPath } from '../storage/paths.js';

// Export manager functions
export {
  queueFailedTopic,
  getQueuedTopic,
  getQueuedTopics,
  clearQueuedTopic,
  incrementRetryCount,
  requeueTopic,
  markTopicProcessing,
  checkTodayQueuedTopic,
} from './manager.js';
