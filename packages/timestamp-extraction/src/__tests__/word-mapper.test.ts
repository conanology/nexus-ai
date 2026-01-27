/**
 * Tests for word-mapper module
 */

import { describe, it, expect, vi } from 'vitest';
import {
  normalizeWord,
  wordsMatch,
  levenshteinDistance,
  mapWordsToSegments,
  updateSegmentTiming,
  applyWordTimingsToSegments,
} from '../word-mapper.js';
import type { DirectionSegment } from '@nexus-ai/script-gen';
import type { STTWord } from '../stt-client.js';

describe('normalizeWord', () => {
  it('should lowercase the word', () => {
    expect(normalizeWord('Hello')).toBe('hello');
    expect(normalizeWord('WORLD')).toBe('world');
  });

  it('should remove punctuation', () => {
    expect(normalizeWord('hello,')).toBe('hello');
    expect(normalizeWord('world!')).toBe('world');
    expect(normalizeWord('"quoted"')).toBe('quoted');
  });

  it('should preserve apostrophes in contractions', () => {
    expect(normalizeWord("don't")).toBe("don't");
    expect(normalizeWord("it's")).toBe("it's");
  });

  it('should handle empty strings', () => {
    expect(normalizeWord('')).toBe('');
  });
});

describe('levenshteinDistance', () => {
  it('should return 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('should return length for empty string comparison', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
    expect(levenshteinDistance('hello', '')).toBe(5);
  });

  it('should count single character differences', () => {
    expect(levenshteinDistance('hello', 'hallo')).toBe(1);
    expect(levenshteinDistance('cat', 'cut')).toBe(1);
  });

  it('should count insertions and deletions', () => {
    expect(levenshteinDistance('hello', 'ello')).toBe(1);
    expect(levenshteinDistance('hello', 'helloo')).toBe(1);
  });
});

describe('wordsMatch', () => {
  it('should match identical words', () => {
    expect(wordsMatch('hello', 'hello')).toBe(true);
  });

  it('should not match empty strings', () => {
    expect(wordsMatch('', 'hello')).toBe(false);
    expect(wordsMatch('hello', '')).toBe(false);
  });

  it('should match with minor spelling variations', () => {
    expect(wordsMatch('color', 'colour')).toBe(true); // 1 char diff, 20% of 5 = 1
    expect(wordsMatch('hello', 'hallo')).toBe(true); // 1 char diff
  });

  it('should not match very different words', () => {
    expect(wordsMatch('hello', 'world')).toBe(false);
    expect(wordsMatch('cat', 'dog')).toBe(false);
  });
});

describe('mapWordsToSegments', () => {
  const createSegment = (id: string, text: string): DirectionSegment => ({
    id,
    type: 'narration',
    content: {
      text,
      speakerNotes: '',
    },
    timing: {
      estimatedStartSec: 0,
      estimatedEndSec: 1,
      estimatedDurationSec: 1,
      timingSource: 'estimated',
    },
  });

  const createSTTWord = (word: string, startTime: number, endTime: number): STTWord => ({
    word,
    startTime,
    endTime,
    confidence: 0.95,
  });

  it('should map words to segments correctly', () => {
    const segments = [
      createSegment('seg-1', 'Hello world'),
      createSegment('seg-2', 'This is a test'),
    ];

    const sttWords: STTWord[] = [
      createSTTWord('Hello', 0, 0.5),
      createSTTWord('world', 0.5, 1.0),
      createSTTWord('This', 1.0, 1.3),
      createSTTWord('is', 1.3, 1.5),
      createSTTWord('a', 1.5, 1.6),
      createSTTWord('test', 1.6, 2.0),
    ];

    const result = mapWordsToSegments(sttWords, segments, 'test-pipeline');

    expect(result.stats.expectedWordCount).toBe(6);
    expect(result.stats.sttWordCount).toBe(6);
    expect(result.stats.mappedWordCount).toBe(6);
    expect(result.stats.matchRatio).toBe(1);
    expect(result.segmentTimings.get('seg-1')?.length).toBe(2);
    expect(result.segmentTimings.get('seg-2')?.length).toBe(4);
  });

  it('should handle empty segments', () => {
    const segments = [createSegment('seg-1', '')];
    const sttWords: STTWord[] = [];

    const result = mapWordsToSegments(sttWords, segments, 'test-pipeline');

    expect(result.stats.expectedWordCount).toBe(0);
    expect(result.stats.matchRatio).toBe(1);
  });

  it('should handle more STT words than expected', () => {
    const segments = [createSegment('seg-1', 'Hello world')];

    const sttWords: STTWord[] = [
      createSTTWord('Hello', 0, 0.5),
      createSTTWord('beautiful', 0.5, 0.8), // extra word
      createSTTWord('world', 0.8, 1.2),
    ];

    const result = mapWordsToSegments(sttWords, segments, 'test-pipeline');

    // Should still map expected words
    expect(result.stats.expectedWordCount).toBe(2);
    expect(result.stats.sttWordCount).toBe(3);
  });
});

