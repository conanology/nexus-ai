/**
 * Script Parser
 *
 * Splits a raw script into logical segments of 2-3 sentences each,
 * then distributes frame timing proportionally by character count.
 *
 * Pure function — no side effects, no I/O.
 *
 * @module @nexus-ai/director-agent/script-parser
 */

import type { ScriptSegment } from './types.js';

// =============================================================================
// Constants
// =============================================================================

/** Minimum segment duration in frames (3 seconds at 30fps) */
const MIN_SEGMENT_FRAMES = 90;

/** Maximum segment duration in frames (10 seconds at 30fps) */
const MAX_SEGMENT_FRAMES = 300;

/** Target sentences per segment */
const TARGET_SENTENCES = 2;

/** Maximum sentences before we force a split */
const MAX_SENTENCES = 3;

// =============================================================================
// Sentence Splitting
// =============================================================================

/**
 * Splits text into individual sentences.
 *
 * Handles:
 * - Standard sentence endings (. ! ?) followed by whitespace + uppercase or quote
 * - Preserves abbreviations like "U.S.", "Dr.", "Mr.", "e.g.", "i.e."
 * - Handles quotes: `He said "Wow." Then he left.`
 * - Does not split on decimal numbers: "increased by 2.5 percent"
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const cleaned = text.trim();

  // Common abbreviations that should NOT trigger a sentence split
  const abbreviations = new Set([
    'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st',
    'inc', 'ltd', 'corp', 'co', 'vs', 'etc', 'approx',
    'dept', 'est', 'govt', 'no', 'vol',
    'e.g', 'i.e', 'u.s', 'u.k', 'a.i',
  ]);

  const sentences: string[] = [];
  let current = '';

  for (let i = 0; i < cleaned.length; i++) {
    current += cleaned[i];

    // Check if we're at a sentence-ending punctuation
    if (cleaned[i] === '.' || cleaned[i] === '!' || cleaned[i] === '?') {
      // Look ahead: is there whitespace followed by an uppercase letter or quote?
      const remaining = cleaned.slice(i + 1);
      const lookahead = remaining.match(/^(\s+)/);

      if (!lookahead) {
        // End of string — this is a sentence end
        if (i === cleaned.length - 1) {
          sentences.push(current.trim());
          current = '';
        }
        continue;
      }

      // Check if this period is part of an abbreviation
      if (cleaned[i] === '.') {
        // Get the word before the period
        const beforePeriod = current.slice(0, -1);
        const lastWord = beforePeriod.split(/\s+/).pop()?.toLowerCase() || '';

        if (abbreviations.has(lastWord) || abbreviations.has(lastWord.replace(/\./g, ''))) {
          continue;
        }

        // Check for decimal numbers: "2.5"
        if (/\d$/.test(beforePeriod) && /^\s*\d/.test(remaining)) {
          continue;
        }

        // Check for ellipsis: "..."
        if (cleaned[i + 1] === '.') {
          continue;
        }
      }

      // Check what follows the whitespace
      const afterWhitespace = remaining.trimStart();
      if (afterWhitespace.length > 0) {
        const nextChar = afterWhitespace[0];
        // Sentence boundary: followed by uppercase, quote, or number
        if (/[A-Z"'\u201C\u201D(0-9]/.test(nextChar)) {
          sentences.push(current.trim());
          current = '';
          // Skip the whitespace
          i += lookahead[1].length;
        }
      }
    }
  }

  // Any remaining text becomes the last sentence
  if (current.trim().length > 0) {
    sentences.push(current.trim());
  }

  return sentences.filter((s) => s.length > 0);
}

// =============================================================================
// Paragraph Detection
// =============================================================================

/**
 * Splits text into paragraphs (separated by blank lines or double newlines).
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p.length > 0);
}

// =============================================================================
// Segment Grouping
// =============================================================================

/**
 * Groups sentences into segments of 2-3 sentences each.
 * Single-sentence paragraphs stay as their own segment.
 */
function groupSentences(paragraphs: string[]): string[] {
  const segments: string[] = [];

  for (const paragraph of paragraphs) {
    const sentences = splitIntoSentences(paragraph);

    if (sentences.length === 0) continue;

    // Single sentence paragraph stays alone
    if (sentences.length === 1) {
      segments.push(sentences[0]);
      continue;
    }

    // Group into chunks of TARGET_SENTENCES to MAX_SENTENCES
    let i = 0;
    while (i < sentences.length) {
      const remaining = sentences.length - i;

      // If we have exactly MAX_SENTENCES + 1 left, split as 2+2 instead of 3+1
      if (remaining === MAX_SENTENCES + 1) {
        segments.push(sentences.slice(i, i + TARGET_SENTENCES).join(' '));
        i += TARGET_SENTENCES;
        segments.push(sentences.slice(i, i + TARGET_SENTENCES).join(' '));
        i += TARGET_SENTENCES;
      } else if (remaining <= MAX_SENTENCES) {
        // Take all remaining
        segments.push(sentences.slice(i, i + remaining).join(' '));
        i += remaining;
      } else {
        // Take TARGET_SENTENCES
        segments.push(sentences.slice(i, i + TARGET_SENTENCES).join(' '));
        i += TARGET_SENTENCES;
      }
    }
  }

  return segments;
}

// =============================================================================
// Frame Timing
// =============================================================================

/**
 * Distributes frames proportionally based on character count,
 * enforcing minimum duration per segment.
 *
 * Note: Does NOT enforce MAX_SEGMENT_FRAMES here — that's handled by
 * text-level splitting in the main parseScript function. Frame distribution
 * simply allocates time proportionally; the segment count (driven by
 * sentence grouping) determines individual durations.
 */
