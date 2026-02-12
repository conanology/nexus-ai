import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { THEME } from '../../theme.js';
import { COLORS, textGlow } from '../../utils/colors.js';

export interface CountUpNumberProps {
  targetNumber: number;
  prefix?: string;
  suffix?: string;
  durationFrames?: number;
  delayFrames?: number;
  fontSize: number;
  fontFamily?: string;
  color?: string;
  decimals?: number;
}

function detectDecimals(n: number): number {
  const str = String(n);
  const dotIndex = str.indexOf('.');
  if (dotIndex === -1) return 0;
  return str.length - dotIndex - 1;
}

export const CountUpNumber: React.FC<CountUpNumberProps> = ({
  targetNumber,
  prefix,
  suffix,
  durationFrames = 30,
  delayFrames = 0,
  fontSize,
  fontFamily = THEME.fonts.mono,
  color = '#ffffff',
  decimals,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const resolvedDecimals = useMemo(
    () => decimals ?? detectDecimals(targetNumber),
    [decimals, targetNumber],
  );

  const effectiveFrame = Math.max(0, frame - delayFrames);

  const currentValue = interpolate(
    effectiveFrame,
    [0, durationFrames],
    [0, targetNumber],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  const formattedNumber = currentValue.toLocaleString('en-US', {
    minimumFractionDigits: resolvedDecimals,
    maximumFractionDigits: resolvedDecimals,
  });

  // Entrance: slam scale from 1.5→1.0 with spring over first 8 frames
  const entranceSpring = spring({
    frame: effectiveFrame,
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 200 },
    durationInFrames: 8,
  });
  const entranceScale = interpolate(entranceSpring, [0, 1], [1.5, 1.0]);
  const entranceOpacity = entranceSpring;

  // Scale overshoot: triggers when count-up completes
  const overshootFrame = effectiveFrame - durationFrames;
  const scaleSpring =
    overshootFrame >= 0
      ? spring({
          frame: overshootFrame,
          fps,
          config: { damping: 8, mass: 0.4, stiffness: 200 },
        })
      : 0;

  const overshootScale = interpolate(scaleSpring, [0, 0.5, 1], [1, 1.06, 1]);
  const scale = overshootScale * entranceScale;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        opacity: entranceOpacity,
        transform: `scale(${scale})`,
        willChange: 'transform',
      }}
    >
      {prefix && (
        <span
          style={{
            fontSize: fontSize * 0.8,
            fontFamily,
            fontWeight: 700,
            color,
          }}
        >
          {prefix}
        </span>
      )}
      <span
        style={{
          fontSize,
          fontFamily,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          textShadow: textGlow(COLORS.accentPrimary, 'medium'),
        }}
      >
        {formattedNumber}
      </span>
      {suffix && (
        <span
          style={{
            fontSize: fontSize * 0.8,
            fontFamily,
            fontWeight: 700,
            color,
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
};
