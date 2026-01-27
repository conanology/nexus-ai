import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { MetricsCounterProps } from '../types';
import { useMotion } from '../hooks/useMotion.js';

export const MetricsCounter: React.FC<MetricsCounterProps> = ({
  title = 'Metric',
  value = 100,
  unit = '',
  data,
  style,
  motion,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const startValue = data?.start ?? 0;
  const endValue = data?.end ?? value;
  const label = data?.label ?? title;

  // Animate counter value
  const counterProgress = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  const currentValue = interpolate(counterProgress, [0, 1], [startValue, endValue]);

  // Format number with commas
  const formattedValue = Math.round(currentValue).toLocaleString();

  const fontSize = style?.fontSize ?? THEME.fontSizes['8xl'];
  const color = style?.color ?? THEME.colors.primary;

  // Pulse animation
  const pulseScale = 1 + Math.sin(frame / 10) * 0.02;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.colors.background,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
      {/* Label */}
      <div
        style={{
          fontFamily: THEME.fonts.heading,
          fontSize: THEME.fontSizes['3xl'],
          color: THEME.colors.textSecondary,
          fontWeight: 600,
          marginBottom: THEME.spacing.xl,
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {label}
      </div>

      {/* Counter value */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'baseline',
          ...motionStyles.emphasisStyle,
          transform: `scale(${pulseScale}) ${motionStyles.emphasisStyle.transform === 'none' ? '' : motionStyles.emphasisStyle.transform}`.trim(),
        }}
      >
        {/* Glow effect */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '120%',
            height: '120%',
            background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
            filter: 'blur(40px)',
            opacity: counterProgress,
          }}
        />

        {/* Number */}
        <div
          style={{
            fontFamily: THEME.fonts.heading,
            fontSize: fontSize,
            color: color,
            fontWeight: 800,
            lineHeight: 1,
            opacity: counterProgress,
            position: 'relative',
          }}
        >
          {formattedValue}
        </div>

        {/* Unit */}
        {unit && (
          <div
            style={{
              fontFamily: THEME.fonts.heading,
              fontSize: fontSize * 0.4,
              color: THEME.colors.textSecondary,
              fontWeight: 600,
              marginLeft: THEME.spacing.md,
              opacity: counterProgress,
            }}
          >
            {unit}
          </div>
        )}
      </div>

      {/* Animated progress bar */}
      <div
        style={{
          marginTop: THEME.spacing['2xl'],
          width: 600,
          height: 8,
          backgroundColor: THEME.colors.backgroundLight,
          borderRadius: THEME.borderRadius.full,
          overflow: 'hidden',
          opacity: interpolate(frame, [10, 30], [0, 1], {
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${counterProgress * 100}%`,
            background: `linear-gradient(90deg, ${color}, ${THEME.colors.accent})`,
            borderRadius: THEME.borderRadius.full,
            boxShadow: THEME.shadows.glow,
          }}
        />
      </div>

      {/* Sparkles effect */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i * Math.PI) / 2 + frame / 20;
        const radius = 200 + Math.sin(frame / 15 + i) * 50;
        const x = 960 + Math.cos(angle) * radius;
        const y = 540 + Math.sin(angle) * radius;
        const sparkleOpacity = interpolate(
          Math.sin(frame / 10 + i * 2),
          [-1, 1],
          [0.2, 0.8]
        );

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: color,
              opacity: sparkleOpacity * counterProgress,
              boxShadow: `0 0 10px ${color}`,
            }}
          />
        );
      })}
      </div>
    </AbsoluteFill>
  );
};
