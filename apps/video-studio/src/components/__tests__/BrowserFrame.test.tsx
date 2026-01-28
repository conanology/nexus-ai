import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { BrowserFrame } from '../BrowserFrame';

// Mutable frame value for tests that need to control frame progression
let mockFrame = 0;

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
    return outputRange[outputRange.length - 1];
  },
  AbsoluteFill: ({ children, style }: any) => <div style={style}>{children}</div>,
}));

/**
 * Deep-render a React element tree, expanding all function components.
 */
function deepRender(element: any): any {
  if (!element || typeof element !== 'object') return element;
  if (Array.isArray(element)) return element.map(deepRender);

  // If element.type is a function (FC), call it to expand
  if (typeof element.type === 'function') {
    try {
      const rendered = element.type(element.props);
      return deepRender(rendered);
    } catch {
      return element;
    }
  }

  // Recursively deep-render children
  if (element.props?.children) {
    const children = element.props.children;
    const renderedChildren = Array.isArray(children)
      ? children.map(deepRender)
      : deepRender(children);
    return { ...element, props: { ...element.props, children: renderedChildren } };
  }

  return element;
}

/**
 * Helper to render component and return the fully expanded React element tree
 */
const renderComponent = (props: any = {}) => {
  try {
    const raw = BrowserFrame(props);
    return deepRender(raw);
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
    if (Array.isArray(element.props.children)) {
      for (const child of element.props.children) {
        const found = findByTestId(child, testId);
        if (found) return found;
      }
    } else {
      return findByTestId(element.props.children, testId);
    }
  }
  return null;
}

