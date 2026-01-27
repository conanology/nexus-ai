/**
 * @nexus-ai/timestamp-extraction
 * Timestamp extraction stage for NEXUS-AI pipeline
 *
 * Extracts word-level timing from TTS audio for synchronized
 * visual animations and text rendering.
 *
 * Primary: Google Cloud Speech-to-Text
 * Fallback: Character-weighted estimation
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

// STT client (Story 6.6)
export {
  recognizeLongRunning,
  createSpeechClient,
  closeSpeechClient,
  resetSpeechClient,
  shouldUseFallback,
  DEFAULT_STT_CONFIG,
  FALLBACK_THRESHOLDS,
} from './stt-client.js';

// Audio utilities (Story 6.6)
export {
  downloadFromGCS,
  downloadAndConvert,
  validateAudioFormat,
  convertToLinear16,
  isValidGcsUrl,
} from './audio-utils.js';

// Word mapping (Story 6.6)
export {
  mapWordsToSegments,
  applyWordTimingsToSegments,
  updateSegmentTiming,
  normalizeWord,
  wordsMatch,
  levenshteinDistance,
} from './word-mapper.js';

// Types - input/output interfaces
export type {
  TimestampExtractionInput,
  TimestampExtractionOutput,
  TimingMetadata,
  EstimatedTimingConfig,
  TimestampQualityResult,
  QualityCheckResult,
} from './types.js';

// STT-specific types (Story 6.6)
export type {
  STTConfig,
  STTWord,
  STTExtractionResult,
  AudioFormatInfo,
  AudioDownloadResult,
  WordMappingResult,
  MappingStats,
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
