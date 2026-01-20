/**
 * Cloud Storage health check
 *
 * Tests Cloud Storage bucket availability.
 * Cloud Storage is marked as DEGRADED - pipeline continues with warnings if this fails.
 *
 * @module orchestrator/health/storage-health
 */

import { createLogger } from '@nexus-ai/core';
import type { IndividualHealthCheck } from '@nexus-ai/core';
import { HEALTH_CHECK_TIMEOUT_MS } from '@nexus-ai/core';

const logger = createLogger('orchestrator.health.storage');

// Default bucket name for NEXUS-AI artifacts
const DEFAULT_BUCKET_NAME = 'nexus-ai-artifacts';

/**
 * Check Cloud Storage health by verifying bucket access
 *
 * @returns Health check result for Cloud Storage service
 */
export async function checkStorageHealth(): Promise<IndividualHealthCheck> {
  const startTime = Date.now();

  try {
    logger.debug({}, 'Starting Cloud Storage health check');

    // Get bucket name from env or use default
    const bucketName = process.env.NEXUS_BUCKET_NAME || DEFAULT_BUCKET_NAME;

    // Dynamically import Cloud Storage SDK
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), HEALTH_CHECK_TIMEOUT_MS);
    });

    const checkPromise = async (): Promise<{ exists: boolean; name: string }> => {
      const bucket = storage.bucket(bucketName);

      // Test bucket access by checking if it exists
      const [exists] = await bucket.exists();

      if (!exists) {
        throw new Error(`Bucket ${bucketName} does not exist`);
      }

      // Optionally test read access by listing files (with limit)
      try {
        await bucket.getFiles({ maxResults: 1 });
      } catch (listError) {
        // List might fail due to permissions, but bucket exists
        logger.warn({
          bucketName,
          error: listError instanceof Error ? listError.message : String(listError),
        }, 'Bucket exists but list operation failed');
      }

      return { exists: true, name: bucketName };
    };

    // Race between check and timeout
    const result = await Promise.race([checkPromise(), timeoutPromise]);

    const latencyMs = Date.now() - startTime;

    logger.info({
      latencyMs,
      status: 'healthy',
      bucketName,
    }, 'Cloud Storage health check passed');

    return {
      service: 'cloud-storage',
      status: 'healthy',
      latencyMs,
      metadata: result,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const isTimeout = errorMessage.includes('Timeout');

    logger.warn({
      latencyMs,
      error: errorMessage,
      isTimeout,
    }, 'Cloud Storage health check failed');

    // Cloud Storage is DEGRADED criticality - return degraded instead of failed
    return {
      service: 'cloud-storage',
      status: 'degraded',
      latencyMs,
      error: isTimeout ? `Timeout after ${HEALTH_CHECK_TIMEOUT_MS}ms` : errorMessage,
    };
  }
}
