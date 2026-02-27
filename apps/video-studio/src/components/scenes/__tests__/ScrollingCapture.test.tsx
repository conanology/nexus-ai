import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Mutable frame value for tests that need to control frame progression
let mockFrame = 15;

// Mock Remotion hooks and components
vi.mock('remotion', () => ({
  useCurrentFrame: () => mockFrame,
  useVideoConfig: () => ({
    fps: 30,
    durationInFrames: 300,
    width: 1920,
    height: 1080,
  }),
  spring: () => 1,
  interpolate: (value: number, inputRange: number[], outputRange: number[], _opts?: any) => {
    // Simple linear interpolation with clamp
    const [inMin, inMax] = inputRange;
    const [outMin, outMax] = outputRange;
    const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)));
    return outMin + t * (outMax - outMin);
  },
  AbsoluteFill: ({ children, style }: any) => <div style={style}>{children}</div>,
  Img: (props: any) => <img {...props} />,
}));

import { ScrollingCapture } from '../ScrollingCapture';

/**
 * Helper to render component and return the React element tree
 */
const renderComponent = (props: any = {}) => {
  try {
    return ScrollingCapture(props);
  } catch {
    return null;
  }
};

/**
 * Recursively extract all text from a React element tree
 */
function extractText(element: any): string {
  if (typeof element === 'string' || typeof element === 'number') {
    return String(element);
  }
  if (!element || typeof element !== 'object') {
    return '';
  }
  if (Array.isArray(element)) {
    return element.map(extractText).join('');
  }
  if (element.props?.children) {
    return extractText(element.props.children);
  }
  return '';
}

/**
 * Recursively collect all style objects from the React element tree.
 * Also returns the associated props for each styled element.
 */
function collectStyledElements(element: any): Array<{ style: any; props: any }> {
  const results: Array<{ style: any; props: any }> = [];
  if (!element || typeof element !== 'object') return results;

  if (element.props?.style) {
    results.push({ style: element.props.style, props: element.props });
  }

  // Recurse into children
  const children = element.props?.children;
  if (children) {
    if (Array.isArray(children)) {
      for (const child of children) {
        results.push(...collectStyledElements(child));
      }
    } else {
      results.push(...collectStyledElements(children));
    }
  }

  // Handle arrays (JSX conditional rendering produces arrays)
  if (Array.isArray(element)) {
    for (const child of element) {
      results.push(...collectStyledElements(child));
    }
  }

  return results;
}

