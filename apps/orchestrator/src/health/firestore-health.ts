/**
 * Firestore health check
 *
 * Tests Firestore availability with read/write operations
 * to the health-checks/{date} collection.
 *
 * @module orchestrator/health/firestore-health
 */

import { FirestoreClient, createLogger } from '@nexus-ai/core';
import type { IndividualHealthCheck } from '@nexus-ai/core';
import { HEALTH_CHECK_TIMEOUT_MS } from '@nexus-ai/core';

const logger = createLogger('orchestrator.health.firestore');

/**
 * Check Firestore health by performing read/write operations
 *
 * @returns Health check result for Firestore service
 */
export async function checkFirestoreHealth(): Promise<IndividualHealthCheck> {
  const startTime = Date.now();

  try {
    logger.debug({}, 'Starting Firestore health check');

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), HEALTH_CHECK_TIMEOUT_MS);
    });

    const checkPromise = performFirestoreCheck();

    // Race between check and timeout
    const result = await Promise.race([checkPromise, timeoutPromise]);

    const latencyMs = Date.now() - startTime;

    logger.info({
      latencyMs,
      status: 'healthy',
    }, 'Firestore health check passed');

    return {
      service: 'firestore',
      status: 'healthy',
      latencyMs,
      metadata: result,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const isTimeout = errorMessage.includes('Timeout');

    logger.error({
      latencyMs,
      error: errorMessage,
      isTimeout,
    }, 'Firestore health check failed');

    return {
      service: 'firestore',
      status: 'failed',
      latencyMs,
      error: isTimeout ? `Timeout after ${HEALTH_CHECK_TIMEOUT_MS}ms` : errorMessage,
    };
  }
}

/**
 * Perform the actual Firestore read/write test
 */
async function performFirestoreCheck(): Promise<{ writeOk: boolean; readOk: boolean }> {
  const firestoreClient = new FirestoreClient();
  const date = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString();

  // Write test document
  const testData = {
    timestamp,
    healthCheck: true,
    randomValue: Math.random(),
  };

  await firestoreClient.setDocument('health-checks', date, testData);

  // Read test document
  const doc = await firestoreClient.getDocument<typeof testData>('health-checks', date);

  if (!doc) {
    throw new Error('Read test failed - document not found after write');
  }

  if (!doc.healthCheck) {
    throw new Error('Read test failed - document data mismatch');
  }

  return {
    writeOk: true,
    readOk: true,
  };
}
