import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

export interface HanddrawnXProps {
  cx: number;
  cy: number;
  size?: number;
  color?: string;
  strokeWidth?: number;
  delayFrames?: number;
  drawDurationFrames?: number;
}

/**
 * Deterministic wobble for X-mark lines.
 */
function xWobble(cx: number, cy: number, lineIndex: number): { dx: number; dy: number } {
  return {
    dx: 2 * Math.sin(cx * 0.03 + lineIndex * 3.7),
    dy: 2 * Math.cos(cy * 0.03 + lineIndex * 2.9),
  };
}

/**
 * Generate X-mark paths: two wobbly diagonal lines crossing at center.
 */
export function generateXPaths(
  cx: number,
  cy: number,
  size: number,
): Array<{ d: string; length: number }> {
  const half = size / 2;

  const w1 = xWobble(cx, cy, 0);
  const w2 = xWobble(cx, cy, 1);
  const w3 = xWobble(cx, cy, 2);
  const w4 = xWobble(cx, cy, 3);

  // Line 1: top-left to bottom-right
  const x1a = cx - half + w1.dx;
  const y1a = cy - half + w1.dy;
  const x1b = cx + half + w2.dx;
  const y1b = cy + half + w2.dy;

  // Line 2: top-right to bottom-left
  const x2a = cx + half + w3.dx;
  const y2a = cy - half + w3.dy;
  const x2b = cx - half + w4.dx;
  const y2b = cy + half + w4.dy;

  const d1 = `M ${x1a.toFixed(2)} ${y1a.toFixed(2)} L ${x1b.toFixed(2)} ${y1b.toFixed(2)}`;
  const len1 = Math.sqrt((x1b - x1a) ** 2 + (y1b - y1a) ** 2);

  const d2 = `M ${x2a.toFixed(2)} ${y2a.toFixed(2)} L ${x2b.toFixed(2)} ${y2b.toFixed(2)}`;
  const len2 = Math.sqrt((x2b - x2a) ** 2 + (y2b - y2a) ** 2);

  return [
    { d: d1, length: len1 },
    { d: d2, length: len2 },
  ];
}

export const HanddrawnX: React.FC<HanddrawnXProps> = ({
  cx,
  cy,
  size = 30,
  color = '#FF4444',
  strokeWidth = 4,
  delayFrames = 0,
  drawDurationFrames = 20,
}) => {
  const frame = useCurrentFrame();

  const lines = useMemo(() => generateXPaths(cx, cy, size), [cx, cy, size]);

  if (frame < delayFrames) return null;

  const lineDuration = Math.max(Math.floor(drawDurationFrames / 2), 3);
  const secondLineDelay = 4; // second line starts 4 frames after first

  return (
    <>
      {lines.map((line, index) => {
        const lineStart = delayFrames + index * secondLineDelay;
        if (frame < lineStart) return null;

        const offset = interpolate(
          frame,
          [lineStart, lineStart + lineDuration],
          [line.length, 0],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          },
        );

        return (
          <path
            key={index}
            d={line.d}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={line.length}
            strokeDashoffset={offset}
            opacity={0.85}
          />
        );
      })}
    </>
  );
};
