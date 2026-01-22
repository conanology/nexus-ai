/**
 * Notification metrics and logging
 *
 * Tracks notification delivery metrics and stores results in Firestore.
 *
 * @module notifications/metrics
 */

import { createLogger } from '@nexus-ai/core';
import { FirestoreClient } from '@nexus-ai/core/storage';
import type {
  NotificationChannelResult,
  NotificationLog,
  NotificationMetrics,
} from './types.js';

const logger = createLogger('notifications.metrics');

// Firestore client for notification storage (lazy initialized)
let firestoreClient: FirestoreClient | null = null;

function getFirestoreClient(): FirestoreClient {
  if (!firestoreClient) {
    firestoreClient = new FirestoreClient();
  }
  return firestoreClient;
}

/**
 * In-memory metrics aggregation
 */
interface MetricsAggregation {
  discord: {
    sent: number;
    failed: number;
    totalLatencyMs: number;
    count: number;
  };
  email: {
    sent: number;
    failed: number;
    totalLatencyMs: number;
    count: number;
  };
}

let metricsAggregation: MetricsAggregation = {
  discord: { sent: 0, failed: 0, totalLatencyMs: 0, count: 0 },
  email: { sent: 0, failed: 0, totalLatencyMs: 0, count: 0 },
};

/**
 * Track notification metrics
 *
 * @param pipelineId - Pipeline ID
 * @param metrics - Array of notification metrics
 */
export function trackNotificationMetrics(
  pipelineId: string,
  metrics: NotificationMetrics[]
): void {
  for (const metric of metrics) {
    const channelMetrics = metricsAggregation[metric.channel];

    if (metric.sent) {
      channelMetrics.sent++;
    } else {
      channelMetrics.failed++;
    }

    channelMetrics.totalLatencyMs += metric.latencyMs;
    channelMetrics.count++;
  }

  logger.debug(
    { pipelineId, metricsCount: metrics.length },
    'Notification metrics tracked'
  );
}

/**
 * Log notification results to Firestore
 *
 * Stores notification outcome for debugging and audit trail.
 *
 * @param pipelineId - Pipeline ID
 * @param discord - Discord notification result
 * @param email - Email notification result
 */
export async function logNotificationResults(
  pipelineId: string,
  discord: NotificationChannelResult,
  email: NotificationChannelResult
): Promise<void> {
  try {
    const client = getFirestoreClient();
    const timestamp = new Date().toISOString();

    const notificationLog: NotificationLog = {
      pipelineId,
      timestamp,
      discord,
      email,
      metrics: [
        {
          channel: 'discord',
          sent: discord.sent,
          latencyMs: 0, // Actual latency tracked separately
          attempts: 1,
          timestamp,
        },
        {
          channel: 'email',
          sent: email.sent,
          latencyMs: 0,
          attempts: 1,
          timestamp,
        },
      ],
    };

    await client.setDocument('notifications', pipelineId, notificationLog);

    logger.info(
      { pipelineId, discordSent: discord.sent, emailSent: email.sent },
      'Notification results logged to Firestore'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { pipelineId, error: errorMessage },
      'Failed to log notification results to Firestore'
    );
    // Don't throw - logging failures should not break the pipeline
  }
}

/**
 * Get notification history for a pipeline
 *
 * Retrieves notification log from Firestore for debugging.
 *
 * @param pipelineId - Pipeline ID
 * @returns Notification log or null if not found
 */
export async function getNotificationHistory(
  pipelineId: string
): Promise<NotificationLog | null> {
  try {
    const client = getFirestoreClient();
    const doc = await client.getDocument<NotificationLog>('notifications', pipelineId);

    if (!doc) {
      logger.debug({ pipelineId }, 'No notification history found');
      return null;
    }

    return doc;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { pipelineId, error: errorMessage },
      'Failed to retrieve notification history'
    );
    return null;
  }
}

/**
 * Get aggregated metrics for all notification channels
 *
 * @returns Current metrics aggregation
 */
export function getAggregatedMetrics(): {
  discord: {
    sent: number;
    failed: number;
    avgLatencyMs: number;
  };
  email: {
    sent: number;
    failed: number;
    avgLatencyMs: number;
  };
} {
  return {
    discord: {
      sent: metricsAggregation.discord.sent,
      failed: metricsAggregation.discord.failed,
      avgLatencyMs:
        metricsAggregation.discord.count > 0
          ? metricsAggregation.discord.totalLatencyMs /
            metricsAggregation.discord.count
          : 0,
    },
    email: {
      sent: metricsAggregation.email.sent,
      failed: metricsAggregation.email.failed,
      avgLatencyMs:
        metricsAggregation.email.count > 0
          ? metricsAggregation.email.totalLatencyMs /
            metricsAggregation.email.count
          : 0,
    },
  };
}

/**
 * Reset metrics aggregation (for testing)
 */
export function resetMetricsAggregation(): void {
  metricsAggregation = {
    discord: { sent: 0, failed: 0, totalLatencyMs: 0, count: 0 },
    email: { sent: 0, failed: 0, totalLatencyMs: 0, count: 0 },
  };
}

/**
 * Reset Firestore client (for testing)
 */
export function resetFirestoreClient(): void {
  firestoreClient = null;
}
