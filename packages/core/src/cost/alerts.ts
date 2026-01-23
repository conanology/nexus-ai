/**
 * Cost Alerts
 *
 * Provides functions for checking cost thresholds and sending alerts
 * via Discord and email through the @nexus-ai/notifications package.
 *
 * @module @nexus-ai/core/cost/alerts
 *
 * @example
 * ```typescript
 * import { checkCostThresholds } from '@nexus-ai/core/cost';
 *
 * // Check cost after pipeline completion
 * const result = await checkCostThresholds(0.82, '2026-01-22', costBreakdown);
 * console.log(result.triggered); // true
 * console.log(result.severity); // 'WARNING'
 * ```
 */

import { createLogger } from '../observability/logger.js';
import { NexusError } from '../errors/index.js';
import { FirestoreClient } from '../storage/firestore-client.js';
import { getBudgetStatus } from './budget.js';
import type { CostAlertPayload, AlertCounts } from './types.js';
import { COST_THRESHOLDS } from './types.js';

const logger = createLogger('nexus.cost.alerts');

/** Alert tracking document path */
const ALERTS_COLLECTION = 'budget';
const ALERTS_DOC_ID = 'alerts';

/** Minimum time between alerts of the same type (1 hour) */
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Alert check result
 */
export interface AlertCheckResult {
  /** Whether an alert was triggered */
  triggered: boolean;
  /** Alert severity if triggered */
  severity?: 'WARNING' | 'CRITICAL';
  /** Whether alert was actually sent (false if in cooldown) */
  sent: boolean;
  /** Reason if not sent */
  reason?: string;
}

/**
 * Alert tracking state stored in Firestore
 */
interface AlertTrackingState {
  /** Count of warning alerts this month */
  warningCount: number;
  /** Count of critical alerts this month */
  criticalCount: number;
  /** Timestamp of last warning alert */
  lastWarningAt?: string;
  /** Timestamp of last critical alert */
  lastCriticalAt?: string;
  /** Current month (for count reset) */
  month: string;
}

/**
 * Check if alert is in cooldown period
 */
function isInCooldown(lastAlertTime: string | undefined): boolean {
  if (!lastAlertTime) return false;
  const timeSinceLastAlert = Date.now() - new Date(lastAlertTime).getTime();
  return timeSinceLastAlert < ALERT_COOLDOWN_MS;
}

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get or initialize alert tracking state
 */
async function getAlertState(
  firestoreClient: FirestoreClient
): Promise<AlertTrackingState> {
  const currentMonth = getCurrentMonth();

  const state = await firestoreClient.getDocument<AlertTrackingState>(
    ALERTS_COLLECTION,
    ALERTS_DOC_ID
  );

  // If no state or new month, initialize
  if (!state || state.month !== currentMonth) {
    return {
      warningCount: 0,
      criticalCount: 0,
      month: currentMonth,
    };
  }

  return state;
}

/**
 * Update alert tracking state
 */
async function updateAlertState(
  firestoreClient: FirestoreClient,
  state: AlertTrackingState
): Promise<void> {
  await firestoreClient.setDocument(ALERTS_COLLECTION, ALERTS_DOC_ID, state);
}

/**
 * Format cost alert body for email
 */
function formatCostAlertBody(
  severity: 'WARNING' | 'CRITICAL',
  payload: CostAlertPayload
): string {
  const threshold = severity === 'CRITICAL' ? COST_THRESHOLDS.CRITICAL : COST_THRESHOLDS.WARNING;

  return `
NEXUS-AI Cost Alert - ${severity}

Pipeline ID: ${payload.pipelineId}
Video Cost: $${payload.videoCost.toFixed(4)}
Threshold: $${threshold.toFixed(2)}

Cost Breakdown:
- Gemini API: $${payload.breakdown.gemini.toFixed(4)}
- TTS: $${payload.breakdown.tts.toFixed(4)}
- Render: $${payload.breakdown.render.toFixed(4)}

Budget Remaining: $${payload.budgetRemaining.toFixed(2)}

Timestamp: ${payload.timestamp}

${severity === 'CRITICAL' ? 'IMMEDIATE ACTION REQUIRED: Review pipeline costs and optimize where possible.' : 'Consider reviewing cost-intensive stages for optimization opportunities.'}
`.trim();
}

