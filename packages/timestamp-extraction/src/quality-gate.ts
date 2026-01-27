/**
 * @nexus-ai/timestamp-extraction
 * Quality gate validation for timestamp extraction
 *
 * Validates word timing extraction results against defined thresholds.
 */

import type { DirectionDocument, WordTiming } from '@nexus-ai/script-gen';

import {
  type TimestampQualityResult,
  type QualityCheckResult,
  QUALITY_THRESHOLDS,
  TIMESTAMP_ERROR_CODES,
  countWords,
} from './types.js';

/**
 * Validate timestamp extraction results against quality thresholds.
 *
 * Checks:
 * - Word count match (90% of expected words)
 * - No timing gaps > 500ms between words
 * - Monotonic timing (no overlaps) - CRITICAL
 * - Processing time < 60 seconds
 *
 * @param wordTimings - Extracted word timings
 * @param document - Original direction document for word count comparison
 * @param processingTimeMs - Time taken for extraction in milliseconds
 * @returns Quality validation result with status and individual check results
 */
export function validateTimestampExtraction(
  wordTimings: WordTiming[],
  document: DirectionDocument,
  processingTimeMs: number
): TimestampQualityResult {
  const checks = {
    wordCountMatch: checkWordCountMatch(wordTimings, document),
    noGaps: checkNoGaps(wordTimings),
    monotonicTiming: checkMonotonicTiming(wordTimings),
    processingTime: checkProcessingTime(processingTimeMs),
  };

  // Determine overall status
  // FAIL if any critical check fails
  // DEGRADED if any non-critical check fails
  // PASS if all checks pass

  let status: 'PASS' | 'DEGRADED' | 'FAIL' = 'PASS';
  const flags: string[] = [];

  for (const [_name, check] of Object.entries(checks)) {
    if (!check.passed) {
      if (check.severity === 'CRITICAL') {
        status = 'FAIL';
      } else if (status !== 'FAIL') {
        status = 'DEGRADED';
      }

      if (check.code) {
        flags.push(check.code);
      }
    }
  }

  return {
    status,
    checks,
    flags,
  };
}

// -----------------------------------------------------------------------------
// Individual Check Functions
// -----------------------------------------------------------------------------

/**
 * Check that extracted word count matches expected word count.
 * Threshold: 90% of expected words must be present.
 */
function checkWordCountMatch(
  wordTimings: WordTiming[],
  document: DirectionDocument
): QualityCheckResult {
  // Calculate expected word count from document segments
  const expectedWordCount = document.segments.reduce(
    (sum, segment) =>
      sum + (segment.content.wordCount ?? countWords(segment.content.text)),
    0
  );

  // Handle edge case of no expected words
  if (expectedWordCount === 0) {
    return {
      passed: wordTimings.length === 0,
      severity: wordTimings.length === 0 ? undefined : 'DEGRADED',
      code: wordTimings.length === 0 ? undefined : TIMESTAMP_ERROR_CODES.WORD_COUNT_MISMATCH,
      message: wordTimings.length === 0
        ? 'No words expected and none extracted'
        : `Extracted ${wordTimings.length} words when none expected`,
      actualValue: wordTimings.length,
      threshold: 0,
    };
  }

  const ratio = wordTimings.length / expectedWordCount;
  const passed = ratio >= QUALITY_THRESHOLDS.WORD_COUNT_MATCH_RATIO;

  return {
    passed,
    severity: passed ? undefined : 'DEGRADED',
    code: passed ? undefined : TIMESTAMP_ERROR_CODES.WORD_COUNT_MISMATCH,
    message: passed
      ? `Word count match: ${wordTimings.length}/${expectedWordCount} (${(ratio * 100).toFixed(1)}%)`
      : `Word count below threshold: ${wordTimings.length}/${expectedWordCount} (${(ratio * 100).toFixed(1)}% < ${QUALITY_THRESHOLDS.WORD_COUNT_MATCH_RATIO * 100}%)`,
    actualValue: ratio,
    threshold: QUALITY_THRESHOLDS.WORD_COUNT_MATCH_RATIO,
  };
}

