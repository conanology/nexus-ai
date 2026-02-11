import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export interface SlowZoomProps {
  startScale?: number;
  endScale?: number;
  children: React.ReactNode;
}

export const SlowZoom: React.FC<SlowZoomProps> = ({
  startScale = 1.0,
  endScale = 1.04,
  children,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [startScale, endScale], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        transform: `scale(${scale})`,
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  );
};
