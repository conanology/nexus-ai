/**
 * Health check types for NEXUS-AI pipeline pre-flight verification
 *
 * Defines interfaces for health check results, individual service checks,
 * and health history aggregation.
 *
 * @module @nexus-ai/core/types/health
 */

/**
 * Health check status levels
 * - healthy: Service is operational and performing within thresholds
 * - degraded: Service is operational but performance is impacted (non-critical)
 * - failed: Service is unavailable or failing critical checks
 */
export type HealthCheckStatus = 'healthy' | 'degraded' | 'failed';

/**
 * Service names that can be health checked
 */
export type HealthCheckService =
  | 'gemini'
  | 'youtube'
  | 'twitter'
  | 'firestore'
  | 'cloud-storage'
  | 'secret-manager';

/**
 * Service criticality levels for failure handling
 * - CRITICAL: Must abort pipeline, trigger buffer deployment
 * - DEGRADED: Can continue but quality may be impacted
 * - RECOVERABLE: Non-critical, pipeline continues normally
 */
export type ServiceCriticality = 'CRITICAL' | 'DEGRADED' | 'RECOVERABLE';

/**
 * Result of an individual service health check
 *
 * @example
 * ```typescript
 * const check: IndividualHealthCheck = {
 *   service: 'gemini',
 *   status: 'healthy',
 *   latencyMs: 245,
 * };
 * ```
 */
export interface IndividualHealthCheck {
  /** Service that was checked */
  service: HealthCheckService;

  /** Health status result */
  status: HealthCheckStatus;

  /** Time taken to perform the check in milliseconds */
  latencyMs: number;

  /** Error message if check failed */
  error?: string;

  /** Additional metadata specific to the service */
  metadata?: Record<string, unknown>;
}

/**
 * Complete health check result with all service checks aggregated
 *
 * @example
 * ```typescript
 * const result: HealthCheckResult = {
 *   timestamp: '2026-01-20T06:00:00.000Z',
 *   allPassed: false,
 *   checks: [...],
 *   criticalFailures: ['gemini'],
 *   warnings: ['cloud-storage'],
 *   totalDurationMs: 1523,
 * };
 * ```
 */
export interface HealthCheckResult {
  /** ISO 8601 timestamp when health check completed */
  timestamp: string;

  /** Overall health status - true if no critical failures */
  allPassed: boolean;

  /** Array of individual service check results */
  checks: IndividualHealthCheck[];

  /** Services that failed with CRITICAL criticality */
  criticalFailures: HealthCheckService[];

  /** Services that are degraded or failed with non-critical criticality */
  warnings: HealthCheckService[];

  /** Total time taken for all health checks in milliseconds */
  totalDurationMs: number;
}

/**
 * Firestore document structure for storing health check results
 * Path: pipelines/{YYYY-MM-DD}/health
 */
export interface HealthCheckDocument extends HealthCheckResult {
  /** Pipeline ID (YYYY-MM-DD format) */
  pipelineId: string;
}

/**
 * YouTube quota check result with additional metadata
 */
export interface YouTubeQuotaCheck extends IndividualHealthCheck {
  service: 'youtube';
  metadata: {
    /** Current quota usage units */
    quotaUsed: number;
    /** Total quota limit (typically 10,000 for YouTube Data API) */
    quotaLimit: number;
    /** Usage percentage (quotaUsed / quotaLimit * 100) */
    percentage: number;
  };
}

/**
 * Service uptime statistics for health history
 */
export interface ServiceHealthStats {
  /** Total number of health checks in the period */
  totalChecks: number;

  /** Number of failed checks */
  failures: number;

  /** Uptime percentage (0-100) */
  uptimePercentage: number;

  /** Average latency in milliseconds */
  avgLatencyMs: number;

  /** ISO timestamp of last failure (if any) */
  lastFailure?: string;

  /** Failure pattern analysis */
  failurePattern: 'none' | 'intermittent' | 'consistent';
}

/**
 * Recurring issue detected in health history
 */
export interface RecurringIssue {
  /** Service experiencing the issue */
  service: HealthCheckService;

  /** Number of occurrences in the analysis period */
  frequency: number;

  /** ISO timestamp of most recent occurrence */
  lastOccurrence: string;

  /** Description of the recurring issue */
  description?: string;
}

/**
 * Aggregated health history summary for a time period
 *
 * @example
 * ```typescript
 * const history = await getHealthHistory(7);
 * console.log(`Gemini uptime: ${history.services.gemini.uptimePercentage}%`);
 * ```
 */
export interface HealthHistorySummary {
  /** Start and end dates for the analysis period */
  dateRange: {
    start: string;
    end: string;
  };

  /** Health statistics per service */
  services: {
    [K in HealthCheckService]?: ServiceHealthStats;
  };

  /** Recurring issues detected across services */
  recurringIssues: RecurringIssue[];

  /** Total number of health checks analyzed */
  totalChecks: number;

  /** Overall system health percentage */
  overallHealth: number;
}

/**
 * Map of service criticality levels
 */
export const SERVICE_CRITICALITY: Record<HealthCheckService, ServiceCriticality> = {
  'gemini': 'CRITICAL',        // No LLM = no content
  'youtube': 'CRITICAL',       // Can't publish = no video
  'firestore': 'CRITICAL',     // Can't persist state = fatal
  'cloud-storage': 'DEGRADED', // Can work with degraded storage
  'secret-manager': 'CRITICAL', // Can't access credentials = fatal
  'twitter': 'RECOVERABLE',    // Social is nice-to-have
} as const;

/**
 * Health check timeout in milliseconds per service
 */
export const HEALTH_CHECK_TIMEOUT_MS = 30000;

/**
 * Maximum total duration for all health checks in milliseconds
 */
export const MAX_HEALTH_CHECK_DURATION_MS = 120000;

/**
 * YouTube quota thresholds per AC5:
 * - healthy: quota < 60%
 * - degraded: quota >= 60% and < 80%
 * - failed: quota >= 80%
 */
export const YOUTUBE_QUOTA_THRESHOLDS = {
  /** Below this is healthy */
  HEALTHY: 60,
  /** Between HEALTHY and FAILED is degraded, send WARNING alert at this level */
  WARNING: 80,
  /** At or above this is FAILED (per AC5: failed >= 80%) */
  CRITICAL: 80,
} as const;
