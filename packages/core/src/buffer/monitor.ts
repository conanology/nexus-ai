/**
 * Buffer video monitor for NEXUS-AI emergency content system
 *
 * Provides health monitoring and digest integration for buffer videos.
 * Includes caching for efficient repeated queries.
 *
 * @module @nexus-ai/core/buffer/monitor
 */

import { createLogger } from '../observability/logger.js';
import {
  BUFFER_COLLECTION,
  BUFFER_THRESHOLDS,
  BUFFER_CACHE_TTL_MS,
  type BufferVideo,
  type BufferHealthStatus,
  type BufferSummary,
  type BufferSystemStatus,
  type BufferCacheEntry,
} from './types.js';
import { getSharedFirestoreClient } from './client.js';

const logger = createLogger('nexus.core.buffer.monitor');

/**
 * Get Firestore client (uses shared instance)
 */
function getFirestoreClient() {
  return getSharedFirestoreClient();
}

// =============================================================================
// Monitor Cache
// =============================================================================

const monitorCache = new Map<string, BufferCacheEntry<unknown>>();

/**
 * Get cached value if not expired
 */
function getCached<T>(key: string): T | null {
  const cached = monitorCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > BUFFER_CACHE_TTL_MS) {
    monitorCache.delete(key);
    return null;
  }
  return cached.data as T;
}

/**
 * Set cache value
 */
