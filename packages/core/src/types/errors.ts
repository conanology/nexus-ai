/**
 * Error types for NEXUS-AI
 * This is a stub for Story 1.3 - full error handling framework will be implemented there
 */

/**
 * Error severity levels for NEXUS-AI pipeline
 * Determines how the error should be handled
 */
export enum ErrorSeverity {
  /** Transient error that can be retried (timeout, rate limit, 503) */
  RETRYABLE = 'RETRYABLE',
  /** Provider-specific error, try fallback provider */
  FALLBACK = 'FALLBACK',
  /** Can continue but quality is compromised */
  DEGRADED = 'DEGRADED',
  /** Stage failed but pipeline can continue */
  RECOVERABLE = 'RECOVERABLE',
  /** Must abort pipeline, no recovery possible */
  CRITICAL = 'CRITICAL',
}
