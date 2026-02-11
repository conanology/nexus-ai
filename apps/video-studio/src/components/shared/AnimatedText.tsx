import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, textGlow, TEXT_CONTRAST_SHADOW } from '../../utils/colors.js';
import { THEME } from '../../theme.js';

export interface AnimatedTextProps {
  text: string;
  highlightWords?: string[];
  animationStyle: 'fade' | 'slam' | 'typewriter' | 'stagger-words';
  fontSize: number;
  fontWeight?: number;
  textAlign?: 'center' | 'left';
  delayFrames?: number;
}

interface WordBoundary {
  word: string;
  start: number;
  end: number;
}

function computeWordBoundaries(text: string): WordBoundary[] {
  const boundaries: WordBoundary[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    boundaries.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return boundaries;
}

function isHighlighted(word: string, highlightSet: Set<string>): boolean {
  const clean = word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return highlightSet.has(clean);
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  highlightWords,
  animationStyle,
  fontSize,
  fontWeight = 700,
  textAlign = 'center',
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const effectiveFrame = Math.max(0, frame - delayFrames);

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const highlightSet = new Set(
    (highlightWords ?? []).map((w) => w.toLowerCase()),
  );

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0 0.3em',
    alignItems: 'baseline',
    justifyContent: textAlign === 'left' ? 'flex-start' : 'center',
    fontFamily: THEME.fonts.heading,
    fontSize,
    fontWeight,
    lineHeight: 1.3,
  };

  const getWordColor = (word: string): string =>
    isHighlighted(word, highlightSet)
      ? COLORS.accentPrimary
      : COLORS.textPrimary;

  const getWordShadow = (word: string): string =>
    isHighlighted(word, highlightSet)
      ? textGlow(COLORS.accentPrimary, 'subtle')
      : TEXT_CONTRAST_SHADOW;

  if (animationStyle === 'fade') {
    const fadeProgress = spring({
      frame: effectiveFrame,
      fps,
      config: { damping: 100, mass: 0.5, stiffness: 120 },
      durationInFrames: 15,
    });
    const scale = interpolate(fadeProgress, [0, 1], [0.9, 1.0]);

    return (
      <div
        style={{
          ...containerStyle,
          opacity: fadeProgress,
          transform: `scale(${scale})`,
        }}
      >
        {words.map((word, i) => (
          <span
            key={i}
            style={{ display: 'inline-block', color: getWordColor(word), textShadow: getWordShadow(word) }}
          >
            {word}
          </span>
        ))}
      </div>
    );
  }

  if (animationStyle === 'slam') {
    const slamProgress = spring({
      frame: effectiveFrame,
      fps,
      config: { damping: 12, mass: 0.8, stiffness: 200 },
    });
    const scale = interpolate(slamProgress, [0, 1], [1.4, 1.0]);
    const opacity = effectiveFrame > 0 ? 1 : 0;

    const shakeAmount =
      effectiveFrame > 0 && effectiveFrame <= 5
        ? Math.sin(effectiveFrame * Math.PI * 2) *
          3 *
          (1 - effectiveFrame / 5)
        : 0;

    return (
      <div
        style={{
          ...containerStyle,
          opacity,
          transform: `scale(${scale}) translateX(${shakeAmount}px)`,
        }}
      >
        {words.map((word, i) => (
          <span
            key={i}
            style={{ display: 'inline-block', color: getWordColor(word), textShadow: getWordShadow(word) }}
          >
            {word}
          </span>
        ))}
      </div>
    );
  }

  if (animationStyle === 'typewriter') {
    const totalChars = text.length;
    const visibleChars = Math.min(
      Math.floor(effectiveFrame / 2),
      totalChars,
    );
    const isComplete = visibleChars >= totalChars;
    const showCursor = !isComplete || frame % 30 < 15;

    const boundaries = computeWordBoundaries(text);

    return (
      <div style={containerStyle}>
        {boundaries.map((wb, i) => {
          if (visibleChars <= wb.start) return null;

          const visiblePortion = text.slice(
            wb.start,
            Math.min(visibleChars, wb.end),
          );
          const color = isHighlighted(wb.word, highlightSet)
            ? COLORS.accentPrimary
            : COLORS.textPrimary;

          return (
            <span
              key={i}
              style={{ display: 'inline-block', color, whiteSpace: 'pre' }}
            >
              {visiblePortion}
            </span>
          );
        })}
        {showCursor && (
          <span
            style={{
              display: 'inline-block',
              color: COLORS.accentPrimary,
              fontWeight: 300,
            }}
          >
            |
          </span>
        )}
      </div>
    );
  }

  // stagger-words
  return (
    <div style={containerStyle}>
      {words.map((word, i) => {
        const wordDelay = i * 5;
        const wordFrame = Math.max(0, effectiveFrame - wordDelay);

        const wordProgress = spring({
          frame: wordFrame,
          fps,
          config: { damping: 100, mass: 0.5, stiffness: 120 },
          durationInFrames: 10,
        });

        const translateY = interpolate(wordProgress, [0, 1], [15, 0]);

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: wordProgress,
              transform: `translateY(${translateY}px)`,
              color: getWordColor(word),
              textShadow: getWordShadow(word),
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
