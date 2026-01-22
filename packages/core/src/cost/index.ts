/**
 * Cost Dashboard Module
 *
 * Provides cost tracking, querying, budgeting, alerts, and dashboard
 * aggregation for the NEXUS-AI pipeline.
 *
 * @module @nexus-ai/core/cost
 *
 * @example
 * ```typescript
 * import {
 *   // Types
 *   COST_THRESHOLDS,
 *   BUDGET_TARGETS,
 *   type DailyCostBreakdown,
 *   type VideoCostBreakdown,
 *   type BudgetStatus,
 *   type CostDashboardData,
 *
 *   // Query functions
 *   getCostsByDate,
 *   getCostsByVideo,
 *   getCostsThisMonth,
 *   getCostTrend,
 *
 *   // Budget functions
 *   initializeBudget,
 *   getBudgetStatus,
 *   updateBudgetSpent,
 *   calculateRunway,
 *
 *   // Alert functions
 *   checkCostThresholds,
 *   getAlertCounts,
 *
 *   // Dashboard functions
 *   getCostDashboardData,
 *   getCostSummaryForDigest,
 * } from '@nexus-ai/core/cost';
 *
 * // Get dashboard data
 * const dashboard = await getCostDashboardData();
 *
 * // Check cost thresholds after pipeline
 * await checkCostThresholds(0.47, '2026-01-22', costBreakdown);
 *
 * // Update budget after pipeline
 * await updateBudgetSpent(0.47);
 * ```
 */

// Types and constants
export {
  COST_THRESHOLDS,
  BUDGET_TARGETS,
  type ServiceCostDetail,
  type StageCostDetail,
  type DailyCostBreakdown,
  type VideoCostBreakdown,
  type MonthlyCostSummary,
  type CostTrendDataPoint,
  type CostTrendData,
  type BudgetStatus,
  type BudgetDocument,
  type MonthlyBudgetHistory,
  type AlertCounts,
  type CostDashboardData,
  type DigestCostSection,
  type CostAlertPayload,
} from './types.js';

// Query functions
export {
  getCostsByDate,
  getCostsByVideo,
  getCostsThisMonth,
  getCostTrend,
  clearCostCache,
  getToday,
  getStartOfMonth,
  getCurrentMonth,
  getLastNDates,
  getDaysRemainingInMonth,
} from './queries.js';

// Budget functions
export {
  initializeBudget,
  getBudgetStatus,
  updateBudgetSpent,
  calculateRunway,
  getMonthlyHistory,
  resetBudget,
} from './budget.js';

// Alert functions
export {
  checkCostThresholds,
  getAlertCounts,
  resetAlertCounts,
  setNotificationFunctions,
  type AlertCheckResult,
  type NotificationFunctions,
} from './alerts.js';

// Dashboard functions
export {
  getCostDashboardData,
  getCostSummaryForDigest,
} from './dashboard.js';