function setCache<T>(key: string, data: T): void {
  monitorCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Clear all monitor cache entries
 */
export function clearMonitorCache(): void {
  monitorCache.clear();
}

// =============================================================================
// Buffer Count
// =============================================================================

/**
 * Get count of available buffer videos
 *
 * Available means: status: 'active' AND used: false
 * Results are cached for 5 minutes.
 *
 * @returns Count of available buffer videos
 */
export async function getBufferCount(): Promise<number> {
  const cacheKey = 'buffer-count';
  const cached = getCached<number>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const client = getFirestoreClient();

  try {
    const buffers = await client.queryDocuments<BufferVideo>(BUFFER_COLLECTION, [
      { field: 'used', operator: '==', value: false },
      { field: 'status', operator: '==', value: 'active' },
    ]);

    const count = buffers.length;
    setCache(cacheKey, count);

    logger.debug({ count }, 'Buffer count retrieved');

    return count;
  } catch (error) {
    logger.error({ error }, 'Failed to get buffer count');
    throw error;
  }
}

// =============================================================================
// Health Status
// =============================================================================

/**
 * Determine system status based on available count
 *
 * Per AC4: WARNING when count drops BELOW 2 (< 2, not <= 2)
 * Critical when at or below minimum (NFR5 requires minimum 1)
 */
function determineStatus(availableCount: number): BufferSystemStatus {
  if (availableCount < BUFFER_THRESHOLDS.MINIMUM_COUNT) {
    // Below minimum (0 buffers) - critical emergency
    return 'critical';
  }
  if (availableCount <= BUFFER_THRESHOLDS.MINIMUM_COUNT) {
    // At minimum (1 buffer) - still critical per NFR5
    return 'critical';
  }
  if (availableCount < BUFFER_THRESHOLDS.WARNING_COUNT) {
    // Below warning threshold but above minimum
    return 'warning';
  }
  return 'healthy';
}

/**
 * Get buffer system health status
 *
 * Evaluates buffer count against thresholds and returns health status
 * for integration with the daily health check system.
 *
 * @returns Buffer health status
 *
 * @example
 * ```typescript
 * const health = await getBufferHealthStatus();
 * if (health.status === 'critical') {
 *   await sendAlert('buffer-low', { count: health.availableCount });
 * }
 * ```
 */
export async function getBufferHealthStatus(): Promise<BufferHealthStatus> {
  const client = getFirestoreClient();
  const now = new Date().toISOString();

  try {
    // Query available buffers
    const availableBuffers = await client.queryDocuments<BufferVideo>(
      BUFFER_COLLECTION,
      [
        { field: 'used', operator: '==', value: false },
        { field: 'status', operator: '==', value: 'active' },
      ]
    );

    // Query deployed buffers
    const deployedBuffers = await client.queryDocuments<BufferVideo>(
      BUFFER_COLLECTION,
      [{ field: 'status', operator: '==', value: 'deployed' }]
    );

    // Query archived buffers for accurate total count
    const archivedBuffers = await client.queryDocuments<BufferVideo>(
      BUFFER_COLLECTION,
      [{ field: 'status', operator: '==', value: 'archived' }]
    );

    const availableCount = availableBuffers.length;
    const deployedCount = deployedBuffers.length;
    const archivedCount = archivedBuffers.length;
    const totalCount = availableCount + deployedCount + archivedCount;

    const status = determineStatus(availableCount);
    // Below thresholds use < to match AC4: "drops below" means strictly less than
    const belowWarningThreshold = availableCount < BUFFER_THRESHOLDS.WARNING_COUNT;
    const belowMinimumThreshold = availableCount < BUFFER_THRESHOLDS.MINIMUM_COUNT;

    const healthStatus: BufferHealthStatus = {
      totalCount,
      availableCount,
      deployedCount,
      status,
      belowWarningThreshold,
      belowMinimumThreshold,
      lastChecked: now,
    };

    logger.info(
      {
        status,
        availableCount,
        totalCount,
        belowWarning: belowWarningThreshold,
        belowMinimum: belowMinimumThreshold,
      },
      'Buffer health status checked'
    );

    return healthStatus;
  } catch (error) {
    logger.error({ error }, 'Failed to get buffer health status');
    throw error;
  }
}

// =============================================================================
// Digest Integration
// =============================================================================

/**
 * Get buffer summary for daily digest email
 *
 * Returns a summary of buffer inventory status for inclusion
 * in the daily digest notification.
 *
 * @param date - Summary date in YYYY-MM-DD format
 * @returns Buffer summary for digest
 *
 * @example
 * ```typescript
 * const summary = await getBufferSummaryForDigest('2026-01-20');
 * // Include in digest: "Buffers: 3 available, 1 deployed today"
 * ```
 */
export async function getBufferSummaryForDigest(date: string): Promise<BufferSummary> {
  const client = getFirestoreClient();

  try {
    // Query available buffers
    const availableBuffers = await client.queryDocuments<BufferVideo>(
      BUFFER_COLLECTION,
      [
        { field: 'used', operator: '==', value: false },
        { field: 'status', operator: '==', value: 'active' },
      ]
    );

    // Query deployed buffers
    const deployedBuffers = await client.queryDocuments<BufferVideo>(
      BUFFER_COLLECTION,
      [{ field: 'status', operator: '==', value: 'deployed' }]
    );

    const availableCount = availableBuffers.length;
    const totalCount = availableCount + deployedBuffers.length;

    // Count buffers deployed on the specified date
    const deployedToday = deployedBuffers.filter((buffer) => {
      if (!buffer.usedDate) return false;
      return buffer.usedDate.startsWith(date);
    }).length;

    // Find oldest available buffer
    const oldestBuffer = availableBuffers.length > 0
      ? availableBuffers.reduce((oldest, current) =>
          new Date(current.createdDate) < new Date(oldest.createdDate)
            ? current
            : oldest
        )
      : null;

    const status = determineStatus(availableCount);

    const summary: BufferSummary = {
      date,
      totalBuffers: totalCount,
      availableBuffers: availableCount,
      deployedToday,
      healthStatus: status,
      oldestBufferDate: oldestBuffer?.createdDate,
    };

    logger.debug(
      {
        date,
        totalBuffers: totalCount,
        availableBuffers: availableCount,
        deployedToday,
      },
      'Buffer summary generated for digest'
    );

    return summary;
  } catch (error) {
    logger.error({ error, date }, 'Failed to get buffer summary for digest');
    throw error;
  }
}
