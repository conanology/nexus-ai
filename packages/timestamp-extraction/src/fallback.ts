/**
 * @nexus-ai/timestamp-extraction
 * Fallback timing estimation when STT is unavailable
 *
 * Provides character-weighted timing distribution as a fallback
 * when actual STT extraction cannot be performed.
 */

import type {
  DirectionDocument,
  DirectionSegment,
  WordTiming,
} from '@nexus-ai/script-gen';

import {
  type EstimatedTimingConfig,
  DEFAULT_TIMING_CONFIG,
  SCALING_TOLERANCE,
  countWords,
} from './types.js';

/**
 * Estimate word timings for a single segment using character-weighted distribution.
 *
 * @param segment - The direction segment to process
 * @param segmentStartSec - Start time for this segment in seconds
 * @param config - Timing estimation configuration
 * @returns Array of word timings for the segment
 */
export function estimateWordTimings(
  segment: DirectionSegment,
  segmentStartSec: number,
  config: EstimatedTimingConfig = DEFAULT_TIMING_CONFIG
): WordTiming[] {
  // Split text into words, filtering empty strings
  const words = segment.content.text.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return [];
  }

  const timings: WordTiming[] = [];

  // Calculate total character count (excluding punctuation) for weighting
  const totalChars = words.reduce(
    (sum, w) => sum + stripPunctuation(w).length,
    0
  );

  // If all words are punctuation-only, use uniform distribution
  if (totalChars === 0) {
    return createUniformTimings(words, segment, segmentStartSec, config);
  }

  // Get segment duration, falling back to estimation based on word count
  const segmentDuration =
    segment.timing.estimatedDurationSec ??
    (segment.content.wordCount / (config.wordsPerMinute / 60));

  let currentTime = segmentStartSec;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const cleanWord = stripPunctuation(word);

    // Duration proportional to character count
    const charRatio = cleanWord.length / totalChars;
    let duration = segmentDuration * charRatio;

    // Clamp duration to min/max bounds
    duration = Math.max(
      config.minWordDuration,
      Math.min(config.maxWordDuration, duration)
    );

    // Check if word is an emphasis word
    const isEmphasis =
      segment.content.emphasis?.some(
        (e) => e.word.toLowerCase() === cleanWord.toLowerCase()
      ) ?? false;

    timings.push({
      word: cleanWord,
      index: i,
      startTime: currentTime,
      endTime: currentTime + duration,
      duration,
      segmentId: segment.id,
      isEmphasis,
    });

    // Calculate pause after punctuation
    let pauseAfter = 0;
    if (/[.!?]$/.test(word)) {
      pauseAfter = config.pauseAfterPunctuation;
    } else if (/[,;:]$/.test(word)) {
      pauseAfter = config.pauseAfterComma;
    }

    currentTime += duration + pauseAfter;
  }

  return timings;
}

/**
 * Apply estimated timings to all segments in a direction document.
 *
 * @param document - The direction document to enrich
 * @param audioDurationSec - Total audio duration for scaling
 * @param config - Timing estimation configuration
 * @returns Object containing enriched document and flat word timings array
 */
