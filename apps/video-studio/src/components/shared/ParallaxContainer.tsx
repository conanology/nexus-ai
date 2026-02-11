import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export type ParallaxLayer = 'background' | 'midground' | 'foreground';

const LAYER_MULTIPLIER: Record<ParallaxLayer, number> = {
  background: 0.3,
  midground: 0.6,
  foreground: 1.0,
};

/** Base drift: 0.5px per frame to the right */
const BASE_DRIFT_PER_FRAME = 0.5;

export interface ParallaxContainerProps {
  layer: ParallaxLayer;
  children: React.ReactNode;
}

/**
 * Enables parallax depth by translating children at different horizontal speeds.
 *
 * Over a 150-frame scene:
 *  - background moves ~22px  (0.5 * 0.3 * 150)
 *  - midground  moves ~45px  (0.5 * 0.6 * 150)
 *  - foreground moves ~75px  (0.5 * 1.0 * 150)
 *
 * Creates a noticeable parallax depth effect between layers.
 */
export const ParallaxContainer: React.FC<ParallaxContainerProps> = ({
  layer,
  children,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const multiplier = LAYER_MULTIPLIER[layer];
  const maxDrift = BASE_DRIFT_PER_FRAME * multiplier * durationInFrames;

  const translateX = interpolate(frame, [0, durationInFrames], [0, maxDrift], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transform: `translateX(${translateX}px)`,
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  );
};
