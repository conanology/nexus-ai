import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import type { SceneComponentProps } from '../../types/scenes.js';

export const OutroSequence: React.FC<SceneComponentProps<'outro'>> = (props) => {
  const { visualData, motion } = props;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { nextTopicTeaser } = visualData;

  const logoSpring = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 12, mass: 0.85, stiffness: 180 },
    durationInFrames: 16,
  });

  const logoScale = interpolate(logoSpring, [0, 1], [0.92, 1]);
  const logoOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [14, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ ...motionStyles.entranceStyle, ...motionStyles.exitStyle }}>
      <BackgroundGradient variant="intense" animate />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${THEME.safeArea.vertical}px ${THEME.safeArea.horizontal}px`,
        }}
      >
        <div style={{ opacity: logoOpacity, transform: `scale(${logoScale})`, textAlign: 'center' }}>
          <span style={{ fontFamily: THEME.fonts.heading, fontWeight: 800, fontSize: 90, letterSpacing: 2, color: COLORS.textPrimary }}>
            NEXUS
          </span>
          <span style={{ fontFamily: THEME.fonts.heading, fontWeight: 800, fontSize: 90, letterSpacing: 2, color: COLORS.accentPrimary }}>
            {' '}AI
          </span>
        </div>

        <div
          style={{
            marginTop: 22,
            width: 860,
            maxWidth: '88%',
            borderRadius: 16,
            padding: '20px 24px',
            backgroundColor: withOpacity(COLORS.bgElevated, 0.8),
            border: `1px solid ${withOpacity(COLORS.accentPrimary, 0.24)}`,
            boxShadow: `0 20px 50px ${withOpacity(COLORS.bgDeepDark, 0.6)}`,
            opacity: ctaOpacity,
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ fontFamily: THEME.fonts.mono, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase', color: COLORS.accentSecondary, fontWeight: 700 }}>
            Keep Building Smarter
          </div>
          <div style={{ marginTop: 8, fontFamily: THEME.fonts.heading, fontSize: 34, lineHeight: 1.1, color: COLORS.textPrimary, fontWeight: 700 }}>
            Subscribe for the next AI edge
          </div>

          {nextTopicTeaser && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${withOpacity(COLORS.textMuted, 0.24)}`, paddingTop: 12 }}>
              <div style={{ fontFamily: THEME.fonts.mono, fontSize: 11, letterSpacing: 1.6, color: COLORS.textMuted, textTransform: 'uppercase' }}>
                Up Next
              </div>
              <div style={{ marginTop: 6, fontFamily: THEME.fonts.body, fontSize: 22, color: COLORS.textSecondary }}>
                {nextTopicTeaser}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, fontFamily: THEME.fonts.mono, fontSize: 15, letterSpacing: 1.6, textTransform: 'uppercase', color: withOpacity(COLORS.textMuted, 0.92) }}>
          @NexusAI
        </div>
      </div>
    </AbsoluteFill>
  );
};
