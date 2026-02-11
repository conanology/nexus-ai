import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

export interface HanddrawnCircleProps {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color?: string;
  strokeWidth?: number;
  delayFrames?: number;
  drawDurationFrames?: number;
  wobbleAmount?: number;
  rotation?: number;
}

const NUM_POINTS = 48;
/** Gap at end so circle doesn't perfectly close (hand-drawn feel) */
const GAP_FRACTION = 0.92;

/**
 * Deterministic wobble offset — uses point index and center coords as seed
 * so every circle wobbles differently but consistently across frames.
 */
function wobbleOffset(
  index: number,
  cx: number,
  cy: number,
  amount: number,
): { dx: number; dy: number } {
  return {
    dx: amount * Math.sin(index * 7.3 + cx * 0.01),
    dy: amount * Math.cos(index * 5.7 + cy * 0.01),
  };
}

/**
 * Generate an SVG path string for a wobbly ellipse.
 * Returns the path data and its approximate total length.
 */
export function generateCirclePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  wobbleAmount: number,
): { d: string; length: number } {
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < NUM_POINTS; i++) {
    const angle = (i / NUM_POINTS) * Math.PI * 2 * GAP_FRACTION;
    const { dx, dy } = wobbleOffset(i, cx, cy, wobbleAmount);
    points.push({
      x: cx + Math.cos(angle) * rx + dx,
      y: cy + Math.sin(angle) * ry + dy,
    });
  }

  if (points.length < 2) return { d: '', length: 0 };

  // Build smooth cubic bezier path through points
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  let totalLength = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    totalLength += Math.sqrt(dx * dx + dy * dy);

    // Use simple line segments with slight curve feel via the wobble
    d += ` L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
  }

  return { d, length: totalLength };
}

export const HanddrawnCircle: React.FC<HanddrawnCircleProps> = ({
  cx,
  cy,
  rx,
  ry,
  color = '#FF4444',
  strokeWidth = 4,
  delayFrames = 0,
  drawDurationFrames = 30,
  wobbleAmount = 4,
  rotation = -5,
}) => {
  const frame = useCurrentFrame();

  const { d, length } = useMemo(
    () => generateCirclePath(cx, cy, rx, ry, wobbleAmount),
    [cx, cy, rx, ry, wobbleAmount],
  );

  if (!d || length === 0) return null;

  const drawProgress = interpolate(
    frame,
    [delayFrames, delayFrames + drawDurationFrames],
    [length, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  // Fully hidden before delay
  if (frame < delayFrames) return null;

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={length}
      strokeDashoffset={drawProgress}
      opacity={0.85}
      transform={`rotate(${rotation} ${cx} ${cy})`}
    />
  );
};
