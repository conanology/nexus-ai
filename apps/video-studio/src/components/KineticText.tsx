import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { THEME } from '../theme.js';
import type { KineticTextProps } from '../types.js';
import type { EmphasisWord, EmphasisEffect } from '../types.js';
import { useMotion } from '../hooks/useMotion.js';

type WordEmphasis = { effect: string; intensity: number };

function findEmphasis(wordText: string, emphasisWords: EmphasisWord[] | undefined): EmphasisWord | undefined {
  if (!emphasisWords) return undefined;
  return emphasisWords.find(
    (ew) => ew.word.toLowerCase() === wordText.toLowerCase(),
  );
}

function getWordEmphasisEffect(
  wordText: string,
  emphasisWords: EmphasisWord[] | undefined,
  emphasisEffect: EmphasisEffect | undefined,
  wordTimingEntry?: { isEmphasis: boolean },
): WordEmphasis | undefined {
  const explicit = findEmphasis(wordText, emphasisWords);
  if (explicit) {
    return { effect: explicit.effect, intensity: explicit.intensity };
  }
  if (wordTimingEntry?.isEmphasis && emphasisEffect) {
    return { effect: emphasisEffect, intensity: 0.8 };
  }
  return undefined;
}

function getEmphasisStyle(emphasis: WordEmphasis | undefined): React.CSSProperties {
  if (!emphasis) return {};

  switch (emphasis.effect) {
    case 'scale':
      // Scale is composed with entrance transform at the render site
      return {};
    case 'glow':
      return { textShadow: `0 0 ${8 * emphasis.intensity}px currentColor` };
    case 'underline':
      return { textDecoration: 'underline', textDecorationColor: THEME.colors.accent };
    case 'color':
      return { color: THEME.colors.accent };
    default:
      return {};
  }
}

function getScaleTransform(emphasis: WordEmphasis | undefined): string {
  if (!emphasis || emphasis.effect !== 'scale') return '';
  return ` scale(${1 + 0.15 * emphasis.intensity})`;
}

/**
 * KineticText - Word-by-word animated text component for kinetic typography.
 *
 * Operates at two animation levels:
 * 1. Segment-level: Uses useMotion hook for entrance/exit/emphasis on the entire text block
 * 2. Word-level: Each word individually animates in at its wordTiming.startTime using spring()
 *
 * When wordTimings are not provided, all text is displayed statically.
 */
export const KineticText: React.FC<KineticTextProps> = ({
  text,
  data,
  style,
  motion,
  emphasisEffect,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const displayText = data?.text ?? text ?? '';
  const wordTimings = data?.wordTimings;
  const emphasisWords = data?.emphasis;

  const words = displayText.split(/\s+/).filter((w) => w.length > 0);

  const fontSize = style?.fontSize ?? THEME.fontSizes['4xl'];
  const fontFamily = style?.fontFamily ?? THEME.fonts.heading;
  const color = style?.color ?? THEME.colors.text;
  const fontWeight = style?.fontWeight ?? 700;

  const renderAnimatedWords = () => {
    return words.map((wordText, i) => {
      const timing = wordTimings && i < wordTimings.length ? wordTimings[i] : undefined;
      const wordStartFrame = timing ? Math.round(timing.startTime * fps) : 0;
      const isVisible = timing ? frame >= wordStartFrame : true;

      const wordSpring = isVisible && timing
        ? spring({
            frame: frame - wordStartFrame,
            fps,
            config: { damping: 15, mass: 0.5, stiffness: 120 },
          })
        : isVisible
          ? 1
          : 0;

      const wordEmphasis = getWordEmphasisEffect(wordText, emphasisWords, emphasisEffect, timing);
      const emphasisStyle = getEmphasisStyle(wordEmphasis);
      const scaleTransform = getScaleTransform(wordEmphasis);

      return (
        <span
          key={i}
          style={{
            opacity: wordSpring,
            transform: `translateY(${(1 - wordSpring) * 10}px)${scaleTransform}`,
            display: 'inline-block',
            ...emphasisStyle,
          }}
        >
          {wordText}
        </span>
      );
    });
  };

  const renderStaticWords = () => {
    return words.map((wordText, i) => {
      const wordEmphasis = getWordEmphasisEffect(wordText, emphasisWords, emphasisEffect, undefined);
      const emphasisStyle = getEmphasisStyle(wordEmphasis);
      const scaleTransform = getScaleTransform(wordEmphasis);

      return (
        <span
          key={i}
          style={{
            opacity: 1,
            transform: scaleTransform ? scaleTransform.trim() : undefined,
            display: 'inline-block',
            ...emphasisStyle,
          }}
        >
          {wordText}
        </span>
      );
    });
  };

  const hasTimings = wordTimings && wordTimings.length > 0;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            ...motionStyles.emphasisStyle,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0 8px',
              alignItems: 'baseline',
              justifyContent: 'center',
              maxWidth: '80%',
              fontSize,
              fontFamily,
              color,
              fontWeight,
              lineHeight: 1.4,
            }}
          >
            {hasTimings ? renderAnimatedWords() : renderStaticWords()}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
