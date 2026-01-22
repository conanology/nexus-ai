/**
 * Digest generation for daily summary emails
 *
 * Collects and formats pipeline results, health status, and alerts
 * into a comprehensive daily digest.
 *
 * @module notifications/digest
 */

import { createLogger } from '@nexus-ai/core';
import type {
  DigestAlert,
  DigestData,
  DigestHealthData,
  DigestPerformanceData,
  DigestPipelineData,
  DigestStageStatus,
  DigestTomorrowData,
  DigestVideoData,
  PipelineResultData,
} from './types.js';

const logger = createLogger('notifications.digest');

/**
 * Generate a complete digest from pipeline result data
 *
 * @param pipelineResult - Pipeline execution result
 * @param additionalData - Optional additional data (health, performance, etc.)
 * @returns Complete digest data
 */
export async function generateDigest(
  pipelineResult: PipelineResultData,
  additionalData?: {
    health?: Partial<DigestHealthData>;
    performance?: DigestPerformanceData;
    tomorrow?: DigestTomorrowData;
    alerts?: DigestAlert[];
  }
): Promise<DigestData> {
  logger.info(
    { status: pipelineResult.status },
    'Generating daily digest'
  );

  // Collect video data
  const video = collectVideoData(pipelineResult);

  // Collect pipeline data
  const pipeline = collectPipelineData(pipelineResult);

  // Collect health data with defaults
  const health = collectHealthData(additionalData?.health);

  // Collect alerts from pipeline warnings and quality context
  const alerts = collectAlerts(pipelineResult, additionalData?.alerts);

  const digest: DigestData = {
    video,
    pipeline,
    health,
    alerts,
  };

  // Add optional performance data
  if (additionalData?.performance) {
    digest.performance = additionalData.performance;
  }

  // Add optional tomorrow data
  if (additionalData?.tomorrow) {
    digest.tomorrow = additionalData.tomorrow;
  }

  logger.info(
    {
      hasVideo: !!video,
      alertCount: alerts.length,
      status: pipeline.status,
    },
    'Digest generated successfully'
  );

  return digest;
}

/**
 * Collect digest data from various sources (Firestore, etc.)
 *
 * This function fetches additional context like buffer counts,
 * budget status, and performance metrics.
 *
 * @param pipelineId - Pipeline ID to fetch data for
 * @param pipelineResult - Pipeline execution result
 * @param additionalContext - Optional pre-fetched context data (health, performance, tomorrow)
 * @returns Complete digest data with all available context
 */
export async function collectDigestData(
  pipelineId: string,
  pipelineResult: PipelineResultData,
  additionalContext?: {
    health?: Partial<DigestHealthData>;
    performance?: DigestPerformanceData;
    tomorrow?: DigestTomorrowData;
  }
): Promise<DigestData> {
  logger.info({ pipelineId }, 'Collecting digest data from all sources');

  // Base digest from pipeline result, passing through any additional context
  const baseDigest = await generateDigest(pipelineResult, {
    health: additionalContext?.health,
    performance: additionalContext?.performance,
    tomorrow: additionalContext?.tomorrow,
  });

  // If no health data was provided, use defaults with clear "unknown" indicators
  // Future Story: Implement Firestore queries for real data
  // - Buffer video count from buffer-videos collection
  // - Budget status from cost tracking
  // - Performance metrics from youtube analytics (if available)
  // - Tomorrow's queued topic from topics collection
  if (!additionalContext?.health) {
    logger.warn(
      { pipelineId },
      'No health context provided, using default values - implement Firestore fetch in future story'
    );
  }

  return baseDigest;
}

/**
 * Collect video data from pipeline result
 *
 * @param result - Pipeline result
 * @returns Video data or null if no video
 */
function collectVideoData(result: PipelineResultData): DigestVideoData | null {
  if (
    result.status === 'failed' ||
    result.status === 'skipped' ||
    !result.videoTitle
  ) {
    return null;
  }

  return {
    title: result.videoTitle,
    url: result.videoUrl || 'URL not available',
    topic: result.topic || 'Unknown topic',
    source: result.source || 'Unknown source',
    thumbnailVariant: result.thumbnailVariant || 1,
  };
}

/**
 * Collect pipeline status data
 *
 * @param result - Pipeline result
 * @returns Pipeline data for digest
 */
function collectPipelineData(result: PipelineResultData): DigestPipelineData {
  const stages: DigestStageStatus[] = result.stages.map((stage) => ({
    name: stage.name,
    status: stage.status,
    provider: stage.provider,
    tier: stage.tier,
  }));

  return {
    pipelineId: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    status: result.status,
    duration: formatDuration(result.durationMs),
    cost: formatCost(result.totalCost),
    stages,
  };
}

/**
 * Collect health data with defaults
 *
 * Uses provided values or sensible defaults that indicate data is unavailable.
 * Future implementation should fetch real data from Firestore.
 *
 * @param health - Partial health data
 * @returns Complete health data
 */
