import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { getVideoStyleConfig } from '../../utils/style-profile.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import type { SceneComponentProps } from '../../types/scenes.js';

export const OutroSequence: React.FC<SceneComponentProps<'outro'>> = (props) => {
  const { visualData, motion } = props;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);
  const styleConfig = getVideoStyleConfig();

  const { nextTopicTeaser } = visualData;

  const logoSpring = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 12, mass: 0.85, stiffness: 180 },
    durationInFrames: 16,
  });

  const logoScale = interpolate(logoSpring, [0, 1], [0.9, 1]);
  const logoOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const panelOpacity = interpolate(frame, [14, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const panelY = interpolate(frame, [14, 26], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const socialOpacity = interpolate(frame, [30, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const shimmerX = interpolate(frame % 100, [0, 50, 100], [-180, 220, 620]);
  const pulse = 0.92 + Math.sin((frame * 2 * Math.PI) / 92) * styleConfig.ctaPulseStrength;
  const finalFade = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ ...motionStyles.entranceStyle, ...motionStyles.exitStyle, opacity: finalFade }}>
      <BackgroundGradient variant="intense" animate particles grid gridOpacity={0.04} />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: `${THEME.safeArea.vertical}px ${THEME.safeArea.horizontal}px`,
          zIndex: 1,
        }}
      >
        <div style={{ opacity: logoOpacity, transform: `scale(${logoScale})`, textAlign: 'center' }}>
          <span style={{ fontSize: 92, fontWeight: 800, fontFamily: THEME.fonts.heading, letterSpacing: styleConfig.titleLetterSpacing, color: COLORS.textPrimary }}>
            NEXUS
          </span>
          <span style={{ fontSize: 92, fontWeight: 800, fontFamily: THEME.fonts.heading, letterSpacing: styleConfig.titleLetterSpacing, color: COLORS.accentPrimary }}>
            {' '}AI
          </span>
        </div>

        <div
          style={{
            marginTop: 22,
            width: 860,
            maxWidth: '88%',
            borderRadius: 18,
            padding: '20px 24px',
            backgroundColor: withOpacity(COLORS.bgElevated, 0.82),
            border: `1px solid ${withOpacity(COLORS.accentPrimary, 0.24)}`,
            boxShadow: `0 20px 55px ${withOpacity(COLORS.bgDeepDark, 0.6)}` ,
            opacity: panelOpacity * pulse,
            transform: `translateY(${panelY}px)`,
            backdropFilter: 'blur(10px)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: shimmerX,
              top: -24,
              width: 180,
              height: 180,
              transform: 'skewX(-24deg)',
              background: `linear-gradient(90deg, ${withOpacity(COLORS.textPrimary, 0)}, ${withOpacity(COLORS.textPrimary, 0.16)}, ${withOpacity(COLORS.textPrimary, 0)})`,
              pointerEvents: 'none',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
            <div>
              <div style={{ fontFamily: THEME.fonts.mono, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase', color: COLORS.accentSecondary, fontWeight: 700 }}>
                Keep Building Smarter
              </div>
              <div style={{ marginTop: 8, fontFamily: THEME.fonts.heading, fontSize: 34, lineHeight: 1.1, color: COLORS.textPrimary, fontWeight: 700 }}>
                Subscribe for the next AI edge
              </div>
            </div>

            <div
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: `linear-gradient(90deg, ${withOpacity(COLORS.accentPrimary, 0.24)}, ${withOpacity(COLORS.accentSecondary, 0.24)})`,
                border: `1px solid ${withOpacity(COLORS.accentPrimary, 0.34)}`,
                fontFamily: THEME.fonts.mono,
                fontWeight: 700,
                color: COLORS.accentPrimary,
                fontSize: 12,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Weekly Premium Drops
            </div>
          </div>

          {nextTopicTeaser && (
            <div style={{ marginTop: 14, fontFamily: THEME.fonts.body, fontSize: 22, color: COLORS.textSecondary, borderTop: `1px solid ${withOpacity(COLORS.textMuted, 0.22)}`, paddingTop: 12 }}>
              <span style={{ color: COLORS.textMuted, fontFamily: THEME.fonts.mono, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' }}>Up Next</span>
              <div style={{ marginTop: 6 }}>{nextTopicTeaser}</div>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 26,
            opacity: socialOpacity,
            fontFamily: THEME.fonts.mono,
            fontSize: 16,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: withOpacity(COLORS.textMuted, 0.92),
          }}
        >
          @NexusAI
        </div>
      </div>
    </AbsoluteFill>
  );
};
