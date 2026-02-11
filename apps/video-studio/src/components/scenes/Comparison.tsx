import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useMotion } from '../../hooks/useMotion.js';
import { COLORS, withOpacity } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { BackgroundGradient } from '../shared/BackgroundGradient.js';
import type { SceneComponentProps } from '../../types/scenes.js';

// ---------------------------------------------------------------------------
// Animation timing constants
// ---------------------------------------------------------------------------

const DIVIDER_DURATION = 15;
const TITLE_FADE_DURATION = 10;
const ITEM_STAGGER = 8;
const ITEM_FADE_DURATION = 10;
const CROSS_PANEL_GAP = 15; // frames between left done and right start
const LEFT_TITLE_START = 10;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PanelProps {
  title: string;
  items: string[];
  accentColor: string;
  bgTint: string;
  side: 'left' | 'right';
  titleStartFrame: number;
  itemsStartFrame: number;
  frame: number;
}

const Panel: React.FC<PanelProps> = ({
  title,
  items,
  accentColor,
  bgTint,
  side,
  titleStartFrame,
  itemsStartFrame,
  frame,
}) => {
  const titleOpacity = interpolate(
    frame,
    [titleStartFrame, titleStartFrame + TITLE_FADE_DURATION],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const positionStyle =
    side === 'left'
      ? { left: 80, right: '52%' }
      : { right: 80, left: '52%' };

  return (
    <div
      style={{
        position: 'absolute',
        top: 80,
        bottom: 80,
        ...positionStyle,
        display: 'flex',
        flexDirection: 'column',
        padding: '40px 32px',
        backgroundColor: bgTint,
        borderRadius: 12,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: 40,
          fontWeight: 700,
          fontFamily: THEME.fonts.heading,
          color: COLORS.textPrimary,
          borderLeft: `3px solid ${accentColor}`,
          paddingLeft: 16,
          marginBottom: 36,
          opacity: titleOpacity,
        }}
      >
        {title}
      </div>

      {/* Items */}
      {items.map((item, i) => {
        const itemStart = itemsStartFrame + i * ITEM_STAGGER;
        const itemOpacity = interpolate(
          frame,
          [itemStart, itemStart + ITEM_FADE_DURATION],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
        const slideX = interpolate(
          frame,
          [itemStart, itemStart + ITEM_FADE_DURATION],
          [-20, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );

        return (
          <div
            key={i}
            style={{
              fontSize: 32,
              fontFamily: THEME.fonts.body,
              fontWeight: 400,
              color: COLORS.textPrimary,
              opacity: itemOpacity,
              transform: `translateX(${slideX}px)`,
              marginBottom: 24,
              paddingLeft: 24,
              lineHeight: 1.4,
            }}
          >
            <span style={{ color: COLORS.textMuted, marginRight: 12 }}>—</span>
            {item}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const Comparison: React.FC<SceneComponentProps<'comparison'>> = (props) => {
  const { visualData, motion, backgroundImage } = props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const motionStyles = useMotion(motion, durationInFrames);

  const { left, right } = visualData;

  // Animation timeline
  const leftTitleStart = LEFT_TITLE_START;
  const leftItemsStart = leftTitleStart + TITLE_FADE_DURATION;
  const leftDoneFrame = leftItemsStart + left.items.length * ITEM_STAGGER + ITEM_FADE_DURATION;
  const rightTitleStart = leftDoneFrame + CROSS_PANEL_GAP;
  const rightItemsStart = rightTitleStart + TITLE_FADE_DURATION;

  // Divider animation
  const dividerProgress = interpolate(
    frame,
    [0, DIVIDER_DURATION],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // VS badge appears when divider reaches midpoint
  const badgeOpacity = interpolate(
    frame,
    [DIVIDER_DURATION * 0.5, DIVIDER_DURATION],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill>
      <BackgroundGradient variant="default" backgroundImage={backgroundImage} imageOverlay="gradient-bottom" />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          ...motionStyles.entranceStyle,
          ...motionStyles.exitStyle,
        }}
      >
        {/* Vertical divider (centered) */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 80,
            width: 2,
            height: `${dividerProgress}%`,
            maxHeight: 'calc(100% - 160px)',
            backgroundColor: COLORS.textMuted,
            transform: 'translateX(-50%)',
            zIndex: 5,
          }}
        />

        {/* VS badge */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: COLORS.bgElevated,
            border: `1px solid ${COLORS.textMuted}`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: 14,
            fontFamily: THEME.fonts.body,
            fontWeight: 600,
            color: COLORS.textSecondary,
            opacity: badgeOpacity,
            zIndex: 6,
          }}
        >
          vs
        </div>

        {/* Left panel (warm tint — "old" / "before") */}
        <Panel
          title={left.title}
          items={left.items}
          accentColor={COLORS.error}
          bgTint={withOpacity(COLORS.error, 0.05)}
          side="left"
          titleStartFrame={leftTitleStart}
          itemsStartFrame={leftItemsStart}
          frame={frame}
        />

        {/* Right panel (cool tint — "new" / "after") */}
        <Panel
          title={right.title}
          items={right.items}
          accentColor={COLORS.success}
          bgTint={withOpacity(COLORS.success, 0.05)}
          side="right"
          titleStartFrame={rightTitleStart}
          itemsStartFrame={rightItemsStart}
          frame={frame}
        />
      </div>
    </AbsoluteFill>
  );
};
