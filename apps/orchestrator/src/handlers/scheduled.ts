// Cloud Scheduler trigger handler

import type { Request, Response } from 'express';
import { createLogger } from '@nexus-ai/core';
import { executePipeline } from '../pipeline.js';
import {
  performHealthCheck,
  hasCriticalFailures,
  handleHealthCheckFailure,
  getHealthCheckSummary,
} from '../health/index.js';

const logger = createLogger('orchestrator.handlers.scheduled');

/**
 * Handles scheduled pipeline triggers from Cloud Scheduler
 *
 * Executes health check before pipeline to verify all services are available.
 * If critical services fail, pipeline is skipped and buffer video is deployed.
 *
 * SECURITY MODEL:
 * - Primary auth: Cloud Run IAM (configured via Terraform in infrastructure/service-accounts/)
 *   - Only nexus-scheduler-sa service account has roles/run.invoker
 *   - Cloud Run validates OIDC token and enforces IAM before request reaches this handler
 * - Secondary auth: Bearer token presence check (defense in depth)
 *   - Cloud Scheduler sends OIDC token as Bearer token
 *   - We verify token exists and has reasonable format
 *   - Full OIDC signature validation is handled by Cloud Run, not application code
 *
 * For local/dev testing without Cloud Run IAM, set NEXUS_SKIP_SCHEDULER_AUTH=true
 */
export async function handleScheduledTrigger(
  req: Request,
  res: Response
): Promise<void> {
  // Skip auth check in development if explicitly configured
  const skipAuth = process.env['NEXUS_SKIP_SCHEDULER_AUTH'] === 'true';

  if (!skipAuth) {
    // Verify Bearer token is present (Cloud Run IAM handles actual OIDC validation)
    // This is defense-in-depth - Cloud Run should reject unauthorized requests before they reach here
    const authHeader = req.headers.authorization;
    const isValidFormat = authHeader &&
      authHeader.startsWith('Bearer ') &&
      authHeader.length > 20; // OIDC tokens are much longer than 20 chars

    if (!isValidFormat) {
      logger.warn({
        ip: req.ip,
        hasAuth: !!authHeader,
        authPrefix: authHeader?.substring(0, 10),
      }, 'Unauthorized scheduled trigger attempt - missing or malformed Bearer token');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  // Generate pipeline ID from current date
  const pipelineId = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Extract scheduler metadata from request body if provided
  const schedulerSource = req.body?.source || 'cloud-scheduler';
  const jobName = req.body?.job_name || 'nexus-daily-pipeline';

  logger.info({
    pipelineId,
    source: schedulerSource,
    jobName,
    triggeredAt: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
  }, 'Scheduled pipeline trigger received');

  // Execute health check BEFORE pipeline (AC #6)
  const healthResult = await performHealthCheck(pipelineId);

  // Check for critical failures
  if (!healthResult.allPassed && hasCriticalFailures(healthResult)) {
    logger.error({
      pipelineId,
      healthResult,
      criticalFailures: healthResult.criticalFailures,
      summary: getHealthCheckSummary(healthResult),
    }, 'Health check failed, skipping pipeline');

    // Handle failure - send alerts and trigger buffer deployment
    const failureResponse = await handleHealthCheckFailure(pipelineId, healthResult);

    // Return 503 Service Unavailable
    res.status(503).json({
      error: 'Service unavailable',
      message: 'Health check failed - pipeline skipped',
      pipelineId,
      healthResult: {
        allPassed: healthResult.allPassed,
        criticalFailures: healthResult.criticalFailures,
        warnings: healthResult.warnings,
        totalDurationMs: healthResult.totalDurationMs,
      },
      bufferDeploymentTriggered: failureResponse.bufferDeploymentTriggered,
    });
    return;
  }

  // Health check passed (or only non-critical warnings)
  logger.info({
    pipelineId,
    healthResult: {
      allPassed: healthResult.allPassed,
      warnings: healthResult.warnings,
      totalDurationMs: healthResult.totalDurationMs,
    },
    summary: getHealthCheckSummary(healthResult),
  }, 'Health check passed, proceeding with pipeline');

  // Execute pipeline asynchronously - don't wait for completion
  // Cloud Run will keep the request open, but we respond immediately
  // to avoid Cloud Scheduler timeout issues
  executePipeline(pipelineId)
    .then((result) => {
      logger.info({
        pipelineId,
        success: result.success,
        status: result.status,
        completedStages: result.completedStages.length,
        totalDurationMs: result.totalDurationMs,
      }, 'Scheduled pipeline completed');
    })
    .catch((error) => {
      logger.error({
        pipelineId,
        error: error.message,
      }, 'Scheduled pipeline failed unexpectedly');
    });

  // Return immediately with 202 Accepted
  res.status(202).json({
    message: 'Pipeline execution started',
    pipelineId,
    status: 'accepted',
    healthStatus: healthResult.allPassed ? 'healthy' : 'degraded',
    healthWarnings: healthResult.warnings,
  });
}
