import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

// =============================================================================
// ColorGrade — Cinematic post-processing for the entire composition
// =============================================================================
//
// Applies on top of ALL scene content:
// 1. Film grain  — subtle animated noise (kills sterile digital feel)
// 2. Vignette    — radial darkening at edges (draws eye to center)
// 3. Color shift — teal shadows + warm highlights (Blade Runner / ColdFusion LUT)
//
// This component wraps the entire composition as the outermost visual layer.
// pointer-events: none on all overlays so it doesn't interfere with interactions.

const FRAME_W = 1920;
const FRAME_H = 1080;

export interface ColorGradeProps {
  /** Enable film grain overlay (default: true) */
  grain?: boolean;
  /** Enable vignette overlay (default: true) */
  vignette?: boolean;
  /** Enable teal-orange color shift (default: true) */
  colorShift?: boolean;
  children: React.ReactNode;
}

/**
 * Deterministic pseudo-random number from a seed (for grain animation).
 * Mulberry32 PRNG — fast, deterministic, good distribution.
 */
function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Film Grain — SVG feTurbulence noise that shifts each frame.
 * Uses the frame number as a seed offset for the turbulence baseFrequency,
 * creating a natural flicker effect. Opacity 0.04 (barely visible).
 */
const FilmGrain: React.FC = () => {
  const frame = useCurrentFrame();

  // Slight variation in baseFrequency per frame for flicker
  const seed = useMemo(() => Math.floor(mulberry32(frame) * 1000), [frame]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay' }}>
      <svg width={FRAME_W} height={FRAME_H} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id={`grain-${frame}`} x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves={3}
              seed={seed}
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix
              type="saturate"
              values="0"
              in="noise"
              result="monoNoise"
            />
          </filter>
        </defs>
        <rect
          width={FRAME_W}
          height={FRAME_H}
          filter={`url(#grain-${frame})`}
          opacity={0.04}
        />
      </svg>
    </AbsoluteFill>
  );
};

/**
 * Vignette — radial gradient that darkens edges.
 * Transparent center → rgba(0,0,0,0.25) at edges.
 */
const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.25) 100%)',
    }}
  />
);

/**
 * Color Shift — Teal shadows + warm highlights (cinematic LUT approximation).
 *
 * Uses an SVG feColorMatrix to:
 * - Push dark areas toward teal (boost blue channel, slight green boost)
 * - Push bright areas toward warm amber (boost red channel slightly)
 * - Keep the effect subtle (10-15% blend via low opacity)
 *
 * The matrix subtly shifts the color balance without heavy-handed filtering.
 */
const ColorShift: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <svg
      width={FRAME_W}
      height={FRAME_H}
      style={{ position: 'absolute', inset: 0 }}
    >
      <defs>
        <filter id="color-grade-lut" colorInterpolationFilters="sRGB">
          {/*
            feColorMatrix values (5x4 matrix, row-major):
            R' = 1.05*R + 0.00*G + -0.02*B + 0 + 0.01
            G' = -0.01*R + 1.02*G + 0.02*B + 0 + 0
            B' = -0.02*R + 0.03*G + 1.08*B + 0 + 0.01
            A' = 0*R + 0*G + 0*B + 1*A + 0

            Effect: slight warm push on reds, teal push on blues,
            very subtle — the 0.12 opacity below controls the blend.
          */}
          <feColorMatrix
            type="matrix"
            values="1.05  0.00 -0.02  0  0.01
                   -0.01  1.02  0.02  0  0.00
                   -0.02  0.03  1.08  0  0.01
                    0     0     0     1  0"
          />
        </filter>
      </defs>
      <rect
        width={FRAME_W}
        height={FRAME_H}
        fill="transparent"
        filter="url(#color-grade-lut)"
        opacity={0.12}
      />
    </svg>
  </AbsoluteFill>
);

// =============================================================================
// Main ColorGrade wrapper
// =============================================================================

export const ColorGrade: React.FC<ColorGradeProps> = ({
  grain = true,
  vignette = true,
  colorShift = true,
  children,
}) => {
  return (
    <AbsoluteFill>
      {/* Scene content renders first (below all post-processing) */}
      {children}

      {/* Post-processing layers (on top of everything) */}
      {colorShift && <ColorShift />}
      {vignette && <Vignette />}
      {grain && <FilmGrain />}
    </AbsoluteFill>
  );
};
