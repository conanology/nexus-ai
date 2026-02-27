import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import type { SceneAnnotation } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NEON_GREEN = '#aaff00';
const BRACKET_LENGTH = 28;
const BRACKET_THICKNESS = 3;

export interface AnnotationLayerProps {
  annotations: SceneAnnotation[];
  sceneDurationFrames: number;
  /** When true, Playwright highlightText is active — skip Remotion annotations */
  suppressForHighlight?: boolean;
}

// ---------------------------------------------------------------------------
// Precision SVG Glow Filter
// ---------------------------------------------------------------------------

const NeonGlowFilter: React.FC = () => (
  <defs>
    <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
);

// ---------------------------------------------------------------------------
// Corner Targeting Brackets (replaces hand-drawn circle)
// Renders 4 L-shaped brackets at corners of a bounding box
// ---------------------------------------------------------------------------

interface TargetBracketsProps {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color?: string;
  delayFrames?: number;
  drawDurationFrames?: number;
}

const TargetBrackets: React.FC<TargetBracketsProps> = ({
  cx, cy, rx, ry,
  color = NEON_GREEN,
  delayFrames = 0,
  drawDurationFrames = 8,
}) => {
  const frame = useCurrentFrame();
  if (frame < delayFrames) return null;

  const progress = interpolate(
    frame,
    [delayFrames, delayFrames + drawDurationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );

  const left = cx - rx;
  const top = cy - ry;
  const right = cx + rx;
  const bottom = cy + ry;
  const len = BRACKET_LENGTH;

  // 4 corner brackets: ⌜ ⌝ ⌞ ⌟
  const corners = [
    // Top-left ⌜
    `M ${left} ${top + len} L ${left} ${top} L ${left + len} ${top}`,
    // Top-right ⌝
    `M ${right - len} ${top} L ${right} ${top} L ${right} ${top + len}`,
    // Bottom-left ⌞
    `M ${left} ${bottom - len} L ${left} ${bottom} L ${left + len} ${bottom}`,
    // Bottom-right ⌟
    `M ${right - len} ${bottom} L ${right} ${bottom} L ${right} ${bottom - len}`,
  ];

  // Each bracket's path length is approximately 2 * BRACKET_LENGTH
  const pathLength = len * 2;

  return (
    <g filter="url(#neon-glow)" opacity={progress}>
      {corners.map((d, i) => {
        const cornerDelay = delayFrames + i * 1;
        const cornerProgress = interpolate(
          frame,
          [cornerDelay, cornerDelay + drawDurationFrames],
          [pathLength, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
        );
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={BRACKET_THICKNESS}
            strokeLinecap="square"
            strokeDasharray={pathLength}
            strokeDashoffset={cornerProgress}
          />
        );
      })}
    </g>
  );
};

// ---------------------------------------------------------------------------
// Precision Arrow (replaces hand-drawn arrow)
// Straight, clean line with triangular arrowhead
// ---------------------------------------------------------------------------

interface PrecisionArrowProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color?: string;
  delayFrames?: number;
  drawDurationFrames?: number;
}

