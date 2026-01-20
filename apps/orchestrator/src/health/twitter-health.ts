/**
 * Twitter API health check
 *
 * Tests Twitter API availability by validating OAuth credentials.
 * Twitter is marked as RECOVERABLE - pipeline continues if this fails.
 *
 * @module orchestrator/health/twitter-health
 */

import { getSecret, createLogger } from '@nexus-ai/core';
import type { IndividualHealthCheck } from '@nexus-ai/core';
import { HEALTH_CHECK_TIMEOUT_MS } from '@nexus-ai/core';

const logger = createLogger('orchestrator.health.twitter');

/**
 * Check Twitter API health by validating credentials
 *
 * Uses the /2/users/me endpoint to verify OAuth token is valid.
 *
 * @returns Health check result for Twitter service
 */
export async function checkTwitterHealth(): Promise<IndividualHealthCheck> {
  const startTime = Date.now();

  try {
    logger.debug({}, 'Starting Twitter health check');

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), HEALTH_CHECK_TIMEOUT_MS);
    });

    const checkPromise = performTwitterCheck();

    // Race between check and timeout
    const result = await Promise.race([checkPromise, timeoutPromise]);

    const latencyMs = Date.now() - startTime;

    logger.info({
      latencyMs,
      status: result.status,
    }, `Twitter health check ${result.status === 'healthy' ? 'passed' : 'completed with warnings'}`);

    return {
      service: 'twitter',
      status: result.status,
      latencyMs,
      error: result.error,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const isTimeout = errorMessage.includes('Timeout');

    logger.warn({
      latencyMs,
      error: errorMessage,
      isTimeout,
    }, 'Twitter health check failed');

    // Twitter is RECOVERABLE - return degraded instead of failed for transient errors
    return {
      service: 'twitter',
      status: 'degraded',
      latencyMs,
      error: isTimeout ? `Timeout after ${HEALTH_CHECK_TIMEOUT_MS}ms` : errorMessage,
    };
  }
}

/**
 * Perform the actual Twitter API check
 */
async function performTwitterCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'failed';
  error?: string;
}> {
  // Get OAuth credentials from Secret Manager
  const credentials = await getSecret('nexus-twitter-oauth');

  // Parse credentials (expected format: JSON with access_token)
  let accessToken: string;
  try {
    const parsed = JSON.parse(credentials);
    accessToken = parsed.access_token || parsed.accessToken;
    if (!accessToken) {
      throw new Error('No access_token in credentials');
    }
  } catch {
    // Fallback: treat as raw bearer token
    accessToken = credentials;
  }

  // Verify credentials by calling /2/users/me endpoint
  const response = await fetch('https://api.twitter.com/2/users/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.ok) {
    return { status: 'healthy' };
  }

  // Check for specific error codes
  const statusCode = response.status;
  if (statusCode === 401 || statusCode === 403) {
    return {
      status: 'failed',
      error: `Authentication failed (HTTP ${statusCode})`,
    };
  }

  if (statusCode === 429) {
    // Rate limited - service is available but throttled
    return {
      status: 'degraded',
      error: 'Rate limited (HTTP 429)',
    };
  }

  // Other errors
  return {
    status: 'degraded',
    error: `HTTP ${statusCode}`,
  };
}
