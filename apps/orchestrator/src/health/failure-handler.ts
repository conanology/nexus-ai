/**
 * Health check failure handler
 *
 * Handles critical failures by routing alerts and triggering buffer deployment.
 * Implements criticality-based response actions.
 *
 * @module orchestrator/health/failure-handler
 */

import {
  createLogger,
  logIncident,
  inferRootCause,
  SERVICE_CRITICALITY,
  getBufferDeploymentCandidate,
  getBufferHealthStatus,
  queueFailedTopic as coreQueueFailedTopic,
  type BufferHealthStatus,
} from '@nexus-ai/core';
import type {
  HealthCheckResult,
  HealthCheckService,
  Incident,
} from '@nexus-ai/core';
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

  if (!result?.success) {
    logger.error({
      error: result?.error,
      pipelineId: alert.pipelineId,
    }, 'Failed to send Discord alert');
  }
}

/**
 * Queue failed topic for retry the next day
 *
 * Uses the core queue module to ensure consistent status tracking.
 *
 * @param pipelineId - Pipeline ID (YYYY-MM-DD) - the original date that failed
 * @param topic - The topic that was being processed (if known)
 * @param failureReason - Error code from the failure
 * @param failureStage - Stage where failure occurred
 */
async function queueFailedTopicInternal(
  pipelineId: string,
  topic: string | undefined,
  failureReason: string,
  failureStage: string
): Promise<void> {
  if (!topic) {
    logger.info({ pipelineId }, 'No topic to queue - failure occurred before topic selection');
    return;
  }

  try {
    const queuedForDate = await coreQueueFailedTopic(
      topic,
      failureReason,
      failureStage,
      pipelineId
    );

    logger.info({
      pipelineId,
      queuedForDate,
      topic,
      failureReason,
    }, 'Failed topic queued for next day processing');
  } catch (error) {
    logger.error({
      pipelineId,
      topic,
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to queue topic via core module');
    throw error;
  }
}

/**
 * Trigger buffer video deployment when pipeline cannot run
 *
 * CRITICAL: Buffer deployment is NOT automatic. This function:
 * 1. Checks if buffer videos are available
 * 2. Logs an incident with buffer deployment resolution type
 * 3. Sends alert to operator with instructions to deploy buffer
 * 4. Queues original topic for next day processing
 *
 * The operator must run `nexus buffer deploy` to actually deploy the buffer.
 *
 * @param pipelineId - Pipeline ID (YYYY-MM-DD)
 * @param healthResult - Health check result for context
 * @param failedTopic - Optional topic that was being processed when failure occurred
 * @param failureStage - Optional stage where failure occurred (defaults to 'health-check')
 */
export async function triggerBufferDeployment(
  pipelineId: string,
  healthResult: HealthCheckResult,
  failedTopic?: string,
  failureStage: string = 'health-check'
): Promise<void> {
  // Check buffer availability
  let bufferHealth: BufferHealthStatus | null = null;
  let hasBufferAvailable = false;

  try {
    bufferHealth = await getBufferHealthStatus();
    const candidate = await getBufferDeploymentCandidate();
    hasBufferAvailable = candidate !== null;
  } catch (error) {
    logger.error({
      pipelineId,
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to check buffer availability');
  }

  // Log incident for the health check failure with buffer deployment resolution
  const incident: Incident = {
    date: pipelineId,
    pipelineId,
    stage: 'health-check',
    error: {
      code: 'NEXUS_HEALTH_CHECK_FAILED',
      message: `Health check failed: ${healthResult.criticalFailures.join(', ')}`,
    },
    severity: 'CRITICAL',
    startTime: healthResult.timestamp,
    rootCause: inferRootCause('NEXUS_SERVICE_UNAVAILABLE'),
    context: {
      criticalFailures: healthResult.criticalFailures,
      warnings: healthResult.warnings,
      healthCheckDurationMs: healthResult.totalDurationMs,
      bufferAvailable: hasBufferAvailable,
      bufferCount: bufferHealth?.availableCount,
      suggestedResolution: hasBufferAvailable ? 'buffer_deployed' : 'manual_required',
    },
  };

  let incidentId: string | undefined;
  try {
    incidentId = await logIncident(incident);
  } catch (error) {
    logger.error({
      pipelineId,
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to log incident');
  }

  // Send appropriate alert based on buffer availability
  if (hasBufferAvailable) {
    // Buffer available - send instructions to operator
    logger.info({
      pipelineId,
      incidentId,
      bufferCount: bufferHealth?.availableCount,
    }, 'Buffer video available - alerting operator to deploy');

    await sendDiscordAlert({
      severity: 'CRITICAL',
      title: `🚨 Pipeline Failed - Buffer Deployment Required`,
      description: `Pipeline ${pipelineId} cannot complete due to health check failure.

**Buffer Status:** ${bufferHealth?.availableCount ?? 0} buffer(s) available

**To deploy buffer video:**
\`\`\`
nexus buffer deploy
\`\`\`

This will schedule a pre-published buffer video for 2 PM UTC.`,
      fields: [
        { name: 'Pipeline ID', value: pipelineId, inline: true },
        { name: 'Incident ID', value: incidentId ?? 'N/A', inline: true },
        { name: 'Critical Failures', value: healthResult.criticalFailures.join(', '), inline: false },
      ],
      timestamp: new Date().toISOString(),
    });
  } else {
    // No buffer available - CRITICAL emergency
    logger.error({
      pipelineId,
      incidentId,
    }, 'NO BUFFER AVAILABLE - Channel will miss daily upload');

    await sendDiscordAlert({
      severity: 'CRITICAL',
      title: `🔥 EMERGENCY: Pipeline Failed - NO BUFFERS AVAILABLE`,
      description: `Pipeline ${pipelineId} failed AND no buffer videos are available!

**NFR5 VIOLATED:** System requires minimum 1 buffer video.

**Immediate action required:**
1. Investigate health check failures
2. Create new buffer videos urgently
3. Consider manual content upload

**Channel will MISS daily upload without intervention.**`,
      fields: [
        { name: 'Pipeline ID', value: pipelineId, inline: true },
        { name: 'Incident ID', value: incidentId ?? 'N/A', inline: true },
        { name: 'Critical Failures', value: healthResult.criticalFailures.join(', '), inline: false },
      ],
      timestamp: new Date().toISOString(),
    });
  }

  // Queue original topic for next day processing (AC2)
  // If we have a topic that was being processed, queue it for retry
  if (failedTopic) {
    try {
      await queueFailedTopicInternal(
        pipelineId,
        failedTopic,
        'NEXUS_HEALTH_CHECK_FAILED',
        failureStage
      );
    } catch (error) {
      logger.error({
        pipelineId,
        topic: failedTopic,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to queue topic for retry');
    }
  }

  logger.info({
    pipelineId,
    incidentId,
    bufferAvailable: hasBufferAvailable,
    criticalFailures: healthResult.criticalFailures,
    topicQueued: failedTopic ? true : false,
    reason: 'Buffer deployment flow completed',
  }, 'Buffer deployment flow completed');
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
