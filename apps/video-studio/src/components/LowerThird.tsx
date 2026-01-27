import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { LowerThirdProps } from '../types';
import { useMotion } from '../hooks/useMotion.js';

export const LowerThird: React.FC<LowerThirdProps> = ({
  text = 'Source Citation',
  subtitle = '',
  data,
  style,
  motion,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const citation = data?.citation ?? text;
  const source = data?.source ?? subtitle;

  const position = style?.position ?? 'bottom';
  const backgroundColor = style?.backgroundColor ?? THEME.colors.backgroundDark;

  // Slide in animation
  const slideProgress = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  const slideX = interpolate(slideProgress, [0, 1], [-400, 0]);

  // Position styling
  const positionStyle = position === 'bottom'
    ? { bottom: THEME.spacing['2xl'] }
    : { top: THEME.spacing['2xl'] };

  return (
    <AbsoluteFill>
      <div
        style={{
          width: '100%',
          height: '100%',
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
      {/* Lower third bar */}
      <div
        style={{
          position: 'absolute',
          left: THEME.spacing['2xl'],
          ...positionStyle,
          transform: `translateX(${slideX}px)`,
          opacity: slideProgress,
        }}
      >
        {/* Background with gradient */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: THEME.spacing.xs,
            padding: `${THEME.spacing.md}px ${THEME.spacing.xl}px`,
            backgroundColor: `${backgroundColor}E6`, // 90% opacity
            borderLeft: `4px solid ${THEME.colors.primary}`,
            borderRadius: `0 ${THEME.borderRadius.md}px ${THEME.borderRadius.md}px 0`,
            boxShadow: THEME.shadows.xl,
            backdropFilter: 'blur(10px)',
            minWidth: 400,
            maxWidth: 800,
          }}
        >
          {/* Accent gradient overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 100,
              background: `linear-gradient(90deg, transparent, ${THEME.colors.primary}20)`,
              borderRadius: `0 ${THEME.borderRadius.md}px ${THEME.borderRadius.md}px 0`,
            }}
          />

          {/* Main text */}
          <div
            style={{
              fontFamily: THEME.fonts.heading,
              fontSize: THEME.fontSizes.xl,
              color: THEME.colors.text,
              fontWeight: 700,
              lineHeight: 1.3,
              position: 'relative',
              zIndex: 1,
              ...motionStyles.emphasisStyle,
            }}
          >
            {citation}
          </div>

          {/* Subtitle/Source */}
          {source && (
            <div
              style={{
                fontFamily: THEME.fonts.body,
                fontSize: THEME.fontSizes.sm,
                color: THEME.colors.textSecondary,
                fontWeight: 500,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {source}
            </div>
          )}
        </div>

        {/* Animated accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            left: 0,
            height: 2,
            width: `${slideProgress * 100}%`,
            background: `linear-gradient(90deg, ${THEME.colors.primary}, ${THEME.colors.accent})`,
            boxShadow: `0 0 10px ${THEME.colors.primary}`,
          }}
        />
      </div>

      {/* Pulsing indicator dot */}
      <div
        style={{
          position: 'absolute',
          left: THEME.spacing['2xl'] - 12,
          ...(position === 'bottom'
            ? { bottom: THEME.spacing['2xl'] + 20 }
            : { top: THEME.spacing['2xl'] + 20 }),
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: THEME.colors.primary,
          opacity: slideProgress,
          boxShadow: `0 0 ${10 + Math.sin(frame / 15) * 5}px ${THEME.colors.primary}`,
          animation: 'pulse 2s infinite',
        }}
      />
      </div>
    </AbsoluteFill>
  );
};
