/**
 * @nexus-ai/timestamp-extraction
 * Timestamp extraction stage for NEXUS-AI pipeline
 *
 * Extracts word-level timing from TTS audio for synchronized
 * visual animations and text rendering.
 */

// Main stage executor
export { executeTimestampExtraction } from './timestamp-extraction.js';

// Fallback timing functions
export {
  estimateWordTimings,
  applyEstimatedTimings,
} from './fallback.js';

// Quality gate validation
export { validateTimestampExtraction } from './quality-gate.js';

// Types - input/output interfaces
export type {
  TimestampExtractionInput,
  TimestampExtractionOutput,
  TimingMetadata,
  EstimatedTimingConfig,
  TimestampQualityResult,
  QualityCheckResult,
} from './types.js';

// Re-exported types from script-gen
export type {
  DirectionDocument,
  DirectionSegment,
  WordTiming,
  SegmentTiming,
} from './types.js';

// Constants
export {
  DEFAULT_TIMING_CONFIG,
  QUALITY_THRESHOLDS,
  TIMESTAMP_ERROR_CODES,
  SCALING_TOLERANCE,
} from './types.js';

// Shared utilities
export { countWords } from './types.js';
