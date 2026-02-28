import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import { ForegroundScreenshot } from '../shared/ForegroundScreenshot.js';
import { SlowZoom } from '../shared/SlowZoom.js';
import { ParallaxContainer } from '../shared/ParallaxContainer.js';
import { AnimatedText } from '../shared/AnimatedText.js';
import type { SceneComponentProps } from '../../types/scenes.js';

export const FullScreenText: React.FC<SceneComponentProps<'full-screen-text'>> = (props) => {
  const { visualData, motion, backgroundImage, screenshotImage, screenshotDisplayMode, sourceMetadata } = props;
  const isForeground = screenshotDisplayMode === 'foreground' && screenshotImage;
  const bgScreenshot = !isForeground ? screenshotImage : undefined;
  const { durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { text, alignment } = visualData;
  const fontSize = text.length > 100 ? 76 : 98;
  const textAlign = alignment ?? 'center';

  return (
    <AbsoluteFill>
      <ParallaxContainer layer="background">
        <BackgroundGradient variant="default" backgroundImage={backgroundImage} screenshotImage={bgScreenshot} />

        {/* Dark vignette overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(0, 0, 0, 0.4) 100%)',
            zIndex: 1,
          }}
        />
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
            <div style={{ width: '70%', maxWidth: '80%', textTransform: 'uppercase' as const }}>
              <AnimatedText
                text={text}
                animationStyle="stagger-words"
                fontSize={fontSize}
                fontWeight={900}
                textAlign={textAlign}
              />
            </div>
          </div>
        </div>
      </SlowZoom>
      </ParallaxContainer>
      {isForeground && <ForegroundScreenshot src={screenshotImage} sourceMetadata={sourceMetadata} />}
    </AbsoluteFill>
  );
};