/**
 * Check that there are no timing gaps larger than threshold.
 * Threshold: No gaps > 500ms between consecutive words.
 */
function checkNoGaps(wordTimings: WordTiming[]): QualityCheckResult {
  // Need at least 2 words to check gaps
  if (wordTimings.length < 2) {
    return {
      passed: true,
      message: 'Insufficient words to check gaps',
      actualValue: 0,
      threshold: QUALITY_THRESHOLDS.MAX_GAP_MS,
    };
  }

  let maxGapMs = 0;
  let maxGapIndex = -1;

  for (let i = 1; i < wordTimings.length; i++) {
    const prev = wordTimings[i - 1];
    const curr = wordTimings[i];

    // Only check gaps within same segment
    if (prev.segmentId === curr.segmentId) {
      const gapMs = (curr.startTime - prev.endTime) * 1000;

      if (gapMs > maxGapMs) {
        maxGapMs = gapMs;
        maxGapIndex = i;
      }
    }
  }

  const passed = maxGapMs <= QUALITY_THRESHOLDS.MAX_GAP_MS;

  return {
    passed,
    severity: passed ? undefined : 'DEGRADED',
    code: passed ? undefined : TIMESTAMP_ERROR_CODES.TIMING_GAP,
    message: passed
      ? `Max gap within threshold: ${maxGapMs.toFixed(0)}ms`
      : `Gap exceeds threshold at word ${maxGapIndex}: ${maxGapMs.toFixed(0)}ms > ${QUALITY_THRESHOLDS.MAX_GAP_MS}ms`,
    actualValue: maxGapMs,
    threshold: QUALITY_THRESHOLDS.MAX_GAP_MS,
  };
}

/**
 * Check that timing is monotonic (no overlapping words).
 * This is a CRITICAL check - overlapping timings will cause rendering issues.
 */
function checkMonotonicTiming(wordTimings: WordTiming[]): QualityCheckResult {
  // Need at least 2 words to check monotonicity
  if (wordTimings.length < 2) {
    return {
      passed: true,
      message: 'Insufficient words to check monotonicity',
    };
  }

  const overlaps: Array<{ index: number; overlap: number }> = [];

  for (let i = 1; i < wordTimings.length; i++) {
    const prev = wordTimings[i - 1];
    const curr = wordTimings[i];

    // Check if current word starts before previous word ends
    if (curr.startTime < prev.endTime) {
      const overlapMs = (prev.endTime - curr.startTime) * 1000;
      overlaps.push({ index: i, overlap: overlapMs });
    }
  }

  const passed = overlaps.length === 0;

  return {
    passed,
    severity: passed ? undefined : 'CRITICAL',
    code: passed ? undefined : TIMESTAMP_ERROR_CODES.TIMING_OVERLAP,
    message: passed
      ? 'Timing is monotonic (no overlaps)'
      : `Found ${overlaps.length} overlapping word(s): ${overlaps.slice(0, 3).map((o) => `word ${o.index} (${o.overlap.toFixed(0)}ms overlap)`).join(', ')}${overlaps.length > 3 ? '...' : ''}`,
    actualValue: overlaps.length,
    threshold: 0,
  };
}

/**
 * Check that processing completed within time threshold.
 * Threshold: < 60 seconds.
 */
function checkProcessingTime(processingTimeMs: number): QualityCheckResult {
  const passed = processingTimeMs <= QUALITY_THRESHOLDS.MAX_PROCESSING_TIME_MS;

  return {
    passed,
    severity: passed ? undefined : 'DEGRADED',
    code: passed ? undefined : TIMESTAMP_ERROR_CODES.SLOW_PROCESSING,
    message: passed
      ? `Processing time within threshold: ${processingTimeMs}ms`
      : `Processing time exceeds threshold: ${processingTimeMs}ms > ${QUALITY_THRESHOLDS.MAX_PROCESSING_TIME_MS}ms`,
    actualValue: processingTimeMs,
    threshold: QUALITY_THRESHOLDS.MAX_PROCESSING_TIME_MS,
  };
}

