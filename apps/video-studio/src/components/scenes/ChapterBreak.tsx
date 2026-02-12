import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import type { SceneComponentProps } from '../../types/scenes.js';

export const ChapterBreak: React.FC<SceneComponentProps<'chapter-break'>> = (props) => {
  const { visualData, motion, backgroundImage } = props;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { title, subtitle, chapterNumber } = visualData;
  const titleFontSize = title.length > 30 ? 64 : 80;

  // --- Animation progress values ---

  // Background fade from black (0-15)
  const bgOverlayOpacity = interpolate(frame, [0, 15], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Accent line width (10-25)
  const lineWidth = interpolate(frame, [10, 25], [0, 200], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Chapter number (15-30)
  const chapterOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const chapterTranslateY = interpolate(frame, [15, 30], [-20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Title (20-35) using spring — slam in with scale 1.3→1.0
  const titleProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 12, mass: 0.6, stiffness: 200 },
    durationInFrames: 12,
  });
  const titleScale = interpolate(titleProgress, [0, 1], [1.3, 1.0]);

  // Subtitle (30-45) slides up after title lands
  const subtitleDelay = 30;
  const subtitleProgress = spring({
    frame: Math.max(0, frame - subtitleDelay),
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 180 },
    durationInFrames: 12,
  });
  const subtitleSlideY = interpolate(subtitleProgress, [0, 1], [20, 0]);

  return (
    <AbsoluteFill>
      <BackgroundGradient variant="intense" backgroundImage={backgroundImage} />

      {/* Black overlay that fades out */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#000000',
          opacity: bgOverlayOpacity,
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
          zIndex: 2,
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
        {/* Chapter number */}
        {chapterNumber !== undefined && (
          <div
            style={{
              fontSize: 36,
              fontFamily: THEME.fonts.mono,
              fontWeight: 500,
              color: COLORS.textSecondary,
              letterSpacing: 6,
              marginBottom: 24,
              opacity: chapterOpacity,
              transform: `translateY(${chapterTranslateY}px)`,
            }}
          >
            CHAPTER {String(chapterNumber).padStart(2, '0')}
          </div>
        )}

        {/* Title */}
        <div
          style={{
            fontSize: titleFontSize,
            fontFamily: THEME.fonts.heading,
            fontWeight: 700,
            color: COLORS.textPrimary,
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: '80%',
            opacity: titleProgress,
            transform: `scale(${titleScale})`,
          }}
        >
          {title}
        </div>

        {/* Accent line */}
        <div
          style={{
            width: lineWidth,
            height: 3,
            backgroundColor: COLORS.accentPrimary,
            marginTop: 32,
            marginBottom: 32,
            borderRadius: 2,
          }}
        />

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              fontSize: 36,
              fontFamily: THEME.fonts.body,
              fontWeight: 400,
              color: COLORS.textSecondary,
              textAlign: 'center',
              opacity: subtitleProgress,
              transform: `translateY(${subtitleSlideY}px)`,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
