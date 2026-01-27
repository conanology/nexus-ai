/**
 * @nexus-ai/timestamp-extraction
 * Tests for quality gate validation
 */

import { describe, it, expect } from 'vitest';
import { validateTimestampExtraction } from '../quality-gate.js';
import { QUALITY_THRESHOLDS, TIMESTAMP_ERROR_CODES } from '../types.js';
import type { DirectionDocument, WordTiming } from '@nexus-ai/script-gen';

// -----------------------------------------------------------------------------
// Test Fixtures
// -----------------------------------------------------------------------------

function createMockWordTiming(
  index: number,
  startTime: number,
  duration: number,
  segmentId = 'seg-1'
): WordTiming {
  return {
    word: `word${index}`,
    index,
    startTime,
    endTime: startTime + duration,
    duration,
    segmentId,
    isEmphasis: false,
  };
}

function createMockDocument(wordCount: number): DirectionDocument {
  return {
    version: '2.0',
    metadata: {
      title: 'Test Document',
      createdAt: new Date().toISOString(),
      agentVersion: 'test',
      totalDurationSec: wordCount * 0.4,
      wordCount,
      segmentCount: 1,
    },
    segments: [
      {
        id: 'seg-1',
        index: 0,
        type: 'explanation',
        content: {
          text: Array(wordCount).fill('word').join(' '),
          wordCount,
          keywords: [],
          emphasis: [],
        },
        timing: {
          estimatedStartSec: 0,
          estimatedEndSec: wordCount * 0.4,
          estimatedDurationSec: wordCount * 0.4,
          timingSource: 'estimated',
        },
        visual: {
          component: 'TechExplainer',
          bRoll: null,
          motion: null,
        },
        audio: {
          voiceEmphasis: 'normal',
          mood: 'neutral',
          sfxCues: [],
        },
      },
    ],
    globalAudio: {
      backgroundMusic: null,
      voiceover: {
        voice: 'default',
        rate: 1.0,
        pitch: 0,
      },
    },
  } as DirectionDocument;
}

function createValidTimings(count: number): WordTiming[] {
  const timings: WordTiming[] = [];
  let currentTime = 0;

  for (let i = 0; i < count; i++) {
    const duration = 0.3;
    timings.push(createMockWordTiming(i, currentTime, duration));
    currentTime += duration + 0.05; // Small gap between words
  }

  return timings;
}

// -----------------------------------------------------------------------------
// validateTimestampExtraction Tests
// -----------------------------------------------------------------------------

