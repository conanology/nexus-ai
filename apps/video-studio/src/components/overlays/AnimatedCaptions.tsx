import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import type { WordTiming } from '../../types.js';

export interface AnimatedCaptionsProps {
  wordTimings: WordTiming[];
  /** Frame ranges during which captions should be hidden (e.g. meme reaction cuts) */
  muteRanges?: Array<{ from: number; to: number }>;
}

const CHUNK_SIZE = 12;
const CROSSFADE_FRAMES = 5;
const CAPTION_FONT_SIZE = 48;

/** Sentence-ending punctuation check */
function isSentenceEnd(word: string): boolean {
  return /[.!?]$/.test(word);
}

/**
 * Pre-compute word chunks (~12 words each, preferring sentence boundaries).
 * Each chunk is { startIdx, endIdx } (inclusive range into wordTimings).
 */
function buildChunks(wordTimings: WordTiming[]): Array<{ startIdx: number; endIdx: number }> {
  if (wordTimings.length === 0) return [];

  const chunks: Array<{ startIdx: number; endIdx: number }> = [];
  let chunkStart = 0;

  while (chunkStart < wordTimings.length) {
    let chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, wordTimings.length - 1);

    // Try to extend up to 3 more words to land on a sentence boundary
    if (chunkEnd < wordTimings.length - 1) {
      for (let probe = chunkEnd; probe <= Math.min(chunkEnd + 3, wordTimings.length - 1); probe++) {
        if (isSentenceEnd(wordTimings[probe].word)) {
          chunkEnd = probe;
          break;
        }
      }
    }

    chunks.push({ startIdx: chunkStart, endIdx: chunkEnd });
    chunkStart = chunkEnd + 1;
  }

  return chunks;
}

/** Find the index of the currently spoken word via linear scan */
function findActiveWordIndex(wordTimings: WordTiming[], currentTimeSec: number): number {
  for (let i = 0; i < wordTimings.length; i++) {
    const wt = wordTimings[i];
    if (currentTimeSec >= wt.startTime && currentTimeSec < wt.endTime) {
      return i;
    }
  }
  // If between words, find the nearest upcoming word
  for (let i = 0; i < wordTimings.length; i++) {
    if (wordTimings[i].startTime > currentTimeSec) {
      return i > 0 ? i - 1 : 0;
    }
  }
  return wordTimings.length - 1;
}

export const AnimatedCaptions: React.FC<AnimatedCaptionsProps> = ({ wordTimings, muteRanges }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chunks = useMemo(() => buildChunks(wordTimings), [wordTimings]);

  if (!wordTimings || wordTimings.length === 0 || chunks.length === 0) {
    return null;
  }

  // Hide captions during muted ranges (meme reaction cuts)
  if (muteRanges && muteRanges.length > 0) {
    const absoluteFrame = frame; // frame is relative to the Sequence from={0}
    for (const range of muteRanges) {
      if (absoluteFrame >= range.from && absoluteFrame < range.to) {
        return null;
      }
    }
  }

  const currentTimeSec = frame / fps;
  const activeWordIdx = findActiveWordIndex(wordTimings, currentTimeSec);

  // Find which chunk contains the active word
  let activeChunkIdx = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (activeWordIdx >= chunks[i].startIdx && activeWordIdx <= chunks[i].endIdx) {
      activeChunkIdx = i;
      break;
    }
  }

  const chunk = chunks[activeChunkIdx];
  const chunkWords = wordTimings.slice(chunk.startIdx, chunk.endIdx + 1);

  // Crossfade when chunk changes: fade based on how long we've been in this chunk
  const chunkStartTime = wordTimings[chunk.startIdx].startTime;
  const chunkStartFrame = Math.round(chunkStartTime * fps);
  const framesIntoChunk = frame - chunkStartFrame;
  const chunkFadeIn = interpolate(framesIntoChunk, [0, CROSSFADE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20%',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '24px 48px',
          background:
            'linear-gradient(transparent, rgba(0, 0, 0, 0.4) 20%, rgba(0, 0, 0, 0.6) 50%, rgba(0, 0, 0, 0.4) 80%, transparent)',
          borderRadius: 16,
          textAlign: 'center',
          opacity: chunkFadeIn,
          lineHeight: 1.5,
        }}
      >
        {chunkWords.map((wt) => {
          const isActive =
            currentTimeSec >= wt.startTime && currentTimeSec < wt.endTime;
          const isSpoken = currentTimeSec >= wt.endTime;
          const isUpcoming = currentTimeSec < wt.startTime;

          // Smooth highlight transition: interpolate over 5 frames around word start
          const wordStartFrame = Math.round(wt.startTime * fps);
          const highlightProgress = interpolate(
            frame,
            [wordStartFrame - 2, wordStartFrame + 3],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          let wordColor: string;
          let fontWeight: number;

          if (isActive) {
            wordColor = COLORS.accentPrimary;
            fontWeight = 700;
          } else if (isSpoken) {
            wordColor = COLORS.textPrimary;
            fontWeight = 500;
          } else if (isUpcoming && highlightProgress > 0) {
            // Transitioning toward active — blend from secondary toward primary
            wordColor = COLORS.accentPrimary;
            fontWeight = 500;
          } else {
            wordColor = COLORS.textSecondary;
            fontWeight = 500;
          }

          return (
            <span
              key={`${wt.segmentId}-${wt.index}`}
              style={{
                fontSize: CAPTION_FONT_SIZE,
                fontFamily: THEME.fonts.body,
                fontWeight,
                color: wordColor,
                display: 'inline',
              }}
            >
              {wt.word}{' '}
            </span>
          );
        })}
      </div>
    </div>
  );
};
