/**
 * Structured logger for NEXUS-AI pipeline using Pino.
 *
 * Features:
 * - ISO 8601 timestamps
 * - JSON output in production, pretty printing in development
 * - Child loggers for pipeline/stage context inheritance
 * - Configurable log levels via NEXUS_LOG_LEVEL env var
 *
 * @module observability/logger
 */

import pino from 'pino';
import type { LogContext } from './types';

/**
 * Determines if running in development mode.
 * Development mode enables pretty printing.
 * Any environment that is NOT production is considered development.
 */
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Determines if running in test mode.
 * Test mode uses 'silent' level to avoid noisy test output.
 */
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

/**
 * Get configured log level from environment.
 * Priority: NEXUS_LOG_LEVEL > test mode silent > 'info' default.
 * In test mode, defaults to 'silent' to avoid noisy test output,
 * but can be overridden by setting NEXUS_LOG_LEVEL for debugging.
 */
const level = process.env.NEXUS_LOG_LEVEL || (isTest ? 'silent' : 'info');

/**
 * Pino transport configuration for development.
 * Uses pino-pretty for colorized, human-readable output.
 */
const devTransport: pino.TransportSingleOptions = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
  },
};

/**
 * Base logger instance configured with NEXUS-AI defaults.
 *
 * Configuration:
 * - ISO 8601 timestamps
 * - Level labels in output
 * - Pretty printing in development
 * - JSON in production
 * - Silent in test mode (unless NEXUS_LOG_LEVEL is set)
 *
 * Note: The base logger has no `name` binding. Use `createLogger(name)` to
 * create module-scoped loggers with proper naming (e.g., `nexus.tts.gemini`).
 *
 * @example
 * ```typescript
 * import { createLogger } from '@nexus-ai/core/observability';
 *
 * const logger = createLogger('tts.gemini');
 * logger.info('Synthesis started');
 * logger.debug({ text: 'hello' }, 'Processing text');
 * ```
 */
export const logger = pino({
  level,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Note: No `base` name binding here to avoid duplicate `name` fields
  // when child loggers set their own name via createLogger().
  // Use createLogger(name) for properly named loggers.
  base: {},
  transport: isDev && !isTest ? devTransport : undefined,
});

/**
 * Creates a named logger that follows NEXUS naming conventions.
 *
 * Logger names follow the pattern: `nexus.{package}.{module}`
 *
 * @param name - Module name to append (e.g., 'tts.gemini', 'storage.firestore')
 * @returns A child logger with the specified name binding
 *
 * @example
 * ```typescript
 * // In packages/core/src/storage/firestore-client.ts
 * const logger = createLogger('storage.firestore');
 *
 * logger.info('Document saved');
 * // Output: { name: 'nexus.storage.firestore', msg: 'Document saved', ... }
 * ```
 */
export function createLogger(name: string): pino.Logger {
  return logger.child({ name: `nexus.${name}` });
}

/**
 * Creates a logger with pipeline context for stage operations.
 *
 * Pipeline loggers automatically include pipelineId and optionally stage
 * in all log entries, reducing boilerplate in stage implementations.
 *
 * @param pipelineId - Pipeline identifier (YYYY-MM-DD format)
 * @param stage - Optional stage name for further scoping
 * @returns A child logger with pipeline context bindings
 *
 * @example
 * ```typescript
 * // In pipeline orchestrator
 * const pipelineLogger = createPipelineLogger('2026-01-08');
 *
 * // In stage implementation
 * const stageLogger = pipelineLogger.child({ stage: 'tts' });
 * stageLogger.info('Stage started');
 * // Output: { pipelineId: '2026-01-08', stage: 'tts', msg: 'Stage started', ... }
 * ```
 */
export function createPipelineLogger(
  pipelineId: string,
  stage?: string
): pino.Logger {
  return logger.child({
    pipelineId,
    ...(stage && { stage }),
  });
}

/**
 * Creates a child logger with additional context bindings.
 *
 * Useful for adding request-scoped or operation-scoped context
 * to an existing logger.
 *
 * @param parentLogger - Parent logger to extend
 * @param context - Additional context to bind
 * @returns A child logger with merged context
 *
 * @example
 * ```typescript
 * const requestLogger = withContext(logger, {
 *   requestId: 'abc123',
 *   userId: 'user456'
 * });
 *
 * requestLogger.info('Processing request');
 * // Output includes requestId and userId in all logs
 * ```
 */
export function withContext(
  parentLogger: pino.Logger,
  context: LogContext
): pino.Logger {
  return parentLogger.child(context);
}

// Re-export pino types for convenience
export type { Logger } from 'pino';
