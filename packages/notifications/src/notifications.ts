/**
 * Notifications stage function
 *
 * Executes as the final pipeline stage to send Discord summaries
 * and daily digest emails. Always runs regardless of prior stage failures.
 *
 * @module notifications/notifications
 */

import {
  createLogger,
  CostTracker,
  type StageInput,
  type StageOutput,
} from '@nexus-ai/core';
import type {
  NotificationsInput,
  NotificationsOutput,
  NotificationChannelResult,
  DigestData,
} from './types.js';
import { sendDiscordSummary } from './discord.js';
import { sendDigestEmail } from './email.js';
import { collectDigestData } from './digest.js';
import { logNotificationResults, trackNotificationMetrics } from './metrics.js';

const logger = createLogger('notifications.stage');

/**
 * Helper to execute a notification channel with timing
 */
async function withTiming<T>(
  fn: () => Promise<T>
): Promise<{ result: T; latencyMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - start };
}

/**
 * Execute notifications stage
 *
 * This stage ALWAYS runs, even after pipeline failures.
 * Notification failures are logged but do not fail the stage.
 *
 * @param input - Stage input with pipeline result
 * @returns Stage output with notification results
 */
export async function executeNotifications(
  input: StageInput<NotificationsInput>
): Promise<StageOutput<NotificationsOutput>> {
  const startTime = Date.now();
  const { pipelineId, data } = input;
  const tracker = new CostTracker(pipelineId, 'notifications');

  logger.info(
    {
      pipelineId,
      stage: 'notifications',
      pipelineStatus: data.pipelineResult.status,
    },
    'Starting notifications stage'
  );

  // Collect digest data with error handling - digest failures should not fail the stage
  let digest: DigestData;
  try {
    digest = await collectDigestData(pipelineId, data.pipelineResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { pipelineId, error: errorMessage },
      'Failed to collect digest data, using minimal fallback'
    );
    // Use minimal fallback digest
    digest = {
      video: null,
      pipeline: {
        pipelineId,
        status: data.pipelineResult.status,
        duration: `${Math.floor(data.pipelineResult.durationMs / 60000)}m`,
        cost: `$${data.pipelineResult.totalCost.toFixed(2)}`,
        stages: [],
      },
      health: {
        buffersRemaining: -1,
        budgetRemaining: 'Unknown',
        daysOfRunway: -1,
      },
      alerts: [{ type: 'warning' as const, message: 'Digest generation failed', timestamp: new Date().toISOString() }],
    };
  }

  // Send Discord and Email in parallel with individual timing
  const [discordTimed, emailTimed] = await Promise.allSettled([
    withTiming(() => sendDiscordSummary(pipelineId, data.pipelineResult)),
    withTiming(() => sendDigestEmail(pipelineId, digest)),
  ]);

  // Extract results with accurate individual latencies
  let discordOutput: NotificationChannelResult;
  let discordLatency: number;
  if (discordTimed.status === 'fulfilled') {
    discordOutput = { sent: true, messageId: discordTimed.value.result };
    discordLatency = discordTimed.value.latencyMs;
  } else {
    discordOutput = { sent: false, error: (discordTimed.reason as Error).message };
    discordLatency = 0;
  }

  let emailOutput: NotificationChannelResult;
  let emailLatency: number;
  if (emailTimed.status === 'fulfilled') {
    emailOutput = { sent: true, messageId: emailTimed.value.result };
    emailLatency = emailTimed.value.latencyMs;
  } else {
    emailOutput = { sent: false, error: (emailTimed.reason as Error).message };
    emailLatency = 0;
  }

  // Track notification metrics
  trackNotificationMetrics(pipelineId, [
    {
      channel: 'discord',
      sent: discordOutput.sent,
      latencyMs: discordLatency,
      attempts: 1, // We handle retries internally
      timestamp: new Date().toISOString(),
    },
    {
      channel: 'email',
      sent: emailOutput.sent,
      latencyMs: emailLatency,
      attempts: 1,
      timestamp: new Date().toISOString(),
    },
  ]);

  // Log notification results to Firestore (non-blocking)
  logNotificationResults(pipelineId, discordOutput, emailOutput).catch((err) =>
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), pipelineId },
      'Failed to log notification results to Firestore'
    )
  );

  // Build stage output
  const durationMs = Date.now() - startTime;
  const notificationsSent = [discordOutput.sent, emailOutput.sent].filter(
    Boolean
  ).length;
  const notificationsFailed = [discordOutput.sent, emailOutput.sent].filter(
    (s) => !s
  ).length;

  // Collect warnings for failed notifications
  const warnings: string[] = [];
  if (!discordOutput.sent) {
    warnings.push(`Discord notification failed: ${discordOutput.error}`);
  }
  if (!emailOutput.sent) {
    warnings.push(`Email notification failed: ${emailOutput.error}`);
  }

  const output: StageOutput<NotificationsOutput> = {
    success: true, // Always succeeds - notification failures are warnings
    data: {
      discord: discordOutput,
      email: emailOutput,
      digest,
    },
    quality: {
      stage: 'notifications',
      timestamp: new Date().toISOString(),
      measurements: {
        notificationsSent,
        notificationsFailed,
        discordLatencyMs: discordLatency,
        emailLatencyMs: emailLatency,
      },
    },
    cost: tracker.getSummary(),
    durationMs,
    provider: {
      name: 'notifications',
      tier: 'primary',
      attempts: 1,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  logger.info(
    {
      pipelineId,
      stage: 'notifications',
      discordSent: discordOutput.sent,
      emailSent: emailOutput.sent,
      durationMs,
      notificationsSent,
      notificationsFailed,
    },
    'Notifications stage complete'
  );

  return output;
}
