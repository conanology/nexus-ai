import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { GlowEffect } from '../shared/GlowEffect.js';
import type { SceneComponentProps } from '../../types/scenes.js';

// Pre-computed particle positions — constant array, no per-frame allocation
const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  baseX: (i % 8) * 240 + ((i * 37) % 60) - 30,
  baseY: Math.floor(i / 8) * 216 + ((i * 53) % 60) - 30,
  size: 2 + (i % 2),
  speedX: 0.3 + (i % 3) * 0.25,
  speedY: 0.2 + (i % 4) * 0.2,
  phaseOffset: i * 0.7,
}));

export const IntroSequence: React.FC<SceneComponentProps<'intro'>> = (props) => {
  const { visualData, motion } = props;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { episodeNumber, episodeTitle } = visualData;

  // --- Logo entrance: spring scale 0.8→1.0 + opacity 0→1 (frames 0-15) ---
  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.8, stiffness: 200 },
    durationInFrames: 15,
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.8, 1.0]);
  const logoOpacity = logoSpring;

  // --- Accent line: width 0→120 (frames 15-25) ---
  const lineWidth = interpolate(frame, [15, 25], [0, 120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Episode number fade (frames 20-35) ---
  const epNumOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Episode title fade (frames 25-40) ---
  const epTitleOpacity = interpolate(frame, [25, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bgDeepDark,
        ...motionStyles.entranceStyle,
        ...motionStyles.exitStyle,
      }}
    >
      {/* Particle grid background */}
      {PARTICLES.map((p, i) => {
        const x = p.baseX + Math.sin(frame * 0.02 + p.phaseOffset) * 30;
        const y = p.baseY + Math.cos(frame * 0.015 + p.phaseOffset) * 20;
        const opacity = 0.05 + Math.sin(frame * 0.03 + p.phaseOffset) * 0.05;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              backgroundColor: withOpacity(COLORS.accentPrimary, opacity),
              pointerEvents: 'none',
            }}
          />
        );
      })}

      {/* GlowEffect behind "AI" — positioned at ~57% x, 50% y */}
      <GlowEffect
        color={COLORS.accentPrimary}
        intensity="medium"
        size={150}
        pulse
        position={{ x: 57, y: 50 }}
      />

      {/* Center content */}
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
        {/* Logo: NEXUS AI */}
        <div
          style={{
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
          }}
        >
          <span
            style={{
              fontSize: 120,
              fontWeight: 700,
              fontFamily: THEME.fonts.heading,
              letterSpacing: 12,
              color: COLORS.textPrimary,
            }}
          >
            NEXUS
          </span>
          <span
            style={{
              fontSize: 120,
              fontWeight: 700,
              fontFamily: THEME.fonts.heading,
              letterSpacing: 12,
              color: COLORS.accentPrimary,
            }}
          >
            {' '}AI
          </span>
        </div>

        {/* Episode info block */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: 20,
          }}
        >
          {/* Accent line */}
          <div
            style={{
              width: lineWidth,
              height: 2,
              backgroundColor: COLORS.accentPrimary,
              borderRadius: 1,
            }}
          />

          {/* Episode number */}
          {episodeNumber !== undefined && (
            <div
              style={{
                marginTop: 16,
                fontSize: 32,
                fontFamily: THEME.fonts.mono,
                fontWeight: 500,
                color: COLORS.textSecondary,
                letterSpacing: 4,
                opacity: epNumOpacity,
              }}
            >
              EP. {String(episodeNumber).padStart(3, '0')}
            </div>
          )}

          {/* Episode title */}
          {episodeTitle && (
            <div
              style={{
                marginTop: 12,
                fontSize: 40,
                fontFamily: THEME.fonts.heading,
                fontWeight: 400,
                color: COLORS.textPrimary,
                textAlign: 'center',
                maxWidth: '60%',
                opacity: epTitleOpacity,
              }}
            >
              {episodeTitle}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
