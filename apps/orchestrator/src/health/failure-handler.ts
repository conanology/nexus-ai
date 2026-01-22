/**
 * Health check failure handler
 *
 * Handles critical failures by routing alerts and triggering buffer deployment.
 * Implements criticality-based response actions.
 *
 * @module orchestrator/health/failure-handler
 */

import { createLogger } from '@nexus-ai/core';
import type {
  HealthCheckResult,
  HealthCheckService,
} from '@nexus-ai/core';
import { SERVICE_CRITICALITY } from '@nexus-ai/core';
import {
  sendDiscordAlert,
  type DiscordAlertConfig,
} from '@nexus-ai/notifications';

const logger = createLogger('orchestrator.health.failure-handler');

/**
 * Alert configuration for notifications
 */
interface AlertConfig {
  severity: 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  pipelineId: string;
  services: HealthCheckService[];
}

/**
 * Handle health check failure by routing appropriate responses
 *
 * Actions based on criticality:
 * - CRITICAL: Log error, prepare alert, trigger buffer deployment
 * - DEGRADED: Log warning, continue with quality flag
 * - RECOVERABLE: Log warning, continue normally
 *
 * @param pipelineId - Pipeline ID (YYYY-MM-DD)
 * @param healthResult - Health check result with failures
 * @returns Actions taken
 */
