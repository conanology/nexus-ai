/**
 * NexusError - Custom error class for NEXUS-AI pipeline
 * Provides severity-based error handling with context preservation
 */

import { ErrorSeverity } from '../types/errors.js';
import { NEXUS_UNKNOWN_ERROR } from './codes.js';

/**
 * Regex pattern for validating error codes: NEXUS_{DOMAIN}_{TYPE}
 * Domain and Type must be uppercase letters/underscores
 */
const ERROR_CODE_PATTERN = /^NEXUS_[A-Z]+_[A-Z_]+$/;

/**
 * Custom error class for NEXUS-AI pipeline
 * Provides severity-based error handling with context preservation
 *
 * @example
 * // Create a retryable error (timeout)
 * throw NexusError.retryable('NEXUS_TTS_TIMEOUT', 'TTS synthesis timed out', 'tts');
 *
 * @example
 * // Wrap unknown errors
 * catch (error) {
 *   throw NexusError.fromError(error, 'tts');
 * }
 */
export class NexusError extends Error {
  /** Error code following NEXUS_{DOMAIN}_{TYPE} format */
  readonly code: string;

  /** Severity determines handling strategy */
  readonly severity: ErrorSeverity;

  /** Pipeline stage where error occurred */
  readonly stage?: string;

  /** Whether error can be retried (derived from severity) */
  readonly retryable: boolean;

  /** Additional context for debugging */
  readonly context?: Record<string, unknown>;

  /** When error occurred (ISO 8601 UTC) */
  readonly timestamp: string;

