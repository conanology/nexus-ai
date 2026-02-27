import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

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
  interpolate: (value: number, inputRange: number[], outputRange: number[], _opts?: any) => {
    const [inMin, inMax] = inputRange;
    const [outMin, outMax] = outputRange;
    const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)));
    return outMin + t * (outMax - outMin);
  },
  AbsoluteFill: ({ children, style }: any) => <div style={style}>{children}</div>,
  Sequence: ({ children }: any) => <div>{children}</div>,
  Audio: () => null,
  staticFile: (p: string) => `/static/${p}`,
}));

// Mock shared components
vi.mock('../../../utils/colors.js', () => ({
  COLORS: {
    bgDeepDark: '#0a0a0a',
    bgBase: '#111111',
    bgElevated: '#1a1a1a',
    accentPrimary: '#aaff00',
    accentGlow: 'rgba(170, 255, 0, 0.3)',
    accentBright: '#88cc00',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
  },
  withOpacity: (color: string, opacity: number) => `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
  GRADIENTS: { background: 'linear-gradient(135deg, #0a0a0a, #111111)' },
}));

vi.mock('../../../theme.js', () => ({
  THEME: {
    fonts: {
      heading: 'Inter, sans-serif',
      body: 'Inter, sans-serif',
      mono: '"JetBrains Mono", monospace',
    },
  },
}));

vi.mock('../../shared/BackgroundGradient.js', () => ({
  BackgroundGradient: ({ children }: any) => <div data-testid="bg-gradient">{children}</div>,
}));

vi.mock('../../shared/ForegroundScreenshot.js', () => ({
  ForegroundScreenshot: ({ src }: any) => <img data-testid="fg-screenshot" src={src} />,
}));

import { DynamicChart } from '../DynamicChart';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const renderComponent = (props: any = {}) => {
  try {
    return DynamicChart(props);
  } catch {
    return null;
  }
};

function extractText(element: any): string {
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  if (!element || typeof element !== 'object') return '';
  if (Array.isArray(element)) return element.map(extractText).join('');
  if (element.props?.children) return extractText(element.props.children);
  return '';
}

function collectStyledElements(element: any): Array<{ style: any; props: any; type: any }> {
  const results: Array<{ style: any; props: any; type: any }> = [];
  if (!element || typeof element !== 'object') return results;
  if (element.props?.style) {
    results.push({ style: element.props.style, props: element.props, type: element.type });
  }
  const children = element.props?.children;
  if (children) {
    if (Array.isArray(children)) {
      for (const child of children) results.push(...collectStyledElements(child));
    } else {
      results.push(...collectStyledElements(children));
    }
  }
  if (Array.isArray(element)) {
    for (const child of element) results.push(...collectStyledElements(child));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const BAR_CHART_DATA = {
  chartType: 'bar' as const,
  title: 'Framework Benchmarks',
  data: [
    { label: 'React', value: 120 },
    { label: 'Vue', value: 85 },
    { label: 'Svelte', value: 45 },
  ],
  unit: 'ms',
  animationStyle: 'sequential' as const,
};

const LINE_CHART_DATA = {
  chartType: 'line' as const,
  title: 'Latency Over Time',
  data: [
    { label: 'Jan', value: 200 },
    { label: 'Feb', value: 180 },
    { label: 'Mar', value: 150 },
    { label: 'Apr', value: 90 },
  ],
  unit: 'ms',
  animationStyle: 'sequential' as const,
};

describe('DynamicChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrame = 15;
  });

  describe('Basic rendering', () => {
    it('renders without crashing with bar chart props', () => {
      const result = renderComponent({ visualData: BAR_CHART_DATA, content: 'Test' });
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });

    it('renders without crashing with line chart props', () => {
      const result = renderComponent({ visualData: LINE_CHART_DATA, content: 'Test' });
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });

    it('renders without crashing with minimal 2-point data', () => {
      const result = renderComponent({
        visualData: {
          chartType: 'bar',
          title: 'Minimal',
          data: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }],
        },
        content: 'Test',
      });
      expect(result).not.toBeNull();
    });
  });

  describe('Title rendering', () => {
    it('displays the chart title', () => {
      const result = renderComponent({ visualData: BAR_CHART_DATA, content: 'Test' });
      const text = extractText(result);
      expect(text).toContain('Framework Benchmarks');
    });

    it('displays the unit in parentheses when provided', () => {
      const result = renderComponent({ visualData: BAR_CHART_DATA, content: 'Test' });
      const text = extractText(result);
      expect(text).toContain('(ms)');
    });

    it('does not display unit when not provided', () => {
      const noUnitData = { ...BAR_CHART_DATA, unit: undefined };
      const result = renderComponent({ visualData: noUnitData, content: 'Test' });
      const text = extractText(result);
      expect(text).not.toContain('(');
    });
  });

  describe('Bar chart labels', () => {
    it('renders all data point labels', () => {
      const result = renderComponent({ visualData: BAR_CHART_DATA, content: 'Test' });
      const text = extractText(result);
      expect(text).toContain('React');
      expect(text).toContain('Vue');
      expect(text).toContain('Svelte');
    });

    it('renders all data point values', () => {
      const result = renderComponent({ visualData: BAR_CHART_DATA, content: 'Test' });
      const text = extractText(result);
      expect(text).toContain('120');
      expect(text).toContain('85');
      expect(text).toContain('45');
    });

    it('renders values with unit suffix', () => {
      const result = renderComponent({ visualData: BAR_CHART_DATA, content: 'Test' });
      const text = extractText(result);
      expect(text).toContain('120 ms');
      expect(text).toContain('85 ms');
    });
  });

  describe('Line chart labels', () => {
    it('renders all data point labels for line chart', () => {
      const result = renderComponent({ visualData: LINE_CHART_DATA, content: 'Test' });
      const text = extractText(result);
      expect(text).toContain('Jan');
      expect(text).toContain('Feb');
      expect(text).toContain('Mar');
      expect(text).toContain('Apr');
    });

    it('renders all data point values for line chart', () => {
      const result = renderComponent({ visualData: LINE_CHART_DATA, content: 'Test' });
      const text = extractText(result);
      expect(text).toContain('200');
      expect(text).toContain('180');
      expect(text).toContain('150');
      expect(text).toContain('90');
    });
  });

  describe('SVG chart elements', () => {
    it('contains an SVG element for the chart', () => {
      const result = renderComponent({ visualData: BAR_CHART_DATA, content: 'Test' });
      const json = JSON.stringify(result);
      expect(json).toContain('"svg"');
    });

    it('contains rect elements for bar chart', () => {
      const result = renderComponent({ visualData: BAR_CHART_DATA, content: 'Test' });
      const json = JSON.stringify(result);
      expect(json).toContain('"rect"');
    });

    it('contains path element for line chart', () => {
      const result = renderComponent({ visualData: LINE_CHART_DATA, content: 'Test' });
      const json = JSON.stringify(result);
      expect(json).toContain('"path"');
    });

    it('contains circle elements for line chart data points', () => {
      const result = renderComponent({ visualData: LINE_CHART_DATA, content: 'Test' });
      const json = JSON.stringify(result);
      expect(json).toContain('"circle"');
    });
  });

  describe('Neon hacker styling', () => {
    it('uses neon green accent color (#aaff00) for bar fill', () => {
      const result = renderComponent({ visualData: BAR_CHART_DATA, content: 'Test' });
      const json = JSON.stringify(result);
      expect(json).toContain('#aaff00');
    });

    it('uses neon green for value labels', () => {
      const result = renderComponent({ visualData: BAR_CHART_DATA, content: 'Test' });
      const styledEls = collectStyledElements(result);
      const valueLabels = styledEls.filter(
        (el) => el.style?.color === '#aaff00' && el.style?.fontWeight === 900,
      );
      expect(valueLabels.length).toBeGreaterThan(0);
    });

    it('uses mono font for labels', () => {
      const result = renderComponent({ visualData: BAR_CHART_DATA, content: 'Test' });
      const styledEls = collectStyledElements(result);
      const monoLabels = styledEls.filter(
        (el) => el.style?.fontFamily?.includes('JetBrains'),
      );
      expect(monoLabels.length).toBeGreaterThan(0);
    });
  });

  describe('Foreground screenshot', () => {
    it('renders foreground screenshot when displayMode is foreground', () => {
      const shotUrl = 'https://example.com/shot.png';
      const result = renderComponent({
        visualData: BAR_CHART_DATA,
        content: 'Test',
        screenshotImage: shotUrl,
        screenshotDisplayMode: 'foreground',
      });
      const json = JSON.stringify(result);
      // ForegroundScreenshot receives the src prop
      expect(json).toContain(shotUrl);
    });

    it('does not render foreground screenshot src when displayMode is background', () => {
      const shotUrl = 'https://example.com/shot-fg-only.png';
      const result = renderComponent({
        visualData: BAR_CHART_DATA,
        content: 'Test',
        screenshotImage: shotUrl,
        screenshotDisplayMode: 'background',
      });
      const json = JSON.stringify(result);
      // In background mode, the screenshot goes to BackgroundGradient, not ForegroundScreenshot
      // The ForegroundScreenshot should NOT render
      const fgOccurrences = json.split(shotUrl).length - 1;
      // URL should appear at most once (in BackgroundGradient), not twice
      expect(fgOccurrences).toBeLessThanOrEqual(1);
    });
  });
});