export function applyEstimatedTimings(
  document: DirectionDocument,
  audioDurationSec: number,
  config: EstimatedTimingConfig = DEFAULT_TIMING_CONFIG
): { document: DirectionDocument; wordTimings: WordTiming[] } {
  const allWordTimings: WordTiming[] = [];

  // Calculate segment start times and collect word timings
  let segmentStartSec = 0;

  // Deep clone the document to avoid mutating the original
  const enrichedDocument: DirectionDocument = JSON.parse(
    JSON.stringify(document)
  );

  for (let i = 0; i < enrichedDocument.segments.length; i++) {
    const segment = enrichedDocument.segments[i];

    // Estimate segment duration if not provided
    const estimatedDuration =
      segment.timing.estimatedDurationSec ??
      calculateSegmentDuration(segment, config);

    // Get word timings for this segment
    const segmentTimings = estimateWordTimings(
      segment,
      segmentStartSec,
      config
    );

    // Add to flat array
    allWordTimings.push(...segmentTimings);

    // Update segment timing with actual start/end based on words
    if (segmentTimings.length > 0) {
      segment.timing.estimatedStartSec = segmentTimings[0].startTime;
      segment.timing.estimatedEndSec =
        segmentTimings[segmentTimings.length - 1].endTime;
      segment.timing.estimatedDurationSec =
        segment.timing.estimatedEndSec - segment.timing.estimatedStartSec;
      segment.timing.timingSource = 'estimated';
    } else {
      // Empty segment - maintain estimated duration
      segment.timing.estimatedStartSec = segmentStartSec;
      segment.timing.estimatedEndSec = segmentStartSec + estimatedDuration;
      segment.timing.estimatedDurationSec = estimatedDuration;
      segment.timing.timingSource = 'estimated';
    }

    // Move to next segment start
    segmentStartSec = segment.timing.estimatedEndSec ?? segmentStartSec + estimatedDuration;
  }

  // Scale timings to match actual audio duration if needed
  if (allWordTimings.length > 0 && audioDurationSec > 0) {
    const lastWordEnd = allWordTimings[allWordTimings.length - 1].endTime;

    // Use adaptive tolerance: percentage-based with minimum floor
    const adaptiveTolerance = Math.max(
      SCALING_TOLERANCE.MIN_TOLERANCE_SEC,
      audioDurationSec * SCALING_TOLERANCE.TOLERANCE_PERCENT
    );

    if (lastWordEnd > 0 && Math.abs(lastWordEnd - audioDurationSec) > adaptiveTolerance) {
      const scaleFactor = audioDurationSec / lastWordEnd;

      // Scale all word timings
      for (const timing of allWordTimings) {
        timing.startTime *= scaleFactor;
        timing.endTime *= scaleFactor;
        timing.duration *= scaleFactor;
      }

      // Scale segment timings
      for (const segment of enrichedDocument.segments) {
        if (segment.timing.estimatedStartSec !== undefined) {
          segment.timing.estimatedStartSec *= scaleFactor;
        }
        if (segment.timing.estimatedEndSec !== undefined) {
          segment.timing.estimatedEndSec *= scaleFactor;
        }
        if (segment.timing.estimatedDurationSec !== undefined) {
          segment.timing.estimatedDurationSec *= scaleFactor;
        }
      }
    }
  }

  return {
    document: enrichedDocument,
    wordTimings: allWordTimings,
  };
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Strip punctuation from a word for character counting.
 */
function stripPunctuation(word: string): string {
  return word.replace(/[.,!?;:'"()\[\]{}]/g, '');
}

/**
 * Calculate estimated segment duration based on word count.
 */
function calculateSegmentDuration(
  segment: DirectionSegment,
  config: EstimatedTimingConfig
): number {
  const wordCount = segment.content.wordCount ?? countWords(segment.content.text);
  const durationMinutes = wordCount / config.wordsPerMinute;
  return durationMinutes * 60;
}

/**
 * Create uniform timings when character weighting isn't possible.
 */
function createUniformTimings(
  words: string[],
  segment: DirectionSegment,
  segmentStartSec: number,
  config: EstimatedTimingConfig
): WordTiming[] {
  const timings: WordTiming[] = [];
  const segmentDuration =
    segment.timing.estimatedDurationSec ??
    (words.length / (config.wordsPerMinute / 60));

  const durationPerWord = Math.max(
    config.minWordDuration,
    Math.min(config.maxWordDuration, segmentDuration / words.length)
  );

  let currentTime = segmentStartSec;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const cleanWord = stripPunctuation(word);

    timings.push({
      word: cleanWord || word, // Use original if all punctuation
      index: i,
      startTime: currentTime,
      endTime: currentTime + durationPerWord,
      duration: durationPerWord,
      segmentId: segment.id,
      isEmphasis: false,
    });

    currentTime += durationPerWord;
  }

  return timings;
}
