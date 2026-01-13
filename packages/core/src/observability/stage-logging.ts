/**
 * Stage lifecycle logging helpers for NEXUS-AI pipeline.
 *
 * Provides consistent logging patterns for stage start, completion, and errors.
 * All helpers automatically include required context fields.
 *
 * @module observability/stage-logging
 */

import type { Logger } from 'pino';
import type { StageInput, StageOutput } from '../types/pipeline.js';
import type { StageEvent, ApiEvent, LogContext } from './types.js';

/**
 * Logs the start of a pipeline stage.
 *
 * Captures:
 * - Pipeline ID
 * - Stage name
 * - Previous stage (for pipeline flow tracing)
 *
 * @param logger - Logger instance (should have pipelineId binding)
 * @param stageName - Name of the stage starting
 * @param input - Stage input containing pipeline context
 *
 * @example
 * ```typescript
 * const logger = createPipelineLogger('2026-01-08');
 * logStageStart(logger, 'tts', input);
 * // Output: { pipelineId: '2026-01-08', stage: 'tts', event: 'stage_start', ... }
 * ```
 */
export function logStageStart<T>(
  logger: Logger,
  stageName: string,
  input: StageInput<T>
): void {
  const context: LogContext & { event: StageEvent } = {
    pipelineId: input.pipelineId,
    stage: stageName,
    event: 'stage_start',
    previousStage: input.previousStage,
  };

  // Include quality context if degradation has occurred
  if (input.qualityContext?.degradedStages.length) {
    context.priorDegradation = input.qualityContext.degradedStages;
  }

  logger.info(context, `Stage ${stageName} started`);
}

/**
 * Logs the successful completion of a pipeline stage.
 *
 * Captures comprehensive metrics:
 * - Duration
 * - Provider info (name, tier, attempts)
 * - Cost
 * - Quality warnings
 *
 * @param logger - Logger instance
 * @param stageName - Name of the completed stage
 * @param output - Stage output containing metrics
 *
 * @example
 * ```typescript
 * logStageComplete(logger, 'tts', output);
 * // Output includes: stage, durationMs, provider, tier, attempts, cost, warnings
 * ```
 */
export function logStageComplete<T>(
  logger: Logger,
  stageName: string,
  output: StageOutput<T>
): void {
  const context: LogContext & { event: StageEvent } = {
    stage: stageName,
    event: 'stage_complete',
    success: output.success,
    durationMs: output.durationMs,
    provider: output.provider.name,
    tier: output.provider.tier,
    attempts: output.provider.attempts,
    cost: output.cost.cost,
  };

  // Include warnings if any
  if (output.warnings?.length) {
    context.warnings = output.warnings;
  }

  // Include artifact count if artifacts generated
  if (output.artifacts?.length) {
    context.artifactCount = output.artifacts.length;
  }

  logger.info(context, `Stage ${stageName} completed`);
}

/**
 * Logs a stage error with full context for debugging.
 *
 * Captures:
 * - Error name, message, and stack trace
 * - Stage name
 * - Additional context if provided
 *
 * @param logger - Logger instance
 * @param stageName - Name of the failed stage
 * @param error - The error that occurred
 * @param context - Optional additional context
 *
 * @example
 * ```typescript
 * try {
 *   await executeStage();
 * } catch (error) {
 *   logStageError(logger, 'tts', error, { provider: 'gemini-tts' });
 *   throw error;
 * }
 * ```
 */
export function logStageError(
  logger: Logger,
  stageName: string,
  error: Error,
  context?: Record<string, unknown>
): void {
  const logContext: LogContext & { event: StageEvent } = {
    stage: stageName,
    event: 'stage_error',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  };

  logger.error(logContext, `Stage ${stageName} failed: ${error.message}`);
}

/**
 * Logs an API call with performance and cost metrics.
 *
 * Use this for all external API calls to track:
 * - Service and operation names
 * - Duration
 * - Token usage (for LLM calls)
 * - Cost
 *
 * @param logger - Logger instance
 * @param service - Service name (e.g., 'gemini-tts', 'firestore')
 * @param operation - Operation name (e.g., 'synthesize', 'save')
 * @param durationMs - Call duration in milliseconds
 * @param context - Optional additional context (tokens, cost)
 *
 * @example
 * ```typescript
 * const startTime = Date.now();
 * const result = await geminiClient.synthesize(text);
 * logApiCall(logger, 'gemini-tts', 'synthesize', Date.now() - startTime, {
 *   tokens: result.tokens,
 *   cost: result.cost
 * });
 * ```
 */
export function logApiCall(
  logger: Logger,
  service: string,
  operation: string,
  durationMs: number,
  context?: { tokens?: number; cost?: number; [key: string]: unknown }
): void {
  const logContext: LogContext & { event: ApiEvent } = {
    event: 'api_call',
    service,
    operation,
    durationMs,
    ...context,
  };

  logger.debug(logContext, `API call to ${service}.${operation}`);
}

/**
 * Logs a retry attempt for debugging retry behavior.
 *
 * @param logger - Logger instance
 * @param stage - Stage name where retry occurred
 * @param attempt - Current attempt number
 * @param maxAttempts - Maximum number of attempts
 * @param delay - Delay before next retry in milliseconds
 * @param error - The error that triggered the retry
 */
export function logRetryAttempt(
  logger: Logger,
  stage: string,
  attempt: number,
  maxAttempts: number,
  delay: number,
  error: Error
): void {
  logger.debug(
    {
      stage,
      event: 'api_retry' as ApiEvent,
      attempt,
      maxAttempts,
      delayMs: delay,
      error: {
        name: error.name,
        message: error.message,
      },
    },
    `Retry attempt ${attempt}/${maxAttempts} for ${stage}`
  );
}

/**
 * Logs when a fallback provider is being used.
 *
 * @param logger - Logger instance
 * @param stage - Stage name
 * @param primaryProvider - Name of the failed primary provider
 * @param fallbackProvider - Name of the fallback being used
 * @param reason - Why fallback was needed
 */
export function logFallbackUsed(
  logger: Logger,
  stage: string,
  primaryProvider: string,
  fallbackProvider: string,
  reason: string
): void {
  logger.warn(
    {
      stage,
      event: 'fallback_used',
      primaryProvider,
      fallbackProvider,
      reason,
    },
    `Using fallback provider ${fallbackProvider} for ${stage}`
  );
}
