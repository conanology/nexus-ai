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

// Mock Remotion hooks and functions
vi.mock('remotion', () => ({
  useCurrentFrame: () => 15, // Simulate frame 15
  useVideoConfig: () => ({
    fps: 30,
    durationInFrames: 300,
    width: 1920,
    height: 1080,
  }),
  spring: () => 0.5, // Simulate mid-animation
  interpolate: () => 0.5,
  AbsoluteFill: ({ children, style }: any) => <div style={style}>{children}</div>,
  random: () => 0.5, // Deterministic random for tests
}));

/**
 * Helper to "render" a functional component for testing
 * strictly checks that it returns a React Element (JSX) and doesn't crash
 */
const renderComponent = (Component: React.FC<any>, props: any = {}) => {
  try {
    return Component(props);
  } catch (e) {
    return null;
  }
};

describe('Visual Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('NeuralNetworkAnimation', () => {
    it('should render without crashing', () => {
      const result = renderComponent(NeuralNetworkAnimation, {
        title: 'Test Network',
        nodeCount: 5
      });
      expect(result).not.toBeNull();
      // Verify basic structure (it returns a React element)
      expect(React.isValidElement(result)).toBe(true);
    });

    it('should handle missing data props gracefully', () => {
      const result = renderComponent(NeuralNetworkAnimation, {});
      expect(result).not.toBeNull();
    });
  });

  describe('DataFlowDiagram', () => {
    it('should render with steps', () => {
      const result = renderComponent(DataFlowDiagram, {
        steps: ['A', 'B', 'C']
      });
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  describe('ComparisonChart', () => {
    it('should render with comparison data', () => {
      const result = renderComponent(ComparisonChart, {
        data: {
          comparison: [
            { label: 'A', value: 10 },
            { label: 'B', value: 20 }
          ]
        }
      });
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  describe('MetricsCounter', () => {
    it('should render with value', () => {
      const result = renderComponent(MetricsCounter, {
        value: 100,
        unit: '%'
      });
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  describe('ProductMockup', () => {
    it('should render with content', () => {
      const result = renderComponent(ProductMockup, {
        content: 'Test Content'
      });
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  describe('CodeHighlight', () => {
    it('should render code block', () => {
      const result = renderComponent(CodeHighlight, {
        code: 'const a = 1;',
        language: 'javascript'
      });
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  describe('BrandedTransition', () => {
    it('should render wipe transition', () => {
      const result = renderComponent(BrandedTransition, {
        type: 'wipe',
        direction: 'left'
      });
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  describe('LowerThird', () => {
    it('should render text', () => {
      const result = renderComponent(LowerThird, {
        text: 'Test Name',
        subtitle: 'Test Title'
      });
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  describe('TextOnGradient', () => {
    it('should render without crashing', () => {
      const result = renderComponent(TextOnGradient, {
        text: 'Test Visual Cue'
      });
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
      
      // Basic content verification via JSON serialization
      // This ensures the text prop is actually being passed down into the React tree
      const json = JSON.stringify(result);
      expect(json).toContain('Test Visual Cue');
    });

    it('should use default text when prop is missing', () => {
      const result = renderComponent(TextOnGradient, {});
      expect(result).not.toBeNull();
      
      const json = JSON.stringify(result);
      expect(json).toContain('Visual Scene'); // Default text from component
    });
  });
});
