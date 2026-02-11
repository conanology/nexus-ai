import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

export interface HanddrawnUnderlineProps {
  x: number;
  y: number;
  width: number;
  color?: string;
  strokeWidth?: number;
  delayFrames?: number;
  drawDurationFrames?: number;
  wobbleAmount?: number;
  style?: 'single' | 'double' | 'squiggly';
}

const NUM_CONTROL_POINTS = 8;

/**
 * Deterministic vertical wobble for underline points.
 */
function wobbleY(index: number, x: number, y: number, amount: number): number {
  return amount * Math.sin(index * 5.3 + x * 0.02 + y * 0.01);
}

/**
 * Generate a single wobbly line path.
 */
export function generateUnderlinePath(
  x: number,
  y: number,
  width: number,
  wobbleAmount: number,
  yOffset: number = 0,
): { d: string; length: number } {
  const points: Array<{ px: number; py: number }> = [];

  for (let i = 0; i <= NUM_CONTROL_POINTS; i++) {
    const t = i / NUM_CONTROL_POINTS;
    const px = x + t * width;
    const py = y + yOffset + (i > 0 && i < NUM_CONTROL_POINTS ? wobbleY(i, x, y + yOffset, wobbleAmount) : 0);
    points.push({ px, py });
  }

  let d = `M ${points[0].px.toFixed(2)} ${points[0].py.toFixed(2)}`;
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].px - points[i - 1].px;
    const dy = points[i].py - points[i - 1].py;
    length += Math.sqrt(dx * dx + dy * dy);
    d += ` L ${points[i].px.toFixed(2)} ${points[i].py.toFixed(2)}`;
  }

  return { d, length };
}

/**
 * Generate a squiggly (sine wave) underline path.
 */
export function generateSquigglyPath(
  x: number,
  y: number,
  width: number,
): { d: string; length: number } {
  const amplitude = 3;
  const numWaves = Math.max(3, Math.round(width / 40));
  const numPoints = numWaves * 4 + 1; // 4 points per wave cycle
  const points: Array<{ px: number; py: number }> = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const px = x + t * width;
    const py = y + amplitude * Math.sin(t * numWaves * Math.PI * 2);
    points.push({ px, py });
  }

  let d = `M ${points[0].px.toFixed(2)} ${points[0].py.toFixed(2)}`;
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].px - points[i - 1].px;
    const dy = points[i].py - points[i - 1].py;
    length += Math.sqrt(dx * dx + dy * dy);
    d += ` L ${points[i].px.toFixed(2)} ${points[i].py.toFixed(2)}`;
  }

  return { d, length };
}

export const HanddrawnUnderline: React.FC<HanddrawnUnderlineProps> = ({
  x,
  y,
  width,
  color = '#FF4444',
  strokeWidth = 4,
  delayFrames = 0,
  drawDurationFrames = 24,
  wobbleAmount = 2,
  style = 'single',
}) => {
  const frame = useCurrentFrame();

  const paths = useMemo(() => {
    if (style === 'squiggly') {
      const p = generateSquigglyPath(x, y, width);
      return [{ ...p, delay: 0 }];
    }

    const line1 = generateUnderlinePath(x, y, width, wobbleAmount);
    if (style === 'double') {
      const line2 = generateUnderlinePath(x, y, width, wobbleAmount, 4);
      return [
        { ...line1, delay: 0 },
        { ...line2, delay: 3 },
      ];
    }

    return [{ ...line1, delay: 0 }];
  }, [x, y, width, wobbleAmount, style]);

  if (frame < delayFrames) return null;

  return (
    <>
      {paths.map((path, index) => {
        if (!path.d || path.length === 0) return null;

        const pathDelay = delayFrames + path.delay;
        if (frame < pathDelay) return null;

        const offset = interpolate(
          frame,
          [pathDelay, pathDelay + drawDurationFrames],
          [path.length, 0],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          },
        );

        return (
          <path
            key={index}
            d={path.d}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={path.length}
            strokeDashoffset={offset}
            opacity={0.85}
          />
        );
      })}
    </>
  );
};
