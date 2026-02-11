import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import type { InfoBadgeOverlay } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InfoBadgeProps extends InfoBadgeOverlay {
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

/**
 * Determine the slide direction based on the position.
 * top-right slides in from right, top-left from left, etc.
 */
function getSlideDirection(position: string): 'left' | 'right' {
  if (position.includes('right')) return 'right';
  return 'left';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InfoBadge: React.FC<InfoBadgeProps> = (props) => {
  const { label, icon, color, position, delayFrames = 20, durationFrames } = props;
  const frame = useCurrentFrame();

  const accentColor = color ?? COLORS.accentPrimary;
  const delay = delayFrames;
  const slideDir = getSlideDirection(position);
  const slideSign = slideDir === 'right' ? 1 : -1;

  // Entrance: slide in + opacity
  const entranceOpacity = interpolate(
    frame,
    [delay, delay + 12],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const slideX = interpolate(
    frame,
    [delay, delay + 12],
    [slideSign * 30, 0],
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

  const opacity = Math.min(entranceOpacity, exitOpacity);
  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        ...getPositionStyle(position),
        zIndex: 10,
        opacity,
        transform: `translateX(${slideX}px)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 36,
          borderRadius: 20,
          backgroundColor: withOpacity(COLORS.bgElevated, 0.85),
          border: `1px solid ${accentColor}`,
          padding: '8px 16px',
        }}
      >
        {icon && (
          <span style={{ fontSize: 18, marginRight: 8, lineHeight: 1 }}>
            {icon}
          </span>
        )}
        <span
          style={{
            fontSize: 20,
            fontFamily: THEME.fonts.body,
            fontWeight: 500,
            color: COLORS.textPrimary,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
};
