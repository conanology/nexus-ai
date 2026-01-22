/**
 * Cost Query Functions
 *
 * Provides functions to retrieve and aggregate cost data from Firestore.
 * All functions read from existing cost documents persisted by CostTracker.
 *
 * @module @nexus-ai/core/cost/queries
 *
 * @example
 * ```typescript
 * import { getCostsByDate, getCostsByVideo, getCostsThisMonth, getCostTrend } from '@nexus-ai/core/cost';
 *
 * // Get daily cost breakdown
 * const daily = await getCostsByDate('2026-01-22');
 *
 * // Get per-video cost breakdown
 * const video = await getCostsByVideo('2026-01-22');
 *
 * // Get month-to-date costs
 * const monthly = await getCostsThisMonth();
 *
 * // Get cost trend for last 7 days
 * const trend = await getCostTrend(7);
 * ```
 */

import { FirestoreClient } from '../storage/firestore-client.js';
import type { VideoCosts } from '../observability/cost-tracker.js';
import { createLogger } from '../observability/logger.js';
import { NexusError } from '../errors/index.js';
import type {
  DailyCostBreakdown,
  VideoCostBreakdown,
  MonthlyCostSummary,
  CostTrendData,
  CostTrendDataPoint,
  ServiceCostDetail,
  StageCostDetail,
} from './types.js';
import { BUDGET_TARGETS } from './types.js';

const logger = createLogger('nexus.cost.queries');

/** Cache for frequently accessed data (15-minute TTL) */
const queryCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Get cached data or null if expired/missing
 */
function getCached<T>(key: string): T | null {
  const cached = queryCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }

  return cached.data as T;
}

/**
 * Set cached data with timestamp
 */