describe('validateTimestampExtraction', () => {
  describe('overall status', () => {
    it('should return PASS when all checks pass', () => {
      const wordCount = 10;
      const document = createMockDocument(wordCount);
      const timings = createValidTimings(wordCount);

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.status).toBe('PASS');
      expect(result.flags).toHaveLength(0);
    });

    it('should return DEGRADED when non-critical check fails', () => {
      const wordCount = 10;
      const document = createMockDocument(wordCount);
      const timings = createValidTimings(5); // Only 50% word count

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.status).toBe('DEGRADED');
    });

    it('should return FAIL when critical check fails', () => {
      const wordCount = 10;
      const document = createMockDocument(wordCount);
      // Create overlapping timings
      const timings = [
        createMockWordTiming(0, 0, 1.0),
        createMockWordTiming(1, 0.5, 1.0), // Starts before previous ends
      ];

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.status).toBe('FAIL');
    });
  });

  describe('word count match check', () => {
    it('should pass when word count matches', () => {
      const wordCount = 10;
      const document = createMockDocument(wordCount);
      const timings = createValidTimings(wordCount);

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.wordCountMatch.passed).toBe(true);
    });

    it('should pass when word count is at threshold', () => {
      const wordCount = 10;
      const document = createMockDocument(wordCount);
      // 90% of expected = 9 words
      const timings = createValidTimings(9);

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.wordCountMatch.passed).toBe(true);
    });

    it('should fail when word count is below threshold', () => {
      const wordCount = 10;
      const document = createMockDocument(wordCount);
      // 80% of expected = 8 words (below 90% threshold)
      const timings = createValidTimings(8);

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.wordCountMatch.passed).toBe(false);
      expect(result.checks.wordCountMatch.code).toBe(
        TIMESTAMP_ERROR_CODES.WORD_COUNT_MISMATCH
      );
    });

    it('should handle zero expected words', () => {
      const document = createMockDocument(0);
      const timings: WordTiming[] = [];

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.wordCountMatch.passed).toBe(true);
    });
  });

  describe('no gaps check', () => {
    it('should pass when gaps are within threshold', () => {
      const wordCount = 5;
      const document = createMockDocument(wordCount);
      const timings: WordTiming[] = [];
      let currentTime = 0;

      for (let i = 0; i < wordCount; i++) {
        timings.push(createMockWordTiming(i, currentTime, 0.3));
        currentTime += 0.3 + 0.1; // 100ms gap - within threshold
      }

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.noGaps.passed).toBe(true);
    });

    it('should fail when gap exceeds threshold', () => {
      const wordCount = 5;
      const document = createMockDocument(wordCount);
      const timings: WordTiming[] = [];
      let currentTime = 0;

      for (let i = 0; i < wordCount; i++) {
        timings.push(createMockWordTiming(i, currentTime, 0.3));
        currentTime += 0.3 + 0.6; // 600ms gap - exceeds 500ms threshold
      }

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.noGaps.passed).toBe(false);
      expect(result.checks.noGaps.code).toBe(TIMESTAMP_ERROR_CODES.TIMING_GAP);
    });

    it('should pass with single word', () => {
      const document = createMockDocument(1);
      const timings = createValidTimings(1);

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.noGaps.passed).toBe(true);
    });

    it('should not check gaps across segment boundaries', () => {
      const document = createMockDocument(4);
      document.segments.push({
        ...document.segments[0],
        id: 'seg-2',
        index: 1,
      });

      // Large gap between segments should be OK
      const timings = [
        createMockWordTiming(0, 0, 0.3, 'seg-1'),
        createMockWordTiming(1, 0.3, 0.3, 'seg-1'),
        createMockWordTiming(2, 5.0, 0.3, 'seg-2'), // Large gap but different segment
        createMockWordTiming(3, 5.3, 0.3, 'seg-2'),
      ];

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.noGaps.passed).toBe(true);
    });
  });

  describe('monotonic timing check', () => {
    it('should pass when timing is monotonic', () => {
      const wordCount = 10;
      const document = createMockDocument(wordCount);
      const timings = createValidTimings(wordCount);

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.monotonicTiming.passed).toBe(true);
    });

    it('should fail when timing overlaps', () => {
      const document = createMockDocument(3);
      const timings = [
        createMockWordTiming(0, 0, 1.0),
        createMockWordTiming(1, 0.5, 1.0), // Overlaps with previous
        createMockWordTiming(2, 2.0, 1.0),
      ];

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.monotonicTiming.passed).toBe(false);
      expect(result.checks.monotonicTiming.severity).toBe('CRITICAL');
      expect(result.checks.monotonicTiming.code).toBe(
        TIMESTAMP_ERROR_CODES.TIMING_OVERLAP
      );
    });

    it('should detect multiple overlaps', () => {
      const document = createMockDocument(4);
      const timings = [
        createMockWordTiming(0, 0, 1.0),
        createMockWordTiming(1, 0.5, 1.0), // Overlap
        createMockWordTiming(2, 1.0, 1.0), // Overlap
        createMockWordTiming(3, 3.0, 1.0),
      ];

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.monotonicTiming.passed).toBe(false);
      expect(result.checks.monotonicTiming.actualValue).toBe(2); // Two overlaps
    });

    it('should pass when words touch but do not overlap', () => {
      const document = createMockDocument(3);
      const timings = [
        createMockWordTiming(0, 0, 1.0),
        createMockWordTiming(1, 1.0, 1.0), // Starts exactly when previous ends
        createMockWordTiming(2, 2.0, 1.0),
      ];

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.monotonicTiming.passed).toBe(true);
    });
  });

  describe('processing time check', () => {
    it('should pass when processing time is within threshold', () => {
      const document = createMockDocument(10);
      const timings = createValidTimings(10);

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.checks.processingTime.passed).toBe(true);
    });

    it('should fail when processing time exceeds threshold', () => {
      const document = createMockDocument(10);
      const timings = createValidTimings(10);

      const result = validateTimestampExtraction(
        timings,
        document,
        QUALITY_THRESHOLDS.MAX_PROCESSING_TIME_MS + 1000
      );

      expect(result.checks.processingTime.passed).toBe(false);
      expect(result.checks.processingTime.code).toBe(
        TIMESTAMP_ERROR_CODES.SLOW_PROCESSING
      );
    });

    it('should pass at exactly the threshold', () => {
      const document = createMockDocument(10);
      const timings = createValidTimings(10);

      const result = validateTimestampExtraction(
        timings,
        document,
        QUALITY_THRESHOLDS.MAX_PROCESSING_TIME_MS
      );

      expect(result.checks.processingTime.passed).toBe(true);
    });
  });

  describe('flags aggregation', () => {
    it('should collect all error codes in flags', () => {
      const wordCount = 10;
      const document = createMockDocument(wordCount);
      // Low word count + overlapping = multiple failures
      const timings = [
        createMockWordTiming(0, 0, 1.0),
        createMockWordTiming(1, 0.5, 1.0), // Overlap
      ];

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.flags).toContain(TIMESTAMP_ERROR_CODES.WORD_COUNT_MISMATCH);
      expect(result.flags).toContain(TIMESTAMP_ERROR_CODES.TIMING_OVERLAP);
    });

    it('should have empty flags when all checks pass', () => {
      const wordCount = 10;
      const document = createMockDocument(wordCount);
      const timings = createValidTimings(wordCount);

      const result = validateTimestampExtraction(timings, document, 1000);

      expect(result.flags).toHaveLength(0);
    });
  });
});
