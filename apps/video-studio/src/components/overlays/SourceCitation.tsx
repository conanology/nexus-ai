import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { COLORS } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import type { SourceCitationOverlay } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SourceCitationProps extends SourceCitationOverlay {
  fps: number;
  sceneDuration: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EDGE_INSET = 40;

export const SourceCitation: React.FC<SourceCitationProps> = (props) => {
  const { source, delayFrames = 30, durationFrames } = props;
  const frame = useCurrentFrame();

  const delay = delayFrames;

  // Gentle fade in
  const entranceOpacity = interpolate(
    frame,
    [delay, delay + 15],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Exit fade
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

  const opacity = Math.min(entranceOpacity, exitOpacity);
  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: EDGE_INSET,
        left: EDGE_INSET,
        zIndex: 10,
        opacity,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Thin vertical accent bar */}
      <div
        style={{
          width: 2,
          height: 18,
          backgroundColor: COLORS.accentPrimary,
          marginRight: 8,
          flexShrink: 0,
        }}
      />

      {/* Citation text */}
      <span
        style={{
          fontSize: 18,
          fontFamily: THEME.fonts.body,
          fontWeight: 400,
          fontStyle: 'italic',
          color: COLORS.textMuted,
          whiteSpace: 'nowrap',
        }}
      >
        {source}
      </span>
    </div>
  );
};
