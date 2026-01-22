/**
 * Type definitions for NEXUS-AI notifications package
 *
 * @module notifications/types
 */

/**
 * Discord alert severity levels with corresponding colors
 */
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'SUCCESS' | 'INFO';

/**
 * Discord color codes (decimal values, not hex)
 */
export const DISCORD_COLORS = {
  CRITICAL: 15158332, // Red (#E74C3C)
  WARNING: 16776960, // Yellow (#FFFF00)
  SUCCESS: 3066993, // Green (#2ECC71)
  INFO: 3447003, // Blue (#3498DB)
} as const;

/**
 * Discord webhook embed field
 */
export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * Discord webhook embed structure
 */
export interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string };
  timestamp?: string;
}

/**
 * Discord webhook payload
 */
export interface DiscordWebhookPayload {
  username?: string;
  avatar_url?: string;
  content?: string;
  embeds?: DiscordEmbed[];
}

/**
 * Discord alert configuration
 */
export interface DiscordAlertConfig {
  severity: AlertSeverity;
  title: string;
  description?: string;
  fields?: DiscordEmbedField[];
  timestamp?: string;
}

/**
 * Alert routing configuration
 */
export interface AlertRoutingConfig {
  severity: AlertSeverity;
  sendDiscord: boolean;
  sendEmail: boolean;
}

/**
 * Predefined alert routing rules
 */
export const ALERT_ROUTING: Record<string, AlertRoutingConfig> = {
  'pipeline-failed-no-buffer': {
    severity: 'CRITICAL',
    sendDiscord: true,
    sendEmail: true,
  },
  'buffer-deployed': { severity: 'WARNING', sendDiscord: true, sendEmail: false },
  'quality-degraded': { severity: 'WARNING', sendDiscord: true, sendEmail: false },
  'buffer-low': { severity: 'WARNING', sendDiscord: true, sendEmail: true },
  'cost-warning': { severity: 'WARNING', sendDiscord: true, sendEmail: false },
  'cost-critical': { severity: 'CRITICAL', sendDiscord: false, sendEmail: true },
  'youtube-ctr-low': { severity: 'WARNING', sendDiscord: true, sendEmail: false },
  'milestone-achieved': { severity: 'SUCCESS', sendDiscord: true, sendEmail: false },
  'health-check-failed': {
    severity: 'CRITICAL',
    sendDiscord: true,
    sendEmail: true,
  },
} as const;

/**
 * Email message structure
 */
export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Alert email configuration
 */
export interface AlertEmailConfig {
  subject: string;
  body: string;
  severity: AlertSeverity;
}

/**
 * Video data for daily digest
 */
export interface DigestVideoData {
  title: string;
  url: string;
  topic: string;
  source: string;
  thumbnailVariant: 1 | 2 | 3;
}

/**
 * Stage status for digest
 */
export interface DigestStageStatus {
  name: string;
  status: string;
  provider?: string;
  tier?: 'primary' | 'fallback';
}

/**
 * Pipeline data for daily digest
 */
export interface DigestPipelineData {
  pipelineId: string;
  status: 'success' | 'failed' | 'degraded' | 'skipped';
  duration: string;
  cost: string;
  stages: DigestStageStatus[];
}

/**
 * Performance data for daily digest (optional)
 */
export interface DigestPerformanceData {
  day1Views?: number;
  ctr?: number;
  avgViewDuration?: string;
  thumbnailVariant: number;
}

/**
 * Health status for daily digest
 */
export interface DigestHealthData {
  buffersRemaining: number;
  budgetRemaining: string;
  daysOfRunway: number;
  creditExpiration?: string;
}

/**
 * Alert item for daily digest
 */
export interface DigestAlert {
  type: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
}

/**
 * Tomorrow's preview for daily digest
 */
export interface DigestTomorrowData {
  queuedTopic?: string;
  expectedPublishTime: string;
}

/**
 * Complete daily digest data structure
 */
export interface DigestData {
  video: DigestVideoData | null;
  pipeline: DigestPipelineData;
  performance?: DigestPerformanceData;
  health: DigestHealthData;
  alerts: DigestAlert[];
  tomorrow?: DigestTomorrowData;
}

/**
 * Notification channel result
 */
export interface NotificationChannelResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Notifications stage input
 */
export interface NotificationsInput {
  pipelineId: string;
  pipelineResult: PipelineResultData;
  healthCheckResult?: HealthCheckResultData;
}

/**
 * Notifications stage output
 */
export interface NotificationsOutput {
  discord: NotificationChannelResult;
  email: NotificationChannelResult;
  digest: DigestData;
}

/**
 * Skip info for pipeline skip (graceful shutdown)
 */
export interface PipelineSkipInfo {
  /** Reason for the skip */
  reason: string;
  /** Stage where skip was triggered */
  stage: string;
  /** Whether the topic was queued for retry */
  topicQueued: boolean;
  /** Date the topic was queued for (YYYY-MM-DD) */
  queuedForDate?: string;
  /** Incident ID for reference */
  incidentId?: string;
}

/**
 * Pipeline result data for notifications
 */
export interface PipelineResultData {
  status: 'success' | 'failed' | 'degraded' | 'skipped';
  videoTitle?: string;
  videoUrl?: string;
  topic?: string;
  source?: string;
  thumbnailVariant?: 1 | 2 | 3;
  durationMs: number;
  totalCost: number;
  stages: Array<{
    name: string;
    status: string;
    provider?: string;
    tier?: 'primary' | 'fallback';
    cost?: number;
  }>;
  qualityContext?: {
    degradedStages: string[];
    fallbacksUsed: string[];
    flags: string[];
  };
  warnings?: string[];
  /** Skip info when status is 'skipped' (graceful shutdown, topic queued) */
  skipInfo?: PipelineSkipInfo;
}

/**
 * Health check result data for notifications
 */
export interface HealthCheckResultData {
  status: 'healthy' | 'degraded' | 'failed';
  timestamp: string;
  criticalFailures: string[];
  warnings: string[];
  totalDurationMs: number;
}

/**
 * Notification metrics for tracking
 */
export interface NotificationMetrics {
  channel: 'discord' | 'email';
  sent: boolean;
  latencyMs: number;
  attempts: number;
  timestamp: string;
}

/**
 * Notification log entry
 */
export interface NotificationLog {
  pipelineId: string;
  timestamp: string;
  discord: NotificationChannelResult;
  email: NotificationChannelResult;
  metrics: NotificationMetrics[];
}

/**
 * Rate limit state for Discord
 */
export interface RateLimitState {
  remaining: number;
  resetAt: number;
  lastRequest: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
}

/**
 * Default retry configurations
 */
export const DEFAULT_RETRY_CONFIG = {
  discord: {
    maxAttempts: 5,
    baseDelayMs: 2000,
    maxDelayMs: 32000,
  },
  email: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 8000,
  },
} as const;

/**
 * Discord rate limit configuration
 * 5 requests per 2 seconds per webhook
 */
export const DISCORD_RATE_LIMIT = {
  maxRequests: 5,
  windowMs: 2000,
} as const;
