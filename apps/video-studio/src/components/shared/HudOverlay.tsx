import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS } from '../../utils/colors.js';

const CROSSHAIR_SIZE = 24;
const MARGIN = 40;

interface HudOverlayProps {
  showTimecode?: boolean;
  fps?: number;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  showTimecode = true,
  fps = 30,
}) => {
  const frame = useCurrentFrame();
  const totalSeconds = frame / fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = frame % fps;
  const timecode = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;

  const crosshairColor = COLORS.accentPrimary;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 20 }}>
      {/* Top-left crosshair */}
      <svg
        width={CROSSHAIR_SIZE}
        height={CROSSHAIR_SIZE}
        style={{ position: 'absolute', top: MARGIN, left: MARGIN }}
      >
        <line x1="0" y1="0" x2={CROSSHAIR_SIZE} y2="0" stroke={crosshairColor} strokeWidth={2} />
        <line x1="0" y1="0" x2="0" y2={CROSSHAIR_SIZE} stroke={crosshairColor} strokeWidth={2} />
      </svg>
      {/* Top-right crosshair */}
      <svg
        width={CROSSHAIR_SIZE}
        height={CROSSHAIR_SIZE}
        style={{ position: 'absolute', top: MARGIN, right: MARGIN }}
      >
        <line x1="0" y1="0" x2={CROSSHAIR_SIZE} y2="0" stroke={crosshairColor} strokeWidth={2} />
        <line x1={CROSSHAIR_SIZE} y1="0" x2={CROSSHAIR_SIZE} y2={CROSSHAIR_SIZE} stroke={crosshairColor} strokeWidth={2} />
      </svg>
      {/* Bottom-left crosshair */}
      <svg
        width={CROSSHAIR_SIZE}
        height={CROSSHAIR_SIZE}
        style={{ position: 'absolute', bottom: MARGIN, left: MARGIN }}
      >
        <line x1="0" y1={CROSSHAIR_SIZE} x2={CROSSHAIR_SIZE} y2={CROSSHAIR_SIZE} stroke={crosshairColor} strokeWidth={2} />
        <line x1="0" y1="0" x2="0" y2={CROSSHAIR_SIZE} stroke={crosshairColor} strokeWidth={2} />
      </svg>
      {/* Bottom-right crosshair */}
      <svg
        width={CROSSHAIR_SIZE}
        height={CROSSHAIR_SIZE}
        style={{ position: 'absolute', bottom: MARGIN, right: MARGIN }}
      >
        <line x1="0" y1={CROSSHAIR_SIZE} x2={CROSSHAIR_SIZE} y2={CROSSHAIR_SIZE} stroke={crosshairColor} strokeWidth={2} />
        <line x1={CROSSHAIR_SIZE} y1="0" x2={CROSSHAIR_SIZE} y2={CROSSHAIR_SIZE} stroke={crosshairColor} strokeWidth={2} />
      </svg>
      {/* Timecode */}
      {showTimecode && (
        <div
          style={{
            position: 'absolute',
            bottom: MARGIN,
            right: MARGIN + CROSSHAIR_SIZE + 16,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 14,
            color: crosshairColor,
            opacity: 0.6,
            letterSpacing: 2,
          }}
        >
          {timecode}
        </div>
      )}
    </AbsoluteFill>
  );
};
