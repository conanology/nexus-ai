import React from 'react';
import { Img, useCurrentFrame, interpolate, spring } from 'remotion';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { getLogoEntry } from '@nexus-ai/asset-library';
import type { CornerLogoOverlay } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CornerLogoProps extends CornerLogoOverlay {
  fps: number;
  sceneDuration: number;
}

// ---------------------------------------------------------------------------
// Position helpers
// ---------------------------------------------------------------------------

const EDGE_INSET = 40;

function getPositionStyle(position: string): React.CSSProperties {
  switch (position) {
    case 'top-left':
      return { top: EDGE_INSET, left: EDGE_INSET };
    case 'top-right':
      return { top: EDGE_INSET, right: EDGE_INSET };
    case 'bottom-left':
      return { bottom: EDGE_INSET, left: EDGE_INSET };
    case 'bottom-right':
      return { bottom: EDGE_INSET, right: EDGE_INSET };
    default:
      return { top: EDGE_INSET, right: EDGE_INSET };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CornerLogo: React.FC<CornerLogoProps> = (props) => {
  const { companyName, logoSrc, brandColor, position, delayFrames = 15, durationFrames, fps } = props;
  const frame = useCurrentFrame();

  const delay = delayFrames;

  // Entrance: scale 0→1 spring + opacity fade
  const relativeFrame = Math.max(0, frame - delay);
  const entranceScale = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.8 },
    durationInFrames: 20,
  });

  const entranceOpacity = interpolate(
    frame,
    [delay, delay + 10],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Exit: fade out if durationFrames is set
  let exitOpacity = 1;
  if (durationFrames) {
    const exitStart = delay + durationFrames - 10;
    exitOpacity = interpolate(
      frame,
      [exitStart, exitStart + 10],
      [1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
  }

  // Subtle glow pulse
  const glowCycle = (frame - delay) % 60;
  const glowOpacity = frame > delay
    ? interpolate(glowCycle, [0, 30, 60], [0.05, 0.12, 0.05])
    : 0;

  const opacity = Math.min(entranceOpacity, exitOpacity);
  if (opacity <= 0) return null;

  // Resolve abbreviation for fallback
  const entry = getLogoEntry(companyName);
  const abbreviation = entry?.abbreviation ?? companyName.charAt(0).toUpperCase();

  return (
    <div
      style={{
        position: 'absolute',
        ...getPositionStyle(position),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity,
        transform: `scale(${entranceScale})`,
        zIndex: 10,
      }}
    >
      {/* Logo card */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 12,
          backgroundColor: COLORS.bgElevated,
          border: `1px solid ${brandColor}`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: `0 0 16px ${withOpacity(brandColor, glowOpacity)}`,
        }}
      >
        {logoSrc ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ffffff',
              borderRadius: 8,
              padding: 8,
            }}
          >
            <Img
              src={logoSrc}
              style={{
                width: 48,
                height: 48,
                objectFit: 'contain',
              }}
            />
          </div>
        ) : (
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: THEME.fonts.mono,
              color: brandColor,
            }}
          >
            {abbreviation}
          </span>
        )}
      </div>

      {/* Company name label */}
      <div
        style={{
          marginTop: 6,
          fontSize: 18,
          fontFamily: THEME.fonts.body,
          fontWeight: 400,
          color: COLORS.textMuted,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {companyName}
      </div>
    </div>
  );
};
