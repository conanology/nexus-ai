/**
 * Budget Tracking
 *
 * Provides functions for tracking GCP credit budget, calculating runway,
 * and projecting costs.
 *
 * @module @nexus-ai/core/cost/budget
 *
 * @example
 * ```typescript
 * import {
 *   initializeBudget,
 *   getBudgetStatus,
 *   updateBudgetSpent,
 *   calculateRunway,
 * } from '@nexus-ai/core/cost';
 *
 * // Initialize budget with GCP credit
 * await initializeBudget(300);
 *
 * // Get current budget status
 * const status = await getBudgetStatus();
 * console.log(status.remaining); // 285.5
 * console.log(status.daysOfRunway); // 612
 *
 * // Update after pipeline completion
 * await updateBudgetSpent(0.47);
 * ```
 */

import { FirestoreClient } from '../storage/firestore-client.js';
import { createLogger } from '../observability/logger.js';
import { NexusError } from '../errors/index.js';
import { getCostTrend } from './queries.js';
import type { BudgetStatus, BudgetDocument, MonthlyBudgetHistory } from './types.js';
import { BUDGET_TARGETS } from './types.js';

const logger = createLogger('nexus.cost.budget');

/** Budget document Firestore path */
const BUDGET_COLLECTION = 'budget';
const BUDGET_DOC_ID = 'current';
const BUDGET_HISTORY_COLLECTION = 'budget/history';

/**
 * Round cost to 4 decimal places
 */
function roundCost(cost: number): number {
  return Math.round(cost * 10000) / 10000;
}

/**
 * Calculate credit expiration date (90 days from start)
 */
function calculateExpirationDate(startDate: string): string {
  const start = new Date(startDate);
  start.setDate(start.getDate() + BUDGET_TARGETS.CREDIT_EXPIRATION_DAYS);
  return start.toISOString();
}

/**
 * Check if currently within credit period
 */
function isInCreditPeriod(creditExpiration: string): boolean {
  return new Date() < new Date(creditExpiration);
}

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Initialize budget tracking with specified credit amount
 *
 * Creates the budget document in Firestore if it doesn't exist.
 * If document already exists, this is a no-op.
 *
 * @param creditAmount - Initial GCP credit amount (default: $300)
 * @param startDate - Budget start date (default: today)
 * @throws NexusError on Firestore errors
 *
 * @example
 * ```typescript
 * // Initialize with default $300 credit
 * await initializeBudget();
 *
 * // Initialize with custom credit amount
 * await initializeBudget(500);
 * ```
 */
