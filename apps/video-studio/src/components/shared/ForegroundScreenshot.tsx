import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';

const ENTRANCE_FRAMES = 15;

interface ForegroundScreenshotProps {
  src: string;
}

/**
 * ForegroundScreenshot — renders a screenshot as a floating foreground window.
 *
 * - 78% x 72% of frame, centered
 * - 3D perspective tilt with floating bob animation
 * - Terminal chrome dots at top
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

  // Floating bob animation
  const float = interpolate(frame % 120, [0, 60, 120], [0, -6, 0]);

  return (
    <AbsoluteFill
      style={{
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        perspective: 1200,
      }}
    >
      <div
        style={{
          width: '78%',
          height: '72%',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 0 30px rgba(170,255,0,0.15), 0 20px 60px rgba(0,0,0,0.6)',
          transform: `perspective(1200px) rotateX(4deg) rotateY(-2deg) translateY(${translateY + float}px)`,
          opacity,
          border: '3px solid rgba(255, 255, 255, 0.9)',
        }}
      >
        {/* Terminal chrome dots */}
        <div
          style={{
            height: 28,
            backgroundColor: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 12,
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ff5f57' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#febc2e' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#28c840' }} />
        </div>
        <Img
          src={src}
          style={{
            width: '100%',
            height: 'calc(100% - 28px)',
            objectFit: 'cover',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
