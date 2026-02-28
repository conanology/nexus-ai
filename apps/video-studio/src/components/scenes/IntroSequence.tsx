import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { getVideoStyleConfig } from '../../utils/style-profile.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import type { SceneComponentProps } from '../../types/scenes.js';

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  x: (i % 7) * 270 + ((i * 31) % 72) - 32,
  y: Math.floor(i / 7) * 250 + ((i * 47) % 84) - 40,
  size: 2 + (i % 3),
  phase: i * 0.64,
}));

export const IntroSequence: React.FC<SceneComponentProps<'intro'>> = (props) => {
  const { visualData, motion } = props;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);
  const styleConfig = getVideoStyleConfig();

  const { episodeNumber, episodeTitle } = visualData;

  const lockupSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.82, stiffness: 190 },
    durationInFrames: 20,
  });

  const lockupScale = interpolate(lockupSpring, [0, 1], [0.86, 1]);
  const lockupOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const lockupY = interpolate(frame, [0, 12], [18, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const kickerOpacity = interpolate(frame, [4, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const lineWidth = interpolate(frame, [15, 30], [0, 280], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cardOpacity = interpolate(frame, [20, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleOpacity = interpolate(frame, [24, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleSheenX = interpolate(frame % 90, [0, 45, 90], [-120, 220, 520]);
  const pulse = 0.95 + Math.sin((frame * 2 * Math.PI) / 110) * 0.05;

  return (
    <AbsoluteFill style={{ ...motionStyles.entranceStyle, ...motionStyles.exitStyle }}>
      <BackgroundGradient
        variant="cool"
        animate
        particles
        particleDensity={styleConfig.profile === 'fireship' ? 'sparse' : 'normal'}
        grid
        gridOpacity={styleConfig.profile === 'fireship' ? 0.035 : 0.05}
      />

      {styleConfig.profile !== 'fireship' &&
        PARTICLES.map((p, i) => {
          const x = p.x + Math.sin(frame * 0.017 + p.phase) * 20;
          const y = p.y + Math.cos(frame * 0.014 + p.phase) * 14;
          const opacity = 0.03 + Math.sin(frame * 0.018 + p.phase) * 0.025;
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
                backgroundColor: withOpacity(COLORS.accentSecondary, Math.max(0.01, opacity)),
              }}
            />
          );
        })}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: `${THEME.safeArea.vertical}px ${THEME.safeArea.horizontal}px`,
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontFamily: THEME.fonts.mono,
            fontSize: 13,
            letterSpacing: 2.4,
            color: withOpacity(COLORS.textSecondary, 0.9),
            textTransform: 'uppercase',
            opacity: kickerOpacity,
            marginBottom: 16,
          }}
        >
          NEXUS AI • SIGNAL BRIEF
        </div>

        <div
          style={{
            opacity: lockupOpacity,
            transform: `translateY(${lockupY}px) scale(${lockupScale})`,
            textAlign: 'center',
            lineHeight: 1,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: 116,
              fontWeight: 800,
              fontFamily: THEME.fonts.heading,
              letterSpacing: styleConfig.titleLetterSpacing,
              color: COLORS.textPrimary,
              textShadow: `0 14px 38px ${withOpacity(COLORS.bgDeepDark, 0.72)}`,
            }}
          >
            NEXUS
          </span>
          <span
            style={{
              fontSize: 116,
              fontWeight: 800,
              fontFamily: THEME.fonts.heading,
              letterSpacing: styleConfig.titleLetterSpacing,
              color: COLORS.accentPrimary,
              textShadow: `0 0 30px ${withOpacity(COLORS.accentPrimary, 0.3)}`,
            }}
          >
            {' '}AI
          </span>

          <div
            style={{
              position: 'absolute',
              left: titleSheenX,
              top: 8,
              width: 130,
              height: 110,
              transform: 'skewX(-20deg)',
              background: `linear-gradient(90deg, ${withOpacity(COLORS.textPrimary, 0)}, ${withOpacity(COLORS.textPrimary, 0.22)}, ${withOpacity(COLORS.textPrimary, 0)})`,
              mixBlendMode: 'screen',
            }}
          />
        </div>

        <div
          style={{
            width: lineWidth,
            height: 2,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${withOpacity(COLORS.accentPrimary, 0.15)}, ${COLORS.accentPrimary}, ${withOpacity(COLORS.accentSecondary, 0.28)})`,
            marginTop: 16,
            boxShadow: `0 0 18px ${withOpacity(COLORS.accentPrimary, 0.3)}`,
          }}
        />

        <div
          style={{
            marginTop: 24,
            minWidth: 520,
            maxWidth: 920,
            padding: '18px 24px',
            borderRadius: 14,
            backgroundColor: withOpacity(COLORS.bgElevated, 0.8),
            border: `1px solid ${withOpacity(COLORS.accentSecondary, 0.24)}`,
            boxShadow: `0 18px 45px ${withOpacity(COLORS.bgDeepDark, 0.55)}`,
            opacity: cardOpacity * pulse,
            backdropFilter: 'blur(10px)',
          }}
        >
          {episodeNumber !== undefined && (
            <div style={{ fontSize: 12, fontFamily: THEME.fonts.mono, fontWeight: 700, letterSpacing: 2.2, color: COLORS.accentSecondary, textTransform: 'uppercase' }}>
              Episode {String(episodeNumber).padStart(3, '0')}
            </div>
          )}

          {episodeTitle && (
            <div style={{ marginTop: 8, fontSize: 38, fontFamily: THEME.fonts.heading, fontWeight: 700, color: COLORS.textPrimary, lineHeight: 1.12, opacity: titleOpacity }}>
              {episodeTitle}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
