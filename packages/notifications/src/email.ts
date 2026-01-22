/**
 * SendGrid email implementation
 *
 * Provides email sending capabilities for daily digests and critical alerts.
 * Implements retry logic with exponential backoff.
 *
 * @module notifications/email
 */

import sgMail from '@sendgrid/mail';
import { createLogger, getSecret } from '@nexus-ai/core';
import type {
  AlertEmailConfig,
  AlertSeverity,
  DigestData,
  EmailMessage,
} from './types.js';
import { DEFAULT_RETRY_CONFIG } from './types.js';

const logger = createLogger('notifications.email');

/**
 * Cached SendGrid configuration
 */
let sendGridInitialized = false;

/**
 * Initialize SendGrid with API key from Secret Manager
 */
async function initializeSendGrid(): Promise<void> {
  if (sendGridInitialized) {
    return;
  }

  try {
    const apiKey = await getSecret('nexus-sendgrid-api-key');
    sgMail.setApiKey(apiKey);
    sendGridInitialized = true;
    logger.info('SendGrid initialized successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, 'Failed to initialize SendGrid');
    throw error;
  }
}

/**
 * Sleep utility
 *
 * @param ms - Milliseconds to sleep
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send email with retry and exponential backoff
 *
 * @param msg - Email message to send
 * @returns Send result
 */
async function sendWithRetry(
  msg: EmailMessage
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { maxAttempts, baseDelayMs, maxDelayMs } = DEFAULT_RETRY_CONFIG.email;

  await initializeSendGrid();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const [response] = await sgMail.send({
        to: msg.to,
        from: { email: msg.from, name: 'NEXUS-AI' },
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });

      if (response.statusCode >= 200 && response.statusCode < 300) {
        logger.info(
          { attempt: attempt + 1, statusCode: response.statusCode },
          'Email sent successfully'
        );
        return {
          success: true,
          messageId: response.headers['x-message-id'] as string | undefined,
        };
      }

      // Non-success status code
      throw new Error(`SendGrid error: ${response.statusCode}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (attempt === maxAttempts - 1) {
        logger.error(
          { attempt: attempt + 1, error: errorMessage },
          'Email send failed after all retries'
        );
        return { success: false, error: errorMessage };
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt),
        maxDelayMs ?? 8000
      );
      logger.warn(
        { attempt: attempt + 1, delay, error: errorMessage },
        'Email send failed, retrying'
      );
      await sleep(delay);
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Get operator email from Secret Manager
 *
 * @returns Operator email address
 */
async function getOperatorEmail(): Promise<string> {
  return await getSecret('nexus-operator-email');
}

/**
 * Cached sender email to avoid repeated Secret Manager lookups
 */
let cachedSenderEmail: string | null = null;

/**
 * Get sender email from Secret Manager (with fallback)
 *
 * Uses Secret Manager per project context rules. Falls back to default
 * if secret is not configured (for local development).
 *
 * @returns Sender email address
 */
async function getSenderEmail(): Promise<string> {
  if (cachedSenderEmail) {
    return cachedSenderEmail;
  }

  try {
    cachedSenderEmail = await getSecret('nexus-sender-email');
    return cachedSenderEmail;
  } catch {
    // Fallback for local development or if secret not configured
    logger.warn(
      'nexus-sender-email secret not found, using default sender'
    );
    cachedSenderEmail = 'notifications@nexus-ai.app';
    return cachedSenderEmail;
  }
}

/**
 * Send an email
 *
 * @param msg - Email message
 * @returns Send result
 */
export async function sendEmail(
  msg: EmailMessage
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  logger.info(
    { to: msg.to, subject: msg.subject },
    'Sending email'
  );

  return await sendWithRetry(msg);
}

/**
 * Send daily digest email
 *
 * @param pipelineId - Pipeline ID
 * @param digest - Digest data
 * @returns Send result
 */
export async function sendDigestEmail(
  pipelineId: string,
  digest: DigestData
): Promise<string | undefined> {
  try {
    const operatorEmail = await getOperatorEmail();
    const date = new Date().toISOString().split('T')[0];

    const statusEmoji = getStatusEmoji(digest.pipeline.status);
    const subject = `${statusEmoji} NEXUS-AI Daily Digest - ${date}`;

    const senderEmail = await getSenderEmail();
    const msg: EmailMessage = {
      to: operatorEmail,
      from: senderEmail,
      subject,
      text: formatDigestPlainText(digest),
      html: formatDigestHtml(digest),
    };

    logger.info({ pipelineId, to: operatorEmail }, 'Sending daily digest email');

    const result = await sendWithRetry(msg);

    if (result.success) {
      return result.messageId;
    }

    logger.error(
      { pipelineId, error: result.error },
      'Failed to send digest email'
    );
    return undefined;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { pipelineId, error: errorMessage },
      'Failed to send digest email'
    );
    return undefined;
  }
}

/**
 * Send alert email for critical issues
 *
 * @param config - Alert email configuration
 * @returns Send result
 */
export async function sendAlertEmail(
  config: AlertEmailConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const operatorEmail = await getOperatorEmail();
    const senderEmail = await getSenderEmail();

    const msg: EmailMessage = {
      to: operatorEmail,
      from: senderEmail,
      subject: config.subject,
      text: config.body,
      html: formatAlertHtml(config),
    };

    logger.info(
      { severity: config.severity, subject: config.subject },
      'Sending alert email'
    );

    return await sendWithRetry(msg);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, 'Failed to send alert email');
    return { success: false, error: errorMessage };
  }
}

/**
 * Get status emoji for email subject
 *
 * @param status - Pipeline status
 * @returns Emoji character
 */
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'success':
      return '\u2705'; // Green check
    case 'degraded':
      return '\u26A0\uFE0F'; // Warning
    case 'failed':
      return '\u274C'; // Red X
    case 'skipped':
      return '\u23ED\uFE0F'; // Skip
    default:
      return '\u2139\uFE0F'; // Info
  }
}

/**
 * Format digest data as plain text email
 *
 * @param digest - Digest data
 * @returns Plain text email body
 */
function formatDigestPlainText(digest: DigestData): string {
  const lines: string[] = [];
  const date = new Date().toISOString().split('T')[0];

  lines.push(`NEXUS-AI Daily Digest - ${date}`);
  lines.push('='.repeat(50));
  lines.push('');

  // Video Section
  lines.push('TODAY\'S VIDEO');
  lines.push('-'.repeat(30));
  if (digest.video) {
    lines.push(`Title: ${digest.video.title}`);
    lines.push(`URL: ${digest.video.url}`);
    lines.push(`Topic: ${digest.video.topic}`);
    lines.push(`Source: ${digest.video.source}`);
  } else {
    lines.push('No video published today.');
  }
  lines.push('');

  // Pipeline Section
  lines.push('PIPELINE STATUS');
  lines.push('-'.repeat(30));
  lines.push(`Status: ${digest.pipeline.status.toUpperCase()}`);
  lines.push(`Duration: ${digest.pipeline.duration}`);
  lines.push(`Cost: ${digest.pipeline.cost}`);
  lines.push(`Pipeline ID: ${digest.pipeline.pipelineId}`);
  lines.push('');

  // Performance Section (if available)
  if (digest.performance) {
    lines.push('PERFORMANCE');
    lines.push('-'.repeat(30));
    if (digest.performance.day1Views !== undefined) {
      lines.push(`Day 1 Views: ${digest.performance.day1Views}`);
    }
    if (digest.performance.ctr !== undefined) {
      lines.push(`CTR: ${(digest.performance.ctr * 100).toFixed(1)}%`);
    }
    if (digest.performance.avgViewDuration) {
      lines.push(`Avg View Duration: ${digest.performance.avgViewDuration}`);
    }
    lines.push('');
  }

  // Health Section
  lines.push('SYSTEM HEALTH');
  lines.push('-'.repeat(30));
  lines.push(`Buffer Videos: ${digest.health.buffersRemaining}`);
  lines.push(`Budget Remaining: ${digest.health.budgetRemaining}`);
  lines.push(`Days of Runway: ${digest.health.daysOfRunway}`);
  if (digest.health.creditExpiration) {
    lines.push(`Credit Expires: ${digest.health.creditExpiration}`);
  }
  lines.push('');

  // Alerts Section
  if (digest.alerts.length > 0) {
    lines.push('ALERTS');
    lines.push('-'.repeat(30));
    for (const alert of digest.alerts) {
      lines.push(`[${alert.type.toUpperCase()}] ${alert.message}`);
    }
    lines.push('');
  }

  // Tomorrow Section
  if (digest.tomorrow) {
    lines.push('TOMORROW');
    lines.push('-'.repeat(30));
    if (digest.tomorrow.queuedTopic) {
      lines.push(`Queued Topic: ${digest.tomorrow.queuedTopic}`);
    }
    lines.push(`Expected Publish: ${digest.tomorrow.expectedPublishTime}`);
    lines.push('');
  }

  lines.push('='.repeat(50));
  lines.push('This email was sent by NEXUS-AI');

  return lines.join('\n');
}

/**
 * Format digest data as HTML email
 *
 * @param digest - Digest data
 * @returns HTML email body
 */
function formatDigestHtml(digest: DigestData): string {
  const date = new Date().toISOString().split('T')[0];

  const statusColor = getStatusColor(digest.pipeline.status);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #2C3E50; border-bottom: 3px solid #3498DB; padding-bottom: 10px; }
    h2 { color: #2C3E50; font-size: 18px; margin-top: 24px; border-bottom: 2px solid #ECF0F1; padding-bottom: 8px; }
    .section { margin-bottom: 24px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; color: white; font-weight: bold; }
    .status-success { background-color: #2ECC71; }
    .status-failed { background-color: #E74C3C; }
    .status-degraded { background-color: #F39C12; }
    .status-skipped { background-color: #95A5A6; }
    .alert { padding: 12px; margin: 8px 0; border-radius: 4px; }
    .alert-critical { background-color: #FADBD8; border-left: 4px solid #E74C3C; }
    .alert-warning { background-color: #FCF3CF; border-left: 4px solid #F39C12; }
    .alert-info { background-color: #D4E6F1; border-left: 4px solid #3498DB; }
    .metric { display: inline-block; margin-right: 20px; }
    .metric-label { color: #7F8C8D; font-size: 12px; text-transform: uppercase; }
    .metric-value { font-size: 18px; font-weight: bold; color: #2C3E50; }
    .video-link { color: #3498DB; text-decoration: none; }
    .video-link:hover { text-decoration: underline; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ECF0F1; color: #95A5A6; font-size: 12px; }
  </style>
</head>
<body>
  <h1>NEXUS-AI Daily Digest</h1>
  <p style="color: #7F8C8D;">${date}</p>

  <div class="section">
    <h2>Today's Video</h2>
    ${
      digest.video
        ? `
    <p><strong>${escapeHtml(digest.video.title)}</strong></p>
    <p><a href="${escapeHtml(digest.video.url)}" class="video-link">Watch on YouTube</a></p>
    <p>Topic: ${escapeHtml(digest.video.topic)} | Source: ${escapeHtml(digest.video.source)}</p>
    `
        : '<p>No video published today.</p>'
    }
  </div>

  <div class="section">
    <h2>Pipeline Status</h2>
    <p>Status: <span class="status status-${digest.pipeline.status}" style="background-color: ${statusColor};">${digest.pipeline.status.toUpperCase()}</span></p>
    <div style="margin-top: 16px;">
      <div class="metric">
        <div class="metric-label">Duration</div>
        <div class="metric-value">${escapeHtml(digest.pipeline.duration)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Cost</div>
        <div class="metric-value">${escapeHtml(digest.pipeline.cost)}</div>
      </div>
    </div>
  </div>

  ${
    digest.performance
      ? `
  <div class="section">
    <h2>Performance</h2>
    <div>
      ${digest.performance.day1Views !== undefined ? `<div class="metric"><div class="metric-label">Day 1 Views</div><div class="metric-value">${digest.performance.day1Views.toLocaleString()}</div></div>` : ''}
      ${digest.performance.ctr !== undefined ? `<div class="metric"><div class="metric-label">CTR</div><div class="metric-value">${(digest.performance.ctr * 100).toFixed(1)}%</div></div>` : ''}
      ${digest.performance.avgViewDuration ? `<div class="metric"><div class="metric-label">Avg Duration</div><div class="metric-value">${escapeHtml(digest.performance.avgViewDuration)}</div></div>` : ''}
    </div>
  </div>
  `
      : ''
  }

  <div class="section">
    <h2>System Health</h2>
    <div>
      <div class="metric">
        <div class="metric-label">Buffer Videos</div>
        <div class="metric-value">${digest.health.buffersRemaining}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Budget Remaining</div>
        <div class="metric-value">${escapeHtml(digest.health.budgetRemaining)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Days of Runway</div>
        <div class="metric-value">${digest.health.daysOfRunway}</div>
      </div>
    </div>
    ${digest.health.creditExpiration ? `<p style="margin-top: 8px; color: #7F8C8D;">Credit expires: ${escapeHtml(digest.health.creditExpiration)}</p>` : ''}
  </div>

  ${
    digest.alerts.length > 0
      ? `
  <div class="section">
    <h2>Alerts</h2>
    ${digest.alerts.map((alert) => `<div class="alert alert-${alert.type}">${escapeHtml(alert.message)}</div>`).join('\n')}
  </div>
  `
      : ''
  }

  ${
    digest.tomorrow
      ? `
  <div class="section">
    <h2>Tomorrow</h2>
    ${digest.tomorrow.queuedTopic ? `<p>Queued topic: <strong>${escapeHtml(digest.tomorrow.queuedTopic)}</strong></p>` : ''}
    <p>Expected publish time: ${escapeHtml(digest.tomorrow.expectedPublishTime)}</p>
  </div>
  `
      : ''
  }

  <div class="footer">
    <p>This email was sent by NEXUS-AI. Pipeline ID: ${escapeHtml(digest.pipeline.pipelineId)}</p>
  </div>
</body>
</html>`;
}

/**
 * Format alert as HTML email
 *
 * @param config - Alert configuration
 * @returns HTML email body
 */
function formatAlertHtml(config: AlertEmailConfig): string {
  const severityColor = getSeverityColor(config.severity);
  const severityBg = getSeverityBgColor(config.severity);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert-header { background-color: ${severityBg}; border-left: 4px solid ${severityColor}; padding: 16px; margin-bottom: 20px; }
    .alert-severity { color: ${severityColor}; font-weight: bold; text-transform: uppercase; font-size: 12px; }
    .alert-body { white-space: pre-wrap; font-family: monospace; background-color: #F8F9FA; padding: 16px; border-radius: 4px; }
    .footer { margin-top: 40px; color: #95A5A6; font-size: 12px; }
  </style>
</head>
<body>
  <div class="alert-header">
    <div class="alert-severity">${config.severity} ALERT</div>
    <h2 style="margin: 8px 0 0 0;">${escapeHtml(config.subject)}</h2>
  </div>

  <div class="alert-body">${escapeHtml(config.body)}</div>

  <div class="footer">
    <p>This is an automated alert from NEXUS-AI.</p>
    <p>Time: ${new Date().toISOString()}</p>
  </div>
</body>
</html>`;
}

/**
 * Get status color for pipeline status
 *
 * @param status - Pipeline status
 * @returns CSS color value
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'success':
      return '#2ECC71';
    case 'degraded':
      return '#F39C12';
    case 'failed':
      return '#E74C3C';
    case 'skipped':
      return '#95A5A6';
    default:
      return '#3498DB';
  }
}

/**
 * Get severity border color
 *
 * @param severity - Alert severity
 * @returns CSS color value
 */
function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return '#E74C3C';
    case 'WARNING':
      return '#F39C12';
    case 'SUCCESS':
      return '#2ECC71';
    case 'INFO':
    default:
      return '#3498DB';
  }
}

/**
 * Get severity background color
 *
 * @param severity - Alert severity
 * @returns CSS color value
 */
function getSeverityBgColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return '#FADBD8';
    case 'WARNING':
      return '#FCF3CF';
    case 'SUCCESS':
      return '#D5F5E3';
    case 'INFO':
    default:
      return '#D4E6F1';
  }
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

/**
 * Reset SendGrid initialization state (for testing)
 */
export function resetSendGridState(): void {
  sendGridInitialized = false;
}

/**
 * Reset sender email cache (for testing)
 */
export function resetSenderEmailCache(): void {
  cachedSenderEmail = null;
}