/**
 * Check video cost against thresholds and send alerts if exceeded
 *
 * Alerts are sent via @nexus-ai/notifications package:
 * - WARNING ($0.75): Discord alert
 * - CRITICAL ($1.00): Email alert
 *
 * Alerts have a 1-hour cooldown to prevent spam.
 *
 * @param videoCost - Total cost for the video in USD
 * @param pipelineId - Pipeline ID (YYYY-MM-DD)
 * @param breakdown - Cost breakdown by category
 * @returns Alert check result
 * @throws NexusError on notification errors
 *
 * @example
 * ```typescript
 * const result = await checkCostThresholds(0.82, '2026-01-22', {
 *   gemini: 0.35,
 *   tts: 0.32,
 *   render: 0.15,
 * });
 *
 * if (result.triggered) {
 *   console.log(`Alert triggered: ${result.severity}`);
 *   console.log(`Sent: ${result.sent}`);
 * }
 * ```
 */
export async function checkCostThresholds(
  videoCost: number,
  pipelineId: string,
  breakdown: { gemini: number; tts: number; render: number }
): Promise<AlertCheckResult> {
  try {
    // Determine if threshold exceeded
    let severity: 'WARNING' | 'CRITICAL' | undefined;
    let threshold: number | undefined;

    if (videoCost >= COST_THRESHOLDS.CRITICAL) {
      severity = 'CRITICAL';
      threshold = COST_THRESHOLDS.CRITICAL;
    } else if (videoCost >= COST_THRESHOLDS.WARNING) {
      severity = 'WARNING';
      threshold = COST_THRESHOLDS.WARNING;
    }

    // No threshold exceeded
    if (!severity || !threshold) {
      logger.debug(
        { pipelineId, videoCost, warningThreshold: COST_THRESHOLDS.WARNING },
        'Video cost within thresholds'
      );
      return { triggered: false, sent: false };
    }

    const firestoreClient = new FirestoreClient();

    // Get alert state to check cooldown
    const alertState = await getAlertState(firestoreClient);
    const lastAlertTime = severity === 'CRITICAL'
      ? alertState.lastCriticalAt
      : alertState.lastWarningAt;

    // Check cooldown
    if (isInCooldown(lastAlertTime)) {
      logger.info(
        { pipelineId, severity, videoCost, lastAlertTime },
        'Cost alert in cooldown period - not sending'
      );
      return {
        triggered: true,
        severity,
        sent: false,
        reason: 'Alert in cooldown period (1 hour between alerts)',
      };
    }

    // Get current budget status for alert payload
    const budgetStatus = await getBudgetStatus();

    // Build alert payload
    const payload: CostAlertPayload = {
      severity,
      pipelineId,
      videoCost,
      breakdown,
      threshold,
      budgetRemaining: budgetStatus.remaining,
      timestamp: new Date().toISOString(),
    };

    // Send alert via notifications package
    await sendCostAlert(severity, payload);

    // Update alert state
    if (severity === 'CRITICAL') {
      alertState.criticalCount++;
      alertState.lastCriticalAt = payload.timestamp;
    } else {
      alertState.warningCount++;
      alertState.lastWarningAt = payload.timestamp;
    }

    await updateAlertState(firestoreClient, alertState);

    logger.warn(
      { pipelineId, severity, videoCost, threshold, budgetRemaining: budgetStatus.remaining },
      `Cost alert triggered: ${severity}`
    );

    return { triggered: true, severity, sent: true };
  } catch (error) {
    logger.error({ pipelineId, videoCost, error }, 'Failed to check cost thresholds');
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.fromError(error, 'cost-alerts');
  }
}

/** Notification functions interface for dependency injection */
export interface NotificationFunctions {
  sendDiscordAlert: (config: {
    severity: string;
    title: string;
    description: string;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
  }) => Promise<void>;
  sendAlertEmail: (config: {
    subject: string;
    body: string;
    severity: string;
  }) => Promise<void>;
}

/** Default notification functions loaded from @nexus-ai/notifications */
let notificationFns: NotificationFunctions | null = null;

/**
 * Get notification functions (lazy loaded)
 * Uses dynamic import with .catch() to signal esbuild this is a runtime dependency
 */
async function getNotificationFunctions(): Promise<NotificationFunctions> {
  if (!notificationFns) {
    // Dynamic import at runtime - the .catch() signals to esbuild to leave as external
    // @ts-expect-error - @nexus-ai/notifications is a workspace package loaded at runtime
    const notifications = await import('@nexus-ai/notifications').catch((err) => {
      logger.error({ error: err }, 'Failed to load @nexus-ai/notifications');
      throw NexusError.fromError(err, 'cost-alerts');
    });
    notificationFns = {
      sendDiscordAlert: notifications.sendDiscordAlert,
      sendAlertEmail: notifications.sendAlertEmail,
    };
  }
  return notificationFns;
}

