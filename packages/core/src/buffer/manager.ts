/**
 * Buffer video manager for NEXUS-AI emergency content system
 *
 * Provides CRUD operations for buffer videos stored in Firestore.
 * Buffer videos are pre-published YouTube videos that can be scheduled
 * for public release when the daily pipeline fails.
 *
 * @module @nexus-ai/core/buffer/manager
 */

import { createLogger } from '../observability/logger.js';
import { NexusError } from '../errors/index.js';
import {
  BUFFER_COLLECTION,
  BUFFER_CACHE_TTL_MS,
  BUFFER_VALIDATION,
  type BufferVideo,
  type CreateBufferInput,
  type BufferDeploymentResult,
  type BufferCacheEntry,
} from './types.js';
import { getSharedFirestoreClient } from './client.js';
import { clearMonitorCache } from './monitor.js';
import { randomUUID } from 'crypto';

const logger = createLogger('nexus.core.buffer.manager');

/**
 * Get Firestore client (uses shared instance)
 */
function getFirestoreClient() {
  return getSharedFirestoreClient();
}

// =============================================================================
// Query Cache
// =============================================================================

const queryCache = new Map<string, BufferCacheEntry<unknown>>();

/**
 * Get cached value if not expired
 */
function getCached<T>(key: string): T | null {
  const cached = queryCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > BUFFER_CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }
  return cached.data as T;
}

/**
 * Set cache value
 */
