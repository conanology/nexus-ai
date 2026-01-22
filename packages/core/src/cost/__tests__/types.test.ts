/**
 * Tests for cost dashboard types
 *
 * @module @nexus-ai/core/cost/__tests__/types.test
 */

import { describe, it, expect } from 'vitest';
import {
  COST_THRESHOLDS,
  BUDGET_TARGETS,
  type DailyCostBreakdown,
  type VideoCostBreakdown,
  type MonthlyCostSummary,
  type CostTrendData,
  type BudgetStatus,
  type CostDashboardData,
  type DigestCostSection,
  type CostAlertPayload,
} from '../types.js';

describe('COST_THRESHOLDS', () => {
  it('should have correct warning threshold', () => {
    expect(COST_THRESHOLDS.WARNING).toBe(0.75);
  });

  it('should have correct critical threshold', () => {
    expect(COST_THRESHOLDS.CRITICAL).toBe(1.0);
  });

  it('should have warning lower than critical', () => {
    expect(COST_THRESHOLDS.WARNING).toBeLessThan(COST_THRESHOLDS.CRITICAL);
  });
});

describe('BUDGET_TARGETS', () => {
  it('should have correct credit period per-video target', () => {
    expect(BUDGET_TARGETS.CREDIT_PERIOD_PER_VIDEO).toBe(0.5);
  });

  it('should have correct post-credit per-video target', () => {
    expect(BUDGET_TARGETS.POST_CREDIT_PER_VIDEO).toBe(1.5);
  });

  it('should have correct monthly target', () => {
    expect(BUDGET_TARGETS.MONTHLY_TARGET).toBe(50);
  });

  it('should have correct default credit', () => {
    expect(BUDGET_TARGETS.DEFAULT_CREDIT).toBe(300);
  });

  it('should have correct credit expiration days', () => {
    expect(BUDGET_TARGETS.CREDIT_EXPIRATION_DAYS).toBe(90);
  });
});

describe('DailyCostBreakdown type', () => {
  it('should accept valid daily cost breakdown', () => {
    const breakdown: DailyCostBreakdown = {
      date: '2026-01-22',
      total: 0.47,
      byCategory: {
        gemini: 0.23,
        tts: 0.18,
        render: 0.06,
      },
      byStage: {
        research: 0.08,
        'script-gen': 0.15,
        tts: 0.18,
        thumbnail: 0.06,
      },
      services: [
        { service: 'gemini-3-pro', cost: 0.23, calls: 5, tokens: { input: 15000, output: 3000 } },
        { service: 'gemini-2.5-pro-tts', cost: 0.18, calls: 1 },
      ],
      videoCount: 1,
    };

    expect(breakdown.date).toBe('2026-01-22');
    expect(breakdown.total).toBe(0.47);
    expect(breakdown.videoCount).toBe(1);
  });
});

describe('VideoCostBreakdown type', () => {
  it('should accept valid video cost breakdown', () => {
    const breakdown: VideoCostBreakdown = {
      pipelineId: '2026-01-22',
      total: 0.47,
      byCategory: {
        gemini: 0.23,
        tts: 0.18,
        render: 0.06,
      },
      stages: [
        {
          stage: 'research',
          cost: 0.08,
          services: [{ service: 'gemini-3-pro', cost: 0.08, calls: 2, tokens: { input: 5000, output: 1000 } }],
        },
      ],
      budgetComparison: {
        target: 0.5,
        withinTarget: true,
        percentOfTarget: 94,
      },
      timestamp: '2026-01-22T10:00:00.000Z',
    };

    expect(breakdown.pipelineId).toBe('2026-01-22');
    expect(breakdown.budgetComparison.withinTarget).toBe(true);
  });
});

describe('MonthlyCostSummary type', () => {
  it('should accept valid monthly cost summary', () => {
    const summary: MonthlyCostSummary = {
      month: '2026-01',
      total: 10.35,
      videoCount: 22,
      avgPerVideo: 0.47,
      dailyBreakdown: {
        '2026-01-01': 0.45,
        '2026-01-02': 0.48,
      },
      byCategory: {
        gemini: 5.1,
        tts: 4.0,
        render: 1.25,
      },
      budgetComparison: {
        target: 50,
        onTrack: true,
        projected: 14.1,
        daysRemaining: 9,
      },
    };

    expect(summary.month).toBe('2026-01');
    expect(summary.budgetComparison.onTrack).toBe(true);
  });
});

