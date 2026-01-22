/**
 * Tests for cost query functions
 *
 * @module @nexus-ai/core/cost/__tests__/queries.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
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
} from '../queries.js';
import { BUDGET_TARGETS } from '../types.js';

// Mock FirestoreClient
vi.mock('../../storage/firestore-client.js', () => ({
  FirestoreClient: vi.fn().mockImplementation(() => ({
    getPipelineCosts: vi.fn(),
  })),
}));

// Mock logger
vi.mock('../../observability/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Import mocked modules for test control
import { FirestoreClient } from '../../storage/firestore-client.js';

const mockFirestoreClient = FirestoreClient as unknown as vi.Mock;

// Sample cost data matching VideoCosts structure
const mockCostData = {
  gemini: 0.23,
  tts: 0.18,
  render: 0.06,
  total: 0.47,
  stages: {
    research: {
      total: 0.08,
      breakdown: [
        { service: 'gemini-3-pro', cost: 0.08, callCount: 2, tokens: { input: 5000, output: 1000 } },
      ],
    },
    'script-gen': {
      total: 0.15,
      breakdown: [
        { service: 'gemini-3-pro', cost: 0.15, callCount: 3, tokens: { input: 10000, output: 2000 } },
      ],
    },
    tts: {
      total: 0.18,
      breakdown: [
        { service: 'gemini-2.5-pro-tts', cost: 0.18, callCount: 1, tokens: {} },
      ],
    },
    thumbnail: {
      total: 0.06,
      breakdown: [
        { service: 'gemini-3-pro-image', cost: 0.06, callCount: 3, tokens: {} },
      ],
    },
  },
};

describe('date utility functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-22T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getToday', () => {
    it('should return today in YYYY-MM-DD format', () => {
      expect(getToday()).toBe('2026-01-22');
    });
  });

  describe('getStartOfMonth', () => {
    it('should return first day of current month', () => {
      expect(getStartOfMonth()).toBe('2026-01-01');
    });
  });

  describe('getCurrentMonth', () => {
    it('should return current month in YYYY-MM format', () => {
      expect(getCurrentMonth()).toBe('2026-01');
    });
  });

  describe('getLastNDates', () => {
    it('should return array of last N dates (most recent first)', () => {
      const dates = getLastNDates(3);
      expect(dates).toEqual(['2026-01-22', '2026-01-21', '2026-01-20']);
    });

    it('should handle single day', () => {
      const dates = getLastNDates(1);
      expect(dates).toEqual(['2026-01-22']);
    });
  });

  describe('getDaysRemainingInMonth', () => {
    it('should return days remaining in current month', () => {
      const remaining = getDaysRemainingInMonth();
      expect(remaining).toBe(9); // Jan 22 -> Jan 31 = 9 days
    });
  });
});

describe('getCostsByDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCostCache();
  });

  it('should return cost breakdown for date with data', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(mockCostData),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostsByDate('2026-01-22');

    expect(result.date).toBe('2026-01-22');
    expect(result.total).toBe(0.47);
    expect(result.byCategory.gemini).toBe(0.23);
    expect(result.byCategory.tts).toBe(0.18);
    expect(result.byCategory.render).toBe(0.06);
    expect(result.videoCount).toBe(1);
    expect(Object.keys(result.byStage)).toContain('research');
    expect(result.services.length).toBeGreaterThan(0);
  });

  it('should return zero-cost breakdown for date without data', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(null),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostsByDate('2026-01-22');

    expect(result.date).toBe('2026-01-22');
    expect(result.total).toBe(0);
    expect(result.byCategory.gemini).toBe(0);
    expect(result.videoCount).toBe(0);
    expect(result.services).toEqual([]);
  });

  it('should cache results', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(mockCostData),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    // First call
    await getCostsByDate('2026-01-22');
    // Second call (should use cache)
    await getCostsByDate('2026-01-22');

    // Only one Firestore call should be made
    expect(mockInstance.getPipelineCosts).toHaveBeenCalledTimes(1);
  });

  it('should aggregate services from multiple stages', async () => {
    const dataWithDuplicateService = {
      ...mockCostData,
      stages: {
        research: {
          total: 0.08,
          breakdown: [
            { service: 'gemini-3-pro', cost: 0.08, callCount: 2, tokens: { input: 5000, output: 1000 } },
          ],
        },
        'script-gen': {
          total: 0.15,
          breakdown: [
            { service: 'gemini-3-pro', cost: 0.15, callCount: 3, tokens: { input: 10000, output: 2000 } },
          ],
        },
      },
    };

    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(dataWithDuplicateService),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostsByDate('2026-01-22');

    // Should aggregate gemini-3-pro from both stages
    const geminiService = result.services.find((s) => s.service === 'gemini-3-pro');
    expect(geminiService).toBeDefined();
    expect(geminiService!.cost).toBe(0.23); // 0.08 + 0.15
    expect(geminiService!.calls).toBe(5); // 2 + 3
    expect(geminiService!.tokens?.input).toBe(15000); // 5000 + 10000
    expect(geminiService!.tokens?.output).toBe(3000); // 1000 + 2000
  });
});

describe('getCostsByVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCostCache();
  });

  it('should return video cost breakdown with budget comparison', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(mockCostData),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostsByVideo('2026-01-22');

    expect(result.pipelineId).toBe('2026-01-22');
    expect(result.total).toBe(0.47);
    expect(result.budgetComparison.target).toBe(BUDGET_TARGETS.CREDIT_PERIOD_PER_VIDEO);
    expect(result.budgetComparison.withinTarget).toBe(true);
    expect(result.budgetComparison.percentOfTarget).toBe(94); // 0.47 / 0.5 * 100
    expect(result.stages.length).toBeGreaterThan(0);
  });

  it('should mark as over budget when exceeding target', async () => {
    const overBudgetData = { ...mockCostData, total: 0.65 };
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(overBudgetData),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostsByVideo('2026-01-22');

    expect(result.budgetComparison.withinTarget).toBe(false);
    expect(result.budgetComparison.percentOfTarget).toBe(130); // 0.65 / 0.5 * 100
  });

  it('should return zero-cost breakdown for missing video', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(null),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostsByVideo('2026-01-22');

    expect(result.total).toBe(0);
    expect(result.budgetComparison.withinTarget).toBe(true);
    expect(result.budgetComparison.percentOfTarget).toBe(0);
    expect(result.stages).toEqual([]);
  });

  it('should include detailed stage breakdown', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(mockCostData),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostsByVideo('2026-01-22');

    const researchStage = result.stages.find((s) => s.stage === 'research');
    expect(researchStage).toBeDefined();
    expect(researchStage!.cost).toBe(0.08);
    expect(researchStage!.services[0].service).toBe('gemini-3-pro');
    expect(researchStage!.services[0].tokens?.input).toBe(5000);
  });
});

describe('getCostsThisMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCostCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-22T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should aggregate costs for month to date', async () => {
    // Return mock data for any date query
    const mockInstance = {
      getPipelineCosts: vi.fn().mockImplementation((date: string) => {
        // Return data for some days, null for others
        if (date === '2026-01-20' || date === '2026-01-21' || date === '2026-01-22') {
          return Promise.resolve(mockCostData);
        }
        return Promise.resolve(null);
      }),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostsThisMonth();

    expect(result.month).toBe('2026-01');
    expect(result.videoCount).toBe(3); // 3 days with data
    expect(result.total).toBe(1.41); // 0.47 * 3
    expect(result.avgPerVideo).toBe(0.47);
    expect(result.budgetComparison.target).toBe(BUDGET_TARGETS.MONTHLY_TARGET);
    expect(result.budgetComparison.daysRemaining).toBe(9);
  });

  it('should project month-end cost', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockImplementation((date: string) => {
        // Simulate 22 days with ~$0.47/day
        if (date <= '2026-01-22' && date >= '2026-01-01') {
          return Promise.resolve(mockCostData);
        }
        return Promise.resolve(null);
      }),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostsThisMonth();

    // 22 days * $0.47 = $10.34, avg = $0.47/day
    // Projected = $10.34 + (9 days * $0.47) = ~$14.57
    expect(result.budgetComparison.projected).toBeGreaterThan(result.total);
    expect(result.budgetComparison.onTrack).toBe(true); // Under $50
  });

  it('should handle empty month', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(null),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostsThisMonth();

    expect(result.total).toBe(0);
    expect(result.videoCount).toBe(0);
    expect(result.avgPerVideo).toBe(0);
    expect(result.budgetComparison.onTrack).toBe(true);
  });
});

describe('getCostTrend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCostCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-22T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return trend data for specified period', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(mockCostData),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostTrend(7);

    expect(result.periodDays).toBe(7);
    expect(result.dataPoints.length).toBe(7);
    expect(result.dataPoints[0].date).toBe('2026-01-22'); // Most recent first
    expect(result.summary.avgDaily).toBe(0.47);
    expect(result.summary.totalCost).toBe(3.29); // 0.47 * 7
    expect(result.summary.totalVideos).toBe(7);
  });

  it('should calculate change from previous day', async () => {
    let callCount = 0;
    const mockInstance = {
      getPipelineCosts: vi.fn().mockImplementation(() => {
        callCount++;
        // Increasing costs over time
        const cost = 0.45 + (callCount - 1) * 0.01;
        return Promise.resolve({
          ...mockCostData,
          total: cost,
        });
      }),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostTrend(3);

    // Check that changes are calculated
    const lastDay = result.dataPoints[0];
    const previousDay = result.dataPoints[1];

    expect(lastDay.changeFromPrevious).not.toBe(0);
    expect(typeof lastDay.percentChange).toBe('number');
  });

  it('should identify increasing trend', async () => {
    // Dates are queried most recent first: 2026-01-22, 2026-01-21, etc.
    // Then reversed to oldest first for calculation
    // So older dates should have lower costs
    const costByDate: Record<string, number> = {
      '2026-01-18': 0.30,
      '2026-01-19': 0.35,
      '2026-01-20': 0.40,
      '2026-01-21': 0.45,
      '2026-01-22': 0.55, // Significant increase
    };

    const mockInstance = {
      getPipelineCosts: vi.fn().mockImplementation((date: string) => {
        const cost = costByDate[date] || 0.40;
        return Promise.resolve({
          ...mockCostData,
          total: cost,
        });
      }),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostTrend(5);

    expect(result.summary.trend).toBe('increasing');
    expect(result.summary.trendPercent).toBeGreaterThan(5);
  });

  it('should identify stable trend', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(mockCostData),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostTrend(7);

    expect(result.summary.trend).toBe('stable');
  });

  it('should handle period with no cost data', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(null),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostTrend(7);

    expect(result.summary.avgDaily).toBe(0);
    expect(result.summary.totalCost).toBe(0);
    expect(result.summary.minDaily).toBe(0);
    expect(result.summary.maxDaily).toBe(0);
    expect(result.summary.trend).toBe('stable');
  });

  it('should clamp days to valid range', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(mockCostData),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    // Request 1000 days, should be clamped to 365
    const result = await getCostTrend(1000);
    expect(result.periodDays).toBe(365);
  });

  it('should default to 7 days', async () => {
    const mockInstance = {
      getPipelineCosts: vi.fn().mockResolvedValue(mockCostData),
    };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    const result = await getCostTrend();
    expect(result.periodDays).toBe(7);
  });
});

describe('clearCostCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCostCache();
  });

  it('should clear cached data', async () => {
    // Create a single mock instance that persists
    const getPipelineCostsMock = vi.fn().mockResolvedValue(mockCostData);
    const mockInstance = { getPipelineCosts: getPipelineCostsMock };
    mockFirestoreClient.mockImplementation(() => mockInstance);

    // First call - should hit Firestore
    await getCostsByDate('2026-01-23');
    expect(getPipelineCostsMock).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    await getCostsByDate('2026-01-23');
    expect(getPipelineCostsMock).toHaveBeenCalledTimes(1);

    // Clear cache
    clearCostCache();

    // Third call - should hit Firestore again since cache is cleared
    await getCostsByDate('2026-01-23');
    expect(getPipelineCostsMock).toHaveBeenCalledTimes(2);
  });
});
