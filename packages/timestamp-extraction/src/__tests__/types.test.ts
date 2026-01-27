/**
 * @nexus-ai/timestamp-extraction
 * Tests for type definitions and constants
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIMING_CONFIG,
  QUALITY_THRESHOLDS,
  TIMESTAMP_ERROR_CODES,
  SCALING_TOLERANCE,
  countWords,
} from '../types.js';

describe('DEFAULT_TIMING_CONFIG', () => {
  it('should have reasonable default values', () => {
    expect(DEFAULT_TIMING_CONFIG.wordsPerMinute).toBe(150);
    expect(DEFAULT_TIMING_CONFIG.minWordDuration).toBe(0.1);
    expect(DEFAULT_TIMING_CONFIG.maxWordDuration).toBe(1.0);
    expect(DEFAULT_TIMING_CONFIG.pauseAfterPunctuation).toBe(0.3);
    expect(DEFAULT_TIMING_CONFIG.pauseAfterComma).toBe(0.15);
  });

  it('should have minWordDuration less than maxWordDuration', () => {
    expect(DEFAULT_TIMING_CONFIG.minWordDuration).toBeLessThan(
      DEFAULT_TIMING_CONFIG.maxWordDuration
    );
  });

  it('should have pauseAfterComma less than pauseAfterPunctuation', () => {
    expect(DEFAULT_TIMING_CONFIG.pauseAfterComma).toBeLessThan(
      DEFAULT_TIMING_CONFIG.pauseAfterPunctuation
    );
  });
});

describe('QUALITY_THRESHOLDS', () => {
  it('should have word count match ratio between 0 and 1', () => {
    expect(QUALITY_THRESHOLDS.WORD_COUNT_MATCH_RATIO).toBeGreaterThan(0);
    expect(QUALITY_THRESHOLDS.WORD_COUNT_MATCH_RATIO).toBeLessThanOrEqual(1);
  });

  it('should have reasonable gap threshold', () => {
    expect(QUALITY_THRESHOLDS.MAX_GAP_MS).toBe(500);
  });

  it('should have reasonable processing time threshold', () => {
    expect(QUALITY_THRESHOLDS.MAX_PROCESSING_TIME_MS).toBe(60000);
  });
});

describe('TIMESTAMP_ERROR_CODES', () => {
  it('should follow NEXUS error code format', () => {
    const errorCodes = Object.values(TIMESTAMP_ERROR_CODES);

    for (const code of errorCodes) {
      expect(code).toMatch(/^NEXUS_TIMESTAMP_/);
    }
  });

  it('should have all expected error codes', () => {
    expect(TIMESTAMP_ERROR_CODES.WORD_COUNT_MISMATCH).toBeDefined();
    expect(TIMESTAMP_ERROR_CODES.TIMING_GAP).toBeDefined();
    expect(TIMESTAMP_ERROR_CODES.TIMING_OVERLAP).toBeDefined();
    expect(TIMESTAMP_ERROR_CODES.SLOW_PROCESSING).toBeDefined();
    expect(TIMESTAMP_ERROR_CODES.INVALID_INPUT).toBeDefined();
    expect(TIMESTAMP_ERROR_CODES.FALLBACK_USED).toBeDefined();
    expect(TIMESTAMP_ERROR_CODES.NO_SEGMENTS).toBeDefined();
    expect(TIMESTAMP_ERROR_CODES.QUALITY_GATE_FAIL).toBeDefined();
  });
});

describe('SCALING_TOLERANCE', () => {
  it('should have minimum tolerance in seconds', () => {
    expect(SCALING_TOLERANCE.MIN_TOLERANCE_SEC).toBe(0.1);
  });

  it('should have tolerance percentage between 0 and 1', () => {
    expect(SCALING_TOLERANCE.TOLERANCE_PERCENT).toBeGreaterThan(0);
    expect(SCALING_TOLERANCE.TOLERANCE_PERCENT).toBeLessThan(1);
  });
});

describe('countWords', () => {
  it('should count words in simple text', () => {
    expect(countWords('Hello world')).toBe(2);
  });

  it('should return 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('should return 0 for whitespace only', () => {
    expect(countWords('   ')).toBe(0);
  });

  it('should handle multiple spaces between words', () => {
    expect(countWords('Hello   world   test')).toBe(3);
  });

  it('should handle tabs and newlines', () => {
    expect(countWords('Hello\tworld\ntest')).toBe(3);
  });
});