describe('CostTrendData type', () => {
  it('should accept valid cost trend data', () => {
    const trend: CostTrendData = {
      periodDays: 7,
      dataPoints: [
        { date: '2026-01-15', total: 0.45, avgPerVideo: 0.45, changeFromPrevious: 0, percentChange: 0 },
        { date: '2026-01-16', total: 0.48, avgPerVideo: 0.48, changeFromPrevious: 0.03, percentChange: 6.67 },
      ],
      summary: {
        avgDaily: 0.465,
        minDaily: 0.45,
        maxDaily: 0.48,
        totalCost: 0.93,
        totalVideos: 2,
        trend: 'increasing',
        trendPercent: 6.67,
      },
    };

    expect(trend.periodDays).toBe(7);
    expect(trend.summary.trend).toBe('increasing');
  });
});

describe('BudgetStatus type', () => {
  it('should accept valid budget status', () => {
    const status: BudgetStatus = {
      initialCredit: 300,
      totalSpent: 14.5,
      remaining: 285.5,
      daysOfRunway: 612,
      projectedMonthly: 14.1,
      creditExpiration: '2026-04-07T00:00:00.000Z',
      isWithinBudget: true,
      isInCreditPeriod: true,
      startDate: '2026-01-08T00:00:00.000Z',
      lastUpdated: '2026-01-22T10:00:00.000Z',
    };

    expect(status.initialCredit).toBe(300);
    expect(status.isWithinBudget).toBe(true);
    expect(status.isInCreditPeriod).toBe(true);
  });
});

describe('CostDashboardData type', () => {
  it('should accept valid dashboard data', () => {
    const dashboard: CostDashboardData = {
      today: {
        date: '2026-01-22',
        total: 0.47,
        byCategory: { gemini: 0.23, tts: 0.18, render: 0.06 },
        byStage: {},
        services: [],
        videoCount: 1,
      },
      thisMonth: {
        month: '2026-01',
        total: 10.35,
        videoCount: 22,
        avgPerVideo: 0.47,
        dailyBreakdown: {},
        byCategory: { gemini: 5.1, tts: 4.0, render: 1.25 },
        budgetComparison: { target: 50, onTrack: true, projected: 14.1, daysRemaining: 9 },
      },
      budget: {
        initialCredit: 300,
        totalSpent: 14.5,
        remaining: 285.5,
        daysOfRunway: 612,
        projectedMonthly: 14.1,
        creditExpiration: '2026-04-07T00:00:00.000Z',
        isWithinBudget: true,
        isInCreditPeriod: true,
        startDate: '2026-01-08T00:00:00.000Z',
        lastUpdated: '2026-01-22T10:00:00.000Z',
      },
      trend: {
        periodDays: 30,
        dataPoints: [],
        summary: {
          avgDaily: 0.47,
          minDaily: 0.45,
          maxDaily: 0.52,
          totalCost: 10.35,
          totalVideos: 22,
          trend: 'stable',
          trendPercent: 2.1,
        },
      },
      alerts: {
        warningCount: 0,
        criticalCount: 0,
      },
      generatedAt: '2026-01-22T10:00:00.000Z',
    };

    expect(dashboard.today.date).toBe('2026-01-22');
    expect(dashboard.budget.isWithinBudget).toBe(true);
    expect(dashboard.alerts.warningCount).toBe(0);
  });
});

describe('DigestCostSection type', () => {
  it('should accept valid digest cost section', () => {
    const section: DigestCostSection = {
      todayCost: '$0.47',
      budgetRemaining: '$285.50',
      daysOfRunway: 612,
      isOverBudget: false,
    };

    expect(section.todayCost).toBe('$0.47');
    expect(section.isOverBudget).toBe(false);
  });
});

describe('CostAlertPayload type', () => {
  it('should accept valid warning alert payload', () => {
    const alert: CostAlertPayload = {
      severity: 'WARNING',
      pipelineId: '2026-01-22',
      videoCost: 0.78,
      breakdown: { gemini: 0.35, tts: 0.28, render: 0.15 },
      threshold: 0.75,
      budgetRemaining: 285.5,
      timestamp: '2026-01-22T10:00:00.000Z',
    };

    expect(alert.severity).toBe('WARNING');
    expect(alert.videoCost).toBeGreaterThan(alert.threshold);
  });

  it('should accept valid critical alert payload', () => {
    const alert: CostAlertPayload = {
      severity: 'CRITICAL',
      pipelineId: '2026-01-22',
      videoCost: 1.05,
      breakdown: { gemini: 0.45, tts: 0.38, render: 0.22 },
      threshold: 1.0,
      budgetRemaining: 285.5,
      timestamp: '2026-01-22T10:00:00.000Z',
    };

    expect(alert.severity).toBe('CRITICAL');
    expect(alert.videoCost).toBeGreaterThan(alert.threshold);
  });
});
