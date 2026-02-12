import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import type { SourceBadgeOverlay } from '../../types/scenes.js';

export interface SourceBadgeProps extends SourceBadgeOverlay {
  fps: number;
  sceneDuration: number;
}

const EDGE_INSET = 40;

export const SourceBadge: React.FC<SourceBadgeProps> = (props) => {
  const { sourceName, delayFrames = 10 } = props;
  const frame = useCurrentFrame();

  const delay = delayFrames;

  // Entrance: slide up + opacity
  const entranceOpacity = interpolate(
    frame,
    [delay, delay + 10],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const slideY = interpolate(
    frame,
    [delay, delay + 10],
    [10, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  if (entranceOpacity <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: EDGE_INSET,
        left: EDGE_INSET,
        zIndex: 10,
        opacity: entranceOpacity * 0.85,
        transform: `translateY(${slideY}px)`,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px',
          borderRadius: 4,
          backgroundColor: withOpacity(COLORS.bgElevated, 0.75),
          border: `1px solid ${withOpacity(COLORS.textMuted, 0.3)}`,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontFamily: THEME.fonts.mono,
            fontWeight: 600,
            color: COLORS.textMuted,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          SOURCE
        </span>
        <span
          style={{
            fontSize: 14,
            fontFamily: THEME.fonts.mono,
            fontWeight: 400,
            color: COLORS.textSecondary,
          }}
        >
          {sourceName}
        </span>
      </div>
    </div>
  );
};