describe('BrowserFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrame = 0;
  });

  describe('Browser chrome rendering (AC2)', () => {
    it('should render the browser window', () => {
      const result = renderComponent({ url: 'https://example.com' });
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);

      const browserWindow = findByTestId(result, 'browser-window');
      expect(browserWindow).not.toBeNull();
    });

    it('should render the address bar with URL', () => {
      const result = renderComponent({ url: 'https://test.dev/page' });
      const addressBar = findByTestId(result, 'address-bar');
      expect(addressBar).not.toBeNull();

      const urlText = findByTestId(result, 'url-text');
      expect(urlText).not.toBeNull();
      const text = extractText(urlText);
      expect(text).toBe('https://test.dev/page');
    });

    it('should render tab bar', () => {
      const result = renderComponent({ url: 'https://example.com/path' });
      const tabBar = findByTestId(result, 'tab-bar');
      expect(tabBar).not.toBeNull();

      const tab = findByTestId(result, 'tab');
      expect(tab).not.toBeNull();
      // Tab should show domain from URL
      const tabText = extractText(tab);
      expect(tabText).toBe('example.com');
    });

    it('should render window control dots (macOS style)', () => {
      const result = renderComponent({ url: 'https://example.com' });
      const dot0 = findByTestId(result, 'window-dot-0');
      const dot1 = findByTestId(result, 'window-dot-1');
      const dot2 = findByTestId(result, 'window-dot-2');

      expect(dot0).not.toBeNull();
      expect(dot1).not.toBeNull();
      expect(dot2).not.toBeNull();

      // Verify colors (red, yellow, green)
      expect(dot0.props.style.backgroundColor).toBe('#FF5F57');
      expect(dot1.props.style.backgroundColor).toBe('#FEBC2E');
      expect(dot2.props.style.backgroundColor).toBe('#28C840');
    });

    it('should render navigation buttons', () => {
      const result = renderComponent({ url: 'https://example.com' });
      const navButtons = findByTestId(result, 'nav-buttons');
      expect(navButtons).not.toBeNull();
    });
  });

  describe('Content area (AC2, AC3)', () => {
    it('should render ReactNode content when provided', () => {
      const result = renderComponent({
        url: 'https://example.com',
        content: React.createElement('div', { 'data-testid': 'custom-content' }, 'Hello World'),
      });

      const contentArea = findByTestId(result, 'content-area');
      expect(contentArea).not.toBeNull();

      const customContent = findByTestId(result, 'custom-content');
      expect(customContent).not.toBeNull();
      expect(extractText(customContent)).toBe('Hello World');
    });

    it('should render data-driven demo elements', () => {
      const result = renderComponent({
        data: {
          url: 'https://demo.com',
          content: {
            elements: [
              { id: 'btn-1', type: 'button', content: 'Click Me', position: { x: 10, y: 20 } },
              { id: 'txt-1', type: 'text', content: 'Some text', position: { x: 10, y: 60 } },
            ],
            scrollY: 0,
          },
        },
      });

      const btn = findByTestId(result, 'element-btn-1');
      expect(btn).not.toBeNull();
      expect(extractText(btn)).toBe('Click Me');

      const txt = findByTestId(result, 'element-txt-1');
      expect(txt).not.toBeNull();
      expect(extractText(txt)).toBe('Some text');
    });
  });

  describe('Action-driven cursor (AC3)', () => {
    it('should render cursor when data.content has cursor', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [],
            cursor: { x: 100, y: 200, visible: true, clicking: false },
            scrollY: 0,
          },
        },
      });

      const cursor = findByTestId(result, 'browser-cursor');
      expect(cursor).not.toBeNull();
      expect(cursor.props.style.left).toBe(100);
      expect(cursor.props.style.top).toBe(200);
    });

    it('should not render cursor when not visible', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [],
            cursor: { x: 100, y: 200, visible: false, clicking: false },
            scrollY: 0,
          },
        },
      });

      const cursor = findByTestId(result, 'browser-cursor');
      expect(cursor).toBeNull();
    });
  });

  describe('Click ripple (AC3)', () => {
    it('should show click ripple when cursor is clicking', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [],
            cursor: { x: 50, y: 75, visible: true, clicking: true },
            scrollY: 0,
          },
        },
      });

      const ripple = findByTestId(result, 'click-ripple');
      expect(ripple).not.toBeNull();
    });

    it('should not show click ripple when cursor is not clicking', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [],
            cursor: { x: 50, y: 75, visible: true, clicking: false },
            scrollY: 0,
          },
        },
      });

      const ripple = findByTestId(result, 'click-ripple');
      expect(ripple).toBeNull();
    });
  });

  describe('Scroll action (AC3)', () => {
    it('should apply scroll offset via translateY', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [
              { id: 'text-1', type: 'text', content: 'Scrollable', position: { x: 0, y: 0 } },
            ],
            scrollY: 150,
          },
        },
      });

      const scrollContainer = findByTestId(result, 'content-scroll');
      expect(scrollContainer).not.toBeNull();
      expect(scrollContainer.props.style.transform).toBe('translateY(-150px)');
    });

    it('should have zero scroll offset when scrollY is 0', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [],
            scrollY: 0,
          },
        },
      });

      const scrollContainer = findByTestId(result, 'content-scroll');
      expect(scrollContainer.props.style.transform).toBe('translateY(-0px)');
    });
  });

  describe('Highlight action (AC3)', () => {
    it('should render highlight box when activeHighlight is set', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [
              { id: 'target', type: 'button', content: 'Target', position: { x: 20, y: 40 } },
            ],
            scrollY: 0,
            activeHighlight: { target: '#target', opacity: 0.8 },
          },
        },
      });

      const highlight = findByTestId(result, 'highlight-box');
      expect(highlight).not.toBeNull();
      expect(highlight.props.style.opacity).toBe(0.8);
    });

    it('should not render highlight box when opacity is 0', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [
              { id: 'target', type: 'button', content: 'Target', position: { x: 20, y: 40 } },
            ],
            scrollY: 0,
            activeHighlight: { target: '#target', opacity: 0 },
          },
        },
      });

      const highlight = findByTestId(result, 'highlight-box');
      expect(highlight).toBeNull();
    });
  });

  describe('Light and dark theme (AC5)', () => {
    it('should render light theme by default', () => {
      const result = renderComponent({ url: 'https://example.com' });
      const contentArea = findByTestId(result, 'content-area');
      expect(contentArea).not.toBeNull();
      // Light theme content area should be white
      expect(contentArea.props.style.backgroundColor).toBe('#ffffff');
    });

    it('should render dark theme when style.theme is dark', () => {
      const result = renderComponent({
        url: 'https://example.com',
        style: { theme: 'dark' },
      });
      const contentArea = findByTestId(result, 'content-area');
      expect(contentArea).not.toBeNull();
      // Dark theme uses THEME.colors.backgroundDark
      expect(contentArea.props.style.backgroundColor).toBe('#020617');
    });

    it('should use data.style.theme over top-level style', () => {
      const result = renderComponent({
        url: 'https://example.com',
        style: { theme: 'light' },
        data: {
          style: { theme: 'dark' },
        },
      });
      const contentArea = findByTestId(result, 'content-area');
      expect(contentArea.props.style.backgroundColor).toBe('#020617');
    });
  });

  describe('Motion hook integration (AC5)', () => {
    it('should render with motion config without errors', () => {
      const result = renderComponent({
        url: 'https://example.com',
        motion: {
          entrance: { type: 'fade', delay: 0, duration: 15, easing: 'spring' },
          emphasis: { type: 'none', intensity: 0, duration: 0 },
          exit: { type: 'fade', duration: 10, startBeforeEnd: 10, easing: 'easeOut' },
        },
      });
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });

    it('should render without motion config (no animations)', () => {
      const result = renderComponent({ url: 'https://example.com' });
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });
  });

  describe('Backward compatibility (AC5)', () => {
    it('should render with no props at all', () => {
      const result = renderComponent({});
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });

    it('should render with only url prop', () => {
      const result = renderComponent({ url: 'https://minimal.test' });
      expect(result).not.toBeNull();

      const urlText = findByTestId(result, 'url-text');
      expect(extractText(urlText)).toBe('https://minimal.test');
    });

    it('should render without actions (static mode)', () => {
      const result = renderComponent({
        url: 'https://static.test',
        content: React.createElement('p', null, 'Static content'),
      });
      expect(result).not.toBeNull();

      // No cursor should be rendered
      const cursor = findByTestId(result, 'browser-cursor');
      expect(cursor).toBeNull();
    });

    it('should use defaults when no url is provided', () => {
      const result = renderComponent({});
      const urlText = findByTestId(result, 'url-text');
      expect(extractText(urlText)).toBe('https://example.com');
    });

    it('should prefer data.url over top-level url', () => {
      const result = renderComponent({
        url: 'https://toplevel.com',
        data: { url: 'https://data-url.com' },
      });
      const urlText = findByTestId(result, 'url-text');
      expect(extractText(urlText)).toBe('https://data-url.com');
    });
  });

  describe('Element types rendering', () => {
    it('should render input elements with styling', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [
              { id: 'input-1', type: 'input', content: 'typed text', position: { x: 10, y: 20 } },
            ],
            scrollY: 0,
          },
        },
      });

      const input = findByTestId(result, 'element-input-1');
      expect(input).not.toBeNull();
      expect(extractText(input)).toBe('typed text');
    });

    it('should render code-block elements with mono font', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [
              { id: 'code-1', type: 'code-block', content: 'const x = 1;', position: { x: 10, y: 20 } },
            ],
            scrollY: 0,
          },
        },
      });

      const codeBlock = findByTestId(result, 'element-code-1');
      expect(codeBlock).not.toBeNull();
      expect(codeBlock.props.style.fontFamily).toContain('JetBrains Mono');
    });

    it('should handle visibleChars for typing action', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [
              { id: 'input-1', type: 'input', content: 'Hello World', visibleChars: 5, position: { x: 10, y: 20 } },
            ],
            scrollY: 0,
          },
        },
      });

      const input = findByTestId(result, 'element-input-1');
      expect(extractText(input)).toBe('Hello');
    });

    it('should render metric elements with primary color and bold weight', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [
              { id: 'metric-1', type: 'metric', content: '99.9%', position: { x: 10, y: 20 } },
            ],
            scrollY: 0,
          },
        },
      });

      const metric = findByTestId(result, 'element-metric-1');
      expect(metric).not.toBeNull();
      expect(extractText(metric)).toBe('99.9%');
      expect(metric.props.style.fontWeight).toBe(700);
    });

    it('should render chart elements with bordered container', () => {
      const result = renderComponent({
        data: {
          url: 'https://example.com',
          content: {
            elements: [
              { id: 'chart-1', type: 'chart', content: 'Revenue Chart', position: { x: 10, y: 20 } },
            ],
            scrollY: 0,
          },
        },
      });

      const chart = findByTestId(result, 'element-chart-1');
      expect(chart).not.toBeNull();
      expect(extractText(chart)).toBe('Revenue Chart');
      expect(chart.props.style.minWidth).toBe(200);
      expect(chart.props.style.minHeight).toBe(100);
    });
  });
});
