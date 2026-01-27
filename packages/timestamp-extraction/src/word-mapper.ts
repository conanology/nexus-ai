/**
 * @nexus-ai/timestamp-extraction
 * Word-to-segment mapping logic
 *
 * Maps STT-recognized words to DirectionDocument segments,
 * handling word variations, punctuation, and mismatches.
 */

import type { DirectionSegment, WordTiming } from '@nexus-ai/script-gen';
import { createPipelineLogger } from '@nexus-ai/core';
import type { STTWord } from './stt-client.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Result of mapping STT words to segments.
 */
export interface WordMappingResult {
  /** Map of segment ID to word timings */
  segmentTimings: Map<string, WordTiming[]>;
  /** Flat array of all word timings */
  allWordTimings: WordTiming[];
  /** Mapping statistics */
  stats: MappingStats;
}

/**
 * Statistics about the word mapping process.
 */
export interface MappingStats {
  /** Total expected words from segments */
  expectedWordCount: number;
  /** Total words from STT */
  sttWordCount: number;
  /** Words successfully mapped */
  mappedWordCount: number;
  /** Words that couldn't be matched */
  unmappedWordCount: number;
  /** Match ratio (0-1) */
  matchRatio: number;
  /** Segments with incomplete mapping */
  incompleteSegments: string[];
}

// -----------------------------------------------------------------------------
// Word Normalization
// -----------------------------------------------------------------------------

/**
 * Normalize a word for comparison by:
 * - Converting to lowercase
 * - Removing punctuation
 * - Removing common contractions
 *
 * @param word - Word to normalize
 * @returns Normalized word
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9']/g, '') // Keep apostrophe for contractions
    .replace(/^'+|'+$/g, ''); // Remove leading/trailing apostrophes
}

/**
 * Check if two normalized words match.
 * Uses exact match first, then Levenshtein distance for fuzzy matching.
 *
 * @param expected - Expected word (from segment)
 * @param actual - Actual word (from STT)
 * @returns True if words match
 */
