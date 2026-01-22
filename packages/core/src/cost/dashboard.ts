/**
 * Cost Dashboard Aggregation
 *
 * Provides functions to aggregate cost data for dashboards and digest emails.
 *
 * @module @nexus-ai/core/cost/dashboard
 *
 * @example
 * ```typescript
 * import { getCostDashboardData, getCostSummaryForDigest } from '@nexus-ai/core/cost';
 *
 * // Get complete dashboard data
 * const dashboard = await getCostDashboardData();
 * console.log(dashboard.today.total);
 * console.log(dashboard.budget.daysOfRunway);
 *
 * // Get summary for daily digest
 * const summary = await getCostSummaryForDigest();
 * console.log(summary.todayCost); // "$0.47"
 * ```
 */

import { createLogger } from '../observability/logger.js';
import { NexusError } from '../errors/index.js';
import { getCostsByDate, getCostsThisMonth, getCostTrend, getToday } from './queries.js';
import { getBudgetStatus } from './budget.js';
import { getAlertCounts } from './alerts.js';
import type {
  CostDashboardData,
  DigestCostSection,
} from './types.js';
import { COST_THRESHOLDS } from './types.js';

const logger = createLogger('nexus.cost.dashboard');

/**
 * Get complete cost dashboard data
 *
 * Aggregates all cost metrics for dashboard display:
 * - Today's costs
 * - Month-to-date summary
 * - Budget status
 * - 30-day cost trend
 * - Alert counts
 *
 * Uses parallel queries for performance.
 *
 * @returns Complete dashboard data
 * @throws NexusError on aggregation errors
 *
 * @example
 * ```typescript
 * const dashboard = await getCostDashboardData();
 *
 * console.log(dashboard.today.total);           // 0.47
 * console.log(dashboard.thisMonth.avgPerVideo); // 0.47
 * console.log(dashboard.budget.daysOfRunway);   // 607
 * console.log(dashboard.trend.summary.trend);   // 'stable'
 * console.log(dashboard.alerts.warningCount);   // 0
 * ```
 */
export async function getCostDashboardData(): Promise<CostDashboardData> {
  try {
    const today = getToday();

    // Query all data in parallel for performance
    const [todayCosts, monthlyCosts, budgetStatus, trendData, alertCounts] = await Promise.all([
      getCostsByDate(today),
      getCostsThisMonth(),
      getBudgetStatus(),
      getCostTrend(30),
      getAlertCounts(),
    ]);

    const dashboard: CostDashboardData = {
      today: todayCosts,
      thisMonth: monthlyCosts,
      budget: budgetStatus,
      trend: trendData,
      alerts: alertCounts,
      generatedAt: new Date().toISOString(),
    };

    logger.info(
      {
        todayCost: todayCosts.total,
        monthlyTotal: monthlyCosts.total,
        budgetRemaining: budgetStatus.remaining,
        alertCount: alertCounts.warningCount + alertCounts.criticalCount,
      },
      'Dashboard data generated'
    );

    return dashboard;
  } catch (error) {
    logger.error({ error }, 'Failed to generate dashboard data');
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.fromError(error, 'cost-dashboard');
  }
}

/**
 * Get cost summary for daily digest email
 *
 * Returns a concise summary compatible with @nexus-ai/notifications DigestHealthData.
 *
 * @returns Cost section for daily digest
 * @throws NexusError on aggregation errors
 *
 * @example
 * ```typescript
 * const summary = await getCostSummaryForDigest();
 *
 * // Use in digest email
 * const digestHealth = {
 *   buffersRemaining: 3,
 *   budgetRemaining: summary.budgetRemaining,  // "$285.50"
 *   daysOfRunway: summary.daysOfRunway,        // 607
 * };
 * ```
 */
export async function getCostSummaryForDigest(): Promise<DigestCostSection> {
  try {
    const today = getToday();

    // Query today's cost and budget in parallel
    const [todayCosts, budgetStatus] = await Promise.all([
      getCostsByDate(today),
      getBudgetStatus(),
    ]);

    const summary: DigestCostSection = {
      todayCost: formatCurrency(todayCosts.total),
      budgetRemaining: formatCurrency(budgetStatus.remaining),
      daysOfRunway: budgetStatus.daysOfRunway,
      isOverBudget: todayCosts.total > COST_THRESHOLDS.WARNING,
    };

    logger.debug(
      { todayCost: todayCosts.total, budgetRemaining: budgetStatus.remaining },
      'Digest cost summary generated'
    );

    return summary;
  } catch (error) {
    logger.error({ error }, 'Failed to generate digest cost summary');
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.fromError(error, 'cost-dashboard');
  }
}

/**
 * Format number as currency string
 *
 * @param amount - Amount in dollars
 * @returns Formatted string (e.g., "$0.47")
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
