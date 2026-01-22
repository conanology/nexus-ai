/**
 * Discord webhook alert implementation
 *
 * Provides Discord alerts for pipeline events, health check failures,
 * and daily summaries. Implements rate limiting and exponential backoff.
 *
 * @module notifications/discord
 */

import { createLogger, getSecret } from '@nexus-ai/core';
import type { HealthCheckResultData } from './types.js';
import {
  type AlertSeverity,
  type DiscordAlertConfig,
  type DiscordEmbed,
  type DiscordEmbedField,
  type DiscordWebhookPayload,
  type PipelineResultData,
  type RateLimitState,
  DISCORD_COLORS,
  DISCORD_RATE_LIMIT,
  DEFAULT_RETRY_CONFIG,
} from './types.js';
import { sendAlertEmail } from './email.js';

const logger = createLogger('notifications.discord');

/**
 * Rate limit state (module-scoped for tracking across calls)
 */
let rateLimitState: RateLimitState = {
  remaining: DISCORD_RATE_LIMIT.maxRequests,
  resetAt: 0,
  lastRequest: 0,
};

/**
 * Sleep utility with jitter
 *
 * @param ms - Base milliseconds to sleep
 * @param jitterPercent - Jitter range as decimal (0.1 = ±10%)
 */
async function sleep(ms: number, jitterPercent = 0.1): Promise<void> {
  const jitter = ms * (1 - jitterPercent + Math.random() * jitterPercent * 2);
  return new Promise((resolve) => setTimeout(resolve, jitter));
}

/**
 * Check and update rate limit state before making a request
 */
async function checkRateLimit(): Promise<void> {
  const now = Date.now();

  // Reset state if window has passed
  if (now >= rateLimitState.resetAt) {
    rateLimitState = {
      remaining: DISCORD_RATE_LIMIT.maxRequests,
      resetAt: now + DISCORD_RATE_LIMIT.windowMs,
      lastRequest: now,
    };
    return;
  }

  // If no remaining requests, wait until reset
  if (rateLimitState.remaining <= 0) {
    const waitTime = rateLimitState.resetAt - now;
    logger.warn(
      { waitTime, resetAt: rateLimitState.resetAt },
      'Discord rate limit reached, waiting'
    );
    await sleep(waitTime, 0);
    rateLimitState.remaining = DISCORD_RATE_LIMIT.maxRequests;
    rateLimitState.resetAt = Date.now() + DISCORD_RATE_LIMIT.windowMs;
  }

  // Decrement remaining
  rateLimitState.remaining--;
  rateLimitState.lastRequest = Date.now();
}

/**
 * Update rate limit state from response headers
 *
 * @param headers - Response headers from Discord webhook
 */
function updateRateLimitFromHeaders(headers: Headers): void {
  const remaining = headers.get('X-RateLimit-Remaining');
  const resetAfter = headers.get('X-RateLimit-Reset-After');

  if (remaining !== null) {
    rateLimitState.remaining = parseInt(remaining, 10);
  }

  if (resetAfter !== null) {
    rateLimitState.resetAt = Date.now() + parseFloat(resetAfter) * 1000;
  }
}

/**
 * Send Discord webhook with retry and exponential backoff
 *
 * @param webhookUrl - Discord webhook URL
 * @param payload - Webhook payload
 * @returns Response status or error
 */
