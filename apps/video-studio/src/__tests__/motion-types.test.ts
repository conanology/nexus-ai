import { describe, it, expect } from 'vitest';
import {
  MOTION_PRESETS,
} from '../types.js';
import type {
  MotionConfig,
  EntranceConfig,
  EmphasisConfig,
  ExitConfig,
  SpringConfig,
  EntranceType,
  EmphasisType,
  ExitType,
  AnimationDirection,
  EasingType,
  EmphasisTrigger,
  MotionPreset,
} from '../types.js';

/**
 * Tests for motion type re-exports from @nexus-ai/script-gen
 * Verifies that video-studio correctly exposes MotionConfig types and presets
 */
describe('Motion Types Re-exports', () => {
  describe('MOTION_PRESETS', () => {
    it('should export MOTION_PRESETS constant', () => {
      expect(MOTION_PRESETS).toBeDefined();
    });

    it('should have subtle, standard, and dramatic keys', () => {
      expect(MOTION_PRESETS).toHaveProperty('subtle');
      expect(MOTION_PRESETS).toHaveProperty('standard');
      expect(MOTION_PRESETS).toHaveProperty('dramatic');
    });

    it('should have exactly 3 preset keys', () => {
      expect(Object.keys(MOTION_PRESETS)).toHaveLength(3);
    });
  });

  describe('MOTION_PRESETS.subtle', () => {
    it('should have fade entrance', () => {
      expect(MOTION_PRESETS.subtle.entrance.type).toBe('fade');
    });

    it('should have no emphasis (type=none)', () => {
      expect(MOTION_PRESETS.subtle.emphasis.type).toBe('none');
      expect(MOTION_PRESETS.subtle.emphasis.trigger).toBe('none');
      expect(MOTION_PRESETS.subtle.emphasis.intensity).toBe(0);
      expect(MOTION_PRESETS.subtle.emphasis.duration).toBe(0);
    });

    it('should have fade exit', () => {
      expect(MOTION_PRESETS.subtle.exit.type).toBe('fade');
      expect(MOTION_PRESETS.subtle.exit.duration).toBe(15);
      expect(MOTION_PRESETS.subtle.exit.startBeforeEnd).toBe(15);
    });

    it('should have easeOut easing on entrance', () => {
      expect(MOTION_PRESETS.subtle.entrance.easing).toBe('easeOut');
      expect(MOTION_PRESETS.subtle.entrance.delay).toBe(0);
      expect(MOTION_PRESETS.subtle.entrance.duration).toBe(20);
    });
  });

  describe('MOTION_PRESETS.standard', () => {
    it('should have slide-up entrance with spring', () => {
      expect(MOTION_PRESETS.standard.entrance.type).toBe('slide');
      expect(MOTION_PRESETS.standard.entrance.direction).toBe('up');
      expect(MOTION_PRESETS.standard.entrance.easing).toBe('spring');
      expect(MOTION_PRESETS.standard.entrance.delay).toBe(0);
      expect(MOTION_PRESETS.standard.entrance.duration).toBe(15);
      expect(MOTION_PRESETS.standard.entrance.springConfig).toBeUndefined();
    });

    it('should have pulse emphasis on word', () => {
      expect(MOTION_PRESETS.standard.emphasis.type).toBe('pulse');
      expect(MOTION_PRESETS.standard.emphasis.trigger).toBe('onWord');
      expect(MOTION_PRESETS.standard.emphasis.intensity).toBe(0.3);
      expect(MOTION_PRESETS.standard.emphasis.duration).toBe(10);
    });

    it('should have fade exit', () => {
      expect(MOTION_PRESETS.standard.exit.type).toBe('fade');
      expect(MOTION_PRESETS.standard.exit.duration).toBe(15);
      expect(MOTION_PRESETS.standard.exit.startBeforeEnd).toBe(15);
    });
  });

  describe('MOTION_PRESETS.dramatic', () => {
    it('should have pop entrance with bounce spring', () => {
      expect(MOTION_PRESETS.dramatic.entrance.type).toBe('pop');
      expect(MOTION_PRESETS.dramatic.entrance.easing).toBe('spring');
      expect(MOTION_PRESETS.dramatic.entrance.springConfig).toBeDefined();
      expect(MOTION_PRESETS.dramatic.entrance.springConfig!.damping).toBe(80);
      expect(MOTION_PRESETS.dramatic.entrance.springConfig!.stiffness).toBe(300);
      expect(MOTION_PRESETS.dramatic.entrance.springConfig!.mass).toBe(1);
    });

    it('should have glow emphasis on word', () => {
      expect(MOTION_PRESETS.dramatic.emphasis.type).toBe('glow');
      expect(MOTION_PRESETS.dramatic.emphasis.trigger).toBe('onWord');
    });

    it('should have shrink exit', () => {
      expect(MOTION_PRESETS.dramatic.exit.type).toBe('shrink');
    });
  });

  describe('TypeScript type compilation', () => {
    it('should compile a complete MotionConfig object', () => {
      const config: MotionConfig = {
        preset: 'standard',
        entrance: {
          type: 'slide',
          direction: 'up',
          delay: 0,
          duration: 15,
          easing: 'spring',
        },
        emphasis: {
          type: 'pulse',
          trigger: 'onWord',
          intensity: 0.5,
          duration: 10,
        },
        exit: {
          type: 'fade',
          duration: 15,
          startBeforeEnd: 15,
        },
      };
      expect(config).toBeDefined();
      expect(config.preset).toBe('standard');
      expect(config.entrance.type).toBe('slide');
      expect(config.emphasis.type).toBe('pulse');
      expect(config.exit.type).toBe('fade');
    });

    it('should compile MotionConfig without optional preset field', () => {
      const config: MotionConfig = {
        entrance: {
          type: 'fade',
          delay: 0,
          duration: 20,
          easing: 'easeOut',
        },
        emphasis: {
          type: 'none',
          trigger: 'none',
          intensity: 0,
          duration: 0,
        },
        exit: {
          type: 'fade',
          duration: 15,
          startBeforeEnd: 15,
        },
      };
      expect(config).toBeDefined();
      expect(config.preset).toBeUndefined();
    });

    it('should compile EntranceConfig with optional fields', () => {
      const entrance: EntranceConfig = {
        type: 'pop',
        delay: 0,
        duration: 12,
        easing: 'spring',
        springConfig: { damping: 80, stiffness: 300, mass: 1 },
      };
      expect(entrance.springConfig).toBeDefined();
    });

    it('should compile EmphasisConfig', () => {
      const emphasis: EmphasisConfig = {
        type: 'glow',
        trigger: 'onWord',
        intensity: 0.6,
        duration: 15,
      };
      expect(emphasis.type).toBe('glow');
    });

    it('should compile ExitConfig with optional direction', () => {
      const exit: ExitConfig = {
        type: 'slide',
        direction: 'left',
        duration: 15,
        startBeforeEnd: 10,
      };
      expect(exit.direction).toBe('left');
    });

    it('should compile SpringConfig', () => {
      const spring: SpringConfig = {
        damping: 100,
        stiffness: 200,
        mass: 1,
      };
      expect(spring.damping).toBe(100);
    });
  });

  describe('Type alias re-exports', () => {
    it('should expose all entrance types', () => {
      const types: EntranceType[] = ['fade', 'slide', 'pop', 'scale', 'blur', 'none'];
      expect(types).toHaveLength(6);
    });

    it('should expose all emphasis types', () => {
      const types: EmphasisType[] = ['pulse', 'shake', 'glow', 'underline', 'scale', 'none'];
      expect(types).toHaveLength(6);
    });

    it('should expose all exit types', () => {
      const types: ExitType[] = ['fade', 'slide', 'shrink', 'blur', 'none'];
      expect(types).toHaveLength(5);
    });

    it('should expose animation directions', () => {
      const dirs: AnimationDirection[] = ['left', 'right', 'up', 'down'];
      expect(dirs).toHaveLength(4);
    });

    it('should expose easing types', () => {
      const easings: EasingType[] = ['spring', 'linear', 'easeOut', 'easeInOut'];
      expect(easings).toHaveLength(4);
    });

    it('should expose emphasis triggers', () => {
      const triggers: EmphasisTrigger[] = ['onWord', 'onSegment', 'continuous', 'none'];
      expect(triggers).toHaveLength(4);
    });

    it('should expose motion presets', () => {
      const presets: MotionPreset[] = ['subtle', 'standard', 'dramatic'];
      expect(presets).toHaveLength(3);
    });
  });
});
