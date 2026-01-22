/**
 * Buffer video types and constants for NEXUS-AI emergency content system
 *
 * Provides strongly-typed buffer video management following NFR5 requirements:
 * - Buffer video document structure for Firestore
 * - Status tracking: active, deployed, archived
 * - Health monitoring thresholds
 * - Deployment result tracking
 *
 * @module @nexus-ai/core/buffer/types
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Firestore collection name for buffer videos
 */
export const BUFFER_COLLECTION = 'buffer-videos';

/**
 * Buffer count thresholds for alerting
 * Per NFR5: Minimum 1 buffer video at all times
 */
export const BUFFER_THRESHOLDS = {
  /** NFR5: Absolute minimum buffers required */
  MINIMUM_COUNT: 1,
  /** Early warning threshold for operator action */
  WARNING_COUNT: 2,
} as const;

/**
 * Buffer video validation constraints
 */
export const BUFFER_VALIDATION = {
  /** Maximum title length per story requirements */
  MAX_TITLE_LENGTH: 100,
  /** Minimum video duration in seconds (5 min) */
  MIN_DURATION_SEC: 60,
  /** Maximum video duration in seconds (15 min) */
  MAX_DURATION_SEC: 900,
  /** YouTube video ID regex pattern */
  YOUTUBE_VIDEO_ID_PATTERN: /^[a-zA-Z0-9_-]{11}$/,
} as const;

/**
 * Valid buffer video statuses
 */
export const BUFFER_VIDEO_STATUSES = ['active', 'deployed', 'archived'] as const;

/**
 * Type guard to check if a string is a valid buffer video status
 */
export function isValidBufferVideoStatus(status: string): status is BufferVideoStatus {
  return BUFFER_VIDEO_STATUSES.includes(status as BufferVideoStatus);
}

// =============================================================================
// Core Types
// =============================================================================

/**
 * Buffer video lifecycle status
 * - active: Available for deployment
 * - deployed: Has been used to cover a pipeline failure
 * - archived: Retired, no longer available for deployment
 */
export type BufferVideoStatus = (typeof BUFFER_VIDEO_STATUSES)[number];

/**
 * Buffer video source - how the buffer was created
 */
export type BufferSource = 'manual' | 'auto';

/**
 * Health status indicator for buffer system
 */
export type BufferSystemStatus = 'healthy' | 'warning' | 'critical';

// =============================================================================
// Document Interfaces
// =============================================================================

/**
 * Buffer video document stored in Firestore at buffer-videos/{id}
 *
 * Buffer videos are pre-published YouTube videos (private/unlisted) that can be
 * scheduled for public release when the daily pipeline fails. This ensures
 * the channel always publishes content (NFR1).
 */
export interface BufferVideo {
  // Core identification
  /** UUID (auto-generated with 'bf-' prefix) */
  id: string;
  /** YouTube video ID (already uploaded as private/unlisted) */
  videoId: string;

  // Content metadata
  /** Evergreen topic (e.g., "Top 5 AI Papers This Week") */
  topic: string;
  /** Video title (max 100 chars) */
  title: string;
  /** Video description snippet (optional) */
  description?: string;

  // Lifecycle tracking
  /** ISO 8601 UTC timestamp when buffer was created */
  createdDate: string;
  /** Has buffer been deployed? */
  used: boolean;
  /** ISO 8601 UTC when deployed (if used) */
  usedDate?: string;
  /** Number of times deployed (typically 0 or 1) */
  deploymentCount: number;

  // Quality metadata
  /** Video length in seconds (typically 300-480 sec for 5-8 min) */
  durationSec: number;
  /** Cloud Storage URL to thumbnail backup (optional) */
  thumbnailPath?: string;

  // Source/classification
  /** How buffer was created */
  source: BufferSource;
  /** Is this evergreen content (always true for buffers) */
  evergreen: boolean;

  // Status tracking
  /** Current lifecycle status */
  status: BufferVideoStatus;
  /** ISO 8601 UTC when buffer was archived (if archived) */
  retirementDate?: string;
}

// =============================================================================
// Operation Interfaces
// =============================================================================

/**
 * Input for creating a new buffer video
 */
