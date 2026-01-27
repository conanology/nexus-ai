import { describe, it, expect } from 'vitest';
import { computeMotionStyles } from '../hooks/useMotion.js';
import type { MotionConfig } from '../types.js';
import { MOTION_PRESETS } from '../types.js';

const FPS = 30;

/**
 * Helper: build a full MotionConfig with defaults
 */
function makeConfig(overrides: Partial<MotionConfig> = {}): MotionConfig {
  return {
    entrance: {
      type: 'fade',
      delay: 0,
      duration: 15,
      easing: 'linear',
      ...overrides.entrance,
    },
    emphasis: {
      type: 'none',
      trigger: 'none',
      intensity: 0,
      duration: 0,
      ...overrides.emphasis,
    },
    exit: {
      type: 'fade',
      duration: 15,
      startBeforeEnd: 15,
      ...overrides.exit,
    },
    ...(overrides.preset ? { preset: overrides.preset } : {}),
  } as MotionConfig;
}

describe('computeMotionStyles', () => {
  describe('Neutral styles when config is undefined', () => {
    it('should return neutral styles when config is undefined', () => {
      const result = computeMotionStyles(0, FPS, undefined, 90);
      expect(result).toEqual({
        entranceStyle: { opacity: 1, transform: 'none', filter: 'none' },
        emphasisStyle: { filter: 'none', transform: 'none' },
        exitStyle: { opacity: 1, transform: 'none' },
        isEntering: false,
        isExiting: false,
      });
    });

    it('should return neutral styles at any frame when config is undefined', () => {
      const result = computeMotionStyles(50, FPS, undefined, 90);
      expect(result.entranceStyle.opacity).toBe(1);
      expect(result.entranceStyle.transform).toBe('none');
      expect(result.emphasisStyle.filter).toBe('none');
      expect(result.exitStyle.opacity).toBe(1);
    });
  });

  describe('Entrance animation - fade', () => {
    it('should have opacity 0 at frame 0 for fade entrance', () => {
      const config = makeConfig({ entrance: { type: 'fade', delay: 0, duration: 15, easing: 'linear' } });
      const result = computeMotionStyles(0, FPS, config, 90);
      expect(result.entranceStyle.opacity).toBe(0);
      expect(result.entranceStyle.transform).toBe('none');
      expect(result.entranceStyle.filter).toBe('none');
    });

    it('should have opacity ~0.5 at midpoint for linear fade entrance', () => {
      const config = makeConfig({ entrance: { type: 'fade', delay: 0, duration: 10, easing: 'linear' } });
      const result = computeMotionStyles(5, FPS, config, 90);
      expect(result.entranceStyle.opacity).toBeCloseTo(0.5, 1);
    });

    it('should have opacity 1 after entrance completes', () => {
      const config = makeConfig({ entrance: { type: 'fade', delay: 0, duration: 15, easing: 'linear' } });
      const result = computeMotionStyles(15, FPS, config, 90);
      expect(result.entranceStyle.opacity).toBe(1);
    });
  });

  describe('Entrance animation - slide', () => {
    it('should translate for slide-up entrance', () => {
      const config = makeConfig({
        entrance: { type: 'slide', direction: 'up', delay: 0, duration: 10, easing: 'linear' },
      });
      // At frame 0, offset = 100%
      const result0 = computeMotionStyles(0, FPS, config, 90);
      expect(result0.entranceStyle.transform).toBe('translateY(100%)');

      // At end, offset should be 0
      const resultEnd = computeMotionStyles(10, FPS, config, 90);
      expect(resultEnd.entranceStyle.transform).toBe('translateY(0%)');
    });

    it('should translate for slide-right entrance', () => {
      const config = makeConfig({
        entrance: { type: 'slide', direction: 'right', delay: 0, duration: 10, easing: 'linear' },
      });
      const result = computeMotionStyles(0, FPS, config, 90);
      expect(result.entranceStyle.transform).toBe('translateX(100%)');
    });

    it('should translate for slide-left entrance', () => {
      const config = makeConfig({
        entrance: { type: 'slide', direction: 'left', delay: 0, duration: 10, easing: 'linear' },
      });
      const result = computeMotionStyles(0, FPS, config, 90);
      expect(result.entranceStyle.transform).toBe('translateX(-100%)');
    });

    it('should translate for slide-down entrance', () => {
      const config = makeConfig({
        entrance: { type: 'slide', direction: 'down', delay: 0, duration: 10, easing: 'linear' },
      });
      const result = computeMotionStyles(0, FPS, config, 90);
      expect(result.entranceStyle.transform).toBe('translateY(-100%)');
    });
  });

  describe('Entrance animation - pop/scale', () => {
    it('should scale from 0 and fade for pop entrance', () => {
      const config = makeConfig({
        entrance: { type: 'pop', delay: 0, duration: 10, easing: 'linear' },
      });
      const result0 = computeMotionStyles(0, FPS, config, 90);
      expect(result0.entranceStyle.opacity).toBe(0);
      expect(result0.entranceStyle.transform).toBe('scale(0)');

      const resultEnd = computeMotionStyles(10, FPS, config, 90);
      expect(resultEnd.entranceStyle.opacity).toBe(1);
      expect(resultEnd.entranceStyle.transform).toBe('scale(1)');
    });

    it('should scale from 0 without fade for scale entrance', () => {
      const config = makeConfig({
        entrance: { type: 'scale', delay: 0, duration: 10, easing: 'linear' },
      });
      const result0 = computeMotionStyles(0, FPS, config, 90);
      expect(result0.entranceStyle.opacity).toBe(1); // no opacity change for scale
      expect(result0.entranceStyle.transform).toBe('scale(0)');

      const resultEnd = computeMotionStyles(10, FPS, config, 90);
      expect(resultEnd.entranceStyle.transform).toBe('scale(1)');
    });
  });

  describe('Entrance animation - blur', () => {
    it('should fade opacity and apply blur filter for blur entrance', () => {
      const config = makeConfig({
        entrance: { type: 'blur', delay: 0, duration: 10, easing: 'linear' },
      });
      const result0 = computeMotionStyles(0, FPS, config, 90);
      expect(result0.entranceStyle.opacity).toBe(0);
      expect(result0.entranceStyle.filter).toContain('blur(');
      expect(result0.entranceStyle.filter).toBe('blur(10px)');

      const resultMid = computeMotionStyles(5, FPS, config, 90);
      expect(resultMid.entranceStyle.filter).toBe('blur(5px)');

      const resultEnd = computeMotionStyles(10, FPS, config, 90);
      expect(resultEnd.entranceStyle.opacity).toBe(1);
      expect(resultEnd.entranceStyle.filter).toBe('blur(0px)');
    });
  });

  describe('Entrance easing - spring', () => {
    it('should use spring easing when configured', () => {
      const config = makeConfig({
        entrance: {
          type: 'fade',
          delay: 0,
          duration: 15,
          easing: 'spring',
          springConfig: { damping: 100, stiffness: 200, mass: 1 },
        },
      });
      // Spring should produce a value between 0 and 1 at mid-frame
      const resultMid = computeMotionStyles(7, FPS, config, 90);
      expect(resultMid.entranceStyle.opacity).toBeGreaterThan(0);
      expect(resultMid.entranceStyle.opacity).toBeLessThanOrEqual(1);
    });

    it('should use spring without explicit springConfig (default damping)', () => {
      const config = makeConfig({
        entrance: { type: 'fade', delay: 0, duration: 15, easing: 'spring' },
      });
      const resultMid = computeMotionStyles(7, FPS, config, 90);
      expect(resultMid.entranceStyle.opacity).toBeGreaterThan(0);
      expect(resultMid.entranceStyle.opacity).toBeLessThanOrEqual(1);
    });
  });

  describe('Entrance easing - non-spring', () => {
    it('should use easeOut interpolation', () => {
      const config = makeConfig({
        entrance: { type: 'fade', delay: 0, duration: 10, easing: 'easeOut' },
      });
      const result = computeMotionStyles(5, FPS, config, 90);
      // easeOut should be further along than linear at midpoint
      expect(result.entranceStyle.opacity).toBeGreaterThan(0.5);
      expect(result.entranceStyle.opacity).toBeLessThan(1);
    });

    it('should use easeInOut interpolation', () => {
      const config = makeConfig({
        entrance: { type: 'fade', delay: 0, duration: 10, easing: 'easeInOut' },
      });
      const result = computeMotionStyles(5, FPS, config, 90);
      // easeInOut at midpoint should be close to 0.5
      expect(result.entranceStyle.opacity).toBeCloseTo(0.5, 1);
    });
  });

  describe('Exit animation', () => {
    it('should start exit at segmentDurationFrames - startBeforeEnd', () => {
      const config = makeConfig({
        exit: { type: 'fade', duration: 10, startBeforeEnd: 10 },
      });
      const segDuration = 90;
      // Exit starts at segDuration - startBeforeEnd = 90 - 10 = frame 80

      // Before exit
      const before = computeMotionStyles(79, FPS, config, segDuration);
      expect(before.exitStyle.opacity).toBe(1);
      expect(before.isExiting).toBe(false);

      // During exit
      const during = computeMotionStyles(85, FPS, config, segDuration);
      expect(during.exitStyle.opacity).toBeLessThan(1);
      expect(during.exitStyle.opacity).toBeGreaterThan(0);
      expect(during.isExiting).toBe(true);
    });

    it('should handle fade exit', () => {
      const config = makeConfig({
        exit: { type: 'fade', duration: 10, startBeforeEnd: 10 },
      });
      const result = computeMotionStyles(90, FPS, config, 90);
      expect(result.exitStyle.opacity).toBe(0);
    });

    it('should handle shrink exit', () => {
      const config = makeConfig({
        exit: { type: 'shrink', duration: 10, startBeforeEnd: 10 },
      });
      const segDuration = 90;
      const result = computeMotionStyles(90, FPS, config, segDuration);
      expect(result.exitStyle.opacity).toBe(0);
      expect(result.exitStyle.transform).toBe('scale(0)');
    });

    it('should handle slide exit', () => {
      const config = makeConfig({
        exit: { type: 'slide', direction: 'left', duration: 10, startBeforeEnd: 10 },
      });
      const segDuration = 90;
      const result = computeMotionStyles(90, FPS, config, segDuration);
      expect(result.exitStyle.transform).toContain('translateX');
    });
  });

  describe('Emphasis animation', () => {
    it('should apply pulse emphasis as scale transform', () => {
      const config = makeConfig({
        emphasis: { type: 'pulse', trigger: 'continuous', intensity: 0.5, duration: 10 },
      });
      const result = computeMotionStyles(5, FPS, config, 90);
      expect(result.emphasisStyle.transform).toContain('scale(');
    });

    it('should apply glow emphasis as brightness filter', () => {
      const config = makeConfig({
        emphasis: { type: 'glow', trigger: 'onSegment', intensity: 0.8, duration: 15 },
      });
      const result = computeMotionStyles(10, FPS, config, 90);
      expect(result.emphasisStyle.filter).toContain('brightness(');
      expect(result.emphasisStyle.transform).toBe('none');
    });

    it('should apply shake emphasis as translateX', () => {
      const config = makeConfig({
        emphasis: { type: 'shake', trigger: 'continuous', intensity: 0.5, duration: 10 },
      });
      const result = computeMotionStyles(3, FPS, config, 90);
      expect(result.emphasisStyle.transform).toContain('translateX(');
    });

    it('should apply scale emphasis', () => {
      const config = makeConfig({
        emphasis: { type: 'scale', trigger: 'continuous', intensity: 0.5, duration: 10 },
      });
      const result = computeMotionStyles(5, FPS, config, 90);
      expect(result.emphasisStyle.transform).toBe('scale(1.1)');
    });

    it('should not apply transform for underline emphasis', () => {
      const config = makeConfig({
        emphasis: { type: 'underline', trigger: 'onWord', intensity: 0.5, duration: 10 },
      });
      const result = computeMotionStyles(5, FPS, config, 90);
      expect(result.emphasisStyle.transform).toBe('none');
      expect(result.emphasisStyle.filter).toBe('none');
    });
  });

  describe('isEntering and isExiting flags', () => {
    it('should set isEntering true during entrance phase', () => {
      const config = makeConfig({
        entrance: { type: 'fade', delay: 0, duration: 10, easing: 'linear' },
      });
      const result = computeMotionStyles(5, FPS, config, 90);
      expect(result.isEntering).toBe(true);
    });

    it('should set isEntering false after entrance phase', () => {
      const config = makeConfig({
        entrance: { type: 'fade', delay: 0, duration: 10, easing: 'linear' },
      });
      const result = computeMotionStyles(10, FPS, config, 90);
      expect(result.isEntering).toBe(false);
    });

    it('should set isExiting true during exit phase', () => {
      const config = makeConfig({
        exit: { type: 'fade', duration: 10, startBeforeEnd: 10 },
      });
      const result = computeMotionStyles(85, FPS, config, 90);
      expect(result.isExiting).toBe(true);
    });

    it('should set isExiting false before exit phase', () => {
      const config = makeConfig({
        exit: { type: 'fade', duration: 10, startBeforeEnd: 10 },
      });
      const result = computeMotionStyles(70, FPS, config, 90);
      expect(result.isExiting).toBe(false);
    });
  });

  describe('Preset resolution', () => {
    it('should apply subtle preset defaults via resolveConfig', () => {
      // Pass preset with the required fields - resolveConfig merges with preset
      const config: MotionConfig = {
        preset: 'subtle',
        entrance: MOTION_PRESETS.subtle.entrance,
        emphasis: MOTION_PRESETS.subtle.emphasis,
        exit: MOTION_PRESETS.subtle.exit,
      };
      const result = computeMotionStyles(0, FPS, config, 90);
      // subtle = fade entrance (from MOTION_PRESETS), so opacity should be 0 at start
      expect(result.entranceStyle.opacity).toBe(0);
      expect(result.entranceStyle.transform).toBe('none');
      // subtle has no emphasis (type: 'none')
      expect(result.emphasisStyle.filter).toBe('none');
      expect(result.emphasisStyle.transform).toBe('none');
    });

    it('should apply dramatic preset - pop entrance with spring', () => {
      const config: MotionConfig = {
        preset: 'dramatic',
        entrance: MOTION_PRESETS.dramatic.entrance,
        emphasis: MOTION_PRESETS.dramatic.emphasis,
        exit: MOTION_PRESETS.dramatic.exit,
      };
      // At frame 0, pop entrance => opacity 0, scale(0)
      const result = computeMotionStyles(0, FPS, config, 90);
      expect(result.entranceStyle.opacity).toBe(0);
      expect(result.entranceStyle.transform).toBe('scale(0)');
      // dramatic has glow emphasis
      expect(result.emphasisStyle.filter).toContain('brightness(');
    });

    it('should merge preset with explicit overrides', () => {
      // Use standard preset but override entrance type to 'fade'
      const config: MotionConfig = {
        preset: 'standard',
        entrance: {
          ...MOTION_PRESETS.standard.entrance,
          type: 'fade', // override slide→fade
        },
        emphasis: MOTION_PRESETS.standard.emphasis,
        exit: MOTION_PRESETS.standard.exit,
      };
      const result = computeMotionStyles(0, FPS, config, 90);
      // Should use fade (from override), not slide (from preset)
      expect(result.entranceStyle.opacity).toBe(0);
      expect(result.entranceStyle.transform).toBe('none'); // fade doesn't use transform
    });

    it('should use preset exit values correctly', () => {
      // dramatic preset: shrink exit with startBeforeEnd: 15
      const config: MotionConfig = {
        preset: 'dramatic',
        entrance: MOTION_PRESETS.dramatic.entrance,
        emphasis: MOTION_PRESETS.dramatic.emphasis,
        exit: MOTION_PRESETS.dramatic.exit,
      };
      const segDuration = 90;
      // Exit starts at 90 - 15 = frame 75
      const beforeExit = computeMotionStyles(74, FPS, config, segDuration);
      expect(beforeExit.isExiting).toBe(false);

      const duringExit = computeMotionStyles(80, FPS, config, segDuration);
      expect(duringExit.isExiting).toBe(true);
      expect(duringExit.exitStyle.transform).toContain('scale(');
    });
  });

  describe('Entrance delay', () => {
    it('should offset animation start by delay frames', () => {
      const config = makeConfig({
        entrance: { type: 'fade', delay: 10, duration: 10, easing: 'linear' },
      });
      // Before delay, progress should be 0
      const beforeDelay = computeMotionStyles(5, FPS, config, 90);
      expect(beforeDelay.entranceStyle.opacity).toBe(0);
      expect(beforeDelay.isEntering).toBe(false);

      // At delay start, animation begins
      const atDelay = computeMotionStyles(10, FPS, config, 90);
      expect(atDelay.isEntering).toBe(true);

      // After delay + duration, animation complete
      const afterDelay = computeMotionStyles(20, FPS, config, 90);
      expect(afterDelay.entranceStyle.opacity).toBe(1);
      expect(afterDelay.isEntering).toBe(false);
    });
  });

  describe('Entrance type none', () => {
    it('should return full opacity and no transform for none entrance', () => {
      const config = makeConfig({
        entrance: { type: 'none', delay: 0, duration: 0, easing: 'linear' },
      });
      const result = computeMotionStyles(0, FPS, config, 90);
      expect(result.entranceStyle.opacity).toBe(1);
      expect(result.entranceStyle.transform).toBe('none');
    });
  });

  describe('Exit type none', () => {
    it('should return full opacity and no transform for none exit', () => {
      const config = makeConfig({
        exit: { type: 'none', duration: 10, startBeforeEnd: 10 },
      });
      const result = computeMotionStyles(85, FPS, config, 90);
      expect(result.exitStyle.opacity).toBe(1);
      expect(result.exitStyle.transform).toBe('none');
    });
  });
});