describe('updateSegmentTiming', () => {
  const createSegment = (id: string, text: string): DirectionSegment => ({
    id,
    type: 'narration',
    content: {
      text,
      speakerNotes: '',
    },
    timing: {
      estimatedStartSec: 0,
      estimatedEndSec: 1,
      estimatedDurationSec: 1,
      timingSource: 'estimated',
    },
  });

  it('should update segment with word timings', () => {
    const segment = createSegment('seg-1', 'Hello world');
    const wordTimings = [
      {
        word: 'Hello',
        index: 0,
        startTime: 0.5,
        endTime: 1.0,
        duration: 0.5,
        segmentId: 'seg-1',
        isEmphasis: false,
      },
      {
        word: 'world',
        index: 1,
        startTime: 1.0,
        endTime: 1.5,
        duration: 0.5,
        segmentId: 'seg-1',
        isEmphasis: false,
      },
    ];

    const updated = updateSegmentTiming(segment, wordTimings);

    expect(updated.timing.actualStartSec).toBe(0.5);
    expect(updated.timing.actualEndSec).toBe(1.5);
    expect(updated.timing.actualDurationSec).toBe(1.0);
    expect(updated.timing.timingSource).toBe('extracted');
    expect(updated.timing.wordTimings).toEqual(wordTimings);
  });

  it('should not modify segment with empty word timings', () => {
    const segment = createSegment('seg-1', 'Hello world');
    const updated = updateSegmentTiming(segment, []);

    expect(updated.timing.actualStartSec).toBeUndefined();
    expect(updated.timing.wordTimings).toBeUndefined();
  });
});

describe('applyWordTimingsToSegments', () => {
  it('should apply timings to all segments', () => {
    const segment1: DirectionSegment = {
      id: 'seg-1',
      type: 'narration',
      content: { text: 'Hello', speakerNotes: '' },
      timing: {
        estimatedStartSec: 0,
        estimatedEndSec: 1,
        estimatedDurationSec: 1,
        timingSource: 'estimated',
      },
    };

    const mappingResult = {
      segmentTimings: new Map([
        ['seg-1', [
          {
            word: 'Hello',
            index: 0,
            startTime: 0,
            endTime: 0.5,
            duration: 0.5,
            segmentId: 'seg-1',
            isEmphasis: false,
          },
        ]],
      ]),
      allWordTimings: [],
      stats: {
        expectedWordCount: 1,
        sttWordCount: 1,
        mappedWordCount: 1,
        unmappedWordCount: 0,
        matchRatio: 1,
        incompleteSegments: [],
      },
    };

    const updated = applyWordTimingsToSegments([segment1], mappingResult);

    expect(updated.length).toBe(1);
    expect(updated[0].timing.actualStartSec).toBe(0);
    expect(updated[0].timing.actualEndSec).toBe(0.5);
  });
});

