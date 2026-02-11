import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS } from '../../utils/colors.js';

const FRAME_W = 1920;
const FRAME_H = 1080;
const GRID_SPACING = 80;

export interface GridOverlayProps {
  opacity?: number;
  scrollSpeed?: number;
  color?: string;
}

export const GridOverlay: React.FC<GridOverlayProps> = ({
  opacity = 0.05,
  scrollSpeed = 0.5,
  color = COLORS.accentPrimary,
}) => {
  const frame = useCurrentFrame();

  // Parse hex to rgb
  const rgb = useMemo(() => {
    const hex = color.replace('#', '');
    const full = hex.length === 3
      ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      : hex;
    return {
      r: parseInt(full.substring(0, 2), 16),
      g: parseInt(full.substring(2, 4), 16),
      b: parseInt(full.substring(4, 6), 16),
    };
  }, [color]);

  // Scroll offset: grid drifts downward
  const scrollOffset = (frame * scrollSpeed) % GRID_SPACING;

  // Generate horizontal and vertical line positions
  const horizontalLines = useMemo(() => {
    const lines: number[] = [];
    // Add one extra line above and below for seamless scrolling
    for (let y = -GRID_SPACING; y <= FRAME_H + GRID_SPACING; y += GRID_SPACING) {
      lines.push(y);
    }
    return lines;
  }, []);

  const verticalLines = useMemo(() => {
    const lines: number[] = [];
    for (let x = 0; x <= FRAME_W; x += GRID_SPACING) {
      lines.push(x);
    }
    return lines;
  }, []);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <svg
        width={FRAME_W}
        height={FRAME_H}
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Horizontal lines — scroll downward */}
        {horizontalLines.map((baseY, i) => {
          const y = baseY + scrollOffset;
          // Skip lines fully outside the viewport
          if (y < -1 || y > FRAME_H + 1) return null;

          // Perspective fade: lines near bottom are more opaque, top fades out
          const t = Math.max(0, Math.min(1, y / FRAME_H));
          const lineOpacity = opacity * (0.4 + t * 1.2); // 0.02 at top → 0.06+ at bottom

          return (
            <line
              key={`h-${i}`}
              x1={0}
              y1={y}
              x2={FRAME_W}
              y2={y}
              stroke={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${lineOpacity})`}
              strokeWidth={1}
            />
          );
        })}

        {/* Vertical lines — static horizontally, same perspective fade */}
        {verticalLines.map((x, i) => (
          <line
            key={`v-${i}`}
            x1={x}
            y1={0}
            x2={x}
            y2={FRAME_H}
            stroke={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.6})`}
            strokeWidth={1}
          />
        ))}

        {/* Pulse line — bright streak traveling top to bottom every 2s (60 frames) */}
        {(() => {
          const PULSE_CYCLE = 60;
          const pulseY = (frame % PULSE_CYCLE) / PULSE_CYCLE * FRAME_H;
          const pulseOpacity = 0.15;
          return (
            <line
              x1={0}
              y1={pulseY}
              x2={FRAME_W}
              y2={pulseY}
              stroke={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pulseOpacity})`}
              strokeWidth={2}
            />
          );
        })()}
      </svg>
    </AbsoluteFill>
  );
};
