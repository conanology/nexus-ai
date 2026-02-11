import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../../utils/colors.js';
import { THEME } from '../../theme.js';
import { CountUpNumber } from '../shared/CountUpNumber.js';
import { AnimatedText } from '../shared/AnimatedText.js';
import type { StatCalloutVisualData, TextEmphasisVisualData } from '../../types/scenes.js';

// =============================================================================
// Types
// =============================================================================

export interface ColdOpenProps {
  hook: {
    text: string;
    sceneType: 'stat-callout' | 'text-emphasis';
    visualData: StatCalloutVisualData | TextEmphasisVisualData;
  };
  durationFrames: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Frame when the cyan line starts drawing */
const LINE_START = 5;
/** Frame when the cyan line finishes drawing */
const LINE_END = 15;
/** Frame when content slams in */
const CONTENT_APPEAR = 15;
/** Number of frames for screen shake effect */
const SHAKE_FRAMES = 8;
/** Number of frames for the hard cut to black at the end */
const EXIT_FRAMES = 5;

// =============================================================================
// Component
// =============================================================================

/**
 * Cold Open wrapper — renders a stat-callout or text-emphasis
 * in a dramatic "hook" style before the intro sequence.
 *
 * Visual sequence:
 * 1. Black screen (frames 0-5)
 * 2. Cyan horizontal line draws across center (frames 5-15)
 * 3. Content SLAMS in with screen shake (frame 15+)
 * 4. Hard cut to black in last 5 frames
 */
export const ColdOpen: React.FC<ColdOpenProps> = ({ hook, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Cyan accent line: draws from center outward ---
  const lineProgress = interpolate(frame, [LINE_START, LINE_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lineWidth = lineProgress * 300;

  // --- Content entrance: slam spring ---
  const contentFrame = Math.max(0, frame - CONTENT_APPEAR);
  const slamSpring = spring({
    frame: contentFrame,
    fps,
    config: { damping: 12, mass: 0.8, stiffness: 200 },
  });
  const contentScale = interpolate(slamSpring, [0, 1], [1.5, 1.0]);
  const contentOpacity = contentFrame > 0 ? 1 : 0;

  // --- Screen shake on appearance (2px random offset for SHAKE_FRAMES) ---
  let shakeX = 0;
  let shakeY = 0;
  if (contentFrame > 0 && contentFrame <= SHAKE_FRAMES) {
    const intensity = 1 - contentFrame / SHAKE_FRAMES;
    shakeX = Math.sin(contentFrame * Math.PI * 3) * 4 * intensity;
    shakeY = Math.cos(contentFrame * Math.PI * 2.5) * 4 * intensity;
  }

  // --- Hard cut to black at the end ---
  const exitStart = durationFrames - EXIT_FRAMES;
  const exitOpacity = interpolate(frame, [exitStart, durationFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity: exitOpacity,
      }}
    >
      {/* Cyan accent line — draws across center */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: lineWidth,
          height: 2,
          backgroundColor: COLORS.accentPrimary,
          zIndex: 1,
          // Fade out when content appears
          opacity: interpolate(frame, [CONTENT_APPEAR, CONTENT_APPEAR + 5], [1, 0.3], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      />

      {/* Content — stat or text emphasis */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
          zIndex: 2,
          opacity: contentOpacity,
          transform: `scale(${contentScale}) translate(${shakeX}px, ${shakeY}px)`,
        }}
      >
        {hook.sceneType === 'stat-callout'
          ? renderStatHook(hook.visualData as StatCalloutVisualData)
          : renderTextHook(hook.visualData as TextEmphasisVisualData)}
      </div>
    </AbsoluteFill>
  );
};

// =============================================================================
// Sub-renderers (no hooks — pure layout)
// =============================================================================

function renderStatHook(visualData: StatCalloutVisualData): React.ReactElement {
  const numStr = visualData.number;
  const numeric = parseFloat(numStr.replace(/[,$€£]/g, '')) || 0;
  const dotIndex = numStr.indexOf('.');
  const decimals = dotIndex === -1 ? 0 : numStr.length - dotIndex - 1;

  return (
    <>
      <CountUpNumber
        targetNumber={numeric}
        prefix={visualData.prefix}
        suffix={visualData.suffix}
        decimals={decimals}
        fontSize={192} // +20% from normal 160
        durationFrames={1} // Instant — no count-up in cold open
        color="#ffffff"
      />
      <div
        style={{
          marginTop: 24,
          fontSize: 48, // +20% from normal 40
          fontFamily: THEME.fonts.heading,
          fontWeight: 400,
          color: COLORS.textSecondary,
          textAlign: 'center',
        }}
      >
        {visualData.label}
      </div>
    </>
  );
}

function renderTextHook(visualData: TextEmphasisVisualData): React.ReactElement {
  const fontSize = visualData.phrase.length > 60 ? 86 : 115; // +20% from normal 72/96

  return (
    <AnimatedText
      text={visualData.phrase}
      highlightWords={visualData.highlightWords}
      animationStyle="slam"
      fontSize={fontSize}
      fontWeight={700}
      textAlign="center"
    />
  );
}
