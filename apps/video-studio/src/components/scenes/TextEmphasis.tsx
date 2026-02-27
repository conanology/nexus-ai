import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import { SlowZoom } from '../shared/SlowZoom.js';
import { ParallaxContainer } from '../shared/ParallaxContainer.js';
import { AnimatedText } from '../shared/AnimatedText.js';
import { ForegroundScreenshot } from '../shared/ForegroundScreenshot.js';
import type { SceneComponentProps } from '../../types/scenes.js';

export const TextEmphasis: React.FC<SceneComponentProps<'text-emphasis'>> = (props) => {
  const { visualData, motion, backgroundImage, screenshotImage, screenshotDisplayMode, pacing } = props;
  const isForeground = screenshotDisplayMode === 'foreground' && screenshotImage;
  const bgScreenshot = !isForeground ? screenshotImage : undefined;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  // Scale-bounce entrance: 1.06 → 1.0 in first 3 frames for impact on hard cut
  const entranceBounce = interpolate(frame, [0, 3], [1.06, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const { phrase, highlightWords, style: rawStyle } = visualData;
  // Override to slam when pacing is punch for extra impact
  const style = (pacing === 'punch' && rawStyle === 'fade') ? 'slam' as const : rawStyle;
  const bgVariant = style === 'slam' ? 'intense' : 'cool';
  const fontSize = phrase.length > 60 ? 112 : 140;

  return (
    <AbsoluteFill>
      <ParallaxContainer layer="background">
        <BackgroundGradient variant={bgVariant} backgroundImage={backgroundImage} screenshotImage={bgScreenshot} />
      </ParallaxContainer>

      <ParallaxContainer layer="foreground">
      <SlowZoom direction="in">
        <div
          style={{
            position: 'absolute',
            inset: 0,
            ...motionStyles.entranceStyle,
            ...motionStyles.exitStyle,
          }}
        >
          {/* Radial glow behind text */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse 50% 40% at 50% 50%, ${withOpacity(COLORS.accentPrimary, 0.15)}, transparent)`,
              zIndex: 1,
            }}
          />

          {/* Content with safe zone */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 80,
              zIndex: 2,
              ...motionStyles.emphasisStyle,
            }}
          >
            <div style={{ transform: `scale(${entranceBounce})`, width: '100%', display: 'flex', justifyContent: 'center' }}>
              <div style={{ textTransform: 'uppercase' as const }}>
                <AnimatedText
                  text={phrase}
                  highlightWords={highlightWords}
                  animationStyle={style}
                  fontSize={fontSize}
                  fontWeight={900}
                  textAlign="center"
                />
              </div>
            </div>
          </div>
        </div>
      </SlowZoom>
      </ParallaxContainer>
      {isForeground && <ForegroundScreenshot src={screenshotImage} />}
    </AbsoluteFill>
  );
};
