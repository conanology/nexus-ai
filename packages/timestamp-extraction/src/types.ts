/**
 * @nexus-ai/timestamp-extraction
 * Type definitions for timestamp extraction stage
 */

// Re-export types from script-gen that this package uses
export type {
  DirectionDocument,
  DirectionSegment,
  WordTiming,
  SegmentTiming,
} from '@nexus-ai/script-gen';

// -----------------------------------------------------------------------------
// Input/Output Interfaces
// -----------------------------------------------------------------------------

/**
 * Input for timestamp extraction stage.
 * Receives TTS audio and direction document from previous stages.
 */
export interface TimestampExtractionInput {
  /** GCS URL to TTS audio file */
  audioUrl: string;
  /** Total audio duration in seconds */
  audioDurationSec: number;
  /** Direction document with segments to enrich */
  directionDocument: import('@nexus-ai/script-gen').DirectionDocument;
  /** Pass-through topic data for downstream stages */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Output from timestamp extraction stage.
 * Contains enriched direction document with word-level timing.
 */
export interface TimestampExtractionOutput {
  /** Direction document enriched with word timings */
  directionDocument: import('@nexus-ai/script-gen').DirectionDocument;
  /** Flat array of all word timings across segments */
  wordTimings: import('@nexus-ai/script-gen').WordTiming[];
  /** Metadata about timing extraction */
  timingMetadata: TimingMetadata;
  /** Pass-through audio URL for downstream stages */
  audioUrl: string;
  /** Pass-through audio duration for downstream stages */
  audioDurationSec: number;
  /** Pass-through topic data for downstream stages */
  topicData?: {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    viralityScore: number;
    metadata?: Record<string, unknown>;
  };
}

// -----------------------------------------------------------------------------
// Metadata Interfaces
// -----------------------------------------------------------------------------

/**
 * Metadata about how timing data was obtained.
 */
export interface TimingMetadata {
  /** Source of timing data */
  source: 'extracted' | 'estimated';
  /** Confidence level from STT (only if extracted) */
  extractionConfidence?: number;
  /** Estimation method used (only if estimated) */
  estimationMethod?: 'character-weighted' | 'uniform';
  /** Warning flags for quality gate */
  warningFlags: string[];
}

// -----------------------------------------------------------------------------
// Configuration Interfaces
// -----------------------------------------------------------------------------

/**
 * Configuration for estimated timing calculations.
 * Used when STT extraction is unavailable.
 */
export interface EstimatedTimingConfig {
  /** Words per minute for estimation (default: 150) */
  wordsPerMinute: number;
  /** Minimum duration per word in seconds (default: 0.1) */
  minWordDuration: number;
  /** Maximum duration per word in seconds (default: 1.0) */
  maxWordDuration: number;
  /** Pause after sentence-ending punctuation in seconds (default: 0.3) */
  pauseAfterPunctuation: number;
  /** Pause after comma/semicolon in seconds (default: 0.15) */
  pauseAfterComma: number;
}

/**
 * Default timing configuration values.
 */
export const DEFAULT_TIMING_CONFIG: EstimatedTimingConfig = {
  wordsPerMinute: 150,
  minWordDuration: 0.1,
  maxWordDuration: 1.0,
  pauseAfterPunctuation: 0.3,
  pauseAfterComma: 0.15,
};

// -----------------------------------------------------------------------------
// Quality Gate Types
// -----------------------------------------------------------------------------

/**
 * Quality gate validation result for timestamp extraction.
 */
export interface TimestampQualityResult {
  /** Overall status */
  status: 'PASS' | 'DEGRADED' | 'FAIL';
  /** Individual check results */
  checks: {
    wordCountMatch: QualityCheckResult;
    noGaps: QualityCheckResult;
    monotonicTiming: QualityCheckResult;
    processingTime: QualityCheckResult;
  };
  /** Aggregated flags for quality context */
  flags: string[];
}

/**
 * Result of a single quality check.
 */
export interface QualityCheckResult {
  /** Whether the check passed */
  passed: boolean;
  /** Severity if failed */
  severity?: 'DEGRADED' | 'CRITICAL';
  /** Error code if failed */
  code?: string;
  /** Human-readable message */
  message?: string;
  /** Actual value measured */
  actualValue?: number;
  /** Threshold value */
  threshold?: number;
}

// -----------------------------------------------------------------------------
// Quality Gate Constants
// -----------------------------------------------------------------------------

/**
 * Quality check thresholds for timestamp extraction.
 */
export const QUALITY_THRESHOLDS = {
  /** Minimum percentage of expected words that must be timed */
  WORD_COUNT_MATCH_RATIO: 0.9,
  /** Maximum allowed gap between words in milliseconds */
  MAX_GAP_MS: 500,
  /** Maximum processing time in milliseconds */
  MAX_PROCESSING_TIME_MS: 60000,
} as const;

/**
 * Error codes for timestamp extraction failures.
 */
export const TIMESTAMP_ERROR_CODES = {
  WORD_COUNT_MISMATCH: 'NEXUS_TIMESTAMP_WORD_COUNT_MISMATCH',
  TIMING_GAP: 'NEXUS_TIMESTAMP_TIMING_GAP',
  TIMING_OVERLAP: 'NEXUS_TIMESTAMP_OVERLAP',
  SLOW_PROCESSING: 'NEXUS_TIMESTAMP_SLOW_PROCESSING',
  INVALID_INPUT: 'NEXUS_TIMESTAMP_INVALID_INPUT',
  FALLBACK_USED: 'NEXUS_TIMESTAMP_FALLBACK',
  NO_SEGMENTS: 'NEXUS_TIMESTAMP_NO_SEGMENTS',
  QUALITY_GATE_FAIL: 'NEXUS_TIMESTAMP_QUALITY_GATE_FAIL',
} as const;

// -----------------------------------------------------------------------------
// Shared Utility Functions
// -----------------------------------------------------------------------------

/**
 * Count words in text by splitting on whitespace.
 * Shared utility used by fallback and quality-gate modules.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Scaling tolerance for matching estimated timings to audio duration.
 * Used as percentage of total duration for adaptive tolerance.
 */
export const SCALING_TOLERANCE = {
  /** Minimum tolerance in seconds */
  MIN_TOLERANCE_SEC: 0.1,
  /** Percentage of audio duration to use as tolerance */
  TOLERANCE_PERCENT: 0.02, // 2%
} as const;
