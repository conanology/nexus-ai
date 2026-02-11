import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import type { SceneComponentProps } from '../../types/scenes.js';

export const OutroSequence: React.FC<SceneComponentProps<'outro'>> = (props) => {
  const { visualData, motion } = props;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { nextTopicTeaser } = visualData;

  // --- Logo entrance: spring scale 0.9→1.0, opacity 0→1 (frames 10-25) ---
  const logoSpring = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 12, mass: 0.8, stiffness: 200 },
    durationInFrames: 15,
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.9, 1.0]);
  const logoOpacity = logoSpring;

  // --- Accent line: width 0→100 (frames 20-30) ---
  const lineWidth = interpolate(frame, [20, 30], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- CTA: opacity 0→1, translateY 10→0 (frames 25-40) ---
  const ctaOpacity = interpolate(frame, [25, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaTranslateY = interpolate(frame, [25, 40], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- CTA pulse: continuous sin oscillation on opacity (90-frame cycle) ---
  const ctaPulse = 0.85 + Math.sin((frame * 2 * Math.PI) / 90) * 0.15;
  const ctaFinalOpacity = ctaOpacity * ctaPulse;

  // --- Next topic teaser: opacity 0→1 (frames 35-50) ---
  const teaserOpacity = interpolate(frame, [35, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Social handle: opacity 0→1 (frames 40-55) ---
  const socialOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        ...motionStyles.entranceStyle,
        ...motionStyles.exitStyle,
      }}
    >
      <BackgroundGradient variant="intense" />

      {/* Content column */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1,
        }}
      >
        {/* Logo: NEXUS AI (smaller than intro) */}
        <div
          style={{
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
          }}
        >
          <span
            style={{
              fontSize: 80,
              fontWeight: 700,
              fontFamily: THEME.fonts.heading,
              letterSpacing: 8,
              color: COLORS.textPrimary,
            }}
          >
            NEXUS
          </span>
          <span
            style={{
              fontSize: 80,
              fontWeight: 700,
              fontFamily: THEME.fonts.heading,
              letterSpacing: 8,
              color: COLORS.accentPrimary,
            }}
          >
            {' '}AI
          </span>
        </div>

        {/* Accent line */}
        <div
          style={{
            width: lineWidth,
            height: 2,
            backgroundColor: COLORS.accentPrimary,
            borderRadius: 1,
            marginTop: 24,
          }}
        />

        {/* CTA text */}
        <div
          style={{
            marginTop: 32,
            fontSize: 36,
            fontWeight: 700,
            fontFamily: THEME.fonts.heading,
            letterSpacing: 4,
            color: COLORS.accentPrimary,
            opacity: ctaFinalOpacity,
            transform: `translateY(${ctaTranslateY}px)`,
          }}
        >
          SUBSCRIBE FOR MORE
        </div>

        {/* Next topic teaser */}
        {nextTopicTeaser && (
          <div
            style={{
              marginTop: 24,
              fontSize: 32,
              fontFamily: THEME.fonts.heading,
              fontWeight: 400,
              color: COLORS.textSecondary,
              textAlign: 'center',
              opacity: teaserOpacity,
            }}
          >
            NEXT: {nextTopicTeaser}
          </div>
        )}

        {/* Social handle */}
        <div
          style={{
            marginTop: 32,
            fontSize: 28,
            fontFamily: THEME.fonts.heading,
            fontWeight: 400,
            color: COLORS.textMuted,
            opacity: socialOpacity,
          }}
        >
          @NexusAI
        </div>
      </div>
    </AbsoluteFill>
  );
};
