import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import type { SceneComponentProps } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TITLE_FADE_FRAMES = 15;
const ITEM_STAGGER = 8;
const ITEM_FADE_FRAMES = 10;
const MARKER_LEAD = 3; // marker appears 3 frames before text
const TITLE_OFFSET = 15; // items start after title

// ---------------------------------------------------------------------------
// Marker renderers
// ---------------------------------------------------------------------------

function renderMarker(
  style: 'bullet' | 'numbered' | 'icon',
  index: number,
  fontSize: number,
): React.ReactNode {
  if (style === 'bullet') {
    return (
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: COLORS.accentPrimary,
          flexShrink: 0,
          marginTop: fontSize * 0.45,
        }}
      />
    );
  }

  if (style === 'numbered') {
    return (
      <span
        style={{
          fontSize,
          fontFamily: THEME.fonts.mono,
          fontWeight: 700,
          color: COLORS.accentPrimary,
          flexShrink: 0,
          minWidth: fontSize * 2,
        }}
      >
        {String(index + 1).padStart(2, '0')}.
      </span>
    );
  }

  // 'icon' — checkmark (U+2713)
  return (
    <span
      style={{
        fontSize,
        fontWeight: 700,
        color: COLORS.accentPrimary,
        flexShrink: 0,
        minWidth: fontSize * 1.2,
      }}
    >
      {'\u2713'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const ListReveal: React.FC<SceneComponentProps<'list-reveal'>> = (props) => {
  const { visualData, motion, backgroundImage } = props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { title, items, style } = visualData;
  const compact = items.length > 6;
  const fontSize = compact ? 34 : 40;
  const itemSpacing = compact ? 60 : 80;

  // Title fade
  const titleOpacity = title
    ? interpolate(frame, [0, TITLE_FADE_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  const baseStart = title ? TITLE_OFFSET : 5;

  return (
    <AbsoluteFill>
      <BackgroundGradient variant="default" backgroundImage={backgroundImage} />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingLeft: '20%',
          paddingRight: '10%',
          zIndex: 2,
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
        {/* Title */}
        {title && (
          <div
            style={{
              fontSize: 56,
              fontFamily: THEME.fonts.heading,
              fontWeight: 700,
              color: COLORS.textPrimary,
              marginBottom: itemSpacing,
              opacity: titleOpacity,
            }}
          >
            {title}
          </div>
        )}

        {/* Items */}
        {items.map((item, i) => {
          const itemStart = baseStart + i * ITEM_STAGGER;
          const markerStart = itemStart - MARKER_LEAD;

          const markerOpacity = interpolate(
            frame,
            [markerStart, markerStart + ITEM_FADE_FRAMES],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          const textOpacity = interpolate(
            frame,
            [itemStart, itemStart + ITEM_FADE_FRAMES],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          const textSlideX = interpolate(
            frame,
            [itemStart, itemStart + ITEM_FADE_FRAMES],
            [-30, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                marginBottom: i < items.length - 1 ? itemSpacing : 0,
              }}
            >
              {/* Marker */}
              <div style={{ opacity: markerOpacity }}>
                {renderMarker(style, i, fontSize)}
              </div>

              {/* Item text */}
              <div
                style={{
                  fontSize,
                  fontFamily: THEME.fonts.body,
                  fontWeight: 400,
                  color: COLORS.textPrimary,
                  lineHeight: 1.4,
                  opacity: textOpacity,
                  transform: `translateX(${textSlideX}px)`,
                }}
              >
                {item}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
