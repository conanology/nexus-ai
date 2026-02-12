import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import { SlowZoom } from '../shared/SlowZoom.js';
import { ParallaxContainer } from '../shared/ParallaxContainer.js';
import type { SceneComponentProps } from '../../types/scenes.js';

/**
 * NarrationDefault — Fallback scene component
 *
 * Renders an animated gradient background when no specific visual is assigned.
 * Supports three variants: gradient, particles (denser particle field), and grid.
 */
export const NarrationDefault: React.FC<SceneComponentProps<'narration-default'>> = (props) => {
  const { visualData, motion, backgroundImage, screenshotImage } = props;
  const { durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const variant = visualData?.backgroundVariant ?? 'gradient';

  const showGrid = variant === 'grid';
  const particleDensity = variant === 'particles' ? 'normal' as const : 'sparse' as const;

  return (
    <AbsoluteFill>
      <ParallaxContainer layer="background">
        <BackgroundGradient
          variant="default"
          particles
          particleDensity={particleDensity}
          grid={showGrid}
          gridOpacity={0.04}
          backgroundImage={backgroundImage}
          screenshotImage={screenshotImage}
        />
      </ParallaxContainer>
      <ParallaxContainer layer="foreground">
      <SlowZoom direction="pan-left">
        <div
          style={{
            position: 'absolute',
            inset: 0,
            ...motionStyles.entranceStyle,
            ...motionStyles.exitStyle,
          }}
        />
      </SlowZoom>
      </ParallaxContainer>
    </AbsoluteFill>
  );
};
