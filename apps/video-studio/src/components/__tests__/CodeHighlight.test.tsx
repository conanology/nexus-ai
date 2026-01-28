import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { CodeHighlight } from '../CodeHighlight';

// Mutable frame value for tests that need to control frame progression
let mockFrame = 15;

vi.mock('remotion', () => ({
  useCurrentFrame: () => mockFrame,
  useVideoConfig: () => ({
    fps: 30,
    durationInFrames: 300,
    width: 1920,
    height: 1080,
  }),
  spring: () => 1,
  interpolate: (_value: number, _inputRange: number[], outputRange: number[]) => {
    // Return last value in output range (fully visible)
    return outputRange[outputRange.length - 1];
  },
  AbsoluteFill: ({ children, style }: any) => <div style={style}>{children}</div>,
}));

/**
 * Helper to render component and extract text content recursively
 */
const renderComponent = (props: any = {}) => {
  try {
    return CodeHighlight(props);
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
 * Find element by data-testid in React element tree
 */
function findByTestId(element: any, testId: string): any {
  if (!element || typeof element !== 'object') return null;
  if (element.props?.['data-testid'] === testId) return element;
  if (Array.isArray(element)) {
    for (const child of element) {
      const found = findByTestId(child, testId);
      if (found) return found;
    }
  }
  if (element.props?.children) {
    return findByTestId(element.props.children, testId);
  }
  return null;
}

describe('CodeHighlight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrame = 15;
  });

  describe('Default mode (no typing)', () => {
    it('should render full code without typing props', () => {
      const code = 'const x = 1;\nconst y = 2;';
      const result = renderComponent({ code });
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);

      const text = extractText(result);
      // All code should be visible
      expect(text).toContain('const x = 1;');
      expect(text).toContain('const y = 2;');
    });

    it('should not show typing cursor when typingEffect is undefined', () => {
      const result = renderComponent({ code: 'hello' });
      const cursor = findByTestId(result, 'typing-cursor');
      expect(cursor).not.toBeNull();
      // Cursor opacity should be 0 when typing is off
      expect(cursor.props.style.opacity).toBe(0);
    });

    it('should not show typing cursor when typingEffect is false', () => {
      const result = renderComponent({ code: 'hello', typingEffect: false });
      const cursor = findByTestId(result, 'typing-cursor');
      expect(cursor).not.toBeNull();
      expect(cursor.props.style.opacity).toBe(0);
    });

    it('should render identically with no typing props (backward compat)', () => {
      const code = 'function test() { return 42; }';
      const withoutTyping = renderComponent({ code });
      const withFalseTyping = renderComponent({ code, typingEffect: false });

      // Both should produce valid elements
      expect(React.isValidElement(withoutTyping)).toBe(true);
      expect(React.isValidElement(withFalseTyping)).toBe(true);

      // Both should show all code
      const textA = extractText(withoutTyping);
      const textB = extractText(withFalseTyping);
      expect(textA).toContain('function test()');
      expect(textB).toContain('function test()');
    });
  });

  describe('Typing mode', () => {
    it('should show partial code based on frame at frame 0', () => {
      mockFrame = 0;
      const code = 'const hello = "world";';
      const result = renderComponent({ code, typingEffect: true });
      expect(result).not.toBeNull();

      const text = extractText(result);
      // At frame 0, visibleChars = floor(0 * (30/30)) = 0
      // No code content should be visible
      expect(text).not.toContain('const');
    });

    it('should progressively reveal characters based on frame', () => {
      // fps=30, typingSpeed=30 (default), so 1 char per frame
      mockFrame = 5;
      const code = 'const hello = "world";';
      const result = renderComponent({ code, typingEffect: true });

      const text = extractText(result);
      // At frame 5: visibleChars = floor(5 * (30/30)) = 5
      // "const" should be visible (first 5 chars)
      expect(text).toContain('const');
      // But the rest shouldn't be fully visible
      expect(text).not.toContain('hello');
    });

    it('should reveal all code when enough frames have passed', () => {
      const code = 'const x = 1;'; // 12 chars
      mockFrame = 15; // floor(15 * 30/30) = 15 > 12
      const result = renderComponent({ code, typingEffect: true });

      const text = extractText(result);
      expect(text).toContain('const x = 1;');
    });

    it('should respect custom typingSpeed', () => {
      // fps=30, typingSpeed=60, so 2 chars per frame
      mockFrame = 5;
      const code = 'const hello = "world";'; // 22 chars
      const result = renderComponent({ code, typingEffect: true, typingSpeed: 60 });

      const text = extractText(result);
      // At frame 5: visibleChars = floor(5 * (60/30)) = 10
      // "const hell" (first 10 chars) should be visible
      expect(text).toContain('const hell');
    });
  });

  describe('visibleChars manual override', () => {
    it('should use visibleChars prop when provided', () => {
      mockFrame = 100; // Would normally show all chars
      const code = 'const hello = "world";';
      const result = renderComponent({
        code,
        typingEffect: true,
        visibleChars: 5,
      });

      const text = extractText(result);
      // visibleChars=5 should override frame-based calculation
      expect(text).toContain('const');
      expect(text).not.toContain('hello');
    });

    it('should show exact number of characters specified', () => {
      const code = 'xyzqwertyu'; // 10 chars
      const result = renderComponent({
        code,
        typingEffect: true,
        visibleChars: 3,
      });

      const text = extractText(result);
      expect(text).toContain('xyz');
      expect(text).not.toContain('q');
    });
  });

  describe('Cursor behavior', () => {
    it('should show cursor when typingEffect is true', () => {
      mockFrame = 5;
      const code = 'const hello = "world";';
      const result = renderComponent({ code, typingEffect: true });
      const cursor = findByTestId(result, 'typing-cursor');
      expect(cursor).not.toBeNull();
      // While typing is still in progress, cursor opacity = 1 (solid)
      expect(cursor.props.style.opacity).toBe(1);
    });

    it('should blink cursor when typing is complete (discrete toggle)', () => {
      const code = 'hi'; // 2 chars
      // Cursor uses Math.floor(frame / 15) % 2 === 0 → on at frame 0-14, off at 15-29, on at 30-44...
      // Frame 10: floor(10/15)=0, 0%2===0 → opacity 1 (on)
      mockFrame = 10;
      const resultOn = renderComponent({ code, typingEffect: true });
      const cursorOn = findByTestId(resultOn, 'typing-cursor');
      expect(cursorOn).not.toBeNull();
      expect(cursorOn.props.style.opacity).toBe(1);

      // Frame 20: floor(20/15)=1, 1%2===0 → false → opacity 0 (off)
      mockFrame = 20;
      const resultOff = renderComponent({ code, typingEffect: true });
      const cursorOff = findByTestId(resultOff, 'typing-cursor');
      expect(cursorOff).not.toBeNull();
      expect(cursorOff.props.style.opacity).toBe(0);
    });

    it('should not show cursor when typingEffect is false', () => {
      const result = renderComponent({ code: 'hello', typingEffect: false });
      const cursor = findByTestId(result, 'typing-cursor');
      expect(cursor.props.style.opacity).toBe(0);
    });
  });

  describe('Syntax highlighting on partial code', () => {
    it('should apply syntax highlighting to visible partial code', () => {
      // When typing, the code is sliced BEFORE highlighting
      mockFrame = 5;
      const code = 'const x = 1;\nreturn x;';
      const result = renderComponent({ code, typingEffect: true });
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);

      // "const" is a keyword and should appear in the visible text
      const text = extractText(result);
      expect(text).toContain('const');
    });

    it('should highlight full code in non-typing mode', () => {
      const code = 'const x = 1;\nreturn x;';
      const result = renderComponent({ code });
      expect(result).not.toBeNull();

      const text = extractText(result);
      expect(text).toContain('const');
      expect(text).toContain('return');
    });
  });

  describe('Backward compatibility', () => {
    it('should render with no props at all', () => {
      const result = renderComponent({});
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });

    it('should render with data prop (existing usage)', () => {
      const result = renderComponent({
        data: {
          code: 'let y = 42;',
          language: 'typescript',
          highlightLines: [0],
        },
      });
      expect(result).not.toBeNull();
      const text = extractText(result);
      expect(text).toContain('let y = 42;');
    });

    it('should display all lines immediately in non-typing mode', () => {
      const code = 'line1\nline2\nline3';
      const result = renderComponent({ code });
      const text = extractText(result);
      expect(text).toContain('line1');
      expect(text).toContain('line2');
      expect(text).toContain('line3');
    });
  });
});
