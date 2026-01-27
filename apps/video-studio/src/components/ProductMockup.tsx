import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { THEME } from '../theme';
import type { ProductMockupProps } from '../types';
import { useMotion } from '../hooks/useMotion.js';

export const ProductMockup: React.FC<ProductMockupProps> = ({
  title = 'Product',
  content = 'Product Interface',
  data,
  style,
  motion,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const imageUrl = data?.imageUrl;
  const caption = data?.caption ?? title;

  const backgroundColor = style?.backgroundColor ?? THEME.colors.backgroundLight;
  const borderColor = style?.borderColor ?? THEME.colors.primary;

  // Animation progress
  const progress = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  // Window chrome dimensions
  const mockupWidth = 1200;
  const mockupHeight = 700;
  const mockupX = (1920 - mockupWidth) / 2;
  const mockupY = (1080 - mockupHeight) / 2;

  // Slide in from bottom
  const slideY = interpolate(progress, [0, 1], [100, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.colors.background }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
      {/* Caption/Title */}
      <div
        style={{
          position: 'absolute',
          top: THEME.spacing['2xl'],
          left: THEME.spacing['2xl'],
          fontFamily: THEME.fonts.heading,
          fontSize: THEME.fontSizes['4xl'],
          color: THEME.colors.text,
          fontWeight: 700,
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {caption}
      </div>

      {/* Product Mockup Window */}
      <div
        style={{
          position: 'absolute',
          left: mockupX,
          top: mockupY,
          width: mockupWidth,
          height: mockupHeight,
          opacity: progress,
          ...motionStyles.emphasisStyle,
          transform: `translateY(${slideY}px) scale(${progress}) ${motionStyles.emphasisStyle.transform === 'none' ? '' : motionStyles.emphasisStyle.transform}`.trim(),
        }}
      >
        {/* Outer glow */}
        <div
          style={{
            position: 'absolute',
            inset: -20,
            background: `radial-gradient(circle, ${borderColor}30 0%, transparent 70%)`,
            filter: 'blur(30px)',
          }}
        />

        {/* Window chrome */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            backgroundColor: backgroundColor,
            borderRadius: THEME.borderRadius.xl,
            border: `2px solid ${borderColor}`,
            overflow: 'hidden',
            boxShadow: THEME.shadows.xl,
          }}
        >
          {/* Title bar */}
          <div
            style={{
              height: 48,
              backgroundColor: THEME.colors.backgroundDark,
              borderBottom: `1px solid ${borderColor}40`,
              display: 'flex',
              alignItems: 'center',
              padding: `0 ${THEME.spacing.md}px`,
            }}
          >
            {/* Window controls */}
            <div style={{ display: 'flex', gap: THEME.spacing.sm }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: THEME.colors.error,
                }}
              />
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: THEME.colors.warning,
                }}
              />
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: THEME.colors.success,
                }}
              />
            </div>

            {/* Window title */}
            <div
              style={{
                flex: 1,
                textAlign: 'center',
                fontFamily: THEME.fonts.body,
                fontSize: THEME.fontSizes.sm,
                color: THEME.colors.textMuted,
                fontWeight: 500,
              }}
            >
              {content}
            </div>
          </div>

          {/* Content area */}
          <div
            style={{
              height: mockupHeight - 48,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: THEME.spacing['2xl'],
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={content}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <>
                {/* Placeholder UI */}
                <div
                  style={{
                    width: '80%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: THEME.spacing.lg,
                  }}
                >
                  {/* Header bar */}
                  <div
                    style={{
                      height: 60,
                      backgroundColor: borderColor,
                      borderRadius: THEME.borderRadius.md,
                      opacity: 0.8,
                    }}
                  />

                  {/* Content rows */}
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: 40,
                        backgroundColor: THEME.colors.backgroundDark,
                        borderRadius: THEME.borderRadius.sm,
                        opacity: 0.6 - i * 0.15,
                        width: `${100 - i * 20}%`,
                      }}
                    />
                  ))}

                  {/* Feature cards */}
                  <div
                    style={{
                      display: 'flex',
                      gap: THEME.spacing.md,
                      marginTop: THEME.spacing.lg,
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: 120,
                          backgroundColor: borderColor,
                          borderRadius: THEME.borderRadius.md,
                          opacity: 0.3,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Shimmer effect */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: interpolate(frame, [30, 90], [-200, mockupWidth + 200], {
              extrapolateRight: 'clamp',
            }),
            width: 200,
            height: mockupHeight,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            opacity: interpolate(frame, [30, 60, 90], [0, 1, 0]),
          }}
        />
      </div>
      </div>
    </AbsoluteFill>
  );
};