function setCache<T>(key: string, data: T): void {
  queryCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Clear all buffer cache entries (manager and monitor)
 * Call after mutations that affect buffer state
 */
export function clearBufferCache(): void {
  queryCache.clear();
  // Also clear monitor cache to prevent stale health data
  clearMonitorCache();
}

// =============================================================================
// Buffer ID Generation
// =============================================================================

/**
 * Generate a unique buffer video ID using cryptographic randomness
 * Format: bf-{uuid}
 */
function generateBufferId(): string {
  return `bf-${randomUUID()}`;
}

// =============================================================================
// Input Validation
// =============================================================================

/**
 * Validate buffer video creation input
 * @throws NexusError if validation fails
 */
function validateCreateInput(input: CreateBufferInput): void {
  // Validate title length
  if (input.title.length > BUFFER_VALIDATION.MAX_TITLE_LENGTH) {
    throw NexusError.critical(
      'NEXUS_BUFFER_INVALID_STATUS',
      `Title exceeds maximum length of ${BUFFER_VALIDATION.MAX_TITLE_LENGTH} characters`,
      'buffer'
    );
  }

  // Validate video ID format (YouTube video IDs are 11 characters)
  if (!BUFFER_VALIDATION.YOUTUBE_VIDEO_ID_PATTERN.test(input.videoId)) {
    throw NexusError.critical(
      'NEXUS_BUFFER_INVALID_STATUS',
      `Invalid YouTube video ID format: ${input.videoId}`,
      'buffer'
    );
  }

  // Validate duration range
  if (
    input.durationSec < BUFFER_VALIDATION.MIN_DURATION_SEC ||
    input.durationSec > BUFFER_VALIDATION.MAX_DURATION_SEC
  ) {
    throw NexusError.critical(
      'NEXUS_BUFFER_INVALID_STATUS',
      `Duration ${input.durationSec}s out of valid range (${BUFFER_VALIDATION.MIN_DURATION_SEC}-${BUFFER_VALIDATION.MAX_DURATION_SEC}s)`,
      'buffer'
    );
  }
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Create a new buffer video
 *
 * @param input - Buffer video creation input
 * @returns Created buffer video
 *
 * @example
 * ```typescript
 * const buffer = await createBufferVideo({
 *   videoId: 'dQw4w9WgXcQ',
 *   topic: 'Top 5 AI Papers This Week',
 *   title: 'Top 5 AI Research Papers You Must Read',
 *   durationSec: 360,
 *   source: 'manual',
 * });
 * ```
 */
export async function createBufferVideo(
  input: CreateBufferInput
): Promise<BufferVideo> {
  // Validate input before proceeding
  validateCreateInput(input);

  const client = getFirestoreClient();
  const now = new Date().toISOString();
  const id = generateBufferId();

  const buffer: BufferVideo = {
    id,
    videoId: input.videoId,
    topic: input.topic,
    title: input.title,
    description: input.description,
    createdDate: now,
    used: false,
    deploymentCount: 0,
    durationSec: input.durationSec,
    thumbnailPath: input.thumbnailPath,
    source: input.source,
    evergreen: true,
    status: 'active',
  };

  try {
    await client.setDocument(BUFFER_COLLECTION, id, buffer);

    logger.info(
      {
        bufferId: id,
        videoId: input.videoId,
        topic: input.topic,
        source: input.source,
      },
      'Buffer video created'
    );

    // Clear cache since we added a new buffer
    clearBufferCache();

    return buffer;
  } catch (error) {
    logger.error(
      { error, videoId: input.videoId },
      'Failed to create buffer video'
    );
    throw NexusError.critical(
      'NEXUS_BUFFER_CREATE_FAILED',
      `Failed to create buffer video: ${(error as Error).message}`,
      'buffer'
    );
  }
}

/**
 * Get a buffer video by ID
 *
 * @param id - Buffer video ID
 * @returns Buffer video or null if not found
 */
export async function getBufferById(id: string): Promise<BufferVideo | null> {
  // Check cache first
  const cacheKey = `buffer:${id}`;
  const cached = getCached<BufferVideo>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const client = getFirestoreClient();

  try {
    const buffer = await client.getDocument<BufferVideo>(BUFFER_COLLECTION, id);

    if (buffer) {
      setCache(cacheKey, buffer);
    }

    return buffer;
  } catch (error) {
    // Use query failed code for Firestore errors (not "not found" - that returns null)
    logger.error({ error, bufferId: id }, 'Failed to query buffer video');
    throw NexusError.critical(
      'NEXUS_BUFFER_QUERY_FAILED',
      `Failed to query buffer video ${id}: ${(error as Error).message}`,
      'buffer'
    );
  }
}

/**
 * List all available buffer videos
 *
 * Available means: status: 'active' AND used: false
 *
 * @returns Array of available buffer videos
 */
export async function listAvailableBuffers(): Promise<BufferVideo[]> {
  const cacheKey = 'available-buffers';
  const cached = getCached<BufferVideo[]>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const client = getFirestoreClient();

  try {
    const buffers = await client.queryDocuments<BufferVideo>(BUFFER_COLLECTION, [
      { field: 'used', operator: '==', value: false },
      { field: 'status', operator: '==', value: 'active' },
    ]);

    setCache(cacheKey, buffers);

    logger.debug(
      { count: buffers.length },
      'Listed available buffers'
    );

    return buffers;
  } catch (error) {
    logger.error({ error }, 'Failed to list available buffers');
    throw NexusError.critical(
      'NEXUS_BUFFER_QUERY_FAILED',
      `Failed to list available buffers: ${(error as Error).message}`,
      'buffer'
    );
  }
}

/**
 * Deploy a buffer video for emergency publication
 *
 * This marks the buffer as used and updates its status.
 * The actual YouTube scheduling is handled by the orchestrator.
 *
 * @param id - Buffer video ID to deploy
 * @param forDate - Date the buffer is being deployed for (YYYY-MM-DD)
 * @returns Deployment result
 *
 * @example
 * ```typescript
 * const result = await deployBuffer('bf-123', '2026-01-20');
 * if (result.success) {
 *   console.log(`Deployed buffer ${result.videoId} for ${result.scheduledTime}`);
 * }
 * ```
 */
export async function deployBuffer(
  id: string,
  forDate: string
): Promise<BufferDeploymentResult> {
  const client = getFirestoreClient();
  const now = new Date().toISOString();

  try {
    // Get current buffer state
    const buffer = await client.getDocument<BufferVideo>(BUFFER_COLLECTION, id);

    if (!buffer) {
      return {
        success: false,
        bufferId: id,
        error: `Buffer ${id} not found`,
      };
    }

    // Validate buffer is available for deployment
    if (buffer.status !== 'active' || buffer.used) {
      return {
        success: false,
        bufferId: id,
        error: `Buffer ${id} is not available for deployment (status: ${buffer.status}, used: ${buffer.used})`,
      };
    }

    // Calculate scheduled time (2 PM UTC on the deployment date)
    const scheduledTime = `${forDate}T14:00:00.000Z`;

    // Update buffer as deployed
    await client.updateDocument<BufferVideo>(BUFFER_COLLECTION, id, {
      used: true,
      usedDate: now,
      status: 'deployed',
      deploymentCount: buffer.deploymentCount + 1,
    });

    logger.info(
      {
        bufferId: id,
        videoId: buffer.videoId,
        forDate,
        scheduledTime,
        previousStatus: buffer.status,
      },
      'Buffer deployed'
    );

    // Clear cache since buffer state changed
    clearBufferCache();

    return {
      success: true,
      bufferId: id,
      videoId: buffer.videoId,
      scheduledTime,
      previousStatus: buffer.status,
      newStatus: 'deployed',
    };
  } catch (error) {
    logger.error(
      { error, bufferId: id, forDate },
      'Failed to deploy buffer'
    );

    return {
      success: false,
      bufferId: id,
      error: `Failed to deploy buffer: ${(error as Error).message}`,
    };
  }
}

/**
 * Archive a buffer video
 *
 * Archiving removes the buffer from the available pool.
 *
 * @param id - Buffer video ID to archive
 * @throws NexusError if buffer not found
 */
export async function archiveBuffer(id: string): Promise<void> {
  const client = getFirestoreClient();
  const now = new Date().toISOString();

  // Verify buffer exists
  const buffer = await client.getDocument<BufferVideo>(BUFFER_COLLECTION, id);

  if (!buffer) {
    throw NexusError.critical(
      'NEXUS_BUFFER_NOT_FOUND',
      `Buffer ${id} not found`,
      'buffer'
    );
  }

  try {
    await client.updateDocument<BufferVideo>(BUFFER_COLLECTION, id, {
      status: 'archived',
      retirementDate: now,
    });

    logger.info(
      { bufferId: id, previousStatus: buffer.status },
      'Buffer archived'
    );

    // Clear cache since buffer state changed
    clearBufferCache();
  } catch (error) {
    logger.error({ error, bufferId: id }, 'Failed to archive buffer');
    throw NexusError.critical(
      'NEXUS_BUFFER_ARCHIVE_FAILED',
      `Failed to archive buffer ${id}: ${(error as Error).message}`,
      'buffer'
    );
  }
}
