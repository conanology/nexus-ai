import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity, gradientBg } from '../../utils/colors.js';
import type { SceneComponentProps } from '../../types/scenes.js';

/**
 * NarrationDefault — Fallback scene component
 *
 * Renders an animated gradient background when no specific visual is assigned.
 * Supports three variants: gradient (fully implemented), particles, and grid.
 */
export const NarrationDefault: React.FC<SceneComponentProps<'narration-default'>> = ({
  visualData,
  content,
  motion,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const variant = visualData?.backgroundVariant ?? 'gradient';

  return (
    <AbsoluteFill>
      <div
        style={{
          width: '100%',
          height: '100%',
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
        {variant === 'gradient' && <GradientBackground frame={frame} durationInFrames={durationInFrames} />}
        {variant === 'particles' && <GradientBackground frame={frame} durationInFrames={durationInFrames} />}
        {/* TODO: Implement particles variant in Phase N */}
        {variant === 'grid' && <GradientBackground frame={frame} durationInFrames={durationInFrames} />}
        {/* TODO: Implement grid variant in Phase N */}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Animated gradient background with slowly shifting angle and central glow.
 */
const GradientBackground: React.FC<{
  frame: number;
  durationInFrames: number;
}> = ({ frame, durationInFrames }) => {
  // Slowly rotate the gradient angle over the scene's duration
  const angle = 135 + interpolate(frame, [0, durationInFrames], [0, 60], {
    extrapolateRight: 'clamp',
  });

  // Subtle pulsing glow opacity
  const glowOpacity = interpolate(
    frame % 90,
    [0, 45, 90],
    [0.08, 0.18, 0.08],
  );

  // Gentle vertical drift for the glow center
  const glowY = interpolate(frame, [0, durationInFrames], [45, 55], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Base gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: gradientBg(angle),
        }}
      />

      {/* Radial accent glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 60% 50% at 50% ${glowY}%, ${withOpacity(COLORS.accentPrimary, glowOpacity)}, transparent)`,
        }}
      />

      {/* Secondary glow accent */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 40% 40% at 70% 60%, ${withOpacity(COLORS.accentSecondary, glowOpacity * 0.5)}, transparent)`,
        }}
      />
    </div>
  );
};
