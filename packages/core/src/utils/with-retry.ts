/**
 * Retry utility with exponential backoff and jitter
 * @module @nexus-ai/core/utils/with-retry
 */

import { NexusError, isRetryable } from '../errors/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for configuring retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  baseDelay?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelay?: number;
  /** Stage name for error context */
  stage?: string;
  /** Optional callback for each retry attempt */
  onRetry?: (attempt: number, delay: number, error: NexusError) => void;
}

/**
 * Result from a successful retry operation
 */
export interface RetryResult<T> {
  /** The successful result */
  result: T;
  /** Number of attempts made (1 = first try succeeded) */
  attempts: number;
  /** Total time spent on retries in ms */
  totalDelayMs: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30000;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sleep for specified milliseconds
 * @param ms - Duration to sleep in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 *
 * Formula: min(baseDelay * 2^attempt, maxDelay) * (0.5 + random * 0.5)
 *
 * The jitter (50-100% of calculated delay) prevents "thundering herd"
 * when multiple instances retry simultaneously after a shared failure.
 *
 * @param attempt - 0-indexed attempt number
 * @param baseDelay - Initial delay in ms
 * @param maxDelay - Maximum delay in ms
 * @returns Delay in ms with jitter applied
 *
 * @example
 * // Attempt 0: 500-1000ms
 * // Attempt 1: 1000-2000ms
 * // Attempt 2: 2000-4000ms
 * calculateDelay(0, 1000, 30000); // ~750ms (with jitter)
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  // Add jitter: 50-100% of the delay (prevents thundering herd)
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(cappedDelay * jitter);
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Retry an async operation with exponential backoff
 *
 * Only retries on errors where isRetryable(error) returns true.
 * Non-retryable errors are thrown immediately without retry.
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration options
 * @returns Promise resolving to RetryResult with result and attempt info
 * @throws NexusError with full retry context when retries exhausted or non-retryable error
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => apiClient.generateText(prompt),
 *   { maxRetries: 3, stage: 'script-gen' }
 * );
 * console.log(`Succeeded after ${result.attempts} attempts`);
 * ```
 *
 * @example
 * ```typescript
 * // With onRetry callback for logging
 * const result = await withRetry(
 *   () => ttsProvider.synthesize(text),
 *   {
 *     maxRetries: 3,
 *     stage: 'tts',
 *     onRetry: (attempt, delay, error) => {
 *       logger.warn('Retry attempt', { attempt, delay, error: error.code });
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelay = DEFAULT_BASE_DELAY,
    maxDelay = DEFAULT_MAX_DELAY,
    stage,
    onRetry,
  } = options;

  // Validate options to prevent unexpected behavior
  if (maxRetries < 0) {
    throw NexusError.critical(
      'NEXUS_RETRY_INVALID_OPTIONS',
      `maxRetries must be >= 0, got ${maxRetries}`,
      stage
    );
  }
  if (baseDelay < 0) {
    throw NexusError.critical(
      'NEXUS_RETRY_INVALID_OPTIONS',
      `baseDelay must be >= 0, got ${baseDelay}`,
      stage
    );
  }
  if (maxDelay < 0) {
    throw NexusError.critical(
      'NEXUS_RETRY_INVALID_OPTIONS',
      `maxDelay must be >= 0, got ${maxDelay}`,
      stage
    );
  }

  let attempts = 0;
  let totalDelayMs = 0;
  const retryHistory: Array<{
    attempt: number;
    error: string;
    delay: number;
  }> = [];

  while (attempts <= maxRetries) {
    try {
      const result = await fn();
      return { result, attempts: attempts + 1, totalDelayMs };
    } catch (error) {
      const nexusError = NexusError.fromError(error, stage);

      // Only retry if error is retryable AND we have retries left
      if (!isRetryable(nexusError) || attempts >= maxRetries) {
        // Throw with full retry context
        throw NexusError.critical(
          nexusError.code,
          nexusError.message,
          stage,
          {
            ...nexusError.context,
            originalSeverity: nexusError.severity,
            retryAttempts: attempts + 1,
            exhaustedRetries: attempts >= maxRetries && isRetryable(nexusError),
            retryHistory,
          }
        );
      }

      // Calculate delay for this retry
      const delay = calculateDelay(attempts, baseDelay, maxDelay);
      totalDelayMs += delay;

      // Record this attempt for error context
      retryHistory.push({
        attempt: attempts + 1,
        error: nexusError.code,
        delay,
      });

      // Notify callback if provided
      onRetry?.(attempts + 1, delay, nexusError);

      // Wait before retrying
      await sleep(delay);
      attempts++;
    }
  }

  // TypeScript requires a return, but we should never reach here
  // The while loop will either return success or throw an error
  throw NexusError.critical(
    'NEXUS_RETRY_LOGIC_ERROR',
    'Unexpected exit from retry loop',
    stage
  );
}
