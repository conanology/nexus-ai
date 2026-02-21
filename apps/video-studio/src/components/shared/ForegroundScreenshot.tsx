import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';

const ENTRANCE_FRAMES = 15;

interface ForegroundScreenshotProps {
  src: string;
}

/**
 * ForegroundScreenshot — renders a screenshot as a floating foreground window.
 *
 * - 65% of frame, centered
 * - border-radius 12px, drop shadow
 * - Subtle perspective tilt
 * - Slide-up entrance over 15 frames
 * - zIndex 5 (below overlays=6, annotations=8)
 */
export const ForegroundScreenshot: React.FC<ForegroundScreenshotProps> = ({ src }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [0, ENTRANCE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ease-out cubic
  const eased = 1 - Math.pow(1 - progress, 3);

  const translateY = (1 - eased) * 60; // slide up 60px
  const opacity = eased;

  return (
    <AbsoluteFill
      style={{
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '78%',
          height: '72%',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
          transform: `translateY(${translateY}px)`,
          opacity,
          border: '3px solid rgba(255, 255, 255, 0.9)',
        }}
      >
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
