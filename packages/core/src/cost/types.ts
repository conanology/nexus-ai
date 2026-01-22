/**
 * Cost Dashboard Types and Interfaces
 *
 * Provides type definitions for cost queries, budget tracking,
 * and dashboard data aggregation.
 *
 * @module @nexus-ai/core/cost/types
 */

/**
 * Cost threshold constants for alerts
 */
export const COST_THRESHOLDS = {
  /** Warning threshold - $0.75 per video */
  WARNING: 0.75,
  /** Critical threshold - $1.00 per video */
  CRITICAL: 1.0,
} as const;

/**
 * Budget targets based on NFRs
 */
export const BUDGET_TARGETS = {
  /** Cost per video during GCP credit period (NFR10) */
  CREDIT_PERIOD_PER_VIDEO: 0.5,
  /** Cost per video post-credit period (NFR11) */
  POST_CREDIT_PER_VIDEO: 1.5,
  /** Monthly operating cost target (NFR12) */
  MONTHLY_TARGET: 50,
  /** Default GCP credit amount */
  DEFAULT_CREDIT: 300,
  /** GCP credit expiration days */
  CREDIT_EXPIRATION_DAYS: 90,
} as const;

/**
 * Service cost breakdown for a specific service
 */
export interface ServiceCostDetail {
  /** Service name (e.g., "gemini-3-pro", "chirp3-hd") */
  service: string;
  /** Total cost for this service (4 decimal precision) */
  cost: number;
  /** Number of API calls to this service */
  calls: number;
  /** Token counts (LLM services only) */
  tokens?: {
    /** Total input tokens */
    input?: number;
    /** Total output tokens */
    output?: number;
  };
}

/**
 * Stage cost breakdown
 */
export interface StageCostDetail {
  /** Stage name */
  stage: string;
  /** Total cost for this stage */
  cost: number;
  /** Breakdown by service within this stage */
  services: ServiceCostDetail[];
}

/**
 * Daily cost breakdown returned by getCostsByDate()
 */
export interface DailyCostBreakdown {
  /** Date (YYYY-MM-DD) */
  date: string;
  /** Total cost for the day (4 decimal precision) */
  total: number;
  /** Breakdown by service category */
  byCategory: {
    /** Gemini API costs (LLM + Image) */
    gemini: number;
    /** TTS synthesis costs */
    tts: number;
    /** Video rendering costs */
    render: number;
  };
  /** Breakdown by stage */
  byStage: Record<string, number>;
  /** Detailed service breakdown */
  services: ServiceCostDetail[];
  /** Number of videos produced */
  videoCount: number;
}

/**
 * Per-video cost breakdown returned by getCostsByVideo()
 */
export interface VideoCostBreakdown {
  /** Pipeline ID (YYYY-MM-DD) */
  pipelineId: string;
  /** Total cost for this video (4 decimal precision) */
  total: number;
  /** Breakdown by service category */
  byCategory: {
    /** Gemini API costs */
    gemini: number;
    /** TTS costs */
    tts: number;
    /** Render costs */
    render: number;
  };
  /** Breakdown by stage */
  stages: StageCostDetail[];
  /** Budget comparison */
  budgetComparison: {
    /** Target cost per video (based on credit period) */
    target: number;
    /** Whether cost is within target */
    withinTarget: boolean;
    /** Percentage of target used */
    percentOfTarget: number;
  };
  /** Timestamp of cost record */
  timestamp: string;
}

/**
 * Monthly cost summary returned by getCostsThisMonth()
 */
export interface MonthlyCostSummary {
  /** Month (YYYY-MM) */
  month: string;
  /** Total cost for the month (4 decimal precision) */
  total: number;
  /** Number of videos produced */
  videoCount: number;
  /** Average cost per video */
  avgPerVideo: number;
  /** Daily cost breakdown */
  dailyBreakdown: Record<string, number>;
  /** Breakdown by service category */
  byCategory: {
    gemini: number;
    tts: number;
    render: number;
  };
  /** Budget comparison */
  budgetComparison: {
    /** Monthly target ($50) */
    target: number;
    /** Whether on track for target */
    onTrack: boolean;
    /** Projected month-end total */
    projected: number;
    /** Days remaining in month */
    daysRemaining: number;
  };
}

/**
 * Cost trend data point for historical analysis
 */
export interface CostTrendDataPoint {
  /** Date (YYYY-MM-DD) */
  date: string;
  /** Total cost for the day */
  total: number;
  /** Average cost per video (same as total for single video per day) */
  avgPerVideo: number;
  /** Change from previous day */
  changeFromPrevious: number;
  /** Percentage change from previous day */
  percentChange: number;
}

