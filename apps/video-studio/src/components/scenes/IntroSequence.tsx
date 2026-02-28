import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import type { SceneComponentProps } from '../../types/scenes.js';

export const IntroSequence: React.FC<SceneComponentProps<'intro'>> = (props) => {
  const { visualData, motion } = props;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { episodeNumber, episodeTitle } = visualData;

  const lockupSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.82, stiffness: 190 },
    durationInFrames: 18,
  });

  const lockupScale = interpolate(lockupSpring, [0, 1], [0.9, 1]);
  const lockupOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const panelOpacity = interpolate(frame, [16, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ ...motionStyles.entranceStyle, ...motionStyles.exitStyle }}>
      <BackgroundGradient variant="cool" animate />

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
        <div style={{ opacity: lockupOpacity, transform: `scale(${lockupScale})`, textAlign: 'center' }}>
          <div style={{ fontFamily: THEME.fonts.mono, fontSize: 13, letterSpacing: 2.2, color: COLORS.accentSecondary, textTransform: 'uppercase', marginBottom: 12 }}>
            NEXUS AI • DAILY BRIEF
          </div>
          <div>
            <span style={{ fontFamily: THEME.fonts.heading, fontWeight: 800, fontSize: 108, letterSpacing: 2, color: COLORS.textPrimary }}>
              NEXUS
            </span>
            <span style={{ fontFamily: THEME.fonts.heading, fontWeight: 800, fontSize: 108, letterSpacing: 2, color: COLORS.accentPrimary, textShadow: `0 0 24px ${withOpacity(COLORS.accentPrimary, 0.28)}` }}>
              {' '}AI
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            width: 860,
            maxWidth: '88%',
            borderRadius: 16,
            padding: '18px 22px',
            backgroundColor: withOpacity(COLORS.bgElevated, 0.8),
            border: `1px solid ${withOpacity(COLORS.accentSecondary, 0.24)}`,
            boxShadow: `0 18px 46px ${withOpacity(COLORS.bgDeepDark, 0.58)}` ,
            opacity: panelOpacity,
            backdropFilter: 'blur(10px)',
          }}
        >
          {episodeNumber !== undefined && (
            <div style={{ fontFamily: THEME.fonts.mono, fontSize: 12, letterSpacing: 2.2, textTransform: 'uppercase', color: COLORS.accentPrimary, fontWeight: 700 }}>
              Episode {String(episodeNumber).padStart(3, '0')}
            </div>
          )}
          {episodeTitle && (
            <div style={{ marginTop: 8, fontFamily: THEME.fonts.heading, fontSize: 38, lineHeight: 1.12, fontWeight: 700, color: COLORS.textPrimary }}>
              {episodeTitle}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
