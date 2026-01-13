/**
 * Structured logging module for NEXUS-AI pipeline.
 *
 * Provides:
 * - Base Pino logger with NEXUS configuration
 * - Factory functions for named and pipeline-scoped loggers
 * - Stage lifecycle logging helpers
 * - Type definitions for log context
 *
 * @module observability
 *
 * @example
 * ```typescript
 * import {
 *   logger,
 *   createLogger,
 *   createPipelineLogger,
 *   logStageStart,
 *   logStageComplete
 * } from '@nexus-ai/core/observability';
 *
 * // Create a module-scoped logger
 * const log = createLogger('tts.gemini');
 *
 * // Create a pipeline-scoped logger
 * const pipelineLog = createPipelineLogger('2026-01-08', 'tts');
 *
 * // Log stage lifecycle
 * logStageStart(pipelineLog, 'tts', input);
 * // ... stage execution ...
 * logStageComplete(pipelineLog, 'tts', output);
 * ```
 */

// Base logger and factory functions
export {
  logger,
  createLogger,
  createPipelineLogger,
  withContext,
  type Logger,
} from './logger.js';

// Stage lifecycle logging helpers
export {
  logStageStart,
  logStageComplete,
  logStageError,
  logApiCall,
  logRetryAttempt,
  logFallbackUsed,
} from './stage-logging.js';

// Type definitions
export type {
  LogContext,
  StageLogContext,
  StageEvent,
  ApiEvent,
  LogLevel,
} from './types.js';

export { LOG_LEVEL_VALUES } from './types.js';