// -----------------------------------------------------------------------------
// Recovery and Edge Case Tests (Task 3: Subtasks 3.1–3.6)
// -----------------------------------------------------------------------------

describe('mapWordsToSegments - recovery and edge cases', () => {
  const createSegment = (id: string, text: string): DirectionSegment => ({
    id,
    type: 'narration',
    content: {
      text,
      speakerNotes: '',
    },
    timing: {
      estimatedStartSec: 0,
      estimatedEndSec: 1,
      estimatedDurationSec: 1,
      timingSource: 'estimated',
    },
  });

  const createSTTWord = (word: string, startTime: number, endTime: number): STTWord => ({
    word,
    startTime,
    endTime,
    confidence: 0.95,
  });

  // 3.1: Test attemptRecovery with skip-stt action (STT word skipped)
  it('should skip extra STT words and still map expected words (skip-stt recovery)', () => {
    const segments = [createSegment('seg-1', 'Hello world')];

    // STT has extra word "um" between Hello and world
    const sttWords: STTWord[] = [
      createSTTWord('Hello', 0, 0.5),
      createSTTWord('um', 0.5, 0.6), // extra STT word
      createSTTWord('world', 0.6, 1.0),
    ];

    const result = mapWordsToSegments(sttWords, segments, 'test-pipeline');

    // Both segment words should be mapped (skip-stt skips "um")
    expect(result.stats.mappedWordCount).toBe(2);
    expect(result.stats.expectedWordCount).toBe(2);
    const timings = result.segmentTimings.get('seg-1')!;
    expect(timings).toHaveLength(2);
    expect(timings[0].word).toBe('Hello');
    expect(timings[0].startTime).toBe(0);
    expect(timings[0].endTime).toBe(0.5);
    expect(timings[1].word).toBe('world');
    expect(timings[1].startTime).toBe(0.6);
    expect(timings[1].endTime).toBe(1.0);
  });

  // 3.2: Test attemptRecovery with skip-segment action (segment word skipped)
  it('should skip missing segment words when STT is missing them (skip-segment recovery)', () => {
    // Segment has "Hello beautiful world" but STT only produced "Hello world"
    // When "beautiful" doesn't match "world", recovery looks ahead in segment
    // and finds "world" matches STT's "world" → skip-segment
    const segments = [createSegment('seg-1', 'Hello beautiful world')];

    const sttWords: STTWord[] = [
      createSTTWord('Hello', 0, 0.5),
      createSTTWord('world', 0.5, 1.0),
    ];

    const result = mapWordsToSegments(sttWords, segments, 'test-pipeline');

    // "Hello" and "world" should map, "beautiful" is unmapped
    expect(result.stats.mappedWordCount).toBe(2);
    expect(result.stats.expectedWordCount).toBe(3);
    expect(result.stats.unmappedWordCount).toBe(1);
    expect(result.stats.incompleteSegments).toContain('seg-1');
    // Verify timing values of mapped words
    const timings = result.segmentTimings.get('seg-1')!;
    expect(timings[0].word).toBe('Hello');
    expect(timings[0].startTime).toBe(0);
    expect(timings[0].endTime).toBe(0.5);
    // "world" maps to STT "world" at 0.5-1.0
    expect(timings[1].word).toBe('world');
    expect(timings[1].startTime).toBe(0.5);
    expect(timings[1].endTime).toBe(1.0);
  });

  // 3.3: Test attemptRecovery with no-recovery-possible path
  it('should handle no-recovery when words are completely different', () => {
    const segments = [createSegment('seg-1', 'alpha beta gamma')];

    // Completely different words - no recovery possible
    const sttWords: STTWord[] = [
      createSTTWord('one', 0, 0.3),
      createSTTWord('two', 0.3, 0.6),
      createSTTWord('three', 0.6, 1.0),
    ];

    const result = mapWordsToSegments(sttWords, segments, 'test-pipeline');

    // All words fail to map
    expect(result.stats.mappedWordCount).toBe(0);
    expect(result.stats.matchRatio).toBe(0);
  });

  // 3.4: Test multiple consecutive mismatches triggering recovery
  it('should handle multiple consecutive mismatches with recovery', () => {
    const segments = [createSegment('seg-1', 'The quick brown fox')];

    // STT has 2 extra words inserted between "The" and "quick"
    const sttWords: STTWord[] = [
      createSTTWord('The', 0, 0.3),
      createSTTWord('uh', 0.3, 0.4), // extra
      createSTTWord('like', 0.4, 0.5), // extra
      createSTTWord('quick', 0.5, 0.8),
      createSTTWord('brown', 0.8, 1.1),
      createSTTWord('fox', 1.1, 1.4),
    ];

    const result = mapWordsToSegments(sttWords, segments, 'test-pipeline');

    // All 4 segment words should eventually map
    expect(result.stats.mappedWordCount).toBe(4);
    expect(result.stats.expectedWordCount).toBe(4);
  });

  // 3.5: Test 0% match ratio (all words unmapped)
  it('should report 0% match ratio when no words can be mapped', () => {
    const segments = [createSegment('seg-1', 'apple banana cherry')];

    // Completely unrelated words that can't match even with lookahead
    const sttWords: STTWord[] = [
      createSTTWord('xxxx', 0, 0.3),
      createSTTWord('yyyy', 0.3, 0.6),
      createSTTWord('zzzz', 0.6, 1.0),
    ];

    const result = mapWordsToSegments(sttWords, segments, 'test-pipeline');

    expect(result.stats.matchRatio).toBe(0);
    expect(result.stats.mappedWordCount).toBe(0);
    expect(result.stats.unmappedWordCount).toBe(3);
    expect(result.stats.incompleteSegments).toContain('seg-1');
  });

  // 3.6: Test segments with special characters or punctuation only
  it('should handle segments with punctuation-heavy text', () => {
    const segments = [createSegment('seg-1', 'Hello, world! How are you?')];

    const sttWords: STTWord[] = [
      createSTTWord('Hello', 0, 0.3),
      createSTTWord('world', 0.3, 0.6),
      createSTTWord('How', 0.6, 0.8),
      createSTTWord('are', 0.8, 0.9),
      createSTTWord('you', 0.9, 1.0),
    ];

    const result = mapWordsToSegments(sttWords, segments, 'test-pipeline');

    // Punctuation should be stripped during normalization, all words should map
    expect(result.stats.mappedWordCount).toBe(5);
    expect(result.stats.matchRatio).toBe(1);
  });

  it('should handle STT words exhausted before segment complete', () => {
    const segments = [createSegment('seg-1', 'Hello world goodbye')];

    // Only 1 STT word for 3 segment words
    const sttWords: STTWord[] = [
      createSTTWord('Hello', 0, 0.5),
    ];

    const result = mapWordsToSegments(sttWords, segments, 'test-pipeline');

    expect(result.stats.mappedWordCount).toBe(1);
    expect(result.stats.expectedWordCount).toBe(3);
    expect(result.stats.unmappedWordCount).toBe(2);
  });

  it('should handle multiple segments with partial mapping', () => {
    const segments = [
      createSegment('seg-1', 'Hello world'),
      createSegment('seg-2', 'Goodbye friend'),
    ];

    // STT only has words for first segment
    const sttWords: STTWord[] = [
      createSTTWord('Hello', 0, 0.5),
      createSTTWord('world', 0.5, 1.0),
    ];

    const result = mapWordsToSegments(sttWords, segments, 'test-pipeline');

    expect(result.stats.mappedWordCount).toBe(2);
    expect(result.stats.expectedWordCount).toBe(4);
    expect(result.stats.incompleteSegments).toContain('seg-2');
    expect(result.segmentTimings.get('seg-1')!).toHaveLength(2);
    expect(result.segmentTimings.get('seg-2')!).toHaveLength(0);
  });
});