describe('ScrollingCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrame = 15;
  });

  describe('Basic rendering', () => {
    it('should render without crashing with minimal props', () => {
      const result = renderComponent({
        visualData: { fullPageImageUrl: 'https://example.com/page.png' },
        content: 'Test content',
      });
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });

    it('should render without crashing when fullPageImageUrl is empty', () => {
      const result = renderComponent({
        visualData: { fullPageImageUrl: '' },
        content: 'Some content',
      });
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });

    it('should render without crashing with all optional props', () => {
      const result = renderComponent({
        visualData: {
          fullPageImageUrl: 'https://example.com/page.png',
          scrollSpeedPxPerSec: 300,
          label: 'Custom Label',
        },
        content: 'Full content text',
      });
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  describe('fullPageImageUrl prop', () => {
    it('should include the image URL in the rendered tree when provided', () => {
      const url = 'https://example.com/screenshot.png';
      const result = renderComponent({
        visualData: { fullPageImageUrl: url },
        content: 'Test',
      });

      const json = JSON.stringify(result);
      expect(json).toContain(url);
    });

    it('should not include an image src when fullPageImageUrl is falsy', () => {
      const result = renderComponent({
        visualData: { fullPageImageUrl: '' },
        content: 'Test',
      });

      // The element tree should not contain any "src" attribute for images
      const styledElements = collectStyledElements(result);
      const imgElements = styledElements.filter((el) => el.props?.src);
      expect(imgElements.length).toBe(0);
    });
  });

  describe('scrollSpeedPxPerSec prop', () => {
    it('should use default speed of 500 px/sec when not specified', () => {
      mockFrame = 30; // 1 second at 30fps
      const result = renderComponent({
        visualData: { fullPageImageUrl: 'https://example.com/page.png' },
        content: 'Test',
      });

      // Default: 500px/sec, fps 30 => 500/30 ~= 16.67 px/frame, frame 30 => ~-500px
      // (floating point: 500/30*30 = 500.00000000000006)
      const json = JSON.stringify(result);
      expect(json).toMatch(/translateY\(-500(\.\d+)?px\)/);
    });

    it('should use custom scrollSpeedPxPerSec when provided', () => {
      mockFrame = 30; // 1 second at 30fps
      const result = renderComponent({
        visualData: {
          fullPageImageUrl: 'https://example.com/page.png',
          scrollSpeedPxPerSec: 300,
        },
        content: 'Test',
      });

      // 300/30 * 30 = 300
      const json = JSON.stringify(result);
      expect(json).toContain('translateY(-300px)');
    });

    it('should calculate correct translateY at frame 0', () => {
      mockFrame = 0;
      const result = renderComponent({
        visualData: { fullPageImageUrl: 'https://example.com/page.png' },
        content: 'Test',
      });

      // frame 0 => -0 * pxPerFrame = 0
      const json = JSON.stringify(result);
      expect(json).toContain('translateY(0px)');
    });

    it('should scroll further at higher frame numbers', () => {
      mockFrame = 60; // 2 seconds at 30fps
      const result = renderComponent({
        visualData: {
          fullPageImageUrl: 'https://example.com/page.png',
          scrollSpeedPxPerSec: 600,
        },
        content: 'Test',
      });

      // 600/30 * 60 = 1200
      const json = JSON.stringify(result);
      expect(json).toContain('translateY(-1200px)');
    });
  });

  describe('label prop', () => {
    it('should render the label text when provided in visualData', () => {
      const result = renderComponent({
        visualData: {
          fullPageImageUrl: 'https://example.com/page.png',
          label: 'GitHub Homepage',
        },
        content: 'Some narration content',
      });

      const text = extractText(result);
      expect(text).toContain('GitHub Homepage');
    });

    it('should fall back to content (first 60 chars) when label is not provided', () => {
      const content = 'This is the narration content for the scrolling capture scene';
      const result = renderComponent({
        visualData: { fullPageImageUrl: 'https://example.com/page.png' },
        content,
      });

      const text = extractText(result);
      expect(text).toContain(content.slice(0, 60));
    });

    it('should truncate content fallback to 60 characters', () => {
      const longContent = 'A'.repeat(100);
      const result = renderComponent({
        visualData: { fullPageImageUrl: 'https://example.com/page.png' },
        content: longContent,
      });

      const json = JSON.stringify(result);
      // The label is content.slice(0, 60) = 60 "A" chars
      expect(json).toContain('A'.repeat(60));
    });

    it('should render label badge with correct styling', () => {
      const result = renderComponent({
        visualData: {
          fullPageImageUrl: 'https://example.com/page.png',
          label: 'My Label',
        },
        content: 'Test',
      });

      const styledElements = collectStyledElements(result);
      // Find the label badge style (positioned at bottom: 60)
      const labelEl = styledElements.find((el) => el.style.bottom === 60);
      expect(labelEl).toBeDefined();
      expect(labelEl!.style.position).toBe('absolute');
      expect(labelEl!.style.fontWeight).toBe(600);
      expect(labelEl!.style.fontSize).toBe(24);
    });
  });

  describe('Dark overlay', () => {
    it('should render a dark gradient overlay', () => {
      const result = renderComponent({
        visualData: { fullPageImageUrl: 'https://example.com/page.png' },
        content: 'Test',
      });

      const styledElements = collectStyledElements(result);
      const overlayEl = styledElements.find(
        (el) => typeof el.style.background === 'string' && el.style.background.includes('linear-gradient'),
      );
      expect(overlayEl).toBeDefined();
      expect(overlayEl!.style.background).toContain('rgba(0,0,0,');
    });
  });

  describe('Label fade-in animation', () => {
    it('should have zero opacity at frame 0', () => {
      mockFrame = 0;
      const result = renderComponent({
        visualData: {
          fullPageImageUrl: 'https://example.com/page.png',
          label: 'Fading Label',
        },
        content: 'Test',
      });

      const styledElements = collectStyledElements(result);
      const labelEl = styledElements.find((el) => el.style.bottom === 60);
      expect(labelEl).toBeDefined();
      // At frame 0, interpolate([0, 15], [0, 1]) = 0
      expect(labelEl!.style.opacity).toBe(0);
    });

    it('should have full opacity after frame 15', () => {
      mockFrame = 20;
      const result = renderComponent({
        visualData: {
          fullPageImageUrl: 'https://example.com/page.png',
          label: 'Visible Label',
        },
        content: 'Test',
      });

      const styledElements = collectStyledElements(result);
      const labelEl = styledElements.find((el) => el.style.bottom === 60);
      expect(labelEl).toBeDefined();
      // At frame 20, clamped to 1
      expect(labelEl!.style.opacity).toBe(1);
    });

    it('should have partial opacity at mid-animation', () => {
      mockFrame = 8; // Roughly half of 15-frame fade
      const result = renderComponent({
        visualData: {
          fullPageImageUrl: 'https://example.com/page.png',
          label: 'Partial Label',
        },
        content: 'Test',
      });

      const styledElements = collectStyledElements(result);
      const labelEl = styledElements.find((el) => el.style.bottom === 60);
      expect(labelEl).toBeDefined();
      // At frame 8, interpolate([0, 15], [0, 1]) ~= 0.533
      expect(labelEl!.style.opacity).toBeGreaterThan(0);
      expect(labelEl!.style.opacity).toBeLessThan(1);
    });
  });

  describe('Image styling', () => {
    it('should render image with width 100% and objectFit cover', () => {
      const result = renderComponent({
        visualData: { fullPageImageUrl: 'https://example.com/page.png' },
        content: 'Test',
      });

      const json = JSON.stringify(result);
      // Verify the image styling is present in the rendered tree
      expect(json).toContain('"width":"100%"');
      expect(json).toContain('"objectFit":"cover"');
    });

    it('should be wrapped in an overflow hidden container', () => {
      const result = renderComponent({
        visualData: { fullPageImageUrl: 'https://example.com/page.png' },
        content: 'Test',
      });

      const styledElements = collectStyledElements(result);
      const containerEl = styledElements.find(
        (el) => el.style.overflow === 'hidden' && el.style.position === 'absolute',
      );
      expect(containerEl).toBeDefined();
      expect(containerEl!.style.inset).toBe(0);
    });
  });
});
