import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { COLORS } from '../../utils/colors.js';

const FRAME_W = 1920;
const FRAME_H = 1080;

const DENSITY_MAP = {
  sparse: 30,
  normal: 50,
  dense: 70,
} as const;

const SPEED_MAP = {
  slow: 0.3,
  normal: 0.6,
  fast: 1.0,
} as const;

export interface ParticleFieldProps {
  density?: 'sparse' | 'normal' | 'dense';
  color?: string;
  speed?: 'slow' | 'normal' | 'fast';
}

interface Particle {
  /** Initial x position (0-1920) */
  x0: number;
  /** Initial y position (0-1080) */
  y0: number;
  /** Drift direction x (-1 to 1) */
  dx: number;
  /** Drift direction y (-1 to 1) */
  dy: number;
  /** Circle radius (2-4) */
  r: number;
  /** Base opacity (0.03-0.08) */
  baseOpacity: number;
  /** Whether this particle pulses opacity */
  pulses: boolean;
  /** Phase offset for pulsing (radians) */
  pulsePhase: number;
  /** Pulse speed multiplier */
  pulseSpeed: number;
}

/**
 * Deterministic pseudo-random number generator seeded by an integer.
 * Returns a value in [0, 1).
 */
function seededRandom(seed: number): number {
  let s = ((seed * 1103515245 + 12345) & 0x7fffffff) >>> 0;
  s = ((s * 1103515245 + 12345) & 0x7fffffff) >>> 0;
  return (s % 10000) / 10000;
}

function generateParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const r0 = seededRandom(i * 7 + 1);
    const r1 = seededRandom(i * 7 + 2);
    const r2 = seededRandom(i * 7 + 3);
    const r3 = seededRandom(i * 7 + 4);
    const r4 = seededRandom(i * 7 + 5);
    const r5 = seededRandom(i * 7 + 6);
    const r6 = seededRandom(i * 7 + 7);

    // Drift direction: normalize a random vector
    const rawDx = r2 * 2 - 1;
    const rawDy = r3 * 2 - 1;
    const mag = Math.sqrt(rawDx * rawDx + rawDy * rawDy) || 1;

    particles.push({
      x0: r0 * FRAME_W,
      y0: r1 * FRAME_H,
      dx: rawDx / mag,
      dy: rawDy / mag,
      r: 2 + r4 * 2, // 2-4px
      baseOpacity: 0.08 + r5 * 0.12, // 0.08-0.20
      pulses: r6 > 0.5,
      pulsePhase: r6 * Math.PI * 2,
      pulseSpeed: 0.03 + r4 * 0.04, // radians per frame
    });
  }
  return particles;
}

export const ParticleField: React.FC<ParticleFieldProps> = ({
  density = 'normal',
  color = COLORS.accentPrimary,
  speed = 'normal',
}) => {
  const frame = useCurrentFrame();
  const count = DENSITY_MAP[density];
  const pxPerFrame = SPEED_MAP[speed];

  // Burst mode: at frame 0-10, particles accelerate 3x then settle back
  const burstMultiplier = interpolate(frame, [0, 5, 10], [3.0, 2.0, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const particles = useMemo(() => generateParticles(count), [count]);

  // Parse hex color to rgb for SVG fill with per-particle opacity
  const rgb = useMemo(() => {
    const hex = color.replace('#', '');
    const full = hex.length === 3
      ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      : hex;
    return {
      r: parseInt(full.substring(0, 2), 16),
      g: parseInt(full.substring(2, 4), 16),
      b: parseInt(full.substring(4, 6), 16),
    };
  }, [color]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg
        width={FRAME_W}
        height={FRAME_H}
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        {particles.map((p, i) => {
          // Compute position with drift (burst accelerates early frames)
          const totalDrift = frame * pxPerFrame * burstMultiplier;
          let x = (p.x0 + p.dx * totalDrift) % FRAME_W;
          let y = (p.y0 + p.dy * totalDrift) % FRAME_H;
          // Wrap negatives
          if (x < 0) x += FRAME_W;
          if (y < 0) y += FRAME_H;

          // Compute opacity with optional pulsing
          let opacity = p.baseOpacity;
          if (p.pulses) {
            const pulse = Math.sin(frame * p.pulseSpeed + p.pulsePhase);
            // Map sine [-1,1] to [0.5, 1.5] multiplier
            opacity *= 0.5 + (pulse + 1) * 0.5;
          }

          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={p.r}
              fill={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
