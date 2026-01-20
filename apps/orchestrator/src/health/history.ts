/**
 * Health check history functions
 *
 * Provides aggregated health history for monitoring and analysis.
 * Supports querying historical health checks and identifying patterns.
 *
 * @module orchestrator/health/history
 */

import { FirestoreClient, createLogger } from '@nexus-ai/core';
import type {
  HealthCheckDocument,
  HealthCheckService,
  HealthHistorySummary,
  ServiceHealthStats,
  RecurringIssue,
} from '@nexus-ai/core';

const logger = createLogger('orchestrator.health.history');

/**
 * All services for iteration
 */
const ALL_SERVICES: HealthCheckService[] = [
  'gemini',
  'youtube',
  'twitter',
  'firestore',
  'cloud-storage',
  'secret-manager',
];

/**
 * Get health check history for the last N days
 *
 * Queries Firestore for health check results and aggregates:
 * - Uptime percentages per service
 * - Failure patterns
 * - Average latencies
 * - Recurring issues
 *
 * @param days - Number of days to analyze (default: 7)
 * @returns Aggregated health history summary
 */
export async function getHealthHistory(days: number = 7): Promise<HealthHistorySummary> {
  const firestoreClient = new FirestoreClient();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  logger.info({
    days,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  }, 'Fetching health history');

  // Collect health check documents for each day
  const healthChecks: HealthCheckDocument[] = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const pipelineId = d.toISOString().split('T')[0];

    try {
      const doc = await firestoreClient.getDocument<HealthCheckDocument>(
        `pipelines/${pipelineId}`,
        'health'
      );

      if (doc) {
        healthChecks.push(doc);
      }
    } catch (error) {
      logger.debug({
        pipelineId,
        error: error instanceof Error ? error.message : String(error),
      }, 'No health check found for date');
    }
  }

  logger.info({
    days,
    healthChecksFound: healthChecks.length,
  }, 'Health history query complete');

  // Build summary
  return buildHealthHistorySummary(healthChecks, startDate, endDate);
}

/**
 * Build aggregated health history summary from health check documents
 */
function buildHealthHistorySummary(
  healthChecks: HealthCheckDocument[],
  startDate: Date,
  endDate: Date
): HealthHistorySummary {
  const serviceStats: Record<HealthCheckService, ServiceHealthStats> = {} as Record<HealthCheckService, ServiceHealthStats>;

  // Initialize stats for all services
  for (const service of ALL_SERVICES) {
    serviceStats[service] = {
      totalChecks: 0,
      failures: 0,
      uptimePercentage: 100,
      avgLatencyMs: 0,
      failurePattern: 'none',
    };
  }

  // Aggregate data from health checks
  const serviceLatencies: Record<HealthCheckService, number[]> = {} as Record<HealthCheckService, number[]>;
  const serviceFailureDates: Record<HealthCheckService, string[]> = {} as Record<HealthCheckService, string[]>;

  for (const service of ALL_SERVICES) {
    serviceLatencies[service] = [];
    serviceFailureDates[service] = [];
  }

  for (const healthCheck of healthChecks) {
    for (const check of healthCheck.checks) {
      const stats = serviceStats[check.service];
      stats.totalChecks++;
      serviceLatencies[check.service].push(check.latencyMs);

      if (check.status === 'failed') {
        stats.failures++;
        stats.lastFailure = healthCheck.timestamp;
        serviceFailureDates[check.service].push(healthCheck.timestamp);
      }
    }
  }

  // Calculate averages and percentages
  for (const service of ALL_SERVICES) {
    const stats = serviceStats[service];
    const latencies = serviceLatencies[service];

    if (latencies.length > 0) {
      stats.avgLatencyMs = Math.round(
        latencies.reduce((a, b) => a + b, 0) / latencies.length
      );
    }

    if (stats.totalChecks > 0) {
      stats.uptimePercentage = Number(
        ((1 - stats.failures / stats.totalChecks) * 100).toFixed(1)
      );
    }

    // Determine failure pattern
    stats.failurePattern = determineFailurePattern(
      stats.failures,
      stats.totalChecks,
      serviceFailureDates[service]
    );
  }

  // Identify recurring issues
  const recurringIssues = identifyRecurringIssues(serviceStats, serviceFailureDates);

  // Calculate overall health
  let totalChecks = 0;
  let totalFailures = 0;
  for (const service of ALL_SERVICES) {
    totalChecks += serviceStats[service].totalChecks;
    totalFailures += serviceStats[service].failures;
  }

  const overallHealth = totalChecks > 0
    ? Number(((1 - totalFailures / totalChecks) * 100).toFixed(1))
    : 100;

  return {
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
    services: serviceStats,
    recurringIssues,
    totalChecks: healthChecks.length,
    overallHealth,
  };
}