const PrecisionArrow: React.FC<PrecisionArrowProps> = ({
  fromX, fromY, toX, toY,
  color = NEON_GREEN,
  delayFrames = 0,
  drawDurationFrames = 8,
}) => {
  const frame = useCurrentFrame();
  if (frame < delayFrames) return null;

  const dx = toX - fromX;
  const dy = toY - fromY;
  const lineLength = Math.sqrt(dx * dx + dy * dy);
  if (lineLength === 0) return null;

  const bodyProgress = interpolate(
    frame,
    [delayFrames, delayFrames + drawDurationFrames],
    [lineLength, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );

  // Arrowhead — equilateral triangle at tip
  const angle = Math.atan2(dy, dx);
  const headSize = 12;
  const headAngle = Math.PI / 7;
  const leftX = toX - headSize * Math.cos(angle - headAngle);
  const leftY = toY - headSize * Math.sin(angle - headAngle);
  const rightX = toX - headSize * Math.cos(angle + headAngle);
  const rightY = toY - headSize * Math.sin(angle + headAngle);

  const headOpacity = interpolate(
    frame,
    [delayFrames + drawDurationFrames - 2, delayFrames + drawDurationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <g filter="url(#neon-glow)">
      <line
        x1={fromX} y1={fromY}
        x2={toX} y2={toY}
        stroke={color}
        strokeWidth={BRACKET_THICKNESS}
        strokeLinecap="square"
        strokeDasharray={lineLength}
        strokeDashoffset={bodyProgress}
      />
      <polygon
        points={`${toX},${toY} ${leftX},${leftY} ${rightX},${rightY}`}
        fill={color}
        opacity={headOpacity}
      />
    </g>
  );
};

// ---------------------------------------------------------------------------
// Precision Underline (replaces hand-drawn underline)
// Straight neon line — no wobble, no squiggly
// ---------------------------------------------------------------------------

interface PrecisionUnderlineProps {
  x: number;
  y: number;
  width: number;
  color?: string;
  delayFrames?: number;
  drawDurationFrames?: number;
}

const PrecisionUnderline: React.FC<PrecisionUnderlineProps> = ({
  x, y, width,
  color = NEON_GREEN,
  delayFrames = 0,
  drawDurationFrames = 8,
}) => {
  const frame = useCurrentFrame();
  if (frame < delayFrames) return null;

  const progress = interpolate(
    frame,
    [delayFrames, delayFrames + drawDurationFrames],
    [width, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );

  return (
    <g filter="url(#neon-glow)">
      <line
        x1={x} y1={y}
        x2={x + width} y2={y}
        stroke={color}
        strokeWidth={BRACKET_THICKNESS}
        strokeLinecap="square"
        strokeDasharray={width}
        strokeDashoffset={progress}
      />
    </g>
  );
};

// ---------------------------------------------------------------------------
// Precision Crosshair (replaces hand-drawn x-mark)
// Clean + shape centered at target
// ---------------------------------------------------------------------------

interface PrecisionCrosshairProps {
  cx: number;
  cy: number;
  size?: number;
  color?: string;
  delayFrames?: number;
  drawDurationFrames?: number;
}

const PrecisionCrosshair: React.FC<PrecisionCrosshairProps> = ({
  cx, cy,
  size = 30,
  color = NEON_GREEN,
  delayFrames = 0,
  drawDurationFrames = 8,
}) => {
  const frame = useCurrentFrame();
  if (frame < delayFrames) return null;

  const half = size / 2;
  const armLength = half;

  const progress = interpolate(
    frame,
    [delayFrames, delayFrames + drawDurationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );

  // Horizontal + vertical lines through center
  const hLine = `M ${cx - armLength} ${cy} L ${cx + armLength} ${cy}`;
  const vLine = `M ${cx} ${cy - armLength} L ${cx} ${cy + armLength}`;
  const pathLen = armLength * 2;

  const dashOffset = pathLen * (1 - progress);

  return (
    <g filter="url(#neon-glow)" opacity={progress}>
      <path
        d={hLine}
        fill="none"
        stroke={color}
        strokeWidth={BRACKET_THICKNESS}
        strokeLinecap="square"
        strokeDasharray={pathLen}
        strokeDashoffset={dashOffset}
      />
      <path
        d={vLine}
        fill="none"
        stroke={color}
        strokeWidth={BRACKET_THICKNESS}
        strokeLinecap="square"
        strokeDasharray={pathLen}
        strokeDashoffset={dashOffset}
      />
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2} fill={color} opacity={progress} />
    </g>
  );
};

// ---------------------------------------------------------------------------
// Main AnnotationLayer
// ---------------------------------------------------------------------------

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  annotations,
  suppressForHighlight = false,
}) => {
  if (!annotations || annotations.length === 0) return null;
  if (suppressForHighlight) return null;

  return (
    <AbsoluteFill style={{ zIndex: 8, pointerEvents: 'none' }}>
      <svg
        viewBox="0 0 1920 1080"
        width="1920"
        height="1080"
        style={{ position: 'absolute', inset: 0 }}
      >
        <NeonGlowFilter />
        {annotations.map((annotation, index) => {
          switch (annotation.type) {
            case 'circle':
              return (
                <TargetBrackets
                  key={`annotation-${index}-bracket`}
                  cx={annotation.cx}
                  cy={annotation.cy}
                  rx={annotation.rx}
                  ry={annotation.ry}
                  color={annotation.color}
                  delayFrames={annotation.delayFrames}
                  drawDurationFrames={annotation.drawDurationFrames}
                />
              );
            case 'arrow':
              return (
                <PrecisionArrow
                  key={`annotation-${index}-arrow`}
                  fromX={annotation.fromX}
                  fromY={annotation.fromY}
                  toX={annotation.toX}
                  toY={annotation.toY}
                  color={annotation.color}
                  delayFrames={annotation.delayFrames}
                  drawDurationFrames={annotation.drawDurationFrames}
                />
              );
            case 'underline':
              return (
                <PrecisionUnderline
                  key={`annotation-${index}-underline`}
                  x={annotation.x}
                  y={annotation.y}
                  width={annotation.width}
                  color={annotation.color}
                  delayFrames={annotation.delayFrames}
                  drawDurationFrames={annotation.drawDurationFrames}
                />
              );
            case 'x-mark':
              return (
                <PrecisionCrosshair
                  key={`annotation-${index}-crosshair`}
                  cx={annotation.cx}
                  cy={annotation.cy}
                  size={annotation.size}
                  color={annotation.color}
                  delayFrames={annotation.delayFrames}
                  drawDurationFrames={annotation.drawDurationFrames}
                />
              );
            default:
              return null;
          }
        })}
      </svg>
    </AbsoluteFill>
  );
};
