import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { WORLD_MAP_PATHS } from './world-map-paths.js';

const FRAME_W = 1920;
const FRAME_H = 1080;

export interface WorldMapProps {
  highlightedCountries: string[];
  highlightColor: string;
  baseColor?: string;
  strokeColor?: string;
  animationStyle: 'sequential' | 'pulse' | 'simultaneous';
  sceneDurationFrames: number;
}

/**
 * Parse hex color to RGB components for SVG filter colorization.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    : h;
  return {
    r: parseInt(full.substring(0, 2), 16),
    g: parseInt(full.substring(2, 4), 16),
    b: parseInt(full.substring(4, 6), 16),
  };
}

export const WorldMap: React.FC<WorldMapProps> = ({
  highlightedCountries,
  highlightColor,
  baseColor = 'rgba(255,255,255,0.08)',
  strokeColor = 'rgba(0,212,255,0.15)',
  animationStyle,
  sceneDurationFrames,
}) => {
  const frame = useCurrentFrame();

  const highlightSet = useMemo(
    () => new Set(highlightedCountries.map((c) => c.toUpperCase())),
    [highlightedCountries],
  );

  const rgb = useMemo(() => hexToRgb(highlightColor), [highlightColor]);
  const glowFilterColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;

  // Animation timing
  const ANIM_START = 15; // frames before animation begins
  const highlightCount = highlightedCountries.length;

  // Sequential: per-country stagger
  const sequentialWindow = Math.max(1, Math.floor(sceneDurationFrames * 0.6));
  const perCountryFrames = highlightCount > 0
    ? Math.max(1, Math.floor(sequentialWindow / highlightCount))
    : 1;

  // Pulse ring animation
  const pulseProgress = animationStyle === 'pulse'
    ? interpolate(frame, [ANIM_START, ANIM_START + 20], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
    : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg
        width={FRAME_W}
        height={FRAME_H}
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Glow filter for highlighted countries */}
        <defs>
          <filter id="country-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Render all countries */}
        {WORLD_MAP_PATHS.map((country) => {
          const isHighlighted = highlightSet.has(country.code);

          if (!isHighlighted) {
            // Non-highlighted: base color, thin stroke
            return (
              <path
                key={country.code}
                d={country.path}
                fill={baseColor}
                stroke={strokeColor}
                strokeWidth={0.5}
              />
            );
          }

          // Highlighted country — compute opacity based on animation style
          let opacity = 0;
          const countryIndex = highlightedCountries
            .map((c) => c.toUpperCase())
            .indexOf(country.code);

          switch (animationStyle) {
            case 'sequential': {
              const startFrame = ANIM_START + countryIndex * perCountryFrames;
              opacity = interpolate(frame, [startFrame, startFrame + 8], [0, 0.6], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              break;
            }
            case 'pulse': {
              opacity = interpolate(frame, [ANIM_START, ANIM_START + 12], [0, 0.6], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              break;
            }
            case 'simultaneous': {
              opacity = interpolate(frame, [ANIM_START, ANIM_START + 12], [0, 0.6], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              // Subtle glow intensifies over 30 frames
              const glowBoost = interpolate(frame, [ANIM_START, ANIM_START + 30], [0, 0.15], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              opacity = Math.min(0.75, opacity + glowBoost);
              break;
            }
          }

          return (
            <path
              key={country.code}
              d={country.path}
              fill={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`}
              stroke={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(1, opacity + 0.2)})`}
              strokeWidth={2}
              filter="url(#country-glow)"
            />
          );
        })}

        {/* Pulse ring effect (only for 'pulse' style) */}
        {animationStyle === 'pulse' && frame >= ANIM_START && frame <= ANIM_START + 25 && (
          <circle
            cx={FRAME_W / 2}
            cy={FRAME_H / 2}
            r={pulseProgress * 800}
            fill="none"
            stroke={glowFilterColor}
            strokeWidth={3 * (1 - pulseProgress)}
            opacity={1 - pulseProgress}
          />
        )}
      </svg>
    </AbsoluteFill>
  );
};