export async function handleHealthCheckFailure(
  pipelineId: string,
  healthResult: HealthCheckResult
): Promise<{
  shouldSkipPipeline: boolean;
  alertsSent: AlertConfig[];
  bufferDeploymentTriggered: boolean;
}> {
  const alertsSent: AlertConfig[] = [];
  let shouldSkipPipeline = false;
  let bufferDeploymentTriggered = false;

  // Handle critical failures
  if (healthResult.criticalFailures.length > 0) {
    shouldSkipPipeline = true;

    logger.error({
      pipelineId,
      criticalFailures: healthResult.criticalFailures,
      failureDetails: healthResult.checks
        .filter(c => c.status === 'failed')
        .map(c => ({ service: c.service, error: c.error })),
    }, 'Critical health check failures detected - pipeline will be skipped');

    // Prepare critical alert
    const criticalAlert: AlertConfig = {
      severity: 'CRITICAL',
      title: 'Health Check Failed - Pipeline Skipped',
      message: buildCriticalAlertMessage(pipelineId, healthResult),
      pipelineId,
      services: healthResult.criticalFailures,
    };

    alertsSent.push(criticalAlert);

    // Send Discord alert using notifications package
    await sendDiscordAlertInternal(criticalAlert);

    // Trigger buffer deployment (Story 5.7 integration point)
    try {
      await triggerBufferDeployment(pipelineId, healthResult);
      bufferDeploymentTriggered = true;
    } catch (error) {
      logger.error({
        pipelineId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to trigger buffer deployment');
    }
  }

  // Handle warnings (degraded or recoverable failures)
  if (healthResult.warnings.length > 0) {
    logger.warn({
      pipelineId,
      warnings: healthResult.warnings,
      warningDetails: healthResult.checks
        .filter(c => c.status === 'degraded' ||
          (c.status === 'failed' && SERVICE_CRITICALITY[c.service] !== 'CRITICAL'))
        .map(c => ({ service: c.service, error: c.error })),
    }, 'Non-critical health check warnings');

    // Prepare warning alert if any warnings exist
    const warningAlert: AlertConfig = {
      severity: 'WARNING',
      title: 'Health Check Warnings',
      message: buildWarningAlertMessage(pipelineId, healthResult),
      pipelineId,
      services: healthResult.warnings,
    };

    alertsSent.push(warningAlert);

    // Only send warning alert if there are non-critical issues worth alerting
    // (skip if just Cloud Storage degraded, for example)
    const significantWarnings = healthResult.warnings.filter(
      service => SERVICE_CRITICALITY[service] !== 'DEGRADED'
    );

    if (significantWarnings.length > 0) {
      await sendDiscordAlertInternal(warningAlert);
    }
  }

  return {
    shouldSkipPipeline,
    alertsSent,
    bufferDeploymentTriggered,
  };
}

/**
 * Build critical alert message content
 */
function buildCriticalAlertMessage(
  pipelineId: string,
  healthResult: HealthCheckResult
): string {
  const failedServices = healthResult.checks
    .filter(c => c.status === 'failed')
    .map(c => `• ${c.service}: ${c.error || 'Unknown error'}`)
    .join('\n');

  return `Pipeline ${pipelineId} health check FAILED

**Critical Services Down:**
${failedServices}

**Action Taken:** Pipeline skipped, buffer video deployment triggered

**Health Check Duration:** ${healthResult.totalDurationMs}ms
**Timestamp:** ${healthResult.timestamp}`;
}

/**
 * Build warning alert message content
 */
function buildWarningAlertMessage(
  pipelineId: string,
  healthResult: HealthCheckResult
): string {
  const warningServices = healthResult.checks
    .filter(c => c.status === 'degraded')
    .map(c => `• ${c.service}: ${c.error || 'Degraded performance'}`)
    .join('\n');

  return `Pipeline ${pipelineId} health check passed with warnings

**Degraded Services:**
${warningServices}

**Action:** Pipeline proceeding with quality flag

**Health Check Duration:** ${healthResult.totalDurationMs}ms`;
}

/**
 * Send alert to Discord webhook using notifications package
 *
 * @param alert - Alert configuration to send
 */
async function sendDiscordAlertInternal(alert: AlertConfig): Promise<void> {
  logger.info({
    severity: alert.severity,
    title: alert.title,
    pipelineId: alert.pipelineId,
    services: alert.services,
  }, 'Sending Discord alert via notifications package');

  const discordConfig: DiscordAlertConfig = {
    severity: alert.severity,
    title: alert.title,
    description: alert.message,
    fields: [
      { name: 'Pipeline ID', value: alert.pipelineId, inline: true },
      { name: 'Affected Services', value: alert.services.join(', ') || 'None', inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  const result = await sendDiscordAlert(discordConfig);

  if (!result.success) {
    logger.error({
      error: result.error,
      pipelineId: alert.pipelineId,
    }, 'Failed to send Discord alert');
  }
}

/**
 * Trigger buffer video deployment when pipeline cannot run
 *
 * Placeholder implementation - Story 5.7 will provide buffer video system.
 *
 * @param pipelineId - Pipeline ID (YYYY-MM-DD)
 * @param healthResult - Health check result for context
 */
export async function triggerBufferDeployment(
  pipelineId: string,
  healthResult: HealthCheckResult
): Promise<void> {
  logger.info({
    pipelineId,
    criticalFailures: healthResult.criticalFailures,
    reason: 'Health check failure triggered buffer deployment',
  }, 'Buffer deployment triggered (Story 5.7 integration pending)');

  // Story 5.7 will implement:
  // - Query Firestore for available buffer videos
  // - Select appropriate buffer video
  // - Trigger YouTube upload of buffer video
  // - Update buffer video inventory
  // - Log buffer deployment in incidents collection
}

/**
 * Determine response action for a specific service failure
 *
 * @param service - Failed service
 * @returns Response action to take
 */
export function getFailureResponse(service: HealthCheckService): {
  action: 'skip-pipeline' | 'continue-degraded' | 'continue-normal';
  alertType: 'CRITICAL' | 'WARNING' | 'INFO';
  shouldAlertDiscord: boolean;
  shouldAlertEmail: boolean;
} {
  const criticality = SERVICE_CRITICALITY[service];

  switch (criticality) {
    case 'CRITICAL':
      return {
        action: 'skip-pipeline',
        alertType: 'CRITICAL',
        shouldAlertDiscord: true,
        shouldAlertEmail: service === 'firestore', // Email for Firestore (per AC #4)
      };

    case 'DEGRADED':
      return {
        action: 'continue-degraded',
        alertType: 'WARNING',
        shouldAlertDiscord: false,
        shouldAlertEmail: false,
      };

    case 'RECOVERABLE':
      return {
        action: 'continue-normal',
        alertType: 'WARNING',
        shouldAlertDiscord: false,
        shouldAlertEmail: false,
      };

    default:
      return {
        action: 'continue-normal',
        alertType: 'INFO',
        shouldAlertDiscord: false,
        shouldAlertEmail: false,
      };
  }
}