export interface CreateBufferInput {
  /** YouTube video ID (already uploaded) */
  videoId: string;
  /** Evergreen topic for the buffer */
  topic: string;
  /** Video title */
  title: string;
  /** Video description (optional) */
  description?: string;
  /** Video duration in seconds */
  durationSec: number;
  /** Cloud Storage thumbnail path (optional) */
  thumbnailPath?: string;
  /** How buffer was created */
  source: BufferSource;
}

/**
 * Result of a buffer deployment operation
 */
export interface BufferDeploymentResult {
  /** Whether deployment succeeded */
  success: boolean;
  /** ID of the buffer that was deployed */
  bufferId: string;
  /** YouTube video ID (only on success) */
  videoId?: string;
  /** ISO 8601 UTC scheduled publish time (only on success) */
  scheduledTime?: string;
  /** Buffer status before deployment */
  previousStatus?: BufferVideoStatus;
  /** Buffer status after deployment */
  newStatus?: BufferVideoStatus;
  /** Error message if deployment failed */
  error?: string;
}

// =============================================================================
// Health & Monitoring Interfaces
// =============================================================================

/**
 * Buffer system health status for health check integration
 */
export interface BufferHealthStatus {
  /** Total buffer videos in system */
  totalCount: number;
  /** Buffers available for deployment (status: active, used: false) */
  availableCount: number;
  /** Buffers that have been deployed (status: deployed) */
  deployedCount: number;
  /** Overall health status */
  status: BufferSystemStatus;
  /** Is available count below WARNING_COUNT threshold? */
  belowWarningThreshold: boolean;
  /** Is available count below MINIMUM_COUNT threshold? */
  belowMinimumThreshold: boolean;
  /** ISO 8601 UTC when health was last checked */
  lastChecked: string;
}

/**
 * Buffer summary for daily digest integration
 */
export interface BufferSummary {
  /** Summary date in YYYY-MM-DD format */
  date: string;
  /** Total buffer videos in inventory */
  totalBuffers: number;
  /** Buffers available for deployment */
  availableBuffers: number;
  /** Buffers deployed on this date */
  deployedToday: number;
  /** Overall health status */
  healthStatus: BufferSystemStatus;
  /** ISO 8601 UTC of oldest available buffer (if any) */
  oldestBufferDate?: string;
}

// =============================================================================
// Queue Types
// =============================================================================

/**
 * Maximum retry attempts for queued topics per FR46
 */
export const QUEUE_MAX_RETRIES = 2;

/**
 * Firestore collection name for queued topics
 */
export const QUEUED_TOPICS_COLLECTION = 'queued-topics';

/**
 * Valid queued topic statuses
 */
export const QUEUED_TOPIC_STATUSES = ['pending', 'processing', 'abandoned'] as const;

/**
 * Queued topic status
 * - pending: Waiting to be processed on target date
 * - processing: Currently being processed in pipeline
 * - abandoned: Max retries exceeded, topic will not be retried
 */
export type QueuedTopicStatus = (typeof QUEUED_TOPIC_STATUSES)[number];

/**
 * Type guard to check if a string is a valid queued topic status
 */
export function isValidQueuedTopicStatus(status: string): status is QueuedTopicStatus {
  return QUEUED_TOPIC_STATUSES.includes(status as QueuedTopicStatus);
}

/**
 * Queued topic for retry after buffer deployment
 * Stored at queued-topics/{date}
 */
export interface QueuedTopic {
  /** The topic that failed */
  topic: string;
  /** Error code from the failure */
  failureReason: string;
  /** Stage where failure occurred */
  failureStage: string;
  /** Original pipeline date when failure occurred */
  originalDate: string;
  /** ISO 8601 UTC when topic was queued */
  queuedDate: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum retry attempts per FR46 */
  maxRetries: number;
  /** Current status of the queued topic (required for queue processing) */
  status: QueuedTopicStatus;
}

// =============================================================================
// Cache Types
// =============================================================================

/**
 * Cache entry for buffer queries
 */
export interface BufferCacheEntry<T> {
  /** Cached data */
  data: T;
  /** When cache entry was created (ms since epoch) */
  timestamp: number;
}

/**
 * Cache TTL for buffer queries in milliseconds (5 minutes)
 */
export const BUFFER_CACHE_TTL_MS = 5 * 60 * 1000;
