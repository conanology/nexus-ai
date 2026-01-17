import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { TextOnGradientProps } from '../types';

/**
 * TextOnGradient - Fallback component for unmapped visual cues
 * Displays text on a branded gradient background with entrance/exit animations
 */
export const TextOnGradient: React.FC<TextOnGradientProps> = ({
  text = 'Visual Scene',
  data,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Use text from data if provided, otherwise use text prop
  const displayText = data?.text ?? text;
  const fontSize = style?.fontSize ?? THEME.fontSizes['5xl'];

  // Entrance animation (first 15 frames, 0.5 seconds at 30fps)
  const entranceProgress = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: {
      damping: 100,
      mass: 0.5,
    },
  });

  // Exit animation (last 15 frames)
  const exitStartFrame = durationInFrames - 15;
  const exitProgress = frame >= exitStartFrame
    ? spring({
        frame: frame - exitStartFrame,
        fps,
        from: 0,
        to: 1,
        config: {
          damping: 100,
          mass: 0.5,
        },
      })
    : 0;

  // Overall opacity (fade in and fade out)
  const opacity = interpolate(
    exitProgress,
    [0, 1],
    [entranceProgress, 0]
  );

  // Text scale animation (entrance)
  const scale = interpolate(
    entranceProgress,
    [0, 1],
    [0.8, 1]
  );

  // Text Y position (entrance from below)
  const translateY = interpolate(
    entranceProgress,
    [0, 1],
    [50, 0]
  );

  return (
    <AbsoluteFill>
      {/* Branded gradient background */}
      <div
        data-testid="gradient-background"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(135deg, ${THEME.colors.primary} 0%, ${THEME.colors.secondary} 50%, ${THEME.colors.accent} 100%)`,
          opacity: opacity * 0.9, // Slight transparency
        }}
      />

      {/* Overlay pattern for visual interest */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 20% 50%, ${THEME.colors.primaryLight}40 0%, transparent 50%)`,
          opacity,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 80% 50%, ${THEME.colors.accentLight}30 0%, transparent 50%)`,
          opacity,
        }}
      />

      {/* Centered text */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) translateY(${translateY}px) scale(${scale})`,
          opacity,
          maxWidth: '80%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: THEME.fonts.heading,
            fontSize,
            fontWeight: 700,
            color: THEME.colors.text,
            lineHeight: 1.2,
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            padding: THEME.spacing.xl,
          }}
        >
          {displayText}
        </div>
      </div>

      {/* Animated accent bars */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, transparent, ${THEME.colors.text}, transparent)`,
          opacity: opacity * 0.5,
          transform: `scaleX(${entranceProgress})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, transparent, ${THEME.colors.text}, transparent)`,
          opacity: opacity * 0.5,
          transform: `scaleX(${entranceProgress})`,
        }}
      />
    </AbsoluteFill>
  );
};
