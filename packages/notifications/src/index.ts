/**
 * @nexus-ai/notifications
 *
 * Discord and email notification capabilities for NEXUS-AI pipeline.
 * Provides immediate alerts, daily digests, and health check failure notifications.
 *
 * @module notifications
 *
 * @example
 * ```typescript
 * import {
 *   sendDiscordAlert,
 *   sendHealthCheckFailureAlert,
 *   sendDigestEmail,
 *   executeNotifications,
 * } from '@nexus-ai/notifications';
 *
 * // Send a critical Discord alert
 * await sendDiscordAlert({
 *   severity: 'CRITICAL',
 *   title: 'Pipeline Failed',
 *   description: 'Video generation failed at TTS stage',
 * });
 *
 * // Send daily digest email
 * await sendDigestEmail(pipelineId, digestData);
 *
 * // Execute notifications stage (always runs, even on failures)
 * const output = await executeNotifications(input);
 * ```
 */

// Types
export type {
  AlertSeverity,
  DiscordEmbedField,
  DiscordEmbed,
  DiscordWebhookPayload,
  DiscordAlertConfig,
  AlertRoutingConfig,
  EmailMessage,
  AlertEmailConfig,
  DigestVideoData,
  DigestStageStatus,
  DigestPipelineData,
  DigestPerformanceData,
  DigestHealthData,
  DigestAlert,
  DigestTomorrowData,
  DigestData,
  NotificationChannelResult,
  NotificationsInput,
  NotificationsOutput,
  PipelineResultData,
  HealthCheckResultData,
  NotificationMetrics,
  NotificationLog,
  RateLimitState,
  RetryConfig,
} from './types.js';

export {
  DISCORD_COLORS,
  ALERT_ROUTING,
  DEFAULT_RETRY_CONFIG,
  DISCORD_RATE_LIMIT,
} from './types.js';

// Discord alerts
export {
  sendDiscordAlert,
  sendHealthCheckFailureAlert,
  sendDiscordSummary,
  formatCriticalAlert,
  formatWarningAlert,
  formatSuccessAlert,
} from './discord.js';

// Email
export {
  sendEmail,
  sendDigestEmail,
  sendAlertEmail,
} from './email.js';

// Digest generation
export {
  generateDigest,
  collectDigestData,
  formatDigestEmail,
  formatDigestPlainText,
} from './digest.js';

// Notifications stage
export { executeNotifications } from './notifications.js';

// Metrics and logging
export {
  trackNotificationMetrics,
  logNotificationResults,
  getNotificationHistory,
} from './metrics.js';

// Alert routing utility
export { routeAlert, sendCriticalAlert } from './routing.js';

// Shared utilities
export { escapeHtml, formatDuration, formatCost } from './utils.js';
