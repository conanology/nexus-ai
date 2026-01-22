/**
 * Tests for cost dashboard functions
 *
 * @module @nexus-ai/core/cost/__tests__/dashboard.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCostDashboardData, getCostSummaryForDigest } from '../dashboard.js';
import { COST_THRESHOLDS } from '../types.js';

// Mock logger
vi.mock('../../observability/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock query functions
vi.mock('../queries.js', () => ({
  getCostsByDate: vi.fn(),
  getCostsThisMonth: vi.fn(),
  getCostTrend: vi.fn(),
  getToday: vi.fn().mockReturnValue('2026-01-22'),
}));

// Mock budget functions
vi.mock('../budget.js', () => ({
  getBudgetStatus: vi.fn(),
}));

// Mock alert functions
vi.mock('../alerts.js', () => ({
  getAlertCounts: vi.fn(),
}));

import { getCostsByDate, getCostsThisMonth, getCostTrend, getToday } from '../queries.js';
import { getBudgetStatus } from '../budget.js';
import { getAlertCounts } from '../alerts.js';

const mockGetCostsByDate = getCostsByDate as unknown as vi.Mock;
const mockGetCostsThisMonth = getCostsThisMonth as unknown as vi.Mock;
const mockGetCostTrend = getCostTrend as unknown as vi.Mock;
const mockGetBudgetStatus = getBudgetStatus as unknown as vi.Mock;
const mockGetAlertCounts = getAlertCounts as unknown as vi.Mock;

// Sample mock data
const mockTodayCosts = {
  date: '2026-01-22',
  total: 0.47,
  byCategory: { gemini: 0.23, tts: 0.18, render: 0.06 },
  byStage: { research: 0.08, 'script-gen': 0.15, tts: 0.18, thumbnail: 0.06 },
  services: [
    { service: 'gemini-3-pro', cost: 0.23, calls: 5 },
    { service: 'gemini-2.5-pro-tts', cost: 0.18, calls: 1 },
  ],
  videoCount: 1,
};

const mockMonthlyCosts = {
  month: '2026-01',
  total: 10.35,
  videoCount: 22,
  avgPerVideo: 0.47,
  dailyBreakdown: { '2026-01-21': 0.48, '2026-01-22': 0.47 },
  byCategory: { gemini: 5.1, tts: 4.0, render: 1.25 },
  budgetComparison: {
    target: 50,
    onTrack: true,
    projected: 14.1,
    daysRemaining: 9,
  },
};

const mockBudgetStatus = {
  initialCredit: 300,
  totalSpent: 14.5,
  remaining: 285.5,
  daysOfRunway: 607,
  projectedMonthly: 14.1,
  creditExpiration: '2026-04-08T00:00:00.000Z',
  isWithinBudget: true,
  isInCreditPeriod: true,
  startDate: '2026-01-08T00:00:00.000Z',
  lastUpdated: '2026-01-22T10:00:00.000Z',
};

const mockTrendData = {
  periodDays: 30,
  dataPoints: [],
  summary: {
    avgDaily: 0.47,
    minDaily: 0.45,
    maxDaily: 0.52,
    totalCost: 10.35,
    totalVideos: 22,
    trend: 'stable' as const,
    trendPercent: 2.1,
  },
};

const mockAlertCounts = {
  warningCount: 1,
  criticalCount: 0,
  lastAlert: '2026-01-20T10:00:00.000Z',
  lastAlertType: 'warning' as const,
};

describe('getCostDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCostsByDate.mockResolvedValue(mockTodayCosts);
    mockGetCostsThisMonth.mockResolvedValue(mockMonthlyCosts);
    mockGetBudgetStatus.mockResolvedValue(mockBudgetStatus);
    mockGetCostTrend.mockResolvedValue(mockTrendData);
    mockGetAlertCounts.mockResolvedValue(mockAlertCounts);
  });

  it('should return complete dashboard data', async () => {
    const dashboard = await getCostDashboardData();

    expect(dashboard.today).toEqual(mockTodayCosts);
    expect(dashboard.thisMonth).toEqual(mockMonthlyCosts);
    expect(dashboard.budget).toEqual(mockBudgetStatus);
    expect(dashboard.trend).toEqual(mockTrendData);
    expect(dashboard.alerts).toEqual(mockAlertCounts);
    expect(dashboard.generatedAt).toBeDefined();
  });

  it('should query all data in parallel', async () => {
    await getCostDashboardData();

    // All functions should be called
    expect(mockGetCostsByDate).toHaveBeenCalledWith('2026-01-22');
    expect(mockGetCostsThisMonth).toHaveBeenCalled();
    expect(mockGetBudgetStatus).toHaveBeenCalled();
    expect(mockGetCostTrend).toHaveBeenCalledWith(30);
    expect(mockGetAlertCounts).toHaveBeenCalled();
  });

  it('should include generation timestamp', async () => {
    const before = new Date().toISOString();
    const dashboard = await getCostDashboardData();
    const after = new Date().toISOString();

    expect(dashboard.generatedAt).toBeDefined();
    expect(dashboard.generatedAt >= before).toBe(true);
    expect(dashboard.generatedAt <= after).toBe(true);
  });

  it('should propagate errors from queries', async () => {
    mockGetCostsByDate.mockRejectedValue(new Error('Query failed'));

    await expect(getCostDashboardData()).rejects.toThrow();
  });
});

describe('getCostSummaryForDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCostsByDate.mockResolvedValue(mockTodayCosts);
    mockGetBudgetStatus.mockResolvedValue(mockBudgetStatus);
  });

  it('should return formatted cost summary', async () => {
    const summary = await getCostSummaryForDigest();

    expect(summary.todayCost).toBe('$0.47');
    expect(summary.budgetRemaining).toBe('$285.50');
    expect(summary.daysOfRunway).toBe(607);
    expect(summary.isOverBudget).toBe(false);
  });

  it('should mark as over budget when cost exceeds warning threshold', async () => {
    mockGetCostsByDate.mockResolvedValue({
      ...mockTodayCosts,
      total: 0.80, // Over warning threshold of $0.75
    });

    const summary = await getCostSummaryForDigest();

    expect(summary.isOverBudget).toBe(true);
  });

  it('should not mark as over budget when cost equals warning threshold', async () => {
    mockGetCostsByDate.mockResolvedValue({
      ...mockTodayCosts,
      total: COST_THRESHOLDS.WARNING, // Exactly at threshold
    });

    const summary = await getCostSummaryForDigest();

    expect(summary.isOverBudget).toBe(false); // Should not be over (>= vs >)
  });

  it('should format zero costs correctly', async () => {
    mockGetCostsByDate.mockResolvedValue({
      ...mockTodayCosts,
      total: 0,
    });

    const summary = await getCostSummaryForDigest();

    expect(summary.todayCost).toBe('$0.00');
    expect(summary.isOverBudget).toBe(false);
  });

  it('should query today and budget in parallel', async () => {
    await getCostSummaryForDigest();

    expect(mockGetCostsByDate).toHaveBeenCalledWith('2026-01-22');
    expect(mockGetBudgetStatus).toHaveBeenCalled();
    // Should NOT call trend or alerts (not needed for digest)
    expect(mockGetCostTrend).not.toHaveBeenCalled();
    expect(mockGetAlertCounts).not.toHaveBeenCalled();
  });

  it('should propagate errors', async () => {
    mockGetBudgetStatus.mockRejectedValue(new Error('Budget error'));

    await expect(getCostSummaryForDigest()).rejects.toThrow();
  });
});
