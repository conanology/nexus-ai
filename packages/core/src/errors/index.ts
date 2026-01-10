/**
 * Error handling utilities for NEXUS-AI pipeline
 * @module @nexus-ai/core/errors
 */

// Re-export ErrorSeverity for convenience when using /errors subpath
export { ErrorSeverity } from '../types/errors.js';

// Export class and type guards
export {
  NexusError,
  isNexusError,
  isRetryable,
  getSeverity,
  shouldFallback,
  canContinue,
} from './nexus-error.js';

// Export all error codes
export * from './codes.js';