function distributeFrames(
  segmentTexts: string[],
  totalDurationFrames: number,
): Array<{ startFrame: number; endFrame: number }> {
  if (segmentTexts.length === 0) return [];

  const totalChars = segmentTexts.reduce((sum, s) => sum + s.length, 0);
  if (totalChars === 0) return [];

  // Proportional allocation with minimum enforcement
  const frames = segmentTexts.map((text) => {
    const proportion = text.length / totalChars;
    return Math.max(MIN_SEGMENT_FRAMES, Math.round(proportion * totalDurationFrames));
  });

  // Normalize so total matches totalDurationFrames exactly
  const currentTotal = frames.reduce((sum, f) => sum + f, 0);
  if (currentTotal !== totalDurationFrames) {
    // Distribute the difference across segments proportionally
    const diff = totalDurationFrames - currentTotal;
    // Apply correction to the largest segment to minimize distortion
    let largestIdx = 0;
    for (let i = 1; i < frames.length; i++) {
      if (frames[i] > frames[largestIdx]) largestIdx = i;
    }
    frames[largestIdx] += diff;

    // Ensure the adjusted segment still meets minimum
    if (frames[largestIdx] < MIN_SEGMENT_FRAMES) {
      frames[largestIdx] = MIN_SEGMENT_FRAMES;
    }
  }

  // Convert to startFrame/endFrame pairs
  const result: Array<{ startFrame: number; endFrame: number }> = [];
  let currentFrame = 0;

  for (const duration of frames) {
    result.push({
      startFrame: currentFrame,
      endFrame: currentFrame + duration,
    });
    currentFrame += duration;
  }

  return result;
}

// =============================================================================
// Segment Splitting for Over-Length
// =============================================================================

/**
 * Splits a text segment that would exceed MAX_SEGMENT_FRAMES into smaller pieces.
 * Tries clause boundaries (commas, semicolons) first, then falls back to word midpoint.
 */
function splitLongSegment(text: string): string[] {
  // Try splitting on clause boundaries
  const clausePattern = /[,;]\s+/g;
  const clauses: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = clausePattern.exec(text)) !== null) {
    clauses.push(text.slice(lastIndex, match.index + 1).trim());
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    clauses.push(text.slice(lastIndex).trim());
  }

  if (clauses.length >= 2) {
    // Group clauses into roughly equal halves
    const mid = Math.ceil(clauses.length / 2);
    return [
      clauses.slice(0, mid).join(' '),
      clauses.slice(mid).join(' '),
    ].filter((s) => s.length > 0);
  }

  // Fallback: split at word midpoint
  const words = text.split(/\s+/);
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    return [
      words.slice(0, mid).join(' '),
      words.slice(mid).join(' '),
    ];
  }

  return [text];
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Parses a script into segments of 2-3 sentences each with proportional frame timing.
 *
 * @param script - Full video script (plain text)
 * @param totalDurationFrames - Total video duration in frames
 * @returns Ordered array of ScriptSegments covering the full duration
 */
export function parseScript(
  script: string,
  totalDurationFrames: number,
): ScriptSegment[] {
  if (!script || script.trim().length === 0) {
    return [];
  }

  if (totalDurationFrames <= 0) {
    return [];
  }

  // Step 1: Split into paragraphs, then group sentences
  const paragraphs = splitIntoParagraphs(script);
  let segmentTexts = groupSentences(paragraphs);

  if (segmentTexts.length === 0) {
    return [];
  }

  // Step 2: Calculate proportional frame timing
  let timings = distributeFrames(segmentTexts, totalDurationFrames);

  // Step 3: Split segments that are both long in text AND would exceed MAX_SEGMENT_FRAMES.
  // We only split when the segment has enough words to warrant it (>= 10 words),
  // and the average frames-per-word suggests the segment would be too long visually.
  // This prevents splitting short texts just because totalDurationFrames is large.
  const minWordsToSplit = 10;
  let needsResplit = true;
  let iterations = 0;
  const maxIterations = 10; // safety valve

  while (needsResplit && iterations < maxIterations) {
    needsResplit = false;
    iterations++;

    const newTexts: string[] = [];
    for (let i = 0; i < segmentTexts.length; i++) {
      const wordCount = segmentTexts[i].split(/\s+/).length;
      const duration = timings[i].endFrame - timings[i].startFrame;

      // Only split if: segment is long enough in text to split meaningfully,
      // AND the duration exceeds max, AND splitting would actually reduce duration
      // (i.e., there are enough total segments that splitting helps)
      if (
        duration > MAX_SEGMENT_FRAMES &&
        wordCount >= minWordsToSplit &&
        segmentTexts.length < totalDurationFrames / MIN_SEGMENT_FRAMES
      ) {
        const parts = splitLongSegment(segmentTexts[i]);
        if (parts.length > 1) {
          newTexts.push(...parts);
          needsResplit = true;
        } else {
          newTexts.push(segmentTexts[i]);
        }
      } else {
        newTexts.push(segmentTexts[i]);
      }
    }

    segmentTexts = newTexts;
    timings = distributeFrames(segmentTexts, totalDurationFrames);
  }

  // Step 4: Build final ScriptSegment array
  return segmentTexts.map((text, index) => ({
    index,
    text,
    startFrame: timings[index].startFrame,
    endFrame: timings[index].endFrame,
    sentenceCount: splitIntoSentences(text).length,
  }));
}
