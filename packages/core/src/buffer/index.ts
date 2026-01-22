/**
 * Buffer video module for NEXUS-AI emergency content system
 *
 * Provides buffer video management for maintaining channel reliability (NFR1).
 * Buffer videos are pre-published YouTube videos that can be scheduled for
 * public release when the daily pipeline fails.
 *
 * @module @nexus-ai/core/buffer
 *
 * @example
 * ```typescript
 * import {
 *   createBufferVideo,
 *   selectBufferForDeployment,
 *   deployBuffer,
 *   getBufferHealthStatus,
 * } from '@nexus-ai/core/buffer';
 *
 * // Create a new buffer video
 * const buffer = await createBufferVideo({
 *   videoId: 'dQw4w9WgXcQ',
 *   topic: 'Top 5 AI Papers This Week',
 *   title: 'Top 5 AI Research Papers',
 *   durationSec: 360,
 *   source: 'manual',
 * });
 *
 * // Deploy a buffer when pipeline fails
 * const selected = await selectBufferForDeployment();
 * const result = await deployBuffer(selected.id, '2026-01-20');
 *
 * // Monitor buffer health
 * const health = await getBufferHealthStatus();
 * if (health.status === 'critical') {
 *   // Send alert
 * }
 * ```
 */

// Types and constants
export {
  // Constants
  BUFFER_COLLECTION,
  BUFFER_THRESHOLDS,
  BUFFER_VALIDATION,
  BUFFER_VIDEO_STATUSES,
  BUFFER_CACHE_TTL_MS,
  QUEUE_MAX_RETRIES,
  QUEUED_TOPICS_COLLECTION,
  QUEUED_TOPIC_STATUSES,

  // Type guards
  isValidBufferVideoStatus,
  isValidQueuedTopicStatus,

  // Types
  type BufferVideo,
  type BufferVideoStatus,
  type BufferSource,
  type BufferSystemStatus,
  type CreateBufferInput,
  type BufferDeploymentResult,
  type BufferHealthStatus,
  type BufferSummary,
  type QueuedTopic,
  type QueuedTopicStatus,
  type BufferCacheEntry,
} from './types.js';

// Shared client utilities
export {
  getSharedFirestoreClient,
  resetSharedClient,
} from './client.js';

// Manager functions
export {
  createBufferVideo,
  getBufferById,
  listAvailableBuffers,
  deployBuffer,
  archiveBuffer,
  clearBufferCache,
} from './manager.js';

// Selector functions
export {
  selectBufferForDeployment,
  getBufferDeploymentCandidate,
} from './selector.js';

// Monitor functions
export {
  getBufferCount,
  getBufferHealthStatus,
  getBufferSummaryForDigest,
  clearMonitorCache,
} from './monitor.js';