function collectHealthData(health?: Partial<DigestHealthData>): DigestHealthData {
  return {
    buffersRemaining: health?.buffersRemaining ?? -1, // -1 indicates unknown
    budgetRemaining: health?.budgetRemaining ?? 'Unknown',
    daysOfRunway: health?.daysOfRunway ?? -1, // -1 indicates unknown
    creditExpiration: health?.creditExpiration,
  };
}

/**
 * Collect alerts from pipeline result and quality context
 *
 * @param result - Pipeline result
 * @param additionalAlerts - Additional alerts to include
 * @returns Array of digest alerts
 */
function collectAlerts(
  result: PipelineResultData,
  additionalAlerts?: DigestAlert[]
): DigestAlert[] {
  const alerts: DigestAlert[] = [];
  const timestamp = new Date().toISOString();

  // Add pipeline failure alerts
  if (result.status === 'failed') {
    alerts.push({
      type: 'critical',
      message: 'Pipeline execution failed',
      timestamp,
    });
  }

  // Add degraded status alerts
  if (result.status === 'degraded') {
    alerts.push({
      type: 'warning',
      message: 'Pipeline completed with degraded quality',
      timestamp,
    });
  }

  // Add quality context alerts
  if (result.qualityContext) {
    // Degraded stages
    if (result.qualityContext.degradedStages.length > 0) {
      alerts.push({
        type: 'warning',
        message: `Degraded stages: ${result.qualityContext.degradedStages.join(', ')}`,
        timestamp,
      });
    }

    // Fallbacks used
    if (result.qualityContext.fallbacksUsed.length > 0) {
      alerts.push({
        type: 'info',
        message: `Fallback providers used: ${result.qualityContext.fallbacksUsed.join(', ')}`,
        timestamp,
      });
    }

    // Quality flags
    for (const flag of result.qualityContext.flags) {
      alerts.push({
        type: 'warning',
        message: `Quality flag: ${flag}`,
        timestamp,
      });
    }
  }

  // Add pipeline warnings
  if (result.warnings) {
    for (const warning of result.warnings) {
      alerts.push({
        type: 'warning',
        message: warning,
        timestamp,
      });
    }
  }

  // Add any additional alerts
  if (additionalAlerts) {
    alerts.push(...additionalAlerts);
  }

  return alerts;
}

/**
 * Format digest as HTML email content
 *
 * @param digest - Digest data
 * @returns HTML string for email body
 */