/**
 * Determine failure pattern based on failure frequency and distribution
 */
function determineFailurePattern(
  failures: number,
  totalChecks: number,
  failureDates: string[]
): 'none' | 'intermittent' | 'consistent' {
  if (failures === 0) {
    return 'none';
  }

  const failureRate = failures / totalChecks;

  // Consistent: more than 50% failure rate
  if (failureRate > 0.5) {
    return 'consistent';
  }

  // Check for consecutive failures (consistent pattern)
  if (hasConsecutiveFailures(failureDates)) {
    return 'consistent';
  }

  return 'intermittent';
}

/**
 * Check if there are 3+ consecutive days of failures
 */
function hasConsecutiveFailures(failureDates: string[]): boolean {
  if (failureDates.length < 3) {
    return false;
  }

  // Sort dates
  const sorted = failureDates.sort();
  let consecutive = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);

    // Check if consecutive days
    const diffDays = Math.floor(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      consecutive++;
      if (consecutive >= 3) {
        return true;
      }
    } else {
      consecutive = 1;
    }
  }

  return false;
}

/**
 * Identify recurring issues across services
 */
function identifyRecurringIssues(
  serviceStats: Record<HealthCheckService, ServiceHealthStats>,
  serviceFailureDates: Record<HealthCheckService, string[]>
): RecurringIssue[] {
  const issues: RecurringIssue[] = [];

  for (const service of ALL_SERVICES) {
    const stats = serviceStats[service];
    const failureDates = serviceFailureDates[service];

    // Consider it a recurring issue if:
    // - More than 2 failures
    // - OR failure rate > 20%
    if (stats.failures > 2 || (stats.totalChecks > 0 && stats.failures / stats.totalChecks > 0.2)) {
      issues.push({
        service,
        frequency: stats.failures,
        lastOccurrence: stats.lastFailure || failureDates[failureDates.length - 1] || '',
        description: getIssueDescription(service, stats.failures, stats.failurePattern),
      });
    }
  }

  // Sort by frequency (most frequent first)
  return issues.sort((a, b) => b.frequency - a.frequency);
}

/**
 * Get human-readable description for a recurring issue
 */
function getIssueDescription(
  service: HealthCheckService,
  failures: number,
  pattern: 'none' | 'intermittent' | 'consistent'
): string {
  if (pattern === 'consistent') {
    return `${service} has consistent failures (${failures} times)`;
  }

  return `${service} has intermittent issues (${failures} failures)`;
}

/**
 * Get quick health status for dashboard
 *
 * Returns a simplified health status suitable for display.
 *
 * @param days - Number of days to analyze
 * @returns Simplified health status
 */
export async function getQuickHealthStatus(days: number = 7): Promise<{
  status: 'healthy' | 'degraded' | 'critical';
  overallHealth: number;
  criticalIssues: number;
  warnings: number;
}> {
  const history = await getHealthHistory(days);

  // Count critical issues (services with >50% failure rate)
  let criticalIssues = 0;
  let warnings = 0;

  for (const service of ALL_SERVICES) {
    const stats = history.services[service];
    if (stats) {
      if (stats.uptimePercentage < 50) {
        criticalIssues++;
      } else if (stats.uptimePercentage < 90) {
        warnings++;
      }
    }
  }

  let status: 'healthy' | 'degraded' | 'critical';
  if (criticalIssues > 0) {
    status = 'critical';
  } else if (warnings > 0 || history.overallHealth < 95) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  return {
    status,
    overallHealth: history.overallHealth,
    criticalIssues,
    warnings,
  };
}
