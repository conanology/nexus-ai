import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

export interface HanddrawnArrowProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color?: string;
  strokeWidth?: number;
  delayFrames?: number;
  drawDurationFrames?: number;
  wobbleAmount?: number;
  curved?: boolean;
  headSize?: number;
}

/**
 * Deterministic wobble for arrow path points.
 */
function wobbleAt(
  index: number,
  fromX: number,
  toY: number,
  amount: number,
): { dx: number; dy: number } {
  return {
    dx: amount * Math.sin(index * 6.1 + fromX * 0.02),
    dy: amount * Math.cos(index * 4.3 + toY * 0.02),
  };
}

/**
 * Generate arrow body path (wobbly line or curve from A to B)
 * and arrowhead lines.
 */
export function generateArrowPaths(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  wobbleAmount: number,
  curved: boolean,
  headSize: number,
): { bodyD: string; bodyLength: number; headD: string; headLength: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  // Control point for curve (perpendicular offset)
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  let cpX = midX;
  let cpY = midY;

  if (curved && lineLength > 0) {
    // Perpendicular direction
    const nx = -dy / lineLength;
    const ny = dx / lineLength;
    // Deterministic offset: 30-50px based on coordinates
    const offset = 30 + 20 * Math.abs(Math.sin(fromX * 0.03 + toY * 0.07));
    cpX = midX + nx * offset;
    cpY = midY + ny * offset;
  }

  // Generate intermediate points along the path with wobble
  const numSegments = 10;
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    // Quadratic bezier: B(t) = (1-t)^2*P0 + 2*(1-t)*t*CP + t^2*P1
    const oneMinusT = 1 - t;
    let px = oneMinusT * oneMinusT * fromX + 2 * oneMinusT * t * cpX + t * t * toX;
    let py = oneMinusT * oneMinusT * fromY + 2 * oneMinusT * t * cpY + t * t * toY;

    // Apply wobble to interior points only
    if (i > 0 && i < numSegments) {
      const { dx: wdx, dy: wdy } = wobbleAt(i, fromX, toY, wobbleAmount);
      px += wdx;
      py += wdy;
    }

    points.push({ x: px, y: py });
  }

  // Build body path
  let bodyD = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  let bodyLength = 0;
  for (let i = 1; i < points.length; i++) {
    const segDx = points[i].x - points[i - 1].x;
    const segDy = points[i].y - points[i - 1].y;
    bodyLength += Math.sqrt(segDx * segDx + segDy * segDy);
    bodyD += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
  }

  // Arrowhead — two lines from the tip at ±30° from the arrival direction
  const lastSeg = points.length >= 2
    ? { dx: points[points.length - 1].x - points[points.length - 2].x,
        dy: points[points.length - 1].y - points[points.length - 2].y }
    : { dx: dx, dy: dy };
  const arrAngle = Math.atan2(lastSeg.dy, lastSeg.dx);
  const tipX = toX;
  const tipY = toY;
  const headAngleOffset = Math.PI / 6; // 30 degrees

  // Wobble on arrowhead (subtle 1-2px)
  const hw1 = 1.5 * Math.sin(fromX * 0.05 + toY * 0.03);
  const hw2 = 1.5 * Math.cos(fromX * 0.03 + toY * 0.05);

  const leftX = tipX - headSize * Math.cos(arrAngle - headAngleOffset) + hw1;
  const leftY = tipY - headSize * Math.sin(arrAngle - headAngleOffset) + hw2;
  const rightX = tipX - headSize * Math.cos(arrAngle + headAngleOffset) - hw1;
  const rightY = tipY - headSize * Math.sin(arrAngle + headAngleOffset) - hw2;

  const headD = `M ${leftX.toFixed(2)} ${leftY.toFixed(2)} L ${tipX.toFixed(2)} ${tipY.toFixed(2)} L ${rightX.toFixed(2)} ${rightY.toFixed(2)}`;

  const headLength =
    Math.sqrt((tipX - leftX) ** 2 + (tipY - leftY) ** 2) +
    Math.sqrt((rightX - tipX) ** 2 + (rightY - tipY) ** 2);

  return { bodyD, bodyLength, headD, headLength };
}

export const HanddrawnArrow: React.FC<HanddrawnArrowProps> = ({
  fromX,
  fromY,
  toX,
  toY,
  color = '#FF4444',
  strokeWidth = 4,
  delayFrames = 0,
  drawDurationFrames = 28,
  wobbleAmount = 3,
  curved = true,
  headSize = 14,
}) => {
  const frame = useCurrentFrame();

  const { bodyD, bodyLength, headD, headLength } = useMemo(
    () => generateArrowPaths(fromX, fromY, toX, toY, wobbleAmount, curved, headSize),
    [fromX, fromY, toX, toY, wobbleAmount, curved, headSize],
  );

  if (!bodyD || bodyLength === 0) return null;
  if (frame < delayFrames) return null;

  // Body draws first (0 to drawDuration - 5)
  const bodyDrawDuration = Math.max(drawDurationFrames - 5, 5);
  const bodyOffset = interpolate(
    frame,
    [delayFrames, delayFrames + bodyDrawDuration],
    [bodyLength, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  // Arrowhead appears in last 5 frames of the animation
  const headStart = delayFrames + bodyDrawDuration;
  const headOffset = interpolate(
    frame,
    [headStart, headStart + 5],
    [headLength, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  return (
    <>
      <path
        d={bodyD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={bodyLength}
        strokeDashoffset={bodyOffset}
        opacity={0.85}
      />
      <path
        d={headD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={headLength}
        strokeDashoffset={headOffset}
        opacity={0.85}
      />
    </>
  );
};