export function formatDigestEmail(digest: DigestData): string {
  const date = new Date().toISOString().split('T')[0];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .section { margin-bottom: 24px; }
    .section-title { color: #333; font-size: 18px; font-weight: bold; border-bottom: 2px solid #2ECC71; padding-bottom: 8px; }
    .status-success { color: #2ECC71; }
    .status-failed { color: #E74C3C; }
    .status-degraded { color: #F39C12; }
    .status-skipped { color: #95A5A6; }
    .alert { padding: 8px 12px; margin: 4px 0; border-radius: 4px; }
    .alert-critical { background: #FADBD8; border-left: 4px solid #E74C3C; }
    .alert-warning { background: #FCF3CF; border-left: 4px solid #F39C12; }
    .alert-info { background: #D4E6F1; border-left: 4px solid #3498DB; }
  </style>
</head>
<body>
  <h1>NEXUS-AI Daily Digest - ${date}</h1>

  <div class="section">
    <h2 class="section-title">Today's Video</h2>
    ${formatVideoSection(digest.video)}
  </div>

  <div class="section">
    <h2 class="section-title">Pipeline Status</h2>
    ${formatPipelineSection(digest.pipeline)}
  </div>

  ${digest.performance ? formatPerformanceSection(digest.performance) : ''}

  <div class="section">
    <h2 class="section-title">System Health</h2>
    ${formatHealthSection(digest.health)}
  </div>

  ${digest.alerts.length > 0 ? formatAlertsSection(digest.alerts) : ''}

  ${digest.tomorrow ? formatTomorrowSection(digest.tomorrow) : ''}
</body>
</html>`;
}

/**
 * Format digest as plain text
 *
 * @param digest - Digest data
 * @returns Plain text string
 */
export function formatDigestPlainText(digest: DigestData): string {
  const lines: string[] = [];
  const date = new Date().toISOString().split('T')[0];

  lines.push(`NEXUS-AI Daily Digest - ${date}`);
  lines.push('='.repeat(50));
  lines.push('');

  // Video
  lines.push('TODAY\'S VIDEO');
  lines.push('-'.repeat(30));
  if (digest.video) {
    lines.push(`Title: ${digest.video.title}`);
    lines.push(`URL: ${digest.video.url}`);
    lines.push(`Topic: ${digest.video.topic} | Source: ${digest.video.source}`);
  } else {
    lines.push('No video published today.');
  }
  lines.push('');

  // Pipeline
  lines.push('PIPELINE STATUS');
  lines.push('-'.repeat(30));
  lines.push(`Status: ${digest.pipeline.status.toUpperCase()}`);
  lines.push(`Duration: ${digest.pipeline.duration} | Cost: ${digest.pipeline.cost}`);
  lines.push('');

  // Performance
  if (digest.performance) {
    lines.push('PERFORMANCE');
    lines.push('-'.repeat(30));
    if (digest.performance.day1Views !== undefined) {
      lines.push(`Day 1 Views: ${digest.performance.day1Views}`);
    }
    if (digest.performance.ctr !== undefined) {
      lines.push(`CTR: ${(digest.performance.ctr * 100).toFixed(1)}%`);
    }
    lines.push('');
  }

  // Health
  lines.push('SYSTEM HEALTH');
  lines.push('-'.repeat(30));
  lines.push(`Buffers: ${digest.health.buffersRemaining} | Budget: ${digest.health.budgetRemaining}`);
  lines.push(`Runway: ${digest.health.daysOfRunway} days`);
  lines.push('');

  // Alerts
  if (digest.alerts.length > 0) {
    lines.push('ALERTS');
    lines.push('-'.repeat(30));
    for (const alert of digest.alerts) {
      lines.push(`[${alert.type.toUpperCase()}] ${alert.message}`);
    }
    lines.push('');
  }

  // Tomorrow
  if (digest.tomorrow) {
    lines.push('TOMORROW');
    lines.push('-'.repeat(30));
    if (digest.tomorrow.queuedTopic) {
      lines.push(`Topic: ${digest.tomorrow.queuedTopic}`);
    }
    lines.push(`Publish: ${digest.tomorrow.expectedPublishTime}`);
  }

  return lines.join('\n');
}

/**
 * Format video section HTML
 */
function formatVideoSection(video: DigestVideoData | null): string {
  if (!video) {
    return '<p>No video published today.</p>';
  }

  return `
    <p><strong>${escapeHtml(video.title)}</strong></p>
    <p><a href="${escapeHtml(video.url)}">Watch on YouTube</a></p>
    <p>Topic: ${escapeHtml(video.topic)} | Source: ${escapeHtml(video.source)}</p>
  `;
}

/**
 * Format pipeline section HTML
 */
function formatPipelineSection(pipeline: DigestPipelineData): string {
  return `
    <p>Status: <span class="status-${pipeline.status}">${pipeline.status.toUpperCase()}</span></p>
    <p>Duration: ${escapeHtml(pipeline.duration)} | Cost: ${escapeHtml(pipeline.cost)}</p>
  `;
}

/**
 * Format performance section HTML
 */
function formatPerformanceSection(performance: DigestPerformanceData): string {
  const parts: string[] = [];

  if (performance.day1Views !== undefined) {
    parts.push(`Day 1 Views: ${performance.day1Views.toLocaleString()}`);
  }
  if (performance.ctr !== undefined) {
    parts.push(`CTR: ${(performance.ctr * 100).toFixed(1)}%`);
  }
  if (performance.avgViewDuration) {
    parts.push(`Avg Duration: ${performance.avgViewDuration}`);
  }

  return `
    <div class="section">
      <h2 class="section-title">Performance</h2>
      <p>${parts.join(' | ')}</p>
    </div>
  `;
}

/**
 * Format health section HTML
 */
function formatHealthSection(health: DigestHealthData): string {
  let html = `
    <p>Buffer Videos: ${health.buffersRemaining}</p>
    <p>Budget Remaining: ${escapeHtml(health.budgetRemaining)} (${health.daysOfRunway} days)</p>
  `;

  if (health.creditExpiration) {
    html += `<p>Credit Expires: ${escapeHtml(health.creditExpiration)}</p>`;
  }

  return html;
}

/**
 * Format alerts section HTML
 */
function formatAlertsSection(alerts: DigestAlert[]): string {
  const alertHtml = alerts
    .map(
      (alert) =>
        `<div class="alert alert-${alert.type}">${escapeHtml(alert.message)}</div>`
    )
    .join('\n');

  return `
    <div class="section">
      <h2 class="section-title">Alerts</h2>
      ${alertHtml}
    </div>
  `;
}

/**
 * Format tomorrow section HTML
 */
function formatTomorrowSection(tomorrow: DigestTomorrowData): string {
  let html = '<div class="section"><h2 class="section-title">Tomorrow</h2>';

  if (tomorrow.queuedTopic) {
    html += `<p>Queued Topic: <strong>${escapeHtml(tomorrow.queuedTopic)}</strong></p>`;
  }

  html += `<p>Expected Publish: ${escapeHtml(tomorrow.expectedPublishTime)}</p></div>`;

  return html;
}

/**
 * Format duration in human-readable form
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string
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
 * @returns Formatted string
 */
function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/**
 * Escape HTML special characters
 *
 * @param str - String to escape
 * @returns Escaped string
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
