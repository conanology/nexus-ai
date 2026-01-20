/**
 * Core health check orchestration function
 *
 * Executes all service health checks in parallel and aggregates results.
 * Stores results in Firestore and determines if pipeline can proceed.
 *
 * @module orchestrator/health/perform-health-check
 */

import { FirestoreClient, createLogger } from '@nexus-ai/core';
import type {
  HealthCheckResult,
  HealthCheckDocument,
  IndividualHealthCheck,
  HealthCheckService,
} from '@nexus-ai/core';
import { SERVICE_CRITICALITY, MAX_HEALTH_CHECK_DURATION_MS } from '@nexus-ai/core';

import { checkGeminiHealth } from './gemini-health.js';
import { checkYouTubeHealth, getQuotaAlertLevel } from './youtube-health.js';
import { checkTwitterHealth } from './twitter-health.js';
import { checkFirestoreHealth } from './firestore-health.js';
import { checkStorageHealth } from './storage-health.js';
import { checkSecretsHealth } from './secrets-health.js';

const logger = createLogger('orchestrator.health.perform-health-check');

/**
 * Service names in execution order
 */
const SERVICE_ORDER: HealthCheckService[] = [
  'gemini',
  'youtube',
  'twitter',
  'firestore',
  'cloud-storage',
  'secret-manager',
];

/**
 * Perform comprehensive health check of all external services
 *
 * Executes health checks for all 6 services in parallel:
 * - Gemini API (LLM)
 * - YouTube API (quota monitoring)
 * - Twitter API (social posting)
 * - Firestore (state persistence)
 * - Cloud Storage (artifacts)
 * - Secret Manager (credentials)
 *
 * @param pipelineId - Pipeline ID (YYYY-MM-DD format)
 * @returns Aggregated health check result
 */
export async function performHealthCheck(
  pipelineId: string
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  logger.info({ pipelineId }, 'Starting health check');

  // Execute all checks in parallel using Promise.allSettled
  // This ensures all checks complete even if some fail
  const checkPromises = [
    checkGeminiHealth(),
    checkYouTubeHealth(),
    checkTwitterHealth(),
    checkFirestoreHealth(),
    checkStorageHealth(),
    checkSecretsHealth(),
  ];

  const results = await Promise.allSettled(checkPromises);

  // Extract results, handling rejected promises
  const checks: IndividualHealthCheck[] = results.map((result, index) => {
    const service = SERVICE_ORDER[index];

    if (result.status === 'fulfilled') {
      return result.value;
    }

    // Promise rejected - convert to failed health check
    const error = result.reason instanceof Error
      ? result.reason.message
      : String(result.reason);

    logger.error({
      pipelineId,
      service,
      error,
    }, 'Health check threw unhandled error');

    return {
      service,
      status: 'failed' as const,
      latencyMs: Date.now() - startTime,
      error,
    };
  });

  const totalDurationMs = Date.now() - startTime;

  // Categorize failures based on criticality
  const criticalFailures: HealthCheckService[] = [];
  const warnings: HealthCheckService[] = [];

  for (const check of checks) {
    const criticality = SERVICE_CRITICALITY[check.service];

    if (check.status === 'failed') {
      if (criticality === 'CRITICAL') {
        criticalFailures.push(check.service);
      } else {
        // DEGRADED or RECOVERABLE failures go to warnings
        warnings.push(check.service);
      }
    } else if (check.status === 'degraded') {
      warnings.push(check.service);
    }
  }

  // allPassed is true only if no critical failures
  const allPassed = criticalFailures.length === 0;

  // Check YouTube quota for alert triggering (per AC5)
  const youtubeCheck = checks.find(c => c.service === 'youtube');
  if (youtubeCheck?.metadata && 'percentage' in youtubeCheck.metadata) {
    const percentage = youtubeCheck.metadata.percentage as number;
    const quotaAlert = getQuotaAlertLevel(percentage);
    if (quotaAlert) {
      logger.warn({
        pipelineId,
        quotaPercentage: percentage.toFixed(1),
        alertSeverity: quotaAlert.severity,
        alertMessage: quotaAlert.message,
      }, 'YouTube quota alert triggered (Story 5.4 will send Discord alert)');
    }
  }

  const healthResult: HealthCheckResult = {
    timestamp: new Date().toISOString(),
    allPassed,
    checks,
    criticalFailures,
    warnings,
    totalDurationMs,
  };

  // Log warning if check took too long
  if (totalDurationMs > MAX_HEALTH_CHECK_DURATION_MS) {
    logger.error({
      pipelineId,
      totalDurationMs,
      maxAllowed: MAX_HEALTH_CHECK_DURATION_MS,
    }, 'Health check exceeded maximum duration');
  } else if (totalDurationMs > 90000) {
    logger.warn({
      pipelineId,
      totalDurationMs,
    }, 'Health check took longer than expected');
  }

  // Store results in Firestore
  try {
    await storeHealthCheckResult(pipelineId, healthResult);
  } catch (error) {
    // Log but don't fail the health check due to storage issues
    logger.warn({
      pipelineId,
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to store health check results in Firestore');
  }

  // Log summary
  logger.info({
    pipelineId,
    allPassed,
    criticalFailures,
    warnings,
    totalDurationMs,
    checkResults: checks.map(c => ({
      service: c.service,
      status: c.status,
      latencyMs: c.latencyMs,
    })),
  }, 'Health check completed');

  return healthResult;
}

/**
 * Store health check results in Firestore
 *
 * @param pipelineId - Pipeline ID (YYYY-MM-DD format)
 * @param result - Health check result to store
 */
async function storeHealthCheckResult(
  pipelineId: string,
  result: HealthCheckResult
): Promise<void> {
  const firestoreClient = new FirestoreClient();

  const document: HealthCheckDocument = {
    ...result,
    pipelineId,
  };

  // Store at pipelines/{date}/health
  await firestoreClient.setDocument(
    `pipelines/${pipelineId}`,
    'health',
    document
  );

  logger.debug({
    pipelineId,
    path: `pipelines/${pipelineId}/health`,
  }, 'Health check results stored');
}

/**
 * Check if health check result has critical failures
 *
 * @param result - Health check result to evaluate
 * @returns true if there are critical failures
 */
export function hasCriticalFailures(result: HealthCheckResult): boolean {
  return result.criticalFailures.length > 0;
}

/**
 * Get a human-readable summary of health check result
 *
 * @param result - Health check result to summarize
 * @returns Summary string
 */
export function getHealthCheckSummary(result: HealthCheckResult): string {
  if (result.allPassed && result.warnings.length === 0) {
    return `All ${result.checks.length} services healthy (${result.totalDurationMs}ms)`;
  }

  if (result.allPassed && result.warnings.length > 0) {
    return `${result.checks.length - result.warnings.length} healthy, ${result.warnings.length} degraded: ${result.warnings.join(', ')} (${result.totalDurationMs}ms)`;
  }

  return `CRITICAL: ${result.criticalFailures.length} failed (${result.criticalFailures.join(', ')}), ${result.warnings.length} warnings (${result.totalDurationMs}ms)`;
}
