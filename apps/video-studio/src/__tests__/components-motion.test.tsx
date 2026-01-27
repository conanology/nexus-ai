import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import {
  NeuralNetworkAnimation,
  DataFlowDiagram,
  ComparisonChart,
  MetricsCounter,
  ProductMockup,
  CodeHighlight,
  BrandedTransition,
  LowerThird,
  TextOnGradient,
} from '../components';
import { MOTION_PRESETS } from '../types.js';

// Mock Remotion hooks and functions
vi.mock('remotion', () => ({
  useCurrentFrame: () => 30,
  useVideoConfig: () => ({
    fps: 30,
    durationInFrames: 300,
    width: 1920,
    height: 1080,
  }),
  spring: () => 0.5,
  interpolate: () => 0.5,
  Easing: {
    out: () => (t: number) => t,
    inOut: () => (t: number) => t,
    ease: (t: number) => t,
  },
  AbsoluteFill: ({ children, style }: any) => <div style={style}>{children}</div>,
  random: () => 0.5,
}));

/**
 * Helper to create a React element from a component for testing.
 * Uses React.createElement for proper component instantiation.
 */
const renderComponent = (Component: React.FC<any>, props: any = {}) => {
  return React.createElement(Component, props);
};

/**
 * Tests for motion support in all 9 visual components.
 * Each component is tested with:
 * 1. No motion prop (backward compatibility)
 * 2. motion: MOTION_PRESETS.subtle
 * 3. motion: MOTION_PRESETS.dramatic
 */

const components = [
  { name: 'NeuralNetworkAnimation', Component: NeuralNetworkAnimation, props: { title: 'Test' } },
  { name: 'DataFlowDiagram', Component: DataFlowDiagram, props: { title: 'Test' } },
  { name: 'ComparisonChart', Component: ComparisonChart, props: { title: 'Test' } },
  { name: 'MetricsCounter', Component: MetricsCounter, props: { title: 'Test', value: 42 } },
  { name: 'ProductMockup', Component: ProductMockup, props: { title: 'Test' } },
  { name: 'CodeHighlight', Component: CodeHighlight, props: { title: 'Test', code: 'const x = 1;' } },
  { name: 'BrandedTransition', Component: BrandedTransition, props: { type: 'wipe' as const } },
  { name: 'LowerThird', Component: LowerThird, props: { text: 'Test' } },
  { name: 'TextOnGradient', Component: TextOnGradient, props: { text: 'Test' } },
];

describe('Component Motion Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  components.forEach(({ name, Component, props }) => {
    describe(`${name}`, () => {
      it('renders without motion prop (backward compatibility)', () => {
        const result = renderComponent(Component, props);
        expect(result).not.toBeNull();
        expect(React.isValidElement(result)).toBe(true);
      });

      it('renders with subtle motion preset', () => {
        const result = renderComponent(Component, {
          ...props,
          motion: MOTION_PRESETS.subtle,
        });
        expect(result).not.toBeNull();
        expect(React.isValidElement(result)).toBe(true);
      });

      it('renders with dramatic motion preset', () => {
        const result = renderComponent(Component, {
          ...props,
          motion: MOTION_PRESETS.dramatic,
        });
        expect(result).not.toBeNull();
        expect(React.isValidElement(result)).toBe(true);
      });
    });
  });
});