  /**
   * Private constructor - use static factory methods instead
   * @param code - Error code following NEXUS_{DOMAIN}_{TYPE} format
   * @param message - Human-readable error message
   * @param severity - Error severity level
   * @param stage - Pipeline stage where error occurred
   * @param context - Additional context for debugging
   * @param cause - Original error that caused this error (for error chaining)
   * @param timestamp - Optional timestamp (preserves original when wrapping)
   */
  private constructor(
    code: string,
    message: string,
    severity: ErrorSeverity,
    stage?: string,
    context?: Record<string, unknown>,
    cause?: unknown,
    timestamp?: string
  ) {
    // Pass cause to Error for proper error chaining (ES2022)
    super(message, cause !== undefined ? { cause } : undefined);

    // Set the prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, NexusError.prototype);

    // Validate error code format
    if (!ERROR_CODE_PATTERN.test(code)) {
      // In development, warn about invalid codes but don't throw
      // to avoid breaking error handling itself
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[NexusError] Invalid error code format: "${code}". ` +
            'Expected format: NEXUS_{DOMAIN}_{TYPE}'
        );
      }
    }

    this.name = 'NexusError';
    this.code = code;
    this.severity = severity;
    this.stage = stage;
    this.retryable = severity === ErrorSeverity.RETRYABLE;
    this.context = context;
    this.timestamp = timestamp ?? new Date().toISOString();

    // Preserve stack trace in V8 engines (Node.js, Chrome)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NexusError);
    }
  }

  /**
   * Serialize error to JSON for logging and persistence
   * Includes all custom properties that may not be included by default
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      stage: this.stage,
      retryable: this.retryable,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Create a retryable error (for transient failures like timeouts, rate limits)
   * retryable = true
   */
  static retryable(
    code: string,
    message: string,
    stage?: string,
    context?: Record<string, unknown>
  ): NexusError {
    return new NexusError(code, message, ErrorSeverity.RETRYABLE, stage, context);
  }

  /**
   * Create a fallback error (provider-specific failure, try next provider)
   * retryable = false
   */
  static fallback(
    code: string,
    message: string,
    stage?: string,
    context?: Record<string, unknown>
  ): NexusError {
    return new NexusError(code, message, ErrorSeverity.FALLBACK, stage, context);
  }

  /**
   * Create a degraded error (can continue but quality is compromised)
   * retryable = false
   */
  static degraded(
    code: string,
    message: string,
    stage?: string,
    context?: Record<string, unknown>
  ): NexusError {
    return new NexusError(code, message, ErrorSeverity.DEGRADED, stage, context);
  }

  /**
   * Create a recoverable error (stage failed but pipeline can continue)
   * retryable = false
   */
  static recoverable(
    code: string,
    message: string,
    stage?: string,
    context?: Record<string, unknown>
  ): NexusError {
    return new NexusError(code, message, ErrorSeverity.RECOVERABLE, stage, context);
  }

  /**
   * Create a critical error (must abort pipeline, no recovery possible)
   * retryable = false
   */
  static critical(
    code: string,
    message: string,
    stage?: string,
    context?: Record<string, unknown>
  ): NexusError {
    return new NexusError(code, message, ErrorSeverity.CRITICAL, stage, context);
  }

  /**
   * Wrap unknown errors in NexusError
   * Preserves original error info in context and maintains error chain
   *
   * @param error - The error to wrap (can be NexusError, Error, string, or unknown)
   * @param stage - The pipeline stage where the error occurred
   * @returns A NexusError instance
   *
   * @example
   * catch (error) {
   *   throw NexusError.fromError(error, 'tts');
   * }
   */
  static fromError(error: unknown, stage?: string): NexusError {
    // Already a NexusError - preserve or add stage
    if (error instanceof NexusError) {
      if (stage && !error.stage) {
        // Add stage to existing error, preserving original timestamp
        return new NexusError(
          error.code,
          error.message,
          error.severity,
          stage,
          error.context,
          undefined, // no cause - it's the same error
          error.timestamp // preserve original timestamp
        );
      }
      return error;
    }

    // Standard Error - wrap with cause for error chaining
    if (error instanceof Error) {
      return new NexusError(
        NEXUS_UNKNOWN_ERROR,
        error.message,
        ErrorSeverity.CRITICAL,
        stage,
        {
          originalName: error.name,
          originalStack: error.stack,
        },
        error // preserve as cause for error chaining
      );
    }

    // String
    if (typeof error === 'string') {
      return new NexusError(
        NEXUS_UNKNOWN_ERROR,
        error,
        ErrorSeverity.CRITICAL,
        stage
      );
    }

    // Unknown object or primitive
    return new NexusError(
      NEXUS_UNKNOWN_ERROR,
      String(error),
      ErrorSeverity.CRITICAL,
      stage,
      { originalValue: error }
    );
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if error is NexusError
 *
 * @example
 * if (isNexusError(error)) {
 *   console.log(error.severity);
 * }
 */
export function isNexusError(error: unknown): error is NexusError {
  return error instanceof NexusError;
}

/**
 * Check if error is retryable (works with any error type)
 * Returns false for non-NexusError values
 */
export function isRetryable(error: unknown): boolean {
  if (isNexusError(error)) {
    return error.retryable;
  }
  return false;
}

/**
 * Get severity from error
 * Returns CRITICAL for non-NexusError values (safe default)
 */
export function getSeverity(error: unknown): ErrorSeverity {
  if (isNexusError(error)) {
    return error.severity;
  }
  return ErrorSeverity.CRITICAL;
}

/**
 * Check if error should trigger fallback to next provider
 *
 * @example
 * if (shouldFallback(error)) {
 *   return tryNextProvider();
 * }
 */
export function shouldFallback(error: unknown): boolean {
  if (isNexusError(error)) {
    return error.severity === ErrorSeverity.FALLBACK;
  }
  return false;
}

/**
 * Check if pipeline can continue after error
 * Returns false for CRITICAL severity or non-NexusError values
 *
 * @example
 * if (!canContinue(error)) {
 *   await abortPipeline(pipelineId);
 *   throw error;
 * }
 */
export function canContinue(error: unknown): boolean {
  if (isNexusError(error)) {
    return error.severity !== ErrorSeverity.CRITICAL;
  }
  return false;
}
