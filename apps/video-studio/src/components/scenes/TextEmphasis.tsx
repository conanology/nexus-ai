import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import { SlowZoom } from '../shared/SlowZoom.js';
import { ParallaxContainer } from '../shared/ParallaxContainer.js';
import { AnimatedText } from '../shared/AnimatedText.js';
import type { SceneComponentProps } from '../../types/scenes.js';

export const TextEmphasis: React.FC<SceneComponentProps<'text-emphasis'>> = (props) => {
  const { visualData, motion, backgroundImage, pacing } = props;
  const { durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { phrase, highlightWords, style: rawStyle } = visualData;
  // Override to slam when pacing is punch for extra impact
  const style = (pacing === 'punch' && rawStyle === 'fade') ? 'slam' as const : rawStyle;
  const bgVariant = style === 'slam' ? 'intense' : 'cool';
  const fontSize = phrase.length > 60 ? 72 : 96;

  return (
    <AbsoluteFill>
      <ParallaxContainer layer="background">
        <BackgroundGradient variant={bgVariant} backgroundImage={backgroundImage} />
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
            <AnimatedText
              text={phrase}
              highlightWords={highlightWords}
              animationStyle={style}
              fontSize={fontSize}
              fontWeight={700}
              textAlign="center"
            />
          </div>
        </div>
      </SlowZoom>
      </ParallaxContainer>
    </AbsoluteFill>
  );
};
