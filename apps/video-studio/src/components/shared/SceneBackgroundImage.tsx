import React from 'react';
import { Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OverlayMode = 'cinematic' | 'dark' | 'vignette' | 'gradient-bottom' | 'screenshot';

export interface SceneBackgroundImageProps {
  src: string;
  opacity?: number;
  overlay?: OverlayMode;
  zoomEffect?: boolean;
  fadeInFrames?: number;
}

// ---------------------------------------------------------------------------
// Overlay Layers
// ---------------------------------------------------------------------------

const CinematicOverlay: React.FC = () => (
  <>
    {/* Base darkening */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(10, 14, 26, 0.40)',
      }}
    />
    {/* Radial vignette */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(10, 14, 26, 0.8) 100%)',
      }}
    />
    {/* Subtle cyan tint for brand consistency */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0, 212, 255, 0.03)',
      }}
    />
  </>
);

const DarkOverlay: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      backgroundColor: 'rgba(10, 14, 26, 0.75)',
    }}
  />
);

const VignetteOverlay: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background:
        'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(10, 14, 26, 0.4) 0%, rgba(10, 14, 26, 0.9) 100%)',
    }}
  />
);

const GradientBottomOverlay: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background:
        'linear-gradient(to bottom, rgba(10, 14, 26, 0.3) 0%, rgba(10, 14, 26, 0.95) 100%)',
    }}
  />
);

const ScreenshotOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  // Animated glow pulse: oscillates 8-16% over 3-second cycle (90 frames at 30fps)
  const glowPulse = 0.08 + 0.04 * Math.sin(frame * (2 * Math.PI) / 90);

  return (
    <>
      {/* Base darkening — reduced from 70% → 55% to let more screenshot through */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(10, 14, 26, 0.55)',
        }}
      />
      {/* Animated screen glow — pulsing cyan (8-16%) as if screen radiates light */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0, 212, 255, ${glowPulse}), transparent)`,
        }}
      />
      {/* Strong vignette at edges — blends screenshot into dark video aesthetic */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 20%, rgba(10, 14, 26, 0.9) 100%)',
        }}
      />
      {/* Subtle scanline effect — CRT monitor feel */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0, 0, 0, 0.02) 1px, rgba(0, 0, 0, 0.02) 2px)',
          backgroundSize: '100% 2px',
          pointerEvents: 'none',
        }}
      />
      {/* Slight blue tint — unifies screenshot colors with the video palette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 30, 60, 0.15)',
        }}
      />
    </>
  );
};

function renderOverlay(mode: OverlayMode): React.ReactNode {
  switch (mode) {
    case 'cinematic':
      return <CinematicOverlay />;
    case 'dark':
      return <DarkOverlay />;
    case 'vignette':
      return <VignetteOverlay />;
    case 'gradient-bottom':
      return <GradientBottomOverlay />;
    case 'screenshot':
      return <ScreenshotOverlay />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a generated image as an atmospheric background layer.
 *
 * The image feels like it's BEHIND glass — visible but muted, atmospheric
 * not attention-grabbing. Includes cinematic overlay, optional slow zoom,
 * and fade-in from black.
 */
export const SceneBackgroundImage: React.FC<SceneBackgroundImageProps> = ({
  src,
  opacity = 0.50,
  overlay = 'cinematic',
  zoomEffect = true,
  fadeInFrames = 12,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Fade in from 0 → target opacity
  const currentOpacity = interpolate(frame, [0, fadeInFrames], [0, opacity], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Slow zoom: 1.0 → 1.10 over scene duration (cinematic Ken Burns effect)
  const scale = zoomEffect
    ? interpolate(frame, [0, durationInFrames], [1.0, 1.10], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1.0;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: currentOpacity,
      }}
    >
      {/* Image layer with optional zoom */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
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

      {/* Overlay layer(s) */}
      {renderOverlay(overlay)}
    </div>
  );
};