export async function initializeBudget(
  creditAmount: number = BUDGET_TARGETS.DEFAULT_CREDIT,
  startDate?: string
): Promise<void> {
  try {
    const firestoreClient = new FirestoreClient();

    // Check if budget already exists
    const existing = await firestoreClient.getDocument<BudgetDocument>(
      BUDGET_COLLECTION,
      BUDGET_DOC_ID
    );

    if (existing) {
      logger.info(
        { initialCredit: existing.initialCredit, totalSpent: existing.totalSpent },
        'Budget already initialized'
      );
      return;
    }

    const start = startDate || new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';

    const budget: BudgetDocument = {
      initialCredit: creditAmount,
      totalSpent: 0,
      remaining: creditAmount,
      startDate: start,
      lastUpdated: new Date().toISOString(),
      creditExpiration: calculateExpirationDate(start),
    };

    await firestoreClient.setDocument(BUDGET_COLLECTION, BUDGET_DOC_ID, budget);

    logger.info(
      { creditAmount, startDate: start, expiration: budget.creditExpiration },
      'Budget initialized'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to initialize budget');
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.fromError(error, 'cost-budget');
  }
}

/**
 * Get current budget status
 *
 * Retrieves budget document from Firestore and calculates runway and projections.
 * If no budget exists, initializes with default values.
 *
 * @returns Budget status with runway and projections
 * @throws NexusError on Firestore errors
 *
 * @example
 * ```typescript
 * const status = await getBudgetStatus();
 * console.log(status.remaining); // 285.50
 * console.log(status.daysOfRunway); // 612
 * console.log(status.isWithinBudget); // true
 * console.log(status.isInCreditPeriod); // true
 * ```
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  try {
    const firestoreClient = new FirestoreClient();

    // Get budget document
    let budget = await firestoreClient.getDocument<BudgetDocument>(
      BUDGET_COLLECTION,
      BUDGET_DOC_ID
    );

    // Initialize if doesn't exist
    if (!budget) {
      logger.info({}, 'Budget not found, initializing with defaults');
      await initializeBudget();
      budget = await firestoreClient.getDocument<BudgetDocument>(
        BUDGET_COLLECTION,
        BUDGET_DOC_ID
      );

      if (!budget) {
        throw NexusError.critical(
          'NEXUS_COST_BUDGET_NOT_FOUND',
          'Failed to initialize budget document',
          'cost-budget'
        );
      }
    }

    // Calculate average daily cost from last 7 days
    const trend = await getCostTrend(7);
    const avgDailyCost = trend.summary.avgDaily;

    // Calculate runway (days remaining at current spend rate)
    const daysOfRunway = calculateRunway(budget.remaining, avgDailyCost);

    // Calculate projected monthly cost
    const projectedMonthly = roundCost(avgDailyCost * 30);

    // Check if within budget
    const isWithinBudget = projectedMonthly <= BUDGET_TARGETS.MONTHLY_TARGET;
    const inCreditPeriod = isInCreditPeriod(budget.creditExpiration);

    const status: BudgetStatus = {
      initialCredit: budget.initialCredit,
      totalSpent: budget.totalSpent,
      remaining: budget.remaining,
      daysOfRunway,
      projectedMonthly,
      creditExpiration: budget.creditExpiration,
      isWithinBudget,
      isInCreditPeriod: inCreditPeriod,
      startDate: budget.startDate,
      lastUpdated: budget.lastUpdated,
    };

    logger.debug(
      {
        remaining: status.remaining,
        daysOfRunway,
        projectedMonthly,
        isWithinBudget,
      },
      'Retrieved budget status'
    );

    return status;
  } catch (error) {
    logger.error({ error }, 'Failed to get budget status');
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.fromError(error, 'cost-budget');
  }
}

/**
 * Update budget with new spending
 *
 * Called after each pipeline completion to record cost.
 * Also updates monthly history document.
 *
 * @param amount - Cost amount to add (in USD)
 * @param date - Date of the cost (default: today)
 * @throws NexusError on Firestore errors
 *
 * @example
 * ```typescript
 * // Record pipeline cost
 * await updateBudgetSpent(0.47);
 *
 * // Record cost for specific date
 * await updateBudgetSpent(0.52, '2026-01-21');
 * ```
 */
export async function updateBudgetSpent(
  amount: number,
  date?: string
): Promise<void> {
  try {
    const firestoreClient = new FirestoreClient();
    const costDate = date || new Date().toISOString().split('T')[0];

    // Get current budget
    let budget = await firestoreClient.getDocument<BudgetDocument>(
      BUDGET_COLLECTION,
      BUDGET_DOC_ID
    );

    // Initialize if doesn't exist
    if (!budget) {
      await initializeBudget();
      budget = await firestoreClient.getDocument<BudgetDocument>(
        BUDGET_COLLECTION,
        BUDGET_DOC_ID
      );

      if (!budget) {
        throw NexusError.critical(
          'NEXUS_COST_BUDGET_NOT_FOUND',
          'Failed to initialize budget document',
          'cost-budget'
        );
      }
    }

    // Update budget
    const newTotalSpent = roundCost(budget.totalSpent + amount);
    const newRemaining = roundCost(budget.initialCredit - newTotalSpent);

    const updatedBudget: BudgetDocument = {
      ...budget,
      totalSpent: newTotalSpent,
      remaining: newRemaining,
      lastUpdated: new Date().toISOString(),
    };

    await firestoreClient.setDocument(BUDGET_COLLECTION, BUDGET_DOC_ID, updatedBudget);

    // Update monthly history
    await updateMonthlyHistory(firestoreClient, costDate, amount);

    logger.info(
      {
        amount,
        date: costDate,
        totalSpent: newTotalSpent,
        remaining: newRemaining,
      },
      'Budget spending updated'
    );
  } catch (error) {
    logger.error({ amount, error }, 'Failed to update budget spent');
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.fromError(error, 'cost-budget');
  }
}

/**
 * Update monthly budget history
 */
async function updateMonthlyHistory(
  firestoreClient: FirestoreClient,
  date: string,
  amount: number
): Promise<void> {
  const month = date.slice(0, 7); // YYYY-MM
  const day = date; // YYYY-MM-DD

  try {
    // Get existing history
    let history = await firestoreClient.getDocument<MonthlyBudgetHistory>(
      BUDGET_HISTORY_COLLECTION,
      month
    );

    if (!history) {
      history = {
        month,
        monthlySpent: 0,
        videoCount: 0,
        avgCostPerVideo: 0,
        days: {},
      };
    }

    // Update values
    history.monthlySpent = roundCost(history.monthlySpent + amount);
    history.videoCount += 1;
    history.avgCostPerVideo = roundCost(history.monthlySpent / history.videoCount);
    history.days[day] = roundCost((history.days[day] || 0) + amount);

    await firestoreClient.setDocument(BUDGET_HISTORY_COLLECTION, month, history);

    logger.debug(
      { month, monthlySpent: history.monthlySpent, videoCount: history.videoCount },
      'Monthly history updated'
    );
  } catch (error) {
    // Log but don't fail - history is supplementary
    logger.warn({ month, error }, 'Failed to update monthly history');
  }
}

/**
 * Calculate days of runway remaining
 *
 * @param remaining - Remaining budget in USD
 * @param avgDailyCost - Average daily cost in USD
 * @returns Days of runway (999 if no cost data or cost is zero)
 *
 * @example
 * ```typescript
 * const runway = calculateRunway(285.5, 0.47);
 * console.log(runway); // 607
 * ```
 */
export function calculateRunway(remaining: number, avgDailyCost: number): number {
  // Handle edge cases
  if (avgDailyCost <= 0) {
    // No cost data - return max runway
    return 999;
  }

  if (remaining <= 0) {
    return 0;
  }

  return Math.floor(remaining / avgDailyCost);
}

/**
 * Get monthly budget history
 *
 * @param month - Month in YYYY-MM format (default: current month)
 * @returns Monthly budget history or null if not found
 *
 * @example
 * ```typescript
 * const history = await getMonthlyHistory('2026-01');
 * console.log(history?.monthlySpent); // 10.35
 * console.log(history?.videoCount); // 22
 * ```
 */
export async function getMonthlyHistory(
  month?: string
): Promise<MonthlyBudgetHistory | null> {
  try {
    const firestoreClient = new FirestoreClient();
    const targetMonth = month || getCurrentMonth();

    return await firestoreClient.getDocument<MonthlyBudgetHistory>(
      BUDGET_HISTORY_COLLECTION,
      targetMonth
    );
  } catch (error) {
    logger.error({ month, error }, 'Failed to get monthly history');
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.fromError(error, 'cost-budget');
  }
}

/**
 * Reset budget for testing or re-initialization
 *
 * WARNING: This will reset all budget tracking data.
 * Only use for testing or with explicit user confirmation.
 *
 * @param newCreditAmount - New credit amount (default: $300)
 * @throws NexusError on Firestore errors
 */
export async function resetBudget(
  newCreditAmount: number = BUDGET_TARGETS.DEFAULT_CREDIT
): Promise<void> {
  try {
    const firestoreClient = new FirestoreClient();

    // Delete existing budget
    try {
      await firestoreClient.deleteDocument(BUDGET_COLLECTION, BUDGET_DOC_ID);
    } catch {
      // Ignore delete errors - document may not exist
    }

    // Re-initialize
    await initializeBudget(newCreditAmount);

    logger.warn(
      { newCreditAmount },
      'Budget reset - all previous tracking data cleared'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to reset budget');
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.fromError(error, 'cost-budget');
  }
}
