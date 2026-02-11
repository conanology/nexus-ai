import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { WorldMap } from '../maps/WorldMap.js';
import { ParticleField } from '../shared/ParticleField.js';
import type { SceneComponentProps } from '../../types/scenes.js';

/** Extract a leading number from a label string, e.g. "Operating in 45 countries" → "45" */
function extractStatNumber(label: string): string | null {
  const match = label.match(/\b(\d[\d,.]*[KkMmBb]?)\b/);
  return match ? match[1] : null;
}

export const MapAnimation: React.FC<SceneComponentProps<'map-animation'>> = (props) => {
  const { visualData } = props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const {
    highlightedCountries,
    highlightColor = COLORS.accentPrimary,
    label,
    animationStyle,
  } = visualData;

  // Label animation
  const labelOpacity = label
    ? interpolate(frame, [20, 30], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  // Extract stat number from label for large display
  const statNumber = label ? extractStatNumber(label) : null;
  const statOpacity = statNumber
    ? interpolate(frame, [18, 26], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0E1A' }}>
      {/* Sparse particles — minimal, the map is the visual */}
      <ParticleField density="sparse" speed="slow" color={COLORS.accentPrimary} />

      {/* World Map — centered, 85% width */}
      <AbsoluteFill
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '85%',
            height: '85%',
            position: 'relative',
          }}
        >
          <WorldMap
            highlightedCountries={highlightedCountries}
            highlightColor={highlightColor}
            animationStyle={animationStyle}
            sceneDurationFrames={durationInFrames}
          />
        </div>
      </AbsoluteFill>

      {/* Label area at bottom center */}
      {label && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            opacity: labelOpacity,
            zIndex: 5,
          }}
        >
          {/* Stat number (large, above label) */}
          {statNumber && (
            <div
              style={{
                fontSize: 64,
                fontFamily: THEME.fonts.heading,
                fontWeight: 700,
                color: COLORS.accentPrimary,
                opacity: statOpacity,
                textShadow: `0 0 20px ${COLORS.accentGlow}`,
              }}
            >
              {statNumber}
            </div>
          )}

          {/* Label text with dark pill background */}
          <div
            style={{
              padding: '10px 28px',
              borderRadius: 30,
              backgroundColor: 'rgba(10, 14, 26, 0.75)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontFamily: THEME.fonts.heading,
                fontWeight: 400,
                color: COLORS.textPrimary,
                letterSpacing: 2,
                textAlign: 'center',
              }}
            >
              {label}
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
