/**
 * Secret Manager health check
 *
 * Tests Secret Manager availability by retrieving a known secret.
 * Secret Manager is CRITICAL - pipeline cannot proceed without credentials.
 *
 * @module orchestrator/health/secrets-health
 */

import { getSecret, createLogger } from '@nexus-ai/core';
import type { IndividualHealthCheck } from '@nexus-ai/core';
import { HEALTH_CHECK_TIMEOUT_MS } from '@nexus-ai/core';

const logger = createLogger('orchestrator.health.secrets');

// Secret to use for health check verification
const HEALTH_CHECK_SECRET = 'nexus-gemini-api-key';

/**
 * Check Secret Manager health by retrieving a test secret
 *
 * @returns Health check result for Secret Manager service
 */
export async function checkSecretsHealth(): Promise<IndividualHealthCheck> {
  const startTime = Date.now();

  try {
    logger.debug({}, 'Starting Secret Manager health check');

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), HEALTH_CHECK_TIMEOUT_MS);
    });

    const checkPromise = async (): Promise<{ retrieved: boolean }> => {
      // Attempt to retrieve the health check secret
      const secret = await getSecret(HEALTH_CHECK_SECRET);

      // Verify we got a non-empty value
      if (!secret || secret.length === 0) {
        throw new Error('Retrieved secret is empty');
      }

      return { retrieved: true };
    };

    // Race between check and timeout
    await Promise.race([checkPromise(), timeoutPromise]);

    const latencyMs = Date.now() - startTime;

    logger.info({
      latencyMs,
      status: 'healthy',
      secretName: HEALTH_CHECK_SECRET,
    }, 'Secret Manager health check passed');

    return {
      service: 'secret-manager',
      status: 'healthy',
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const isTimeout = errorMessage.includes('Timeout');

    logger.error({
      latencyMs,
      error: errorMessage,
      isTimeout,
      secretName: HEALTH_CHECK_SECRET,
    }, 'Secret Manager health check failed');

    return {
      service: 'secret-manager',
      status: 'failed',
      latencyMs,
      error: isTimeout ? `Timeout after ${HEALTH_CHECK_TIMEOUT_MS}ms` : errorMessage,
    };
  }
}
