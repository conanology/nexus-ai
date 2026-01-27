/**
 * @nexus-ai/timestamp-extraction
 * Tests for fallback timing estimation
 */

import { describe, it, expect } from 'vitest';
import { estimateWordTimings, applyEstimatedTimings } from '../fallback.js';
import { DEFAULT_TIMING_CONFIG } from '../types.js';
import type { DirectionSegment, DirectionDocument } from '@nexus-ai/script-gen';

// -----------------------------------------------------------------------------
// Test Fixtures
// -----------------------------------------------------------------------------

function createMockSegment(
  id: string,
  text: string,
  overrides?: Partial<DirectionSegment>
): DirectionSegment {
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

  return {
    id,
    index: 0,
    type: 'explanation',
    content: {
      text,
      wordCount,
      keywords: [],
      emphasis: [],
    },
    timing: {
      estimatedStartSec: 0,
      estimatedEndSec: wordCount * 0.4, // ~150 WPM
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
    ...overrides,
  } as DirectionSegment;
}

function createMockDocument(
  segments: DirectionSegment[]
): DirectionDocument {
  return {
    version: '2.0',
    metadata: {
      title: 'Test Document',
      createdAt: new Date().toISOString(),
      agentVersion: 'test',
      totalDurationSec: segments.reduce(
        (sum, s) => sum + (s.timing.estimatedDurationSec ?? 0),
        0
      ),
      wordCount: segments.reduce((sum, s) => sum + s.content.wordCount, 0),
      segmentCount: segments.length,
    },
    segments,
    globalAudio: {
      backgroundMusic: null,
      voiceover: {
        voice: 'default',
        rate: 1.0,
        pitch: 0,
      },
    },
  };
}

// -----------------------------------------------------------------------------
// estimateWordTimings Tests
// -----------------------------------------------------------------------------

describe('estimateWordTimings', () => {
  it('should estimate timings for simple text', () => {
    const segment = createMockSegment('seg-1', 'Hello world');

    const timings = estimateWordTimings(segment, 0);

    expect(timings).toHaveLength(2);
    expect(timings[0].word).toBe('Hello');
    expect(timings[1].word).toBe('world');
  });

  it('should return empty array for empty text', () => {
    const segment = createMockSegment('seg-1', '');

    const timings = estimateWordTimings(segment, 0);

    expect(timings).toHaveLength(0);
  });

  it('should return empty array for whitespace-only text', () => {
    const segment = createMockSegment('seg-1', '   ');

    const timings = estimateWordTimings(segment, 0);

    expect(timings).toHaveLength(0);
  });

  it('should strip punctuation from words', () => {
    const segment = createMockSegment('seg-1', 'Hello, world!');

    const timings = estimateWordTimings(segment, 0);

    expect(timings[0].word).toBe('Hello');
    expect(timings[1].word).toBe('world');
  });

  it('should use character-weighted distribution', () => {
    const segment = createMockSegment('seg-1', 'a longerword');

    const timings = estimateWordTimings(segment, 0);

    // 'longerword' has more characters than 'a', so should be longer
    expect(timings[1].duration).toBeGreaterThan(timings[0].duration);
  });

  it('should add pause after sentence-ending punctuation', () => {
    const segment = createMockSegment('seg-1', 'Hello. World');

    const timings = estimateWordTimings(segment, 0);

    const gapBetween = timings[1].startTime - timings[0].endTime;
    expect(gapBetween).toBeGreaterThanOrEqual(DEFAULT_TIMING_CONFIG.pauseAfterPunctuation - 0.001);
  });

  it('should add smaller pause after comma', () => {
    const segment = createMockSegment('seg-1', 'Hello, world');

    const timings = estimateWordTimings(segment, 0);

    const gapBetween = timings[1].startTime - timings[0].endTime;
    expect(gapBetween).toBeGreaterThanOrEqual(DEFAULT_TIMING_CONFIG.pauseAfterComma - 0.001);
  });

  it('should clamp word duration to minimum', () => {
    const segment = createMockSegment('seg-1', 'a b c d e f g h i j');
    // Override to very short duration
    segment.timing.estimatedDurationSec = 0.1;

    const timings = estimateWordTimings(segment, 0);

    for (const timing of timings) {
      expect(timing.duration).toBeGreaterThanOrEqual(DEFAULT_TIMING_CONFIG.minWordDuration);
    }
  });

  it('should clamp word duration to maximum', () => {
    const segment = createMockSegment('seg-1', 'supercalifragilisticexpialidocious');
    // Override to very long duration
    segment.timing.estimatedDurationSec = 100;

    const timings = estimateWordTimings(segment, 0);

    for (const timing of timings) {
      expect(timing.duration).toBeLessThanOrEqual(DEFAULT_TIMING_CONFIG.maxWordDuration);
    }
  });

  it('should start from specified offset', () => {
    const segment = createMockSegment('seg-1', 'Hello world');
    const startOffset = 5.0;

    const timings = estimateWordTimings(segment, startOffset);

    expect(timings[0].startTime).toBe(startOffset);
  });

  it('should mark emphasis words correctly', () => {
    const segment = createMockSegment('seg-1', 'Important keyword here');
    segment.content.emphasis = [{ word: 'keyword', effect: 'scale' }];

    const timings = estimateWordTimings(segment, 0);

    expect(timings[0].isEmphasis).toBe(false); // 'Important'
    expect(timings[1].isEmphasis).toBe(true); // 'keyword'
    expect(timings[2].isEmphasis).toBe(false); // 'here'
  });

  it('should maintain monotonic timing (no overlaps)', () => {
    const segment = createMockSegment(
      'seg-1',
      'This is a longer sentence with multiple words to ensure proper timing.'
    );

    const timings = estimateWordTimings(segment, 0);

    for (let i = 1; i < timings.length; i++) {
      expect(timings[i].startTime).toBeGreaterThanOrEqual(timings[i - 1].endTime);
    }
  });

  it('should set correct segment ID on all timings', () => {
    const segment = createMockSegment('unique-segment-id', 'Hello world');

    const timings = estimateWordTimings(segment, 0);

    for (const timing of timings) {
      expect(timing.segmentId).toBe('unique-segment-id');
    }
  });

  it('should use custom config when provided', () => {
    const segment = createMockSegment('seg-1', 'Hello world');
    const customConfig = {
      ...DEFAULT_TIMING_CONFIG,
      minWordDuration: 0.5,
    };

    const timings = estimateWordTimings(segment, 0, customConfig);

    for (const timing of timings) {
      expect(timing.duration).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('should use uniform distribution for all-punctuation words', () => {
    const segment = createMockSegment('seg-1', '... !!! ???');

    const timings = estimateWordTimings(segment, 0);

    // All-punctuation words should get uniform timing
    expect(timings).toHaveLength(3);
    // Uniform distribution means all words should have the same duration
    const durations = timings.map((t) => t.duration);
    expect(durations[0]).toBeCloseTo(durations[1], 5);
    expect(durations[1]).toBeCloseTo(durations[2], 5);
  });

  it('should add exactly 300ms pause after sentence-ending punctuation (.!?)', () => {
    const segment = createMockSegment('seg-1', 'Hello! World');

    const timings = estimateWordTimings(segment, 0);

    const pauseAfterHello = timings[1].startTime - timings[0].endTime;
    expect(pauseAfterHello).toBeCloseTo(0.3, 2);
  });

  it('should add exactly 150ms pause after comma/semicolon/colon', () => {
    const segment = createMockSegment('seg-1', 'Hello; World');

    const timings = estimateWordTimings(segment, 0);

    const pauseAfterHello = timings[1].startTime - timings[0].endTime;
    expect(pauseAfterHello).toBeCloseTo(0.15, 2);
  });

  it('should add 150ms pause after colon', () => {
    const segment = createMockSegment('seg-1', 'Note: details');

    const timings = estimateWordTimings(segment, 0);

    const pause = timings[1].startTime - timings[0].endTime;
    expect(pause).toBeCloseTo(0.15, 2);
  });

  it('should set correct index for each word', () => {
    const segment = createMockSegment('seg-1', 'alpha beta gamma');

    const timings = estimateWordTimings(segment, 0);

    expect(timings[0].index).toBe(0);
    expect(timings[1].index).toBe(1);
    expect(timings[2].index).toBe(2);
  });

  it('should produce positive durations for all words', () => {
    const segment = createMockSegment('seg-1', 'This is a test sentence with several words');

    const timings = estimateWordTimings(segment, 0);

    for (const timing of timings) {
      expect(timing.duration).toBeGreaterThan(0);
      expect(timing.endTime).toBeGreaterThan(timing.startTime);
    }
  });
});

// -----------------------------------------------------------------------------
// applyEstimatedTimings Tests
// -----------------------------------------------------------------------------

describe('applyEstimatedTimings', () => {
  it('should process all segments', () => {
    const doc = createMockDocument([
      createMockSegment('seg-1', 'First segment'),
      createMockSegment('seg-2', 'Second segment'),
    ]);

    const result = applyEstimatedTimings(doc, 10);

    expect(result.wordTimings).toHaveLength(4);
    expect(result.document.segments).toHaveLength(2);
  });

  it('should return enriched document and flat word timings', () => {
    const doc = createMockDocument([
      createMockSegment('seg-1', 'Hello world'),
    ]);

    const result = applyEstimatedTimings(doc, 5);

    expect(result.document).toBeDefined();
    expect(result.wordTimings).toBeDefined();
    expect(Array.isArray(result.wordTimings)).toBe(true);
  });

  it('should not mutate original document', () => {
    const doc = createMockDocument([
      createMockSegment('seg-1', 'Hello world'),
    ]);
    const originalTiming = doc.segments[0].timing.estimatedStartSec;

    applyEstimatedTimings(doc, 5);

    expect(doc.segments[0].timing.estimatedStartSec).toBe(originalTiming);
  });

  it('should scale timings to match audio duration', () => {
    const doc = createMockDocument([
      createMockSegment('seg-1', 'Hello world'),
    ]);
    const audioDuration = 10;

    const result = applyEstimatedTimings(doc, audioDuration);

    const lastWord = result.wordTimings[result.wordTimings.length - 1];
    // Should end close to audio duration (allowing for some tolerance)
    expect(lastWord.endTime).toBeLessThanOrEqual(audioDuration + 0.1);
  });

  it('should handle empty document', () => {
    const doc = createMockDocument([]);

    const result = applyEstimatedTimings(doc, 5);

    expect(result.wordTimings).toHaveLength(0);
    expect(result.document.segments).toHaveLength(0);
  });

  it('should handle segments with no words', () => {
    const doc = createMockDocument([
      createMockSegment('seg-1', ''),
      createMockSegment('seg-2', 'Hello world'),
    ]);

    const result = applyEstimatedTimings(doc, 5);

    expect(result.wordTimings).toHaveLength(2);
  });

  it('should maintain segment order in word timings', () => {
    const doc = createMockDocument([
      createMockSegment('seg-1', 'First'),
      createMockSegment('seg-2', 'Second'),
    ]);

    const result = applyEstimatedTimings(doc, 10);

    expect(result.wordTimings[0].segmentId).toBe('seg-1');
    expect(result.wordTimings[1].segmentId).toBe('seg-2');
  });

  it('should set timing source to estimated', () => {
    const doc = createMockDocument([
      createMockSegment('seg-1', 'Hello world'),
    ]);

    const result = applyEstimatedTimings(doc, 5);

    expect(result.document.segments[0].timing.timingSource).toBe('estimated');
  });

  it('should update segment timing based on word timings', () => {
    const doc = createMockDocument([
      createMockSegment('seg-1', 'Hello world'),
    ]);

    const result = applyEstimatedTimings(doc, 5);

    const firstWord = result.wordTimings[0];
    const lastWord = result.wordTimings[result.wordTimings.length - 1];

    expect(result.document.segments[0].timing.estimatedStartSec).toBe(firstWord.startTime);
    expect(result.document.segments[0].timing.estimatedEndSec).toBe(lastWord.endTime);
  });

  it('should use custom config when provided', () => {
    const doc = createMockDocument([
      createMockSegment('seg-1', 'Hello world test'),
    ]);
    const customConfig = {
      ...DEFAULT_TIMING_CONFIG,
      minWordDuration: 0.5,
      wordsPerMinute: 100, // Slower speech
    };

    const result = applyEstimatedTimings(doc, 10, customConfig);

    // With custom minWordDuration of 0.5, all words should be >= 0.5s
    for (const timing of result.wordTimings) {
      expect(timing.duration).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('should use adaptive tolerance for scaling', () => {
    // Test with very long audio where 2% tolerance should apply
    const doc = createMockDocument([
      createMockSegment('seg-1', 'Hello world'),
    ]);

    // With 100s audio, 2% = 2s tolerance (much larger than 0.1s minimum)
    const result = applyEstimatedTimings(doc, 100);

    // Should still scale and produce valid timings
    expect(result.wordTimings.length).toBe(2);
    expect(result.wordTimings[result.wordTimings.length - 1].endTime).toBeLessThanOrEqual(100);
  });

  it('should deep clone document so original is not mutated', () => {
    const doc = createMockDocument([
      createMockSegment('seg-1', 'Hello world'),
    ]);
    const originalStart = doc.segments[0].timing.estimatedStartSec;
    const originalEnd = doc.segments[0].timing.estimatedEndSec;
    const originalDuration = doc.segments[0].timing.estimatedDurationSec;

    const result = applyEstimatedTimings(doc, 20);

    // Original document should be unchanged
    expect(doc.segments[0].timing.estimatedStartSec).toBe(originalStart);
    expect(doc.segments[0].timing.estimatedEndSec).toBe(originalEnd);
    expect(doc.segments[0].timing.estimatedDurationSec).toBe(originalDuration);

    // Returned document is different object
    expect(result.document).not.toBe(doc);
    expect(result.document.segments[0]).not.toBe(doc.segments[0]);
  });

  it('should scale word durations proportionally when scaling', () => {
    const doc = createMockDocument([
      createMockSegment('seg-1', 'alpha beta gamma'),
    ]);

    const result = applyEstimatedTimings(doc, 30);

    // All timings should be scaled to fit within audio duration
    const lastTiming = result.wordTimings[result.wordTimings.length - 1];
    expect(lastTiming.endTime).toBeLessThanOrEqual(30 + 0.1);

    // Each word should still have startTime < endTime
    for (const timing of result.wordTimings) {
      expect(timing.endTime).toBeGreaterThan(timing.startTime);
      expect(timing.duration).toBeGreaterThan(0);
    }
  });

  it('should handle multi-segment document with correct ordering', () => {
    const doc = createMockDocument([
      createMockSegment('seg-1', 'First segment text'),
      createMockSegment('seg-2', 'Second segment text'),
      createMockSegment('seg-3', 'Third segment text'),
    ]);

    const result = applyEstimatedTimings(doc, 30);

    // Words should be in order across segments
    for (let i = 1; i < result.wordTimings.length; i++) {
      expect(result.wordTimings[i].startTime).toBeGreaterThanOrEqual(
        result.wordTimings[i - 1].startTime
      );
    }

    // Segment timings should be set
    for (const segment of result.document.segments) {
      expect(segment.timing.timingSource).toBe('estimated');
      expect(segment.timing.estimatedStartSec).toBeDefined();
      expect(segment.timing.estimatedEndSec).toBeDefined();
    }
  });
});
