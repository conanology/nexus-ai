/**
 * YouTube API health check with quota monitoring
 *
 * Uses Google Cloud Monitoring API to fetch YouTube Data API quota usage.
 * YouTube API v3 does not provide a programmatic quota check endpoint,
 * so we must use Cloud Monitoring metrics.
 *
 * @module orchestrator/health/youtube-health
 */

import { createLogger } from '@nexus-ai/core';
import type { YouTubeQuotaCheck } from '@nexus-ai/core';
import {
  HEALTH_CHECK_TIMEOUT_MS,
  YOUTUBE_QUOTA_THRESHOLDS,
} from '@nexus-ai/core';

const logger = createLogger('orchestrator.health.youtube');

// Default YouTube Data API quota limit (10,000 units per day)
const DEFAULT_QUOTA_LIMIT = 10000;

/**
 * Check YouTube API health via Cloud Monitoring quota metrics
 *
 * @returns Health check result for YouTube service with quota metadata
 */
export async function checkYouTubeHealth(): Promise<YouTubeQuotaCheck> {
  const startTime = Date.now();

  try {
    logger.debug({}, 'Starting YouTube health check');

    const projectId = process.env.NEXUS_PROJECT_ID;
    if (!projectId) {
      throw new Error('NEXUS_PROJECT_ID environment variable not set');
    }

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), HEALTH_CHECK_TIMEOUT_MS);
    });

    const checkPromise = performYouTubeQuotaCheck(projectId);

    // Race between check and timeout
    const quotaResult = await Promise.race([checkPromise, timeoutPromise]);

    const latencyMs = Date.now() - startTime;

    logger.info({
      latencyMs,
      status: quotaResult.status,
      quotaUsed: quotaResult.quotaUsed,
      quotaLimit: quotaResult.quotaLimit,
      percentage: quotaResult.percentage.toFixed(1),
    }, 'YouTube health check completed');

    return {
      service: 'youtube',
      status: quotaResult.status,
      latencyMs,
      metadata: {
        quotaUsed: quotaResult.quotaUsed,
        quotaLimit: quotaResult.quotaLimit,
        percentage: quotaResult.percentage,
      },
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const isTimeout = errorMessage.includes('Timeout');

    logger.error({
      latencyMs,
      error: errorMessage,
      isTimeout,
    }, 'YouTube health check failed');

    return {
      service: 'youtube',
      status: 'failed',
      latencyMs,
      error: isTimeout ? `Timeout after ${HEALTH_CHECK_TIMEOUT_MS}ms` : errorMessage,
      metadata: {
        quotaUsed: 0,
        quotaLimit: DEFAULT_QUOTA_LIMIT,
        percentage: 0,
      },
    };
  }
}

/**
 * Perform the actual YouTube quota check via Cloud Monitoring
 */
async function performYouTubeQuotaCheck(projectId: string): Promise<{
  status: 'healthy' | 'degraded' | 'failed';
  quotaUsed: number;
  quotaLimit: number;
  percentage: number;
}> {
  // Dynamically import Cloud Monitoring SDK
  const { MetricServiceClient } = await import('@google-cloud/monitoring');
  const client = new MetricServiceClient();

  // Query Cloud Monitoring for YouTube API quota usage
  const now = Date.now();
  const oneDayAgo = now - 86400000; // 24 hours in milliseconds

  const request = {
    name: `projects/${projectId}`,
    filter: 'metric.type="serviceruntime.googleapis.com/quota/allocation/usage" AND resource.labels.service="youtube.googleapis.com"',
    interval: {
      endTime: { seconds: Math.floor(now / 1000) },
      startTime: { seconds: Math.floor(oneDayAgo / 1000) },
    },
    aggregation: {
      alignmentPeriod: { seconds: 86400 }, // 1 day
      perSeriesAligner: 'ALIGN_MAX' as const,
    },
  };

  const response = await client.listTimeSeries(request);
  const timeSeries = response[0] as Array<{
    points?: Array<{
      value?: {
        int64Value?: string | number;
        doubleValue?: number;
      };
    }>;
  }>;

  // Extract quota usage from response
  let quotaUsed = 0;
  if (timeSeries && timeSeries.length > 0) {
    const points = timeSeries[0]?.points;
    if (points && points.length > 0) {
      const value = points[0]?.value;
      if (value?.int64Value) {
        quotaUsed = Number(value.int64Value);
      } else if (value?.doubleValue) {
        quotaUsed = Math.floor(value.doubleValue);
      }
    }
  }

  const quotaLimit = DEFAULT_QUOTA_LIMIT;
  const percentage = (quotaUsed / quotaLimit) * 100;

  // Determine status based on thresholds (per AC5)
  let status: 'healthy' | 'degraded' | 'failed';
  if (percentage >= YOUTUBE_QUOTA_THRESHOLDS.CRITICAL) {
    status = 'failed';
  } else if (percentage >= YOUTUBE_QUOTA_THRESHOLDS.HEALTHY) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  return { status, quotaUsed, quotaLimit, percentage };
}

/**
 * Determine if a quota alert should be sent based on percentage
 *
 * @param percentage - Current quota usage percentage
 * @returns Alert configuration or null if no alert needed
 */
export function getQuotaAlertLevel(percentage: number): {
  severity: 'WARNING' | 'CRITICAL';
  message: string;
} | null {
  if (percentage >= YOUTUBE_QUOTA_THRESHOLDS.CRITICAL) {
    return {
      severity: 'CRITICAL',
      message: `YouTube API quota at ${percentage.toFixed(1)}% - Pipeline will be skipped`,
    };
  } else if (percentage >= YOUTUBE_QUOTA_THRESHOLDS.WARNING) {
    return {
      severity: 'WARNING',
      message: `YouTube API quota at ${percentage.toFixed(1)}% - Approaching limit`,
    };
  }
  return null;
}