export function wordsMatch(expected: string, actual: string): boolean {
  // Exact match
  if (expected === actual) return true;

  // Empty check
  if (!expected || !actual) return false;

  // Fuzzy match using Levenshtein distance
  // Allow 20% of word length as error margin
  const maxDistance = Math.max(1, Math.floor(expected.length * 0.2));
  const distance = levenshteinDistance(expected, actual);

  return distance <= maxDistance;
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy word matching to handle minor STT errors.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// -----------------------------------------------------------------------------
// Word-to-Segment Mapping
// -----------------------------------------------------------------------------

/**
 * Map STT-recognized words to DirectionDocument segments.
 *
 * Algorithm:
 * 1. Extract words from each segment in order
 * 2. Match STT words to segment words sequentially
 * 3. Handle mismatches by skipping or interpolating
 * 4. Return mapped word timings with segment associations
 *
 * @param sttWords - Words from STT with timing
 * @param segments - DirectionDocument segments
 * @param pipelineId - Pipeline ID for logging
 * @returns Mapping result
 */
export function mapWordsToSegments(
  sttWords: STTWord[],
  segments: DirectionSegment[],
  pipelineId: string
): WordMappingResult {
  const log = createPipelineLogger(pipelineId, 'timestamp-extraction');
  const segmentTimings = new Map<string, WordTiming[]>();
  const allWordTimings: WordTiming[] = [];

  let sttIndex = 0;
  let expectedWordCount = 0;
  let mappedWordCount = 0;
  const incompleteSegments: string[] = [];

  for (const segment of segments) {
    // Get words from segment text
    const segmentWords = extractWords(segment.content.text);
    expectedWordCount += segmentWords.length;

    if (segmentWords.length === 0) {
      segmentTimings.set(segment.id, []);
      continue;
    }

    const timings: WordTiming[] = [];
    let segmentMappedCount = 0;

    for (let i = 0; i < segmentWords.length; i++) {
      if (sttIndex >= sttWords.length) {
        // No more STT words - remaining segment words are unmapped
        log.warn(
          {
            segmentId: segment.id,
            remainingWords: segmentWords.length - i,
            segmentWordIndex: i,
          },
          'STT words exhausted before segment complete'
        );
        break;
      }

      const expectedWord = normalizeWord(segmentWords[i]);
      const sttWord = sttWords[sttIndex];
      const actualWord = normalizeWord(sttWord.word);

      if (wordsMatch(expectedWord, actualWord)) {
        // Match found - create word timing
        const wordTiming: WordTiming = {
          word: segmentWords[i], // Keep original word (with punctuation)
          index: i,
          startTime: sttWord.startTime,
          endTime: sttWord.endTime,
          duration: sttWord.endTime - sttWord.startTime,
          segmentId: segment.id,
          isEmphasis: isEmphasisWord(segmentWords[i], segment),
        };

        timings.push(wordTiming);
        allWordTimings.push(wordTiming);
        segmentMappedCount++;
        mappedWordCount++;
        sttIndex++;
      } else {
        // Mismatch - try to recover
        const recovery = attemptRecovery(
          expectedWord,
          sttWords,
          sttIndex,
          segmentWords,
          i
        );

        if (recovery.action === 'skip-stt') {
          // STT has extra word - skip it
          log.debug(
            {
              expected: expectedWord,
              actual: actualWord,
              action: 'skip-stt',
            },
            'Word mismatch - skipping STT word'
          );
          sttIndex += recovery.skipCount;
          i--; // Retry this segment word
        } else if (recovery.action === 'skip-segment') {
          // Segment has extra word - skip it (will be unmapped)
          log.debug(
            {
              expected: expectedWord,
              actual: actualWord,
              action: 'skip-segment',
            },
            'Word mismatch - skipping segment word'
          );
          // Don't increment sttIndex, let loop continue
        } else {
          // Can't recover - log and move on
          log.warn(
            {
              expected: expectedWord,
              actual: actualWord,
              sttIndex,
              segmentWordIndex: i,
            },
            'Word mismatch - no recovery possible'
          );
          // Skip both and hope they resync
          sttIndex++;
        }
      }
    }

    // Track incomplete segments
    if (segmentMappedCount < segmentWords.length) {
      incompleteSegments.push(segment.id);
    }

    segmentTimings.set(segment.id, timings);
  }

  // Calculate statistics
  const stats: MappingStats = {
    expectedWordCount,
    sttWordCount: sttWords.length,
    mappedWordCount,
    unmappedWordCount: expectedWordCount - mappedWordCount,
    matchRatio: expectedWordCount > 0 ? mappedWordCount / expectedWordCount : 1,
    incompleteSegments,
  };

  log.info(
    {
      expectedWords: stats.expectedWordCount,
      sttWords: stats.sttWordCount,
      mappedWords: stats.mappedWordCount,
      matchRatio: (stats.matchRatio * 100).toFixed(1) + '%',
      incompleteSegments: stats.incompleteSegments.length,
    },
    'Word mapping complete'
  );

  return {
    segmentTimings,
    allWordTimings,
    stats,
  };
}

/**
 * Extract words from text, splitting on whitespace.
 */
function extractWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Check if a word is marked for emphasis in the segment.
 */
function isEmphasisWord(word: string, segment: DirectionSegment): boolean {
  if (!segment.content.emphasis) return false;

  const normalizedWord = normalizeWord(word);
  return segment.content.emphasis.some(
    (e) => normalizeWord(e.word) === normalizedWord
  );
}

/**
 * Attempt to recover from a word mismatch.
 */
function attemptRecovery(
  expectedWord: string,
  sttWords: STTWord[],
  sttIndex: number,
  segmentWords: string[],
  segmentWordIndex: number
): { action: 'skip-stt' | 'skip-segment' | 'none'; skipCount: number } {
  // Look ahead in STT words (up to 3) for expected word
  for (let i = 1; i <= 3 && sttIndex + i < sttWords.length; i++) {
    if (wordsMatch(expectedWord, normalizeWord(sttWords[sttIndex + i].word))) {
      return { action: 'skip-stt', skipCount: i };
    }
  }

  // Look ahead in segment words (up to 3) for actual word
  const actualWord = normalizeWord(sttWords[sttIndex].word);
  for (let i = 1; i <= 3 && segmentWordIndex + i < segmentWords.length; i++) {
    if (wordsMatch(normalizeWord(segmentWords[segmentWordIndex + i]), actualWord)) {
      return { action: 'skip-segment', skipCount: i };
    }
  }

  return { action: 'none', skipCount: 0 };
}

// -----------------------------------------------------------------------------
// Segment Timing Update
// -----------------------------------------------------------------------------

/**
 * Update segment timing based on mapped word timings.
 *
 * @param segment - Segment to update
 * @param wordTimings - Word timings for this segment
 * @returns Updated segment
 */
export function updateSegmentTiming(
  segment: DirectionSegment,
  wordTimings: WordTiming[]
): DirectionSegment {
  if (wordTimings.length === 0) {
    return segment;
  }

  // Get actual start and end from word timings
  const actualStartSec = wordTimings[0].startTime;
  const actualEndSec = wordTimings[wordTimings.length - 1].endTime;
  const actualDurationSec = actualEndSec - actualStartSec;

  return {
    ...segment,
    timing: {
      ...segment.timing,
      actualStartSec,
      actualEndSec,
      actualDurationSec,
      timingSource: 'extracted',
      wordTimings,
    },
  };
}

/**
 * Apply word timings to all segments in a direction document.
 *
 * @param segments - Original segments
 * @param mappingResult - Word mapping result
 * @returns Updated segments
 */
export function applyWordTimingsToSegments(
  segments: DirectionSegment[],
  mappingResult: WordMappingResult
): DirectionSegment[] {
  return segments.map((segment) => {
    const timings = mappingResult.segmentTimings.get(segment.id) ?? [];
    return updateSegmentTiming(segment, timings);
  });
}
