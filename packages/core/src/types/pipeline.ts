/**
 * Core pipeline types for NEXUS-AI
 * Defines standardized contracts for stage input/output and pipeline state
 */

import type { CostBreakdown } from './providers.js';
import type { QualityMetrics } from './quality.js';
import { ErrorSeverity } from './errors.js';

/**
 * Configuration for a pipeline stage
 */
export interface StageConfig {
  /** Stage timeout in milliseconds */
  timeout: number;
  /** Number of retry attempts (default: 3) */
  retries: number;
  /** Maximum concurrency for parallelizable stages */
  maxConcurrency?: number;
  /** Stage-specific options */
  [key: string]: unknown;
}

/**
 * Reference to an artifact stored in GCS
 */
export interface ArtifactRef {
  /** Type of artifact */
  type: 'audio' | 'video' | 'image' | 'json' | 'text';
  /** GCS path (e.g., gs://nexus-ai-artifacts/...) */
  url: string;
  /** File size in bytes */
  size: number;
  /** MIME type (e.g., "audio/wav", "video/mp4") */
  contentType: string;
  /** ISO 8601 UTC timestamp when generated */
  generatedAt: string;
  /** Stage that generated the artifact */
  stage: string;
}

/**
 * Quality context tracking degradation through the pipeline
 */
export interface QualityContext {
  /** Stages that experienced quality degradation */
  degradedStages: string[];
  /** Fallback providers that were used (format: "stage:provider") */
  fallbacksUsed: string[];
  /** Quality flags from prior stages */
  flags: string[];
}

/**
 * Standard input for all pipeline stages
 * @template T - Stage-specific input data type
 */
export interface StageInput<T> {
  /** Pipeline ID in YYYY-MM-DD format (e.g., "2026-01-08") */
  pipelineId: string;
  /** Name of the previous stage (null if first stage) */
  previousStage: string | null;
  /** Stage-specific input data */
  data: T;
  /** Stage execution configuration */
  config: StageConfig;
  /** Optional quality context from previous stages */
  qualityContext?: QualityContext;
}

/**
 * Provider execution information
 */
export interface ProviderInfo {
  /** Provider name (e.g., "gemini-3-pro-preview") */
  name: string;
  /** Provider tier used */
  tier: 'primary' | 'fallback';
  /** Number of retry attempts made */
  attempts: number;
}

/**
 * Standard output for all pipeline stages
 * @template T - Stage-specific output data type
 */
export interface StageOutput<T> {
  /** Whether the stage executed successfully */
  success: boolean;
  /** Stage-specific output data */
  data: T;
  /** References to artifacts generated (GCS paths) */
  artifacts?: ArtifactRef[];
  /** Quality metrics from quality gate */
  quality: QualityMetrics;
  /** Cost breakdown from CostTracker */
  cost: CostBreakdown;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Provider execution information */
  provider: ProviderInfo;
  /** Non-fatal quality issues */
  warnings?: string[];
}

/**
 * Pipeline execution state (stored in Firestore)
 */
export interface PipelineState {
  /** Pipeline ID in YYYY-MM-DD format */
  pipelineId: string;
  /** Current stage name */
  stage: string;
  /** Pipeline status */
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  /** ISO 8601 UTC start time */
  startTime: string;
  /** ISO 8601 UTC end time (when complete) */
  endTime?: string;
  /** Selected topic title */
  topic?: string;
  /** Error history */
  errors: Array<{
    code: string;
    message: string;
    stage: string;
    timestamp: string;
    severity: ErrorSeverity;
  }>;
  /** Accumulated quality issues */
  qualityContext?: QualityContext;
}
