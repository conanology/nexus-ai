/**
 * ScrollingCapture — full-page screenshot with vertical pan animation.
 *
 * Renders a materialized full-page image and animates a translateY pan
 * at ~500px/sec (~17px/frame at 30fps). Dark overlay + optional label badge.
 */
import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS, TEXT_CONTRAST_SHADOW } from '../../utils/colors.js';
import type { SceneComponentProps } from '../../types/scenes.js';

const SCROLL_SPEED_PX_PER_SEC = 500;
const OVERLAY_OPACITY = 0.35;

interface ScrollingCaptureVisualData {
  fullPageImageUrl: string;
  scrollSpeedPxPerSec?: number;
  label?: string;
}

export const ScrollingCapture: React.FC<SceneComponentProps<'scrolling-capture'>> = ({
  visualData,
  content,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = visualData as unknown as ScrollingCaptureVisualData;

  const speed = data.scrollSpeedPxPerSec ?? SCROLL_SPEED_PX_PER_SEC;
  const pxPerFrame = speed / fps;
  const translateY = -frame * pxPerFrame;

  const label = data.label ?? content.slice(0, 60);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDeepDark }}>
      {/* Scrolling full-page image */}
      {data.fullPageImageUrl && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <Img
            src={data.fullPageImageUrl}
            style={{
              width: '100%',
              transform: `translateY(${translateY}px)`,
              objectFit: 'cover',
            }}
          />
        </div>
      )}

      {/* Dark overlay */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,${OVERLAY_OPACITY}) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,${OVERLAY_OPACITY}) 100%)`,
        }}
      />

      {/* Label badge at bottom */}
      {label && (
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: `1px solid ${COLORS.accentPrimary}`,
            borderRadius: 8,
            padding: '10px 24px',
            fontFamily: 'Inter, sans-serif',
            fontSize: 24,
            fontWeight: 600,
            color: COLORS.textPrimary,
            textShadow: TEXT_CONTRAST_SHADOW,
            whiteSpace: 'nowrap',
            maxWidth: '80%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            opacity: interpolate(frame, [0, 15], [0, 1], {
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {label}
        </div>
      )}
    </AbsoluteFill>
  );
};
