/**
 * Buffer video selector for NEXUS-AI emergency content system
 *
 * Provides intelligent buffer selection using FIFO (oldest first) strategy
 * with preference for buffers that have never been deployed.
 *
 * @module @nexus-ai/core/buffer/selector
 */

import { createLogger } from '../observability/logger.js';
import { NexusError } from '../errors/index.js';
import { listAvailableBuffers } from './manager.js';
import type { BufferVideo } from './types.js';

const logger = createLogger('nexus.core.buffer.selector');

/**
 * Select the best buffer for deployment
 *
 * Selection priority:
 * 1. Prefer buffers that have never been deployed (deploymentCount: 0)
 * 2. Among same deployment count, select oldest by createdDate (FIFO)
 *
 * @returns Selected buffer video
 * @throws NexusError if no buffers available (NEXUS_BUFFER_EXHAUSTED)
 *
 * @example
 * ```typescript
 * try {
 *   const buffer = await selectBufferForDeployment();
 *   console.log(`Selected buffer: ${buffer.id} (${buffer.topic})`);
 * } catch (error) {
 *   if (error.code === 'NEXUS_BUFFER_EXHAUSTED') {
 *     // No buffers available - critical alert needed
 *   }
 * }
 * ```
 */
export async function selectBufferForDeployment(): Promise<BufferVideo> {
  const availableBuffers = await listAvailableBuffers();

  if (availableBuffers.length === 0) {
    logger.error({}, 'No buffer videos available for deployment');
    throw NexusError.critical(
      'NEXUS_BUFFER_EXHAUSTED',
      'No buffer videos available for deployment. System requires minimum 1 buffer (NFR5).',
      'buffer'
    );
  }

  // Sort buffers by selection priority:
  // 1. deploymentCount ascending (prefer never deployed)
  // 2. createdDate ascending (oldest first - FIFO)
  const sorted = [...availableBuffers].sort((a, b) => {
    // First priority: deployment count (prefer 0)
    if (a.deploymentCount !== b.deploymentCount) {
      return a.deploymentCount - b.deploymentCount;
    }

    // Second priority: oldest first (FIFO)
    const dateA = new Date(a.createdDate).getTime();
    const dateB = new Date(b.createdDate).getTime();
    return dateA - dateB;
  });

  const selected = sorted[0];

  logger.info(
    {
      selectedId: selected.id,
      selectedTopic: selected.topic,
      deploymentCount: selected.deploymentCount,
      createdDate: selected.createdDate,
      totalAvailable: availableBuffers.length,
    },
    'Buffer selected for deployment'
  );

  return selected;
}

/**
 * Get the best deployment candidate without throwing
 *
 * Unlike selectBufferForDeployment, this function returns null
 * instead of throwing when no buffers are available. Useful for
 * checking buffer availability before committing to deployment.
 *
 * @returns Best buffer candidate or null if none available
 *
 * @example
 * ```typescript
 * const candidate = await getBufferDeploymentCandidate();
 * if (candidate) {
 *   // Buffer available - can proceed with deployment
 *   await deployBuffer(candidate.id, targetDate);
 * } else {
 *   // No buffers - send critical alert
 *   await sendCriticalAlert('pipeline-failed-no-buffer');
 * }
 * ```
 */
export async function getBufferDeploymentCandidate(): Promise<BufferVideo | null> {
  try {
    return await selectBufferForDeployment();
  } catch (error) {
    // Log but don't throw - caller expects null for no buffers
    if (error instanceof NexusError && error.code === 'NEXUS_BUFFER_EXHAUSTED') {
      logger.warn({}, 'No buffer candidates available');
    } else {
      logger.error({ error }, 'Error getting buffer candidate');
    }
    return null;
  }
}
