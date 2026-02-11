import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS, withOpacity, gradientBg } from '../../utils/colors.js';
import { ParticleField } from './ParticleField.js';
import { GridOverlay } from './GridOverlay.js';
import { SceneBackgroundImage } from './SceneBackgroundImage.js';
import type { OverlayMode } from './SceneBackgroundImage.js';

export interface BackgroundGradientProps {
  variant?: 'default' | 'warm' | 'cool' | 'intense';
  animate?: boolean;
  particles?: boolean;
  particleDensity?: 'sparse' | 'normal' | 'dense';
  grid?: boolean;
  gridOpacity?: number;
  backgroundImage?: string;
  screenshotImage?: string;
  imageOverlay?: OverlayMode;
}

const GLOW_CONFIG: Record<
  string,
  { primaryColor: string; secondaryColor: string; multiplier: number; secondaryMult: number; ellipse: string }
> = {
  default: {
    primaryColor: COLORS.accentPrimary,
    secondaryColor: COLORS.accentSecondary,
    multiplier: 1.0,
    secondaryMult: 0.5,
    ellipse: '70% 65%',
  },
  cool: {
    primaryColor: COLORS.accentPrimary,
    secondaryColor: COLORS.accentBright,
    multiplier: 1.8,
    secondaryMult: 0.6,
    ellipse: '70% 65%',
  },
  warm: {
    primaryColor: COLORS.warning,
    secondaryColor: COLORS.accentSecondaryBright,
    multiplier: 1.5,
    secondaryMult: 0.7,
    ellipse: '70% 65%',
  },
  intense: {
    primaryColor: COLORS.accentPrimary,
    secondaryColor: COLORS.accentSecondary,
    multiplier: 2.5,
    secondaryMult: 0.8,
    ellipse: '80% 60%',
  },
};

export const BackgroundGradient: React.FC<BackgroundGradientProps> = ({
  variant = 'default',
  animate = true,
  particles = true,
  particleDensity = 'sparse',
  grid = false,
  gridOpacity = 0.05,
  backgroundImage,
  screenshotImage,
  imageOverlay = 'cinematic',
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const config = GLOW_CONFIG[variant];

  const angle = animate
    ? 135 + interpolate(frame, [0, durationInFrames], [-10, 10], {
        extrapolateRight: 'clamp',
      })
    : 135;

  const baseGlowOpacity = animate
    ? interpolate(frame % 90, [0, 45, 90], [0.08, 0.18, 0.08])
    : 0.12;

  const glowY = animate
    ? interpolate(frame, [0, durationInFrames], [45, 55], {
        extrapolateRight: 'clamp',
      })
    : 50;

  const primaryOpacity = baseGlowOpacity * config.multiplier;
  const secondaryOpacity = baseGlowOpacity * config.secondaryMult;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* Layer 1: Base gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: gradientBg(angle),
        }}
      />

      {/* Layer 1b: Primary radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse ${config.ellipse} at 50% ${glowY}%, ${withOpacity(config.primaryColor, primaryOpacity)}, transparent)`,
        }}
      />

      {/* Layer 1c: Secondary accent glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 40% 40% at 70% 60%, ${withOpacity(config.secondaryColor, secondaryOpacity)}, transparent)`,
        }}
      />

      {/* Layer 1d: Lower-third ambient glow — prevents black void at bottom */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80% 35% at 50% 90%, ${withOpacity(config.primaryColor, primaryOpacity * 0.6)}, transparent)`,
        }}
      />

      {/* Layer 1e: Subtle floor gradient — lifts the darkest corners */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to bottom, transparent 50%, ${withOpacity(COLORS.bgElevated, 0.25)} 100%)`,
        }}
      />

      {/* Layer 2: Background image — screenshot takes priority over AI-generated */}
      {screenshotImage ? (
        <SceneBackgroundImage src={screenshotImage} overlay="screenshot" opacity={0.28} />
      ) : backgroundImage ? (
        <SceneBackgroundImage src={backgroundImage} overlay={imageOverlay} />
      ) : null}

      {/* Layer 3: Grid overlay (optional) */}
      {grid && <GridOverlay opacity={gridOpacity} />}

      {/* Layer 4: Particle field (optional) */}
      {particles && <ParticleField density={particleDensity} />}
    </AbsoluteFill>
  );
};