async function sendWithRetry(
  webhookUrl: string,
  payload: DiscordWebhookPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { maxAttempts, baseDelayMs, maxDelayMs } = DEFAULT_RETRY_CONFIG.discord;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check local rate limit before sending
      await checkRateLimit();

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Update rate limit state from response headers
      updateRateLimitFromHeaders(response.headers);

      if (response.ok) {
        logger.info(
          { attempt: attempt + 1, status: response.status },
          'Discord webhook sent successfully'
        );
        return { success: true };
      }

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter =
          parseInt(response.headers.get('retry-after') || '5', 10) * 1000;
        logger.warn(
          { attempt: attempt + 1, retryAfter },
          'Discord rate limited, waiting'
        );
        await sleep(retryAfter, 0);
        continue;
      }

      // Non-retryable error
      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, error: errorText },
          'Discord webhook client error'
        );
        return {
          success: false,
          error: `Discord webhook failed: ${response.status} - ${errorText}`,
        };
      }

      // Server error - retry
      throw new Error(`Discord webhook server error: ${response.status}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (attempt === maxAttempts - 1) {
        logger.error(
          { attempt: attempt + 1, error: errorMessage },
          'Discord webhook failed after all retries'
        );
        return { success: false, error: errorMessage };
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs ?? 32000);
      logger.warn(
        { attempt: attempt + 1, delay, error: errorMessage },
        'Discord webhook failed, retrying'
      );
      await sleep(delay);
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Build Discord embed from alert config
 *
 * @param config - Alert configuration
 * @returns Discord embed object
 */
function buildEmbed(config: DiscordAlertConfig): DiscordEmbed {
  const embed: DiscordEmbed = {
    title: config.title,
    color: DISCORD_COLORS[config.severity],
    timestamp: config.timestamp || new Date().toISOString(),
  };

  if (config.description) {
    embed.description = config.description;
  }

  if (config.fields && config.fields.length > 0) {
    embed.fields = config.fields;
  }

  embed.footer = { text: `NEXUS-AI | ${config.severity}` };

  return embed;
}

/**
 * Send a Discord alert
 *
 * @param config - Alert configuration
 * @returns Send result
 */
export async function sendDiscordAlert(
  config: DiscordAlertConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const webhookUrl = await getSecret('nexus-discord-webhook');

    const payload: DiscordWebhookPayload = {
      username: 'NEXUS-AI',
      embeds: [buildEmbed(config)],
    };

    logger.info(
      { severity: config.severity, title: config.title },
      'Sending Discord alert'
    );

    return await sendWithRetry(webhookUrl, payload);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, 'Failed to send Discord alert');
    return { success: false, error: errorMessage };
  }
}

/**
 * Format a critical alert
 *
 * @param title - Alert title
 * @param description - Alert description
 * @param fields - Optional fields
 * @returns Alert configuration
 */
export function formatCriticalAlert(
  title: string,
  description: string,
  fields?: DiscordEmbedField[]
): DiscordAlertConfig {
  return {
    severity: 'CRITICAL',
    title,
    description,
    fields,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format a warning alert
 *
 * @param title - Alert title
 * @param description - Alert description
 * @param fields - Optional fields
 * @returns Alert configuration
 */
export function formatWarningAlert(
  title: string,
  description: string,
  fields?: DiscordEmbedField[]
): DiscordAlertConfig {
  return {
    severity: 'WARNING',
    title,
    description,
    fields,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format a success alert
 *
 * @param title - Alert title
 * @param description - Alert description
 * @param fields - Optional fields
 * @returns Alert configuration
 */
export function formatSuccessAlert(
  title: string,
  description: string,
  fields?: DiscordEmbedField[]
): DiscordAlertConfig {
  return {
    severity: 'SUCCESS',
    title,
    description,
    fields,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Send health check failure alert (Story 5.3 integration)
 *
 * Sends BOTH Discord and Email alerts for critical health check failures,
 * as required by AC7 and ALERT_ROUTING configuration.
 *
 * @param pipelineId - Pipeline ID
 * @param healthResult - Health check result
 * @returns Send result with both channel outcomes
 */
export async function sendHealthCheckFailureAlert(
  pipelineId: string,
  healthResult: HealthCheckResultData
): Promise<{ success: boolean; error?: string; discordSent: boolean; emailSent: boolean }> {
  const failedServices = healthResult.criticalFailures.join(', ');

  const fields: DiscordEmbedField[] = [
    { name: 'Pipeline ID', value: pipelineId, inline: true },
    { name: 'Failed Services', value: failedServices || 'None', inline: true },
    { name: 'Timestamp', value: healthResult.timestamp, inline: true },
    {
      name: 'Action',
      value: 'Pipeline execution skipped. Buffer video deployment attempted.',
      inline: false,
    },
  ];

  const config = formatCriticalAlert(
    'Health Check Failed - Pipeline Skipped',
    `Critical services unavailable: ${failedServices}`,
    fields
  );

  logger.info(
    { pipelineId, failedServices },
    'Sending health check failure alert to Discord and Email'
  );

  // Send to both Discord and Email in parallel (per AC7 and ALERT_ROUTING)
  const [discordResult, emailResult] = await Promise.allSettled([
    sendDiscordAlert(config),
    sendAlertEmail({
      subject: `[CRITICAL] NEXUS-AI Health Check Failed - ${pipelineId}`,
      body: `Critical services are unavailable and the pipeline has been skipped.

Failed Services: ${failedServices}
Timestamp: ${healthResult.timestamp}

A buffer video deployment has been attempted to maintain daily publishing.

Please investigate the service outages immediately.`,
      severity: 'CRITICAL',
    }),
  ]);

  const discordSent = discordResult.status === 'fulfilled' && discordResult.value.success;
  const emailSent = emailResult.status === 'fulfilled' && emailResult.value.success;

  // Collect errors if any
  const errors: string[] = [];
  if (!discordSent) {
    const discordError = discordResult.status === 'rejected'
      ? (discordResult.reason as Error).message
      : (discordResult.value as { error?: string }).error;
    if (discordError) errors.push(`Discord: ${discordError}`);
  }
  if (!emailSent) {
    const emailError = emailResult.status === 'rejected'
      ? (emailResult.reason as Error).message
      : (emailResult.value as { error?: string }).error;
    if (emailError) errors.push(`Email: ${emailError}`);
  }

  return {
    success: discordSent || emailSent, // Success if at least one channel worked
    discordSent,
    emailSent,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

/**
 * Send Discord summary for pipeline completion
 *
 * @param pipelineId - Pipeline ID
 * @param result - Pipeline result
 * @returns Message ID or undefined
 */
export async function sendDiscordSummary(
  pipelineId: string,
  result: PipelineResultData
): Promise<string | undefined> {
  let severity: AlertSeverity;
  let title: string;

  switch (result.status) {
    case 'success':
      severity = 'SUCCESS';
      title = 'Pipeline Completed Successfully';
      break;
    case 'degraded':
      severity = 'WARNING';
      title = 'Pipeline Completed (Degraded)';
      break;
    case 'failed':
      severity = 'CRITICAL';
      title = 'Pipeline Failed';
      break;
    case 'skipped':
      severity = 'WARNING';
      title = 'Pipeline Skipped';
      break;
    default:
      severity = 'INFO';
      title = 'Pipeline Status Update';
  }

  const fields: DiscordEmbedField[] = [
    { name: 'Pipeline ID', value: pipelineId, inline: true },
    { name: 'Status', value: result.status.toUpperCase(), inline: true },
    {
      name: 'Duration',
      value: formatDuration(result.durationMs),
      inline: true,
    },
    { name: 'Cost', value: formatCost(result.totalCost), inline: true },
  ];

  if (result.videoTitle) {
    fields.push({ name: 'Video', value: result.videoTitle, inline: false });
  }

  if (result.videoUrl) {
    fields.push({ name: 'URL', value: result.videoUrl, inline: false });
  }

  if (result.qualityContext?.degradedStages?.length) {
    fields.push({
      name: 'Degraded Stages',
      value: result.qualityContext.degradedStages.join(', '),
      inline: false,
    });
  }

  if (result.qualityContext?.fallbacksUsed?.length) {
    fields.push({
      name: 'Fallbacks Used',
      value: result.qualityContext.fallbacksUsed.join(', '),
      inline: false,
    });
  }

  if (result.warnings?.length) {
    fields.push({
      name: 'Warnings',
      value: result.warnings.slice(0, 3).join('\n'),
      inline: false,
    });
  }

  const config: DiscordAlertConfig = {
    severity,
    title,
    description: `Pipeline ${pipelineId} has completed with status: ${result.status}`,
    fields,
    timestamp: new Date().toISOString(),
  };

  const sendResult = await sendDiscordAlert(config);

  if (sendResult.success) {
    return sendResult.messageId;
  }

  logger.error(
    { pipelineId, error: sendResult.error },
    'Failed to send Discord summary'
  );
  return undefined;
}

/**
 * Format duration in human-readable form
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "3h 42m")
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format cost as currency
 *
 * @param cost - Cost in dollars
 * @returns Formatted string (e.g., "$0.47")
 */
function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/**
 * Reset rate limit state (for testing)
 */
export function resetRateLimitState(): void {
  rateLimitState = {
    remaining: DISCORD_RATE_LIMIT.maxRequests,
    resetAt: 0,
    lastRequest: 0,
  };
}
