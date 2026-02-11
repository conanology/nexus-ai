import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { COLORS } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import type { FloatingLabelOverlay } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FloatingLabelProps extends FloatingLabelOverlay {
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
      return { top: EDGE_INSET, left: EDGE_INSET };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const UNDERLINE_DRAW_DURATION = 15;

export const FloatingLabel: React.FC<FloatingLabelProps> = (props) => {
  const { text, position, delayFrames = 15, durationFrames } = props;
  const frame = useCurrentFrame();

  const delay = delayFrames;

  // Fade in
  const entranceOpacity = interpolate(
    frame,
    [delay, delay + 12],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Underline draws from left to right
  const underlineProgress = interpolate(
    frame,
    [delay + 5, delay + 5 + UNDERLINE_DRAW_DURATION],
    [0, 100],
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
        ...getPositionStyle(position),
        zIndex: 10,
        opacity,
      }}
    >
      {/* Label text */}
      <div
        style={{
          fontSize: 22,
          fontFamily: THEME.fonts.heading,
          fontWeight: 600,
          color: COLORS.accentPrimary,
          textTransform: 'uppercase',
          letterSpacing: 3,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </div>

      {/* Animated underline */}
      <div
        style={{
          height: 2,
          backgroundColor: COLORS.accentPrimary,
          width: `${underlineProgress}%`,
          marginTop: 4,
        }}
      />
    </div>
  );
};
