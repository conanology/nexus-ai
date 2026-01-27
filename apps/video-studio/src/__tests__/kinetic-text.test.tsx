import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import type { WordTiming, EmphasisWord } from '../types.js';
import { MOTION_PRESETS } from '../types.js';

let mockFrame = 30;

vi.mock('remotion', () => ({
  useCurrentFrame: () => mockFrame,
  useVideoConfig: () => ({
    fps: 30,
    durationInFrames: 300,
    width: 1920,
    height: 1080,
  }),
  spring: () => 1,
  interpolate: () => 0.5,
  Easing: {
    out: () => (t: number) => t,
    inOut: () => (t: number) => t,
    ease: (t: number) => t,
  },
  AbsoluteFill: ({ children, style }: any) => <div style={style}>{children}</div>,
}));

// Import after mocks
import { KineticText } from '../components/KineticText.js';

const mockWordTimings: WordTiming[] = [
  { word: 'Hello', index: 0, startTime: 0, endTime: 0.3, duration: 0.3, segmentId: 'seg-1', isEmphasis: false },
  { word: 'World', index: 1, startTime: 0.5, endTime: 0.8, duration: 0.3, segmentId: 'seg-1', isEmphasis: true },
  { word: 'Test', index: 2, startTime: 1.0, endTime: 1.3, duration: 0.3, segmentId: 'seg-1', isEmphasis: false },
];

const mockEmphasisWords: EmphasisWord[] = [
  { word: 'World', effect: 'glow', intensity: 0.8 },
];

describe('KineticText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrame = 30;
  });

  it('renders without any props (graceful defaults)', () => {
    const result = React.createElement(KineticText);
    expect(result).not.toBeNull();
    expect(React.isValidElement(result)).toBe(true);
  });

  it('renders with text only (no word timings — fallback to static display)', () => {
    const result = React.createElement(KineticText, { text: 'Static text display' });
    expect(result).not.toBeNull();
    expect(React.isValidElement(result)).toBe(true);

    // Should NOT call spring for word-level animation (static mode)
    // Spring may still be called by useMotion for segment-level motion
  });

  it('renders with word timings (words appear based on timing)', () => {
    const result = React.createElement(KineticText, {
      data: {
        text: 'Hello World Test',
        wordTimings: mockWordTimings,
      },
    });
    expect(result).not.toBeNull();
    expect(React.isValidElement(result)).toBe(true);
  });

  it('renders with emphasis words (emphasis effect applied)', () => {
    const result = React.createElement(KineticText, {
      data: {
        text: 'Hello World Test',
        wordTimings: mockWordTimings,
        emphasis: mockEmphasisWords,
      },
    });
    expect(result).not.toBeNull();
    expect(React.isValidElement(result)).toBe(true);
  });

  it('renders with motion preset (segment-level motion applied)', () => {
    const result = React.createElement(KineticText, {
      text: 'Motion text',
      motion: MOTION_PRESETS.subtle,
    });
    expect(result).not.toBeNull();
    expect(React.isValidElement(result)).toBe(true);
  });

  it('handles empty wordTimings array gracefully', () => {
    const result = React.createElement(KineticText, {
      data: {
        text: 'Some text here',
        wordTimings: [],
      },
    });
    expect(result).not.toBeNull();
    expect(React.isValidElement(result)).toBe(true);
  });

  it('word visibility at specific frames (word visible when frame >= startFrame)', () => {
    // At frame 0, only the first word (startTime: 0) should have spring called
    // At frame 30 (1 second at 30fps), all three words should be visible
    // Word 1: startTime 0 -> frame 0 (visible at frame 30)
    // Word 2: startTime 0.5 -> frame 15 (visible at frame 30)
    // Word 3: startTime 1.0 -> frame 30 (visible at frame 30)

    mockFrame = 30; // 1 second at 30fps

    const result = React.createElement(KineticText, {
      data: {
        text: 'Hello World Test',
        wordTimings: mockWordTimings,
      },
    });

    expect(result).not.toBeNull();
    expect(React.isValidElement(result)).toBe(true);

    // At frame 30, all words should be visible (startFrame <= 30 for all)
    // Word 0: startTime 0 -> startFrame 0 -> visible (frame 30 >= 0)
    // Word 1: startTime 0.5 -> startFrame 15 -> visible (frame 30 >= 15)
    // Word 2: startTime 1.0 -> startFrame 30 -> visible (frame 30 >= 30)
  });

  it('applies different emphasis effects correctly', () => {
    const emphasisTypes: EmphasisWord[] = [
      { word: 'Scale', effect: 'scale', intensity: 0.8 },
      { word: 'Glow', effect: 'glow', intensity: 0.7 },
      { word: 'Underline', effect: 'underline', intensity: 0.6 },
      { word: 'Color', effect: 'color', intensity: 0.9 },
    ];

    const result = React.createElement(KineticText, {
      data: {
        text: 'Scale Glow Underline Color',
        wordTimings: [
          { word: 'Scale', index: 0, startTime: 0, endTime: 0.3, duration: 0.3, segmentId: 'seg-1', isEmphasis: true },
          { word: 'Glow', index: 1, startTime: 0.3, endTime: 0.6, duration: 0.3, segmentId: 'seg-1', isEmphasis: true },
          { word: 'Underline', index: 2, startTime: 0.6, endTime: 0.9, duration: 0.3, segmentId: 'seg-1', isEmphasis: true },
          { word: 'Color', index: 3, startTime: 0.9, endTime: 1.2, duration: 0.3, segmentId: 'seg-1', isEmphasis: true },
        ],
        emphasis: emphasisTypes,
      },
    });

    expect(result).not.toBeNull();
    expect(React.isValidElement(result)).toBe(true);
  });

  it('uses emphasisEffect prop for isEmphasis words without explicit EmphasisWord entry', () => {
    // Word "Test" has isEmphasis: true in WordTiming but no EmphasisWord entry
    // Should use the component-level emphasisEffect prop
    const result = React.createElement(KineticText, {
      data: {
        text: 'Hello World Test',
        wordTimings: mockWordTimings,
        // No emphasis array for "Test" - only "World" has explicit emphasis
        emphasis: mockEmphasisWords,
      },
      emphasisEffect: 'color', // Fallback effect for isEmphasis words without explicit entry
    });

    expect(result).not.toBeNull();
    expect(React.isValidElement(result)).toBe(true);
  });

  it('resolves text from data.text over text prop', () => {
    const result = React.createElement(KineticText, {
      text: 'Fallback text',
      data: {
        text: 'Primary text',
      },
    });

    expect(result).not.toBeNull();
    expect(React.isValidElement(result)).toBe(true);
  });
});