function setCache<T>(key: string, data: T): void {
  queryCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Clear all cached data (useful for testing)
 */
export function clearCostCache(): void {
  queryCache.clear();
}

/**
 * Round cost to 4 decimal places
 */
function roundCost(cost: number): number {
  return Math.round(cost * 10000) / 10000;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get start of current month in YYYY-MM-DD format
 */
export function getStartOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get array of last N dates in YYYY-MM-DD format (most recent first)
 */
export function getLastNDates(n: number): string[] {
  const dates: string[] = [];
  const now = new Date();

  for (let i = 0; i < n; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

/**
 * Get number of days remaining in current month
 */
export function getDaysRemainingInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

/**
 * Convert VideoCosts (from CostTracker) to service details
 */
function extractServiceDetails(costs: VideoCosts): ServiceCostDetail[] {
  const services: ServiceCostDetail[] = [];

  if (costs.stages) {
    for (const stageName in costs.stages) {
      const stage = costs.stages[stageName];
      for (const breakdown of stage.breakdown) {
        // Find existing service or create new
        const existing = services.find((s) => s.service === breakdown.service);
        if (existing) {
          existing.cost = roundCost(existing.cost + breakdown.cost);
          existing.calls += breakdown.callCount;
          if (breakdown.tokens.input !== undefined) {
            existing.tokens = existing.tokens || {};
            existing.tokens.input = (existing.tokens.input || 0) + breakdown.tokens.input;
          }
          if (breakdown.tokens.output !== undefined) {
            existing.tokens = existing.tokens || {};
            existing.tokens.output = (existing.tokens.output || 0) + breakdown.tokens.output;
          }
        } else {
          services.push({
            service: breakdown.service,
            cost: breakdown.cost,
            calls: breakdown.callCount,
            tokens: breakdown.tokens.input !== undefined || breakdown.tokens.output !== undefined
              ? { input: breakdown.tokens.input, output: breakdown.tokens.output }
              : undefined,
          });
        }
      }
    }
  }

  return services;
}

/**
 * Convert VideoCosts to stage breakdown map
 */
function extractStageBreakdown(costs: VideoCosts): Record<string, number> {
  const stages: Record<string, number> = {};

  if (costs.stages) {
    for (const stageName in costs.stages) {
      stages[stageName] = costs.stages[stageName].total;
    }
  }

  return stages;
}

/**
 * Convert VideoCosts to detailed stage cost breakdown
 */
function extractStageCostDetails(costs: VideoCosts): StageCostDetail[] {
  const stages: StageCostDetail[] = [];

  if (costs.stages) {
    for (const stageName in costs.stages) {
      const stageData = costs.stages[stageName];
      stages.push({
        stage: stageName,
        cost: stageData.total,
        services: stageData.breakdown.map((b) => ({
          service: b.service,
          cost: b.cost,
          calls: b.callCount,
          tokens: b.tokens.input !== undefined || b.tokens.output !== undefined
            ? { input: b.tokens.input, output: b.tokens.output }
            : undefined,
        })),
      });
    }
  }

  return stages;
}

/**
 * Get cost breakdown for a specific date
 *
 * Returns daily cost breakdown by service and stage.
 * If no cost data exists for the date, returns zero-cost breakdown.
 *
 * @param date - Date in YYYY-MM-DD format
 * @returns Daily cost breakdown
 * @throws NexusError on Firestore errors
 *
 * @example
 * ```typescript
 * const costs = await getCostsByDate('2026-01-22');
 * console.log(costs.total); // 0.47
 * console.log(costs.byCategory.gemini); // 0.23
 * ```
 */
export async function getCostsByDate(date: string): Promise<DailyCostBreakdown> {
  // Check cache
  const cacheKey = `daily:${date}`;
  const cached = getCached<DailyCostBreakdown>(cacheKey);
  if (cached) {
    logger.debug({ date, cached: true }, 'Returning cached daily cost data');
    return cached;
  }

  try {
    const firestoreClient = new FirestoreClient();
    const costs = await firestoreClient.getPipelineCosts<VideoCosts>(date);

    // Return zero-cost breakdown if no data
    if (!costs) {
      const emptyBreakdown: DailyCostBreakdown = {
        date,
        total: 0,
        byCategory: { gemini: 0, tts: 0, render: 0 },
        byStage: {},
        services: [],
        videoCount: 0,
      };

      logger.debug({ date }, 'No cost data found for date');
      return emptyBreakdown;
    }

    const breakdown: DailyCostBreakdown = {
      date,
      total: costs.total,
      byCategory: {
        gemini: costs.gemini,
        tts: costs.tts,
        render: costs.render,
      },
      byStage: extractStageBreakdown(costs),
      services: extractServiceDetails(costs),
      videoCount: 1, // Single video per day
    };

    // Cache the result
    setCache(cacheKey, breakdown);

    logger.debug({ date, total: breakdown.total }, 'Retrieved daily cost data');
    return breakdown;
  } catch (error) {
    logger.error({ date, error }, 'Failed to get costs by date');
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.fromError(error, 'cost-queries');
  }
}

/**
 * Get detailed cost breakdown for a specific video/pipeline
 *
 * Returns per-video cost breakdown with stage details and budget comparison.
 *
 * @param pipelineId - Pipeline ID (YYYY-MM-DD)
 * @returns Video cost breakdown with budget comparison
 * @throws NexusError on Firestore errors
 *
 * @example
 * ```typescript
 * const video = await getCostsByVideo('2026-01-22');
 * console.log(video.total); // 0.47
 * console.log(video.budgetComparison.withinTarget); // true
 * console.log(video.stages[0].services); // Service breakdown per stage
 * ```
 */
export async function getCostsByVideo(pipelineId: string): Promise<VideoCostBreakdown> {
  // Check cache
  const cacheKey = `video:${pipelineId}`;
  const cached = getCached<VideoCostBreakdown>(cacheKey);
  if (cached) {
    logger.debug({ pipelineId, cached: true }, 'Returning cached video cost data');
    return cached;
  }

  try {
    const firestoreClient = new FirestoreClient();
    const costs = await firestoreClient.getPipelineCosts<VideoCosts>(pipelineId);

    // Return zero-cost breakdown if no data
    if (!costs) {
      const emptyBreakdown: VideoCostBreakdown = {
        pipelineId,
        total: 0,
        byCategory: { gemini: 0, tts: 0, render: 0 },
        stages: [],
        budgetComparison: {
          target: BUDGET_TARGETS.CREDIT_PERIOD_PER_VIDEO,
          withinTarget: true,
          percentOfTarget: 0,
        },
        timestamp: new Date().toISOString(),
      };

      logger.debug({ pipelineId }, 'No cost data found for video');
      return emptyBreakdown;
    }

    const total = costs.total;
    const target = BUDGET_TARGETS.CREDIT_PERIOD_PER_VIDEO;

    const breakdown: VideoCostBreakdown = {
      pipelineId,
      total,
      byCategory: {
        gemini: costs.gemini,
        tts: costs.tts,
        render: costs.render,
      },
      stages: extractStageCostDetails(costs),
      budgetComparison: {
        target,
        withinTarget: total <= target,
        percentOfTarget: roundCost((total / target) * 100),
      },
      timestamp: new Date().toISOString(),
    };

    // Cache the result
    setCache(cacheKey, breakdown);

    logger.debug({ pipelineId, total }, 'Retrieved video cost data');
    return breakdown;
  } catch (error) {
    logger.error({ pipelineId, error }, 'Failed to get costs by video');
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.fromError(error, 'cost-queries');
  }
}

/**
 * Get month-to-date cost summary
 *
 * Aggregates all costs from start of month to today.
 * Uses parallel queries for efficiency.
 *
 * @returns Monthly cost summary with projections
 * @throws NexusError on Firestore errors
 *
 * @example
 * ```typescript
 * const monthly = await getCostsThisMonth();
 * console.log(monthly.total); // 10.35
 * console.log(monthly.avgPerVideo); // 0.47
 * console.log(monthly.budgetComparison.onTrack); // true
 * ```
 */
export async function getCostsThisMonth(): Promise<MonthlyCostSummary> {
  const month = getCurrentMonth();
  const startOfMonth = getStartOfMonth();
  const today = getToday();

  // Check cache
  const cacheKey = `monthly:${month}`;
  const cached = getCached<MonthlyCostSummary>(cacheKey);
  if (cached) {
    logger.debug({ month, cached: true }, 'Returning cached monthly cost data');
    return cached;
  }

  try {
    // Calculate number of days to query
    // Use date-only comparison to avoid timezone issues
    const days: string[] = [];
    const startMs = new Date(startOfMonth + 'T00:00:00.000Z').getTime();
    const endMs = new Date(today + 'T00:00:00.000Z').getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let ms = startMs; ms <= endMs; ms += dayMs) {
      days.push(new Date(ms).toISOString().split('T')[0]);
    }

    // Query all days in parallel
    const dailyCosts = await Promise.all(days.map((date) => getCostsByDate(date)));

    // Aggregate results
    let total = 0;
    let videoCount = 0;
    let geminiTotal = 0;
    let ttsTotal = 0;
    let renderTotal = 0;
    const dailyBreakdown: Record<string, number> = {};

    for (const daily of dailyCosts) {
      total = roundCost(total + daily.total);
      videoCount += daily.videoCount;
      geminiTotal = roundCost(geminiTotal + daily.byCategory.gemini);
      ttsTotal = roundCost(ttsTotal + daily.byCategory.tts);
      renderTotal = roundCost(renderTotal + daily.byCategory.render);

      if (daily.total > 0) {
        dailyBreakdown[daily.date] = daily.total;
      }
    }

    const avgPerVideo = videoCount > 0 ? roundCost(total / videoCount) : 0;
    const daysRemaining = getDaysRemainingInMonth();
    const daysSoFar = days.length;
    const avgDaily = daysSoFar > 0 ? roundCost(total / daysSoFar) : 0;
    const projected = roundCost(total + avgDaily * daysRemaining);

    const summary: MonthlyCostSummary = {
      month,
      total,
      videoCount,
      avgPerVideo,
      dailyBreakdown,
      byCategory: {
        gemini: geminiTotal,
        tts: ttsTotal,
        render: renderTotal,
      },
      budgetComparison: {
        target: BUDGET_TARGETS.MONTHLY_TARGET,
        onTrack: projected <= BUDGET_TARGETS.MONTHLY_TARGET,
        projected,
        daysRemaining,
      },
    };

    // Cache the result (shorter TTL for monthly data - refresh more often)
    setCache(cacheKey, summary);

    logger.info(
      { month, total, videoCount, projected },
      'Calculated monthly cost summary'
    );

    return summary;
  } catch (error) {
    logger.error({ month, error }, 'Failed to get monthly costs');
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.fromError(error, 'cost-queries');
  }
}

/**
 * Get cost trend data for specified period
 *
 * Returns daily cost data points with change calculations and summary statistics.
 *
 * @param days - Number of days to include in trend (default: 7)
 * @returns Cost trend data with summary statistics
 * @throws NexusError on Firestore errors
 *
 * @example
 * ```typescript
 * const trend = await getCostTrend(7);
 * console.log(trend.summary.avgDaily); // 0.47
 * console.log(trend.summary.trend); // 'stable'
 * console.log(trend.dataPoints[0]); // Most recent day
 * ```
 */
export async function getCostTrend(days: number = 7): Promise<CostTrendData> {
  // Clamp days to reasonable range
  const periodDays = Math.max(1, Math.min(days, 365));

  // Check cache
  const cacheKey = `trend:${periodDays}`;
  const cached = getCached<CostTrendData>(cacheKey);
  if (cached) {
    logger.debug({ periodDays, cached: true }, 'Returning cached trend data');
    return cached;
  }

  try {
    const dates = getLastNDates(periodDays);

    // Query all dates in parallel
    const dailyCosts = await Promise.all(dates.map((date) => getCostsByDate(date)));

    // Build data points (reverse to get oldest first for calculations)
    const sortedCosts = [...dailyCosts].reverse();
    const dataPoints: CostTrendDataPoint[] = [];

    let totalCost = 0;
    let totalVideos = 0;
    let minDaily = Infinity;
    let maxDaily = 0;

    for (let i = 0; i < sortedCosts.length; i++) {
      const current = sortedCosts[i];
      const previous = i > 0 ? sortedCosts[i - 1] : null;

      const changeFromPrevious = previous
        ? roundCost(current.total - previous.total)
        : 0;

      const percentChange = previous && previous.total > 0
        ? roundCost(((current.total - previous.total) / previous.total) * 100)
        : 0;

      dataPoints.push({
        date: current.date,
        total: current.total,
        avgPerVideo: current.total, // Single video per day
        changeFromPrevious,
        percentChange,
      });

      totalCost = roundCost(totalCost + current.total);
      totalVideos += current.videoCount;

      if (current.total > 0) {
        minDaily = Math.min(minDaily, current.total);
        maxDaily = Math.max(maxDaily, current.total);
      }
    }

    // Handle edge case where no costs exist
    if (minDaily === Infinity) minDaily = 0;
    if (maxDaily === 0) maxDaily = 0;

    // Calculate trend direction
    const firstWithCost = dataPoints.find((d) => d.total > 0);
    const lastWithCost = [...dataPoints].reverse().find((d) => d.total > 0);

    let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let trendPercent = 0;

    if (firstWithCost && lastWithCost && firstWithCost !== lastWithCost) {
      const change = lastWithCost.total - firstWithCost.total;
      trendPercent = roundCost((change / firstWithCost.total) * 100);

      if (trendPercent > 5) {
        trendDirection = 'increasing';
      } else if (trendPercent < -5) {
        trendDirection = 'decreasing';
      }
    }

    const daysWithCost = dataPoints.filter((d) => d.total > 0).length;
    const avgDaily = daysWithCost > 0 ? roundCost(totalCost / daysWithCost) : 0;

    const trend: CostTrendData = {
      periodDays,
      dataPoints: dataPoints.reverse(), // Return most recent first
      summary: {
        avgDaily,
        minDaily,
        maxDaily,
        totalCost,
        totalVideos,
        trend: trendDirection,
        trendPercent: Math.abs(trendPercent),
      },
    };

    // Cache the result
    setCache(cacheKey, trend);

    logger.debug(
      { periodDays, avgDaily, trend: trendDirection },
      'Calculated cost trend'
    );

    return trend;
  } catch (error) {
    logger.error({ days, error }, 'Failed to get cost trend');
    if (error instanceof NexusError) {
      throw error;
    }
    throw NexusError.fromError(error, 'cost-queries');
  }
}
