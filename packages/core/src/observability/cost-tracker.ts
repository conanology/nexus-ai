/**
 * Cost tracking for NEXUS-AI pipeline stages
 *
 * Provides per-stage and per-video cost tracking with:
 * - Recording API calls with service, tokens, and cost
 * - Aggregating costs by service
 * - Persisting costs to Firestore
 * - Retrieving video and daily cost summaries
 * - 4 decimal precision for micro-costs
 *
 * @module @nexus-ai/core/observability/cost-tracker
 *
 * @example
 * ```typescript
 * import { CostTracker } from '@nexus-ai/core/observability';
 *
 * // Create tracker for a stage
 * const tracker = new CostTracker('2026-01-08', 'script-gen');
 *
 * // Record API calls
 * tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.0023);
 * tracker.recordApiCall('chirp3-hd', {}, 0.0045);
 *
 * // Get aggregated summary
 * const summary = tracker.getSummary();
 *
 * // Persist to Firestore
 * await tracker.persist();
 *
 * // Retrieve video cost
 * const cost = await CostTracker.getVideoCost('2026-01-08');
 *
 * // Retrieve daily costs
 * const daily = await CostTracker.getDailyCosts('2026-01-08');
 * ```
 */

import { FirestoreClient } from '../storage/firestore-client.js';
import { NexusError } from '../errors/index.js';
import { createLogger } from './logger.js';
import type { Logger } from './logger.js';

/**
 * Service cost breakdown aggregated by service
 */
export interface ServiceCostBreakdown {
  /** Service name (e.g., "gemini-3-pro", "chirp3-hd") */
  service: string;
  /** Total cost for this service (4 decimal precision) */
  cost: number;
  /** Aggregated token counts (LLM only) */
  tokens: {
    /** Total input tokens */
    input?: number;
    /** Total output tokens */
    output?: number;
  };
  /** Number of API calls to this service */
  callCount: number;
}

/**
 * Stage cost summary returned by getSummary()
 */
export interface StageCostSummary {
  /** Stage name */
  stage: string;
  /** Total cost for this stage (4 decimal precision) */
  totalCost: number;
  /** Breakdown by service */
  breakdown: ServiceCostBreakdown[];
  /** ISO 8601 UTC timestamp */
  timestamp: string;
}

/**
 * Video costs stored in Firestore
 */
export interface VideoCosts {
  /** Gemini API costs (LLM + Image) */
  gemini: number;
  /** TTS synthesis costs */
  tts: number;
  /** Video rendering costs (GCP compute) */
  render: number;
  /** Total video cost */
  total: number;
  /** Per-stage breakdown (optional) */
  stages?: {
    [stageName: string]: {
      /** Total cost for stage */
      total: number;
      /** Breakdown by service */
      breakdown: ServiceCostBreakdown[];
    };
  };
}

/**
 * Daily cost summary returned by getDailyCosts()
 */
export interface DailyCostSummary {
  /** Date (YYYY-MM-DD) */
  date: string;
  /** Total cost for the day */
  totalCost: number;
  /** Breakdown by service category */
  breakdown: {
    /** Gemini API costs */
    gemini: number;
    /** TTS costs */
    tts: number;
    /** Render costs */
    render: number;
  };
  /** Per-stage breakdown */
  stages: {
    [stageName: string]: {
      total: number;
      breakdown: ServiceCostBreakdown[];
    };
  };
}

/**
 * Internal cost entry for a single API call
 */
interface CostEntry {
  /** Service name */
  service: string;
  /** Token counts (LLM only) */
  tokens: {
    input?: number;
    output?: number;
  };
  /** Cost in USD (4 decimal precision) */
  cost: number;
  /** ISO 8601 UTC timestamp */
  timestamp: string;
}

/**
 * Cost tracker for tracking API costs per stage
 *
 * Records API calls and aggregates costs for a specific stage.
 * Persists costs to Firestore at pipelines/{pipelineId}/costs.
 *
 * @example
 * ```typescript
 * const tracker = new CostTracker('2026-01-08', 'script-gen');
 * tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.0023);
 * const summary = tracker.getSummary();
 * await tracker.persist();
 * ```
 */
export class CostTracker {
  /** Pipeline ID (YYYY-MM-DD) */
  private readonly pipelineId: string;

  /** Stage name */
  private readonly stageName: string;

  /** Array of cost entries for this stage */
  private readonly entries: CostEntry[] = [];

  /** Structured logger instance */
  private readonly logger: Logger;

  /** Firestore client for persistence */
  private readonly firestoreClient: FirestoreClient;

