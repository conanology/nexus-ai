import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export type ZoomDirection = 'in' | 'out' | 'pan-left' | 'pan-right';

export interface SlowZoomProps {
  startScale?: number;
  endScale?: number;
  direction?: ZoomDirection;
  /** Quick 5% scale pop on first 8 frames — camera "reaction" for punchy scenes */
  reactionZoom?: boolean;
  children: React.ReactNode;
}

export const SlowZoom: React.FC<SlowZoomProps> = ({
  startScale,
  endScale,
  direction = 'in',
  reactionZoom = false,
  children,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Resolve start/end scale based on direction (if not explicitly provided)
  let resolvedStart = startScale;
  let resolvedEnd = endScale;
  let translateX = 0;

  if (resolvedStart === undefined && resolvedEnd === undefined) {
    switch (direction) {
      case 'in':
        resolvedStart = 1.0;
        resolvedEnd = 1.04;
        break;
      case 'out':
        resolvedStart = 1.06;
        resolvedEnd = 1.0;
        break;
      case 'pan-left':
        resolvedStart = 1.02;
        resolvedEnd = 1.02;
        translateX = interpolate(frame, [0, durationInFrames], [10, -10], {
          extrapolateRight: 'clamp',
        });
        break;
      case 'pan-right':
        resolvedStart = 1.02;
        resolvedEnd = 1.02;
        translateX = interpolate(frame, [0, durationInFrames], [-10, 10], {
          extrapolateRight: 'clamp',
        });
        break;
    }
  }

  const baseScale = interpolate(
    frame,
    [0, durationInFrames],
    [resolvedStart ?? 1.0, resolvedEnd ?? 1.04],
    { extrapolateRight: 'clamp' },
  );

  // Reaction zoom: quick 5% pop on first 8 frames, settles back
  const reactionMult = reactionZoom
    ? interpolate(frame, [0, 3, 8], [1.05, 1.03, 1.0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1.0;

  const scale = baseScale * reactionMult;

  const transform = translateX !== 0
    ? `scale(${scale}) translateX(${translateX}px)`
    : `scale(${scale})`;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        transform,
        transformOrigin: 'center center',
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  );
};
