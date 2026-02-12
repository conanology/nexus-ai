import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import { SlowZoom } from '../shared/SlowZoom.js';
import { ParallaxContainer } from '../shared/ParallaxContainer.js';
import { CountUpNumber } from '../shared/CountUpNumber.js';
import { GlowEffect } from '../shared/GlowEffect.js';
import type { SceneComponentProps } from '../../types/scenes.js';

/** Parse a stat string like "700", "2.3", "87.5" into a numeric value and decimal count */
function parseStatNumber(numStr: string): { numeric: number; decimals: number } {
  const numeric = parseFloat(numStr);
  const dotIndex = numStr.indexOf('.');
  const decimals = dotIndex === -1 ? 0 : numStr.length - dotIndex - 1;
  return { numeric: isNaN(numeric) ? 0 : numeric, decimals };
}

const COUNT_UP_DURATION = 30;
const LABEL_FADE_DELAY = 10; // frames after count-up completes
const SHAKE_FRAMES = 6; // screen shake after count-up

export const StatCallout: React.FC<SceneComponentProps<'stat-callout'>> = (props) => {
  const { visualData, motion, backgroundImage, screenshotImage } = props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { number: numStr, label, prefix, suffix, countUp, comparison } = visualData;
  const mainStat = parseStatNumber(numStr);
  const countUpDuration = countUp ? COUNT_UP_DURATION : 1;

  const labelDelay = countUp ? countUpDuration + LABEL_FADE_DELAY : 0;
  const labelSlideY = interpolate(frame, [labelDelay, labelDelay + 10], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelOpacity = interpolate(frame, [labelDelay, labelDelay + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Screen shake when count-up completes
  const shakeStart = countUp ? countUpDuration : 0;
  const shakeFrame = frame - shakeStart;
  const shakeX = shakeFrame >= 0 && shakeFrame < SHAKE_FRAMES
    ? Math.sin(shakeFrame * Math.PI * 2.5) * 4 * (1 - shakeFrame / SHAKE_FRAMES)
    : 0;

  if (comparison) {
    const compStat = parseStatNumber(comparison.number);

    const compLabelDelay = countUp ? countUpDuration + 10 + LABEL_FADE_DELAY : 0;
    const compLabelOpacity = interpolate(frame, [compLabelDelay, compLabelDelay + 10], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    return (
      <AbsoluteFill>
        <ParallaxContainer layer="background">
          <BackgroundGradient variant="intense" grid gridOpacity={0.05} backgroundImage={backgroundImage} screenshotImage={screenshotImage} />
          <GlowEffect color={COLORS.accentPrimary} intensity="medium" size={300} position={{ x: 30, y: 45 }} />
          <GlowEffect color={COLORS.accentPrimary} intensity="subtle" size={250} position={{ x: 70, y: 45 }} />
        </ParallaxContainer>

        <ParallaxContainer layer="foreground">
        <SlowZoom direction="in" reactionZoom>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 80,
              zIndex: 2,
              ...motionStyles.entranceStyle,
              ...motionStyles.exitStyle,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 60 }}>
              {/* Left stat (comparison / "before") — slightly dimmer */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.7 }}>
                <CountUpNumber
                  targetNumber={compStat.numeric}
                  decimals={compStat.decimals}
                  fontSize={120}
                  durationFrames={countUpDuration}
                />
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 36,
                    fontFamily: THEME.fonts.heading,
                    fontWeight: 400,
                    color: COLORS.textSecondary,
                    opacity: labelOpacity,
                    textAlign: 'center',
                  }}
                >
                  {comparison.label}
                </div>
              </div>

              {/* Divider arrow */}
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 700,
                  color: COLORS.accentPrimary,
                  opacity: labelOpacity,
                }}
              >
                →
              </span>

              {/* Right stat (main / "after") — full brightness */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <CountUpNumber
                  targetNumber={mainStat.numeric}
                  prefix={prefix}
                  suffix={suffix}
                  decimals={mainStat.decimals}
                  fontSize={120}
                  durationFrames={countUpDuration}
                  delayFrames={countUp ? 10 : 0}
                />
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 36,
                    fontFamily: THEME.fonts.heading,
                    fontWeight: 400,
                    color: COLORS.textSecondary,
                    opacity: compLabelOpacity,
                    textAlign: 'center',
                  }}
                >
                  {label}
                </div>
              </div>
            </div>
          </div>
        </SlowZoom>
        </ParallaxContainer>
      </AbsoluteFill>
    );
  }

  // Normal mode — single stat
  return (
    <AbsoluteFill>
      <ParallaxContainer layer="background">
        <BackgroundGradient variant="intense" grid gridOpacity={0.05} backgroundImage={backgroundImage} screenshotImage={screenshotImage} />
        <GlowEffect color={COLORS.accentPrimary} intensity="medium" size={300} />
      </ParallaxContainer>

      <ParallaxContainer layer="foreground">
      <SlowZoom direction="in" reactionZoom>
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
          <div style={{ transform: `translateX(${shakeX}px)` }}>
            <CountUpNumber
              targetNumber={mainStat.numeric}
              prefix={prefix}
              suffix={suffix}
              decimals={mainStat.decimals}
              fontSize={160}
              durationFrames={countUpDuration}
            />
          </div>

          <div
            style={{
              marginTop: 24,
              fontSize: 40,
              fontFamily: THEME.fonts.heading,
              fontWeight: 400,
              color: COLORS.textSecondary,
              opacity: labelOpacity,
              transform: `translateY(${labelSlideY}px) translateX(${shakeX}px)`,
              textAlign: 'center',
            }}
          >
            {label}
          </div>
        </div>
      </SlowZoom>
      </ParallaxContainer>
    </AbsoluteFill>
  );
};