  /**
   * Create a new CostTracker for a stage
   *
   * @param pipelineId - Pipeline ID (YYYY-MM-DD)
   * @param stageName - Stage name
   * @throws NexusError if pipelineId format is invalid
   */
  constructor(pipelineId: string, stageName: string) {
    // Validate pipelineId format (YYYY-MM-DD) and that it's a valid date
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(pipelineId)) {
      throw new NexusError(
        'NEXUS_VALIDATION_ERROR',
        `Invalid pipelineId format: "${pipelineId}". Expected YYYY-MM-DD format.`,
        'CRITICAL',
        'cost-tracker',
        false,
        { pipelineId, expectedFormat: 'YYYY-MM-DD' }
      );
    }

    // Validate it's a valid date (not just format)
    const date = new Date(pipelineId);
    if (isNaN(date.getTime()) || pipelineId !== date.toISOString().split('T')[0]) {
      throw new NexusError(
        'NEXUS_VALIDATION_ERROR',
        `Invalid pipelineId date: "${pipelineId}". Date is not valid.`,
        'CRITICAL',
        'cost-tracker',
        false,
        { pipelineId, expectedFormat: 'YYYY-MM-DD (valid date)' }
      );
    }

    this.pipelineId = pipelineId;
    this.stageName = stageName;
    this.logger = createLogger('observability.cost-tracker');
    this.firestoreClient = new FirestoreClient();
  }

  /**
   * Round cost to 4 decimal places
   *
   * @param cost - Cost in USD
   * @returns Cost rounded to 4 decimal places
   */
  private roundCost(cost: number): number {
    return Math.round(cost * 10000) / 10000;
  }

  /**
   * Categorize a service into gemini, tts, or render
   *
   * Uses exact string matching with known service patterns.
   * Unknown services return 'unknown' to avoid silent failures.
   *
   * @param serviceName - Service name (e.g., "gemini-3-pro", "chirp3-hd")
   * @returns Category: 'gemini', 'tts', 'render', or 'unknown'
   */
  private categorizeService(serviceName: string): 'gemini' | 'tts' | 'render' | 'unknown' {
    const lower = serviceName.toLowerCase();

    // Gemini services (LLM and image generation)
    if (lower.startsWith('gemini-')) {
      return 'gemini';
    }

    // TTS services
    if (lower.startsWith('chirp') || lower.startsWith('wavenet') || lower.includes('-tts')) {
      return 'tts';
    }

    // Render services
    if (lower.startsWith('render') || lower.includes('video-render')) {
      return 'render';
    }

    // Unknown service - log warning
    this.logger.warn(
      { service: serviceName, stage: this.stageName },
      'Unknown service category - cost not assigned to gemini/tts/render'
    );

    return 'unknown';
  }

  /**
   * Record an API call cost
   *
   * @param service - Service name (e.g., "gemini-3-pro", "chirp3-hd")
   * @param tokens - Token counts (LLM only, optional)
   * @param cost - Cost in USD
   *
   * @example
   * ```typescript
   * tracker.recordApiCall('gemini-3-pro', { input: 100, output: 50 }, 0.0023);
   * tracker.recordApiCall('chirp3-hd', {}, 0.0045);
   * ```
   */
  recordApiCall(
    service: string,
    tokens: { input?: number; output?: number },
    cost: number
  ): void {
    // Store exact cost - rounding happens during aggregation to avoid accumulation errors
    const entry: CostEntry = {
      service,
      tokens,
      cost,
      timestamp: new Date().toISOString(),
    };

    this.entries.push(entry);

    this.logger.debug(
      {
        pipelineId: this.pipelineId,
        stage: this.stageName,
        service,
        cost: this.roundCost(cost), // Round only for logging
        tokens,
      },
      'API cost recorded'
    );
  }

  /**
   * Get aggregated cost summary for this stage
   *
   * Aggregates all recorded API calls by service and returns
   * a summary with total cost, breakdown by service, and token counts.
   *
   * @returns Stage cost summary
   *
   * @example
   * ```typescript
   * const summary = tracker.getSummary();
   * console.log(summary.totalCost); // 0.0068
   * console.log(summary.breakdown); // [{ service: 'gemini-3-pro', cost: 0.0068, ... }]
   * ```
   */
  getSummary(): StageCostSummary {
    // Aggregate by service
    const serviceMap = new Map<string, ServiceCostBreakdown>();

    for (const entry of this.entries) {
      const existing = serviceMap.get(entry.service);

      if (existing) {
        // Update existing service entry
        existing.cost = this.roundCost(existing.cost + entry.cost);
        existing.callCount += 1;

        // Aggregate tokens if present
        if (entry.tokens.input !== undefined) {
          existing.tokens.input = (existing.tokens.input || 0) + entry.tokens.input;
        }
        if (entry.tokens.output !== undefined) {
          existing.tokens.output = (existing.tokens.output || 0) + entry.tokens.output;
        }
      } else {
        // Create new service entry
        serviceMap.set(entry.service, {
          service: entry.service,
          cost: entry.cost,
          tokens: { ...entry.tokens },
          callCount: 1,
        });
      }
    }

    // Calculate total cost
    const breakdown = Array.from(serviceMap.values());
    const totalCost = this.roundCost(
      breakdown.reduce((sum, b) => sum + b.cost, 0)
    );

    return {
      stage: this.stageName,
      totalCost,
      breakdown,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Persist costs to Firestore
   *
   * Merges stage costs into existing pipeline costs document.
   * Creates document if it doesn't exist.
   *
   * @throws NexusError on Firestore errors
   *
   * @example
   * ```typescript
   * await tracker.persist();
   * ```
   */
  async persist(): Promise<void> {
    try {
      // Get summary for this stage
      const summary = this.getSummary();

      // Load existing costs
      const existing = await this.firestoreClient.getPipelineCosts<VideoCosts>(
        this.pipelineId
      );

      // Initialize costs structure
      const costs: VideoCosts = existing || {
        gemini: 0,
        tts: 0,
        render: 0,
        total: 0,
        stages: {},
      };

      // Ensure stages object exists
      if (!costs.stages) {
        costs.stages = {};
      }

      // Add this stage's costs
      costs.stages[this.stageName] = {
        total: summary.totalCost,
        breakdown: summary.breakdown,
      };

      // Update service category totals
      // Map services to categories (gemini, tts, render)
      // Note: We need to recalculate ALL category totals from ALL stages to ensure accuracy
      let geminiCost = 0;
      let ttsCost = 0;
      let renderCost = 0;

      // Aggregate costs from all stages (including this one)
      for (const stageName in costs.stages) {
        const stageData = costs.stages[stageName];
        for (const serviceBreakdown of stageData.breakdown) {
          const category = this.categorizeService(serviceBreakdown.service);

          if (category === 'gemini') {
            geminiCost = this.roundCost(geminiCost + serviceBreakdown.cost);
          } else if (category === 'tts') {
            ttsCost = this.roundCost(ttsCost + serviceBreakdown.cost);
          } else if (category === 'render') {
            renderCost = this.roundCost(renderCost + serviceBreakdown.cost);
          }
          // If category is 'unknown', it's still counted in total but not in specific categories
        }
      }

      costs.gemini = geminiCost;
      costs.tts = ttsCost;
      costs.render = renderCost;
      costs.total = this.roundCost(geminiCost + ttsCost + renderCost);

      // Save to Firestore
      await this.firestoreClient.setPipelineCosts(this.pipelineId, costs);

      this.logger.info(
        {
          pipelineId: this.pipelineId,
          stage: this.stageName,
          totalCost: summary.totalCost,
        },
        'Costs persisted to Firestore'
      );
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'cost-tracker');
    }
  }

  /**
   * Get total video cost for a pipeline
   *
   * Static method to retrieve aggregated costs from Firestore.
   *
   * @param pipelineId - Pipeline ID (YYYY-MM-DD)
   * @returns Total video cost (0 if not found)
   * @throws NexusError on Firestore errors
   *
   * @example
   * ```typescript
   * const cost = await CostTracker.getVideoCost('2026-01-08');
   * console.log(cost); // 0.008
   * ```
   */
  static async getVideoCost(pipelineId: string): Promise<number> {
    try {
      const firestoreClient = new FirestoreClient();
      const costs = await firestoreClient.getPipelineCosts<VideoCosts>(pipelineId);

      return costs?.total || 0;
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'cost-tracker');
    }
  }

  /**
   * Get daily cost summary
   *
   * Static method to retrieve complete cost breakdown for a date.
   *
   * @param date - Date (YYYY-MM-DD)
   * @returns Daily cost summary (empty if not found)
   * @throws NexusError on Firestore errors
   *
   * @example
   * ```typescript
   * const summary = await CostTracker.getDailyCosts('2026-01-08');
   * console.log(summary.totalCost); // 0.008
   * console.log(summary.breakdown); // { gemini: 0.0023, tts: 0.0045, render: 0.0012 }
   * ```
   */
  static async getDailyCosts(date: string): Promise<DailyCostSummary> {
    try {
      const firestoreClient = new FirestoreClient();
      const costs = await firestoreClient.getPipelineCosts<VideoCosts>(date);

      if (!costs) {
        return {
          date,
          totalCost: 0,
          breakdown: {
            gemini: 0,
            tts: 0,
            render: 0,
          },
          stages: {},
        };
      }

      return {
        date,
        totalCost: costs.total,
        breakdown: {
          gemini: costs.gemini,
          tts: costs.tts,
          render: costs.render,
        },
        stages: costs.stages || {},
      };
    } catch (error) {
      if (error instanceof NexusError) {
        throw error;
      }
      throw NexusError.fromError(error, 'cost-tracker');
    }
  }
}