/**
 * Cost trend data returned by getCostTrend()
 */
export interface CostTrendData {
  /** Trend period in days */
  periodDays: number;
  /** Array of daily data points */
  dataPoints: CostTrendDataPoint[];
  /** Summary statistics */
  summary: {
    /** Average daily cost */
    avgDaily: number;
    /** Minimum daily cost */
    minDaily: number;
    /** Maximum daily cost */
    maxDaily: number;
    /** Total cost over period */
    totalCost: number;
    /** Total videos over period */
    totalVideos: number;
    /** Trend direction (increasing, decreasing, stable) */
    trend: 'increasing' | 'decreasing' | 'stable';
    /** Trend percentage change from first to last day */
    trendPercent: number;
  };
}

/**
 * Budget status returned by getBudgetStatus()
 */
export interface BudgetStatus {
  /** Initial GCP credit amount ($300) */
  initialCredit: number;
  /** Total amount spent since start */
  totalSpent: number;
  /** Remaining credit */
  remaining: number;
  /** Number of days of runway remaining */
  daysOfRunway: number;
  /** Projected monthly cost based on average */
  projectedMonthly: number;
  /** Credit expiration date (ISO 8601) */
  creditExpiration: string;
  /** Whether currently within budget */
  isWithinBudget: boolean;
  /** Whether in credit period (before expiration) */
  isInCreditPeriod: boolean;
  /** Budget start date (ISO 8601) */
  startDate: string;
  /** Last updated timestamp (ISO 8601) */
  lastUpdated: string;
}

/**
 * Budget document stored in Firestore at budget/current
 */
export interface BudgetDocument {
  /** Initial GCP credit amount */
  initialCredit: number;
  /** Total amount spent */
  totalSpent: number;
  /** Remaining credit */
  remaining: number;
  /** Budget tracking start date (ISO 8601) */
  startDate: string;
  /** Last updated timestamp (ISO 8601) */
  lastUpdated: string;
  /** Credit expiration date (ISO 8601) */
  creditExpiration: string;
}

/**
 * Monthly budget history stored in Firestore at budget/history/{YYYY-MM}
 */
export interface MonthlyBudgetHistory {
  /** Month (YYYY-MM) */
  month: string;
  /** Total spent this month */
  monthlySpent: number;
  /** Number of videos produced */
  videoCount: number;
  /** Average cost per video */
  avgCostPerVideo: number;
  /** Daily breakdown */
  days: Record<string, number>;
}

/**
 * Alert counts for dashboard
 */
export interface AlertCounts {
  /** Number of warning alerts this month */
  warningCount: number;
  /** Number of critical alerts this month */
  criticalCount: number;
  /** Timestamp of last alert (ISO 8601) */
  lastAlert?: string;
  /** Last alert type */
  lastAlertType?: 'warning' | 'critical';
}

/**
 * Complete cost dashboard data returned by getCostDashboardData()
 */
export interface CostDashboardData {
  /** Today's cost breakdown */
  today: DailyCostBreakdown;
  /** Month-to-date summary */
  thisMonth: MonthlyCostSummary;
  /** Current budget status */
  budget: BudgetStatus;
  /** Cost trend for last 30 days */
  trend: CostTrendData;
  /** Alert counts */
  alerts: AlertCounts;
  /** Dashboard generation timestamp */
  generatedAt: string;
}

/**
 * Cost summary for daily digest email
 * Compatible with @nexus-ai/notifications DigestHealthData
 */
export interface DigestCostSection {
  /** Today's total cost formatted (e.g., "$0.47") */
  todayCost: string;
  /** Budget remaining formatted (e.g., "$285.50") */
  budgetRemaining: string;
  /** Days of runway remaining */
  daysOfRunway: number;
  /** Whether today's cost exceeded warning threshold */
  isOverBudget: boolean;
}

/**
 * Cost alert payload for notifications
 */
export interface CostAlertPayload {
  /** Alert severity level */
  severity: 'WARNING' | 'CRITICAL';
  /** Pipeline ID that triggered the alert */
  pipelineId: string;
  /** Total video cost */
  videoCost: number;
  /** Cost breakdown by category */
  breakdown: {
    gemini: number;
    tts: number;
    render: number;
  };
  /** Threshold that was exceeded */
  threshold: number;
  /** Current budget status */
  budgetRemaining: number;
  /** Timestamp of alert (ISO 8601) */
  timestamp: string;
}
