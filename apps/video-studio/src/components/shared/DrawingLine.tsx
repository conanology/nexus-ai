import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { COLORS } from '../../utils/colors.js';

export interface DrawingLineProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
  strokeWidth?: number;
  showArrow?: boolean;
  delayFrames?: number;
  durationFrames?: number;
  glowColor?: string;
}

const ARROW_LENGTH = 10;
const ARROW_WIDTH = 8;

export const DrawingLine: React.FC<DrawingLineProps> = ({
  from,
  to,
  color = COLORS.accentPrimary,
  strokeWidth = 2,
  showArrow = true,
  delayFrames = 0,
  durationFrames = 20,
  glowColor,
}) => {
  const frame = useCurrentFrame();

  const { lineLength, angle } = useMemo(() => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return {
      lineLength: Math.sqrt(dx * dx + dy * dy),
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  }, [from.x, from.y, to.x, to.y]);

  const effectiveFrame = Math.max(0, frame - delayFrames);

  const dashOffset = interpolate(
    effectiveFrame,
    [0, durationFrames],
    [lineLength, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  const arrowOpacity = showArrow
    ? interpolate(
        effectiveFrame,
        [durationFrames * 0.8, durationFrames],
        [0, 1],
        { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
      )
    : 0;

  // Arrow triangle points (pointing right, centered at origin, then positioned at 'to')
  const arrowPoints = useMemo(() => {
    const tip = { x: 0, y: 0 };
    const left = { x: -ARROW_LENGTH, y: -ARROW_WIDTH / 2 };
    const right = { x: -ARROW_LENGTH, y: ARROW_WIDTH / 2 };
    return `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`;
  }, []);

  return (
    <g>
      {/* Glow line (behind) */}
      {glowColor && (
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={glowColor}
          strokeWidth={strokeWidth * 4}
          strokeLinecap="round"
          strokeDasharray={lineLength}
          strokeDashoffset={dashOffset}
          opacity={0.3}
          style={{ filter: 'blur(4px)' }}
        />
      )}

      {/* Main line */}
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={lineLength}
        strokeDashoffset={dashOffset}
      />

      {/* Arrowhead */}
      {showArrow && arrowOpacity > 0 && (
        <g
          transform={`translate(${to.x}, ${to.y}) rotate(${angle})`}
          opacity={arrowOpacity}
        >
          <polygon points={arrowPoints} fill={color} />
        </g>
      )}
    </g>
  );
};
