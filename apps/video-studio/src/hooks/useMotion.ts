import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion';
import type { MotionConfig } from '../types.js';
import { MOTION_PRESETS } from '../types.js';

/**
 * Computed motion styles returned by useMotion hook
 */
export interface MotionStyles {
  entranceStyle: {
    opacity: number;
    transform: string;
    filter: string;
  };
  emphasisStyle: {
    filter: string;
    transform: string;
  };
  exitStyle: {
    opacity: number;
    transform: string;
  };
  isEntering: boolean;
  isExiting: boolean;
}

const NEUTRAL_STYLES: MotionStyles = {
  entranceStyle: { opacity: 1, transform: 'none', filter: 'none' },
  emphasisStyle: { filter: 'none', transform: 'none' },
  exitStyle: { opacity: 1, transform: 'none' },
  isEntering: false,
  isExiting: false,
};

/**
 * Resolve preset config merged with explicit overrides
 */
function resolveConfig(config: MotionConfig): Omit<MotionConfig, 'preset'> {
  if (!config.preset) {
    return config;
  }
  const preset = MOTION_PRESETS[config.preset];
  return {
    entrance: { ...preset.entrance, ...stripUndefined(config.entrance) },
    emphasis: { ...preset.emphasis, ...stripUndefined(config.emphasis) },
    exit: { ...preset.exit, ...stripUndefined(config.exit) },
  };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Compute easing progress (0→1) for a given frame range
 */
function computeProgress(
  frame: number,
  fps: number,
  startFrame: number,
  endFrame: number,
  easing: string,
  springConfig?: { damping: number; stiffness: number; mass: number },
): number {
  const relativeFrame = frame - startFrame;
  const duration = endFrame - startFrame;

  if (relativeFrame <= 0) return 0;
  if (relativeFrame >= duration) return 1;

  if (easing === 'spring') {
    return spring({
      frame: relativeFrame,
      fps,
      config: springConfig ?? { damping: 100 },
      durationInFrames: duration,
    });
  }

  const easingFn =
    easing === 'easeOut'
      ? Easing.out(Easing.ease)
      : easing === 'easeInOut'
        ? Easing.inOut(Easing.ease)
        : undefined;

  return interpolate(relativeFrame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easingFn,
  });
}

/**
 * Pure computation function for motion styles.
 * Extracted for testability without React/Remotion context.
 */
export function computeMotionStyles(
  frame: number,
  fps: number,
  config: MotionConfig | undefined,
  segmentDurationFrames: number,
): MotionStyles {
  if (!config) {
    return NEUTRAL_STYLES;
  }

  const resolved = resolveConfig(config);
  const { entrance, emphasis, exit } = resolved;

  // --- Entrance ---
  const entranceStart = entrance.delay;
  const entranceEnd = entrance.delay + entrance.duration;
  const isEntering = frame >= entranceStart && frame < entranceEnd;
  const entranceProgress = computeProgress(
    frame,
    fps,
    entranceStart,
    entranceEnd,
    entrance.easing,
    entrance.springConfig,
  );

  let entranceOpacity = 1;
  let entranceTransform = 'none';
  let entranceFilter = 'none';

  switch (entrance.type) {
    case 'fade':
      entranceOpacity = entranceProgress;
      break;
    case 'slide': {
      const offset = 1 - entranceProgress;
      const dir = entrance.direction ?? 'up';
      if (dir === 'left') entranceTransform = `translateX(${-offset * 100}%)`;
      else if (dir === 'right') entranceTransform = `translateX(${offset * 100}%)`;
      else if (dir === 'up') entranceTransform = `translateY(${offset * 100}%)`;
      else if (dir === 'down') entranceTransform = `translateY(${-offset * 100}%)`;
      break;
    }
    case 'pop':
      entranceOpacity = entranceProgress;
      entranceTransform = `scale(${entranceProgress})`;
      break;
    case 'scale':
      entranceTransform = `scale(${entranceProgress})`;
      break;
    case 'blur': {
      entranceOpacity = entranceProgress;
      const blurAmount = (1 - entranceProgress) * 10;
      entranceFilter = `blur(${blurAmount}px)`;
      break;
    }
    case 'none':
      break;
  }

  const entranceStyle = {
    opacity: entranceOpacity,
    transform: entranceTransform,
    filter: entranceFilter,
  };

  // --- Exit ---
  const exitStart = segmentDurationFrames - exit.startBeforeEnd;
  const exitEnd = exitStart + exit.duration;
  const isExiting = frame >= exitStart && frame < segmentDurationFrames;
  const exitProgress = frame < exitStart
    ? 0
    : frame >= exitEnd
      ? 1
      : interpolate(frame, [exitStart, exitEnd], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  let exitOpacity = 1;
  let exitTransform = 'none';

  switch (exit.type) {
    case 'fade':
      exitOpacity = 1 - exitProgress;
      break;
    case 'slide': {
      const dir = exit.direction ?? 'left';
      if (dir === 'left') exitTransform = `translateX(${-exitProgress * 100}%)`;
      else if (dir === 'right') exitTransform = `translateX(${exitProgress * 100}%)`;
      else if (dir === 'up') exitTransform = `translateY(${-exitProgress * 100}%)`;
      else if (dir === 'down') exitTransform = `translateY(${exitProgress * 100}%)`;
      break;
    }
    case 'shrink':
      exitOpacity = 1 - exitProgress;
      exitTransform = `scale(${1 - exitProgress})`;
      break;
    case 'blur':
      exitOpacity = 1 - exitProgress;
      break;
    case 'none':
      break;
  }

  const exitStyle = {
    opacity: exitOpacity,
    transform: exitTransform,
  };

  // --- Emphasis ---
  let emphasisFilter = 'none';
  let emphasisTransform = 'none';

  if (emphasis.type !== 'none') {
    const intensity = emphasis.intensity;
    switch (emphasis.type) {
      case 'pulse': {
        const cycle = Math.sin((frame / emphasis.duration) * Math.PI * 2);
        const pulseAmount = 1 + cycle * intensity * 0.1;
        emphasisTransform = `scale(${pulseAmount})`;
        break;
      }
      case 'shake': {
        const shakeOffset = Math.sin((frame / emphasis.duration) * Math.PI * 2) * intensity * 5;
        emphasisTransform = `translateX(${shakeOffset}px)`;
        break;
      }
      case 'glow':
        emphasisFilter = `brightness(${1 + intensity * 0.3})`;
        break;
      case 'scale':
        emphasisTransform = `scale(${1 + intensity * 0.2})`;
        break;
      case 'underline':
        // Component handles text-decoration
        break;
    }
  }

  const emphasisStyle = {
    filter: emphasisFilter,
    transform: emphasisTransform,
  };

  return {
    entranceStyle,
    emphasisStyle,
    exitStyle,
    isEntering,
    isExiting,
  };
}

/**
 * Hook for computing motion animation styles based on MotionConfig.
 *
 * Uses Remotion's useCurrentFrame() and useVideoConfig() internally.
 * Returns neutral styles when config is undefined.
 */
export function useMotion(
  config: MotionConfig | undefined,
  segmentDurationFrames: number,
): MotionStyles {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return computeMotionStyles(frame, fps, config, segmentDurationFrames);
}
