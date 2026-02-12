import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import type { KeyPhraseOverlay } from '../../types/scenes.js';

export interface KeyPhraseProps extends KeyPhraseOverlay {
  fps: number;
  sceneDuration: number;
}

const EDGE_INSET = 40;

export const KeyPhrase: React.FC<KeyPhraseProps> = (props) => {
  const { phrase, position, delayFrames = 20 } = props;
  const frame = useCurrentFrame();

  const delay = delayFrames;

  // Entrance: slide down + opacity
  const entranceOpacity = interpolate(
    frame,
    [delay, delay + 10],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const slideY = interpolate(
    frame,
    [delay, delay + 10],
    [-15, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  if (entranceOpacity <= 0) return null;

  const posStyle: React.CSSProperties = position === 'top-right'
    ? { top: EDGE_INSET, right: EDGE_INSET }
    : { top: EDGE_INSET, left: EDGE_INSET };

  return (
    <div
      style={{
        position: 'absolute',
        ...posStyle,
        zIndex: 10,
        opacity: entranceOpacity,
        transform: `translateY(${slideY}px)`,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          padding: '6px 14px',
          borderRadius: 4,
          backgroundColor: withOpacity(COLORS.bgElevated, 0.80),
          border: `1px solid ${withOpacity(COLORS.accentPrimary, 0.3)}`,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontFamily: THEME.fonts.mono,
            fontWeight: 500,
            color: withOpacity(COLORS.textPrimary, 0.8),
            letterSpacing: 2,
            whiteSpace: 'nowrap',
          }}
        >
          {phrase}
        </span>
      </div>
    </div>
  );
};
