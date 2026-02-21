import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, STICKER_OUTLINE, TEXT_CONTRAST_SHADOW, markerHighlight } from '../../utils/colors.js';
import { getFontProps } from '../../fonts.js';

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

  const headlineFont = getFontProps('headline');
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0 0.3em',
    alignItems: 'baseline',
    justifyContent: textAlign === 'left' ? 'flex-start' : 'center',
    fontFamily: headlineFont.fontFamily,
    fontSize,
    fontWeight: fontWeight >= 700 ? 900 : fontWeight,
    letterSpacing: '-0.02em',
    lineHeight: 1.3,
  };

  const getWordColor = (word: string): string =>
    isHighlighted(word, highlightSet)
      ? COLORS.accentPrimary
      : COLORS.textPrimary;

  const getWordShadow = (word: string): string =>
    isHighlighted(word, highlightSet)
      ? STICKER_OUTLINE
      : TEXT_CONTRAST_SHADOW;

  const getWordTransform = (word: string): string | undefined =>
    isHighlighted(word, highlightSet) ? 'scale(1.15) rotate(-2deg)' : undefined;

  const getWordStyle = (word: string): React.CSSProperties =>
    isHighlighted(word, highlightSet)
      ? { display: 'inline-block', color: getWordColor(word), textShadow: getWordShadow(word), transform: getWordTransform(word), ...markerHighlight() }
      : { display: 'inline-block', color: getWordColor(word), textShadow: getWordShadow(word) };

  if (animationStyle === 'fade') {
    // Slide-up with spring — punchy snap entrance
    const slideSpring = spring({
      frame: effectiveFrame,
      fps,
      config: { damping: 16, mass: 0.5, stiffness: 250 },
      durationInFrames: 8,
    });
    const translateY = interpolate(slideSpring, [0, 1], [30, 0]);
    const scale = interpolate(slideSpring, [0, 1], [0.95, 1.0]);

    return (
      <div
        style={{
          ...containerStyle,
          opacity: slideSpring,
          transform: `translateY(${translateY}px) scale(${scale})`,
        }}
      >
        {words.map((word, i) => (
          <span key={i} style={getWordStyle(word)}>
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
      config: { damping: 12, mass: 0.5, stiffness: 300 },
    });
    const scale = interpolate(slamProgress, [0, 1], [2.2, 1.0]);
    const opacity = effectiveFrame > 0 ? 1 : 0;

    const shakeAmount =
      effectiveFrame > 0 && effectiveFrame <= 5
        ? Math.sin(effectiveFrame * Math.PI * 2) *
          8 *
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
          <span key={i} style={getWordStyle(word)}>
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
        const wordDelay = i * 2;
        const wordFrame = Math.max(0, effectiveFrame - wordDelay);

        const wordProgress = spring({
          frame: wordFrame,
          fps,
          config: { damping: 14, mass: 0.5, stiffness: 200 },
          durationInFrames: 6,
        });

        const translateY = interpolate(wordProgress, [0, 1], [20, 0]);

        return (
          <span
            key={i}
            style={{
              ...getWordStyle(word),
              opacity: wordProgress,
              transform: `translateY(${translateY}px)${isHighlighted(word, highlightSet) ? ' scale(1.15) rotate(-2deg)' : ''}`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
