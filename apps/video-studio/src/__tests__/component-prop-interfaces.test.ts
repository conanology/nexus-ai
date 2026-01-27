import { describe, it, expect } from 'vitest';
import type {
  NeuralNetworkAnimationProps,
  DataFlowDiagramProps,
  ComparisonChartProps,
  MetricsCounterProps,
  ProductMockupProps,
  CodeHighlightProps,
  BrandedTransitionProps,
  LowerThirdProps,
  TextOnGradientProps,
  MotionConfig,
} from '../types.js';
import { MOTION_PRESETS } from '../types.js';

describe('Component prop interfaces include motion', () => {
  const fullMotionConfig: MotionConfig = {
    preset: 'subtle',
    entrance: { type: 'fade', direction: 'up', delay: 0, duration: 15, easing: 'easeOut', springConfig: { stiffness: 100, damping: 15, mass: 1 } },
    emphasis: { type: 'pulse', trigger: 'onWord', intensity: 0.5, duration: 10 },
    exit: { type: 'fade', direction: 'down', duration: 15, startBeforeEnd: 15 },
  };

  describe('NeuralNetworkAnimationProps', () => {
    it('accepts motion config', () => {
      const props: NeuralNetworkAnimationProps = {
        title: 'Test',
        motion: MOTION_PRESETS.subtle,
      };
      expect(props.motion).toBeDefined();
    });

    it('works without motion (backward compat)', () => {
      const props: NeuralNetworkAnimationProps = { title: 'Test' };
      expect(props.motion).toBeUndefined();
    });
  });

  describe('DataFlowDiagramProps', () => {
    it('accepts motion config', () => {
      const props: DataFlowDiagramProps = {
        title: 'Test',
        motion: MOTION_PRESETS.subtle,
      };
      expect(props.motion).toBeDefined();
    });

    it('works without motion (backward compat)', () => {
      const props: DataFlowDiagramProps = { title: 'Test' };
      expect(props.motion).toBeUndefined();
    });
  });

  describe('ComparisonChartProps', () => {
    it('accepts motion config', () => {
      const props: ComparisonChartProps = {
        title: 'Test',
        motion: MOTION_PRESETS.subtle,
      };
      expect(props.motion).toBeDefined();
    });

    it('works without motion (backward compat)', () => {
      const props: ComparisonChartProps = { title: 'Test' };
      expect(props.motion).toBeUndefined();
    });
  });

  describe('MetricsCounterProps', () => {
    it('accepts motion config', () => {
      const props: MetricsCounterProps = {
        title: 'Test',
        motion: MOTION_PRESETS.subtle,
      };
      expect(props.motion).toBeDefined();
    });

    it('works without motion (backward compat)', () => {
      const props: MetricsCounterProps = { title: 'Test' };
      expect(props.motion).toBeUndefined();
    });
  });

  describe('ProductMockupProps', () => {
    it('accepts motion config', () => {
      const props: ProductMockupProps = {
        title: 'Test',
        motion: MOTION_PRESETS.subtle,
      };
      expect(props.motion).toBeDefined();
    });

    it('works without motion (backward compat)', () => {
      const props: ProductMockupProps = { title: 'Test' };
      expect(props.motion).toBeUndefined();
    });
  });

  describe('CodeHighlightProps', () => {
    it('accepts motion config', () => {
      const props: CodeHighlightProps = {
        title: 'Test',
        motion: MOTION_PRESETS.subtle,
      };
      expect(props.motion).toBeDefined();
    });

    it('works without motion (backward compat)', () => {
      const props: CodeHighlightProps = { title: 'Test' };
      expect(props.motion).toBeUndefined();
    });
  });

  describe('BrandedTransitionProps', () => {
    it('accepts motion config', () => {
      const props: BrandedTransitionProps = {
        type: 'fade',
        motion: MOTION_PRESETS.subtle,
      };
      expect(props.motion).toBeDefined();
    });

    it('works without motion (backward compat)', () => {
      const props: BrandedTransitionProps = { type: 'fade' };
      expect(props.motion).toBeUndefined();
    });
  });

  describe('LowerThirdProps', () => {
    it('accepts motion config', () => {
      const props: LowerThirdProps = {
        text: 'Test',
        motion: MOTION_PRESETS.subtle,
      };
      expect(props.motion).toBeDefined();
    });

    it('works without motion (backward compat)', () => {
      const props: LowerThirdProps = { text: 'Test' };
      expect(props.motion).toBeUndefined();
    });
  });

  describe('TextOnGradientProps', () => {
    it('accepts motion config', () => {
      const props: TextOnGradientProps = {
        text: 'Test',
        motion: MOTION_PRESETS.subtle,
      };
      expect(props.motion).toBeDefined();
    });

    it('works without motion (backward compat)', () => {
      const props: TextOnGradientProps = { text: 'Test' };
      expect(props.motion).toBeUndefined();
    });
  });

  describe('Full MotionConfig acceptance', () => {
    it('accepts full MotionConfig with all sub-properties', () => {
      const props: NeuralNetworkAnimationProps = {
        title: 'Test',
        motion: fullMotionConfig,
      };
      expect(props.motion).toEqual(fullMotionConfig);
      expect(props.motion?.entrance?.type).toBe('fade');
      expect(props.motion?.emphasis?.type).toBe('pulse');
      expect(props.motion?.exit?.type).toBe('fade');
    });

    it('accepts config with preset field', () => {
      const props: DataFlowDiagramProps = {
        title: 'Test',
        motion: { preset: 'subtle', ...MOTION_PRESETS.subtle },
      };
      expect(props.motion?.preset).toBe('subtle');
    });
  });
});
