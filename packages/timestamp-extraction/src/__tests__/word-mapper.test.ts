/**
 * Tests for word-mapper module
 */

import { describe, it, expect } from 'vitest';
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