/**
 * Set notification functions for testing
 * @internal
 */
export function setNotificationFunctions(fns: NotificationFunctions | null): void {
  notificationFns = fns;
}

/**
 * Send cost alert via appropriate channel
 */
async function sendCostAlert(
  severity: 'WARNING' | 'CRITICAL',
  payload: CostAlertPayload
): Promise<void> {
  try {
    const notifications = await getNotificationFunctions();

    if (severity === 'CRITICAL') {
      // Critical alerts go to email
      await notifications.sendAlertEmail({
        subject: `[CRITICAL] NEXUS-AI Cost Alert - ${payload.pipelineId}`,
        body: formatCostAlertBody('CRITICAL', payload),
        severity: 'CRITICAL',
      });

      logger.info({ pipelineId: payload.pipelineId }, 'Critical cost alert email sent');
    } else {
      // Warning alerts go to Discord
      await notifications.sendDiscordAlert({
        severity: 'WARNING',
        title: 'Cost Warning',
        description: `Video cost $${payload.videoCost.toFixed(2)} exceeded warning threshold ($${COST_THRESHOLDS.WARNING.toFixed(2)})`,
        fields: [
          { name: 'Pipeline ID', value: payload.pipelineId, inline: true },
          { name: 'Total Cost', value: `$${payload.videoCost.toFixed(4)}`, inline: true },
          { name: 'Threshold', value: `$${COST_THRESHOLDS.WARNING.toFixed(2)}`, inline: true },
          { name: 'Gemini', value: `$${payload.breakdown.gemini.toFixed(4)}`, inline: true },
          { name: 'TTS', value: `$${payload.breakdown.tts.toFixed(4)}`, inline: true },
          { name: 'Render', value: `$${payload.breakdown.render.toFixed(4)}`, inline: true },
          { name: 'Budget Remaining', value: `$${payload.budgetRemaining.toFixed(2)}`, inline: false },
        ],
      });

      logger.info({ pipelineId: payload.pipelineId }, 'Warning cost alert Discord message sent');
    }
  } catch (error) {
    // Log but re-throw - alerts are important
    logger.error({ severity, pipelineId: payload.pipelineId, error }, 'Failed to send cost alert');
    throw error;
  }
}

/**
 * Get current alert counts for dashboard
 *
 * @returns Alert counts for current month
 *
 * @example
 * ```typescript
 * const alerts = await getAlertCounts();
 * console.log(alerts.warningCount); // 2
 * console.log(alerts.criticalCount); // 0
 * ```
 */
export async function getAlertCounts(): Promise<AlertCounts> {
  try {
    const firestoreClient = new FirestoreClient();
    const state = await getAlertState(firestoreClient);

    // Determine most recent alert
    let lastAlert: string | undefined;
    let lastAlertType: 'warning' | 'critical' | undefined;

    if (state.lastCriticalAt && state.lastWarningAt) {
      // Both exist - compare timestamps
      if (state.lastCriticalAt > state.lastWarningAt) {
        lastAlert = state.lastCriticalAt;
        lastAlertType = 'critical';
      } else {
        lastAlert = state.lastWarningAt;
        lastAlertType = 'warning';
      }
    } else if (state.lastCriticalAt) {
      lastAlert = state.lastCriticalAt;
      lastAlertType = 'critical';
    } else if (state.lastWarningAt) {
      lastAlert = state.lastWarningAt;
      lastAlertType = 'warning';
    }

    return {
      warningCount: state.warningCount,
      criticalCount: state.criticalCount,
      lastAlert,
      lastAlertType,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get alert counts');
    // Return zeros on error - don't fail dashboard
    return { warningCount: 0, criticalCount: 0 };
  }
}

/**
 * Reset alert counts (for testing or end of month)
 *
 * @internal
 */
export async function resetAlertCounts(): Promise<void> {
  try {
    const firestoreClient = new FirestoreClient();
    const currentMonth = getCurrentMonth();

    await updateAlertState(firestoreClient, {
      warningCount: 0,
      criticalCount: 0,
      month: currentMonth,
    });

    logger.info({ month: currentMonth }, 'Alert counts reset');
  } catch (error) {
    logger.error({ error }, 'Failed to reset alert counts');
    throw NexusError.fromError(error, 'cost-alerts');
  }
}
