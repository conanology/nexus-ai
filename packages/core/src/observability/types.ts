/**
 * Structured logging types for NEXUS-AI pipeline.
 *
 * @module observability/types
 */

/**
 * Base log context that can be attached to any log entry.
 * All fields are optional and added as structured data.
 */
export interface LogContext {
  /** Pipeline identifier in YYYY-MM-DD format */
  pipelineId?: string;
  /** Current pipeline stage name */
  stage?: string;
  /** Provider name used for the operation */
  provider?: string;
  /** Provider tier - primary or fallback */
  tier?: 'primary' | 'fallback';
  /** Operation duration in milliseconds */
  durationMs?: number;
  /** Cost of the operation in USD */
  cost?: number;
  /** Token count for LLM operations */
  tokens?: number;
  /** Number of retry attempts */
  attempts?: number;
  /** Allow additional custom fields */
  [key: string]: unknown;
}

/**
 * Required context for stage-level logging.
 * Extends LogContext with mandatory pipelineId and stage.
 */
export interface StageLogContext extends LogContext {
  /** Pipeline identifier - required for stage logs */
  pipelineId: string;
  /** Stage name - required for stage logs */
  stage: string;
}

/**
 * Event types for stage lifecycle logging.
 */
export type StageEvent = 'stage_start' | 'stage_complete' | 'stage_error';

/**
 * Event types for API call logging.
 */
export type ApiEvent = 'api_call' | 'api_error' | 'api_retry';

/**
 * Log levels supported by the logger.
 * Ordered from most verbose (trace) to least (fatal).
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log level numeric values for comparison.
 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};
