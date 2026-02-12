import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import { SlowZoom } from '../shared/SlowZoom.js';
import { ParallaxContainer } from '../shared/ParallaxContainer.js';
import { AnimatedText } from '../shared/AnimatedText.js';
import type { SceneComponentProps } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUOTE_MARK_FADE_FRAMES = 15;
const ACCENT_BAR_DRAW_FRAMES = 15;
const TEXT_DELAY = 10;
const ATTRIBUTION_START = 35;
const ROLE_START = 45;

export const Quote: React.FC<SceneComponentProps<'quote'>> = (props) => {
  const { visualData, motion, backgroundImage } = props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { text, attribution, role } = visualData;
  const quoteFontSize = text.length > 150 ? 40 : 48;

  // --- Quotation mark (0-15) — slides down ---
  const quoteMarkOpacity = interpolate(frame, [0, QUOTE_MARK_FADE_FRAMES], [0, 0.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const quoteMarkSlideY = interpolate(frame, [0, QUOTE_MARK_FADE_FRAMES], [-20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Accent bar (5-20, scaleY) ---
  const barScale = interpolate(frame, [5, 5 + ACCENT_BAR_DRAW_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Attribution (starts at ~35) — slides up ---
  const attrOpacity = interpolate(frame, [ATTRIBUTION_START, ATTRIBUTION_START + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const attrSlideY = interpolate(frame, [ATTRIBUTION_START, ATTRIBUTION_START + 10], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Role (starts at ~45) — slides up ---
  const roleOpacity = interpolate(frame, [ROLE_START, ROLE_START + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const roleSlideY = interpolate(frame, [ROLE_START, ROLE_START + 8], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <ParallaxContainer layer="background">
        <BackgroundGradient variant="default" backgroundImage={backgroundImage} imageOverlay="vignette" />
      </ParallaxContainer>

      <ParallaxContainer layer="foreground">
      <SlowZoom direction="pan-right">
        {/* Decorative quotation mark */}
        <div
          style={{
            position: 'absolute',
            top: 80,
            left: 120,
            fontSize: 200,
            fontFamily: 'Georgia, serif',
            fontWeight: 700,
            color: withOpacity(COLORS.accentPrimary, quoteMarkOpacity),
            lineHeight: 1,
            userSelect: 'none',
            zIndex: 2,
            transform: `translateY(${quoteMarkSlideY}px)`,
          }}
        >
          {'\u201C'}
        </div>

        {/* Content area */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '120px 160px',
            zIndex: 2,
            ...motionStyles.entranceStyle,
            ...motionStyles.exitStyle,
          }}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '70%',
              paddingLeft: 32,
            }}
          >
            {/* Vertical accent bar */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                backgroundColor: COLORS.accentPrimary,
                transformOrigin: 'top center',
                transform: `scaleY(${barScale})`,
              }}
            />

            {/* Quote text */}
            <AnimatedText
              text={text}
              animationStyle="fade"
              fontSize={quoteFontSize}
              fontWeight={300}
              textAlign="left"
              delayFrames={TEXT_DELAY}
            />

            {/* Attribution */}
            {attribution && (
              <div
                style={{
                  marginTop: 40,
                  fontSize: 32,
                  fontFamily: THEME.fonts.body,
                  fontWeight: 400,
                  color: COLORS.textSecondary,
                  opacity: attrOpacity,
                  transform: `translateY(${attrSlideY}px)`,
                  fontStyle: 'normal',
                }}
              >
                — {attribution}
              </div>
            )}

            {/* Role */}
            {role && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 28,
                  fontFamily: THEME.fonts.body,
                  fontWeight: 400,
                  color: COLORS.textMuted,
                  opacity: roleOpacity,
                  transform: `translateY(${roleSlideY}px)`,
                }}
              >
                {role}
              </div>
            )}
          </div>
        </div>
      </SlowZoom>
      </ParallaxContainer>
    </AbsoluteFill>
  );
};
