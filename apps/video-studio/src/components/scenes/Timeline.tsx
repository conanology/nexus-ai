import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import type { SceneComponentProps } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINE_DRAW_FRAMES = 30;
const EVENT_STAGGER = 10;
const TICK_SPRING_FRAMES = 12;
const LABEL_FADE_FRAMES = 5;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface EventMarkerProps {
  event: { year: string; label: string; description?: string };
  xPercent: number;
  startFrame: number;
  isActive: boolean;
  frame: number;
  fps: number;
  compact: boolean;
}

const EventMarker: React.FC<EventMarkerProps> = ({
  event,
  xPercent,
  startFrame,
  isActive,
  frame,
  fps,
  compact,
}) => {
  const relFrame = Math.max(0, frame - startFrame);

  // Tick grows from bottom (scaleY 0→1)
  const tickScale = spring({
    frame: relFrame,
    fps,
    config: { damping: 14, stiffness: 200, mass: 0.6 },
    durationInFrames: TICK_SPRING_FRAMES,
  });

  // Year label fades in 5 frames after tick starts
  const yearOpacity = interpolate(
    frame,
    [startFrame + 5, startFrame + 5 + LABEL_FADE_FRAMES],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Description fades in 10 frames after tick starts
  const descOpacity = interpolate(
    frame,
    [startFrame + 10, startFrame + 10 + LABEL_FADE_FRAMES],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const tickColor = isActive ? COLORS.accentPrimary : COLORS.textMuted;
  const yearFontSize = compact ? 22 : 28;
  const descFontSize = compact ? 26 : 32;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${xPercent}%`,
        top: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Year/label — above the axis */}
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          fontSize: yearFontSize,
          fontFamily: THEME.fonts.mono,
          fontWeight: 600,
          color: tickColor,
          whiteSpace: 'nowrap',
          opacity: yearOpacity,
          textAlign: 'center',
        }}
      >
        {event.year || event.label}
      </div>

      {/* Vertical tick mark */}
      <div
        style={{
          width: 2,
          height: 20,
          backgroundColor: tickColor,
          transformOrigin: 'bottom center',
          transform: `translateY(-20px) scaleY(${tickScale})`,
        }}
      />

      {/* Dot on axis */}
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: isActive ? COLORS.accentPrimary : 'transparent',
          border: `2px solid ${tickColor}`,
          transform: `translateY(-6px) scale(${tickScale})`,
        }}
      />

      {/* Description — below the axis */}
      {event.description && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            fontSize: descFontSize,
            fontFamily: THEME.fonts.body,
            fontWeight: 400,
            color: COLORS.textPrimary,
            opacity: descOpacity,
            textAlign: 'center',
            maxWidth: 200,
            lineHeight: 1.3,
          }}
        >
          {event.description}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const Timeline: React.FC<SceneComponentProps<'timeline'>> = (props) => {
  const { visualData, motion, backgroundImage } = props;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { events } = visualData;
  const count = events.length;
  const compact = count > 6;

  // Axis line draws left-to-right over LINE_DRAW_FRAMES
  const lineProgress = interpolate(frame, [0, LINE_DRAW_FRAMES], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Determine which event is the most recently appeared ("active")
  const lastVisibleIndex = (() => {
    for (let i = count - 1; i >= 0; i--) {
      if (frame >= LINE_DRAW_FRAMES + i * EVENT_STAGGER) return i;
    }
    return -1;
  })();

  return (
    <AbsoluteFill>
      <BackgroundGradient variant="cool" grid gridOpacity={0.03} backgroundImage={backgroundImage} />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
        {/* Horizontal axis line */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '10%',
            width: `${lineProgress * 0.8}%`,
            height: 2,
            backgroundColor: COLORS.textMuted,
            transform: 'translateY(-1px)',
          }}
        />

        {/* Event markers */}
        {events.map((event, i) => {
          const xPercent = count === 1
            ? 50
            : 10 + (i / (count - 1)) * 80;

          return (
            <EventMarker
              key={i}
              event={event}
              xPercent={xPercent}
              startFrame={LINE_DRAW_FRAMES + i * EVENT_STAGGER}
              isActive={i === lastVisibleIndex}
              frame={frame}
              fps={fps}
              compact={compact}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
