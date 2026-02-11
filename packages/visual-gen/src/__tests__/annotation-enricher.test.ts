/**
 * Annotation Enricher Tests
 *
 * Validates that enrichScenesWithAnnotations correctly adds hand-drawn annotations:
 * - Circles on stat-callout scenes
 * - Arrows + x-marks on comparison scenes
 * - Underlines on text-emphasis scenes
 * - Arrows on list-reveal scenes
 * - Respects limits, exclusions, and sentiment-based color selection
 */

import { describe, it, expect } from 'vitest';
import { enrichScenesWithAnnotations, ANNOTATION_COLORS } from '../annotation-enricher.js';
import type { Scene } from '@nexus-ai/director-agent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScene(overrides: Partial<Scene> & { type: Scene['type']; content: string }): Scene {
  return {
    id: `scene-${Math.random().toString(36).slice(2, 8)}`,
    startFrame: 0,
    endFrame: 150,
    visualData: {},
    transition: 'cut',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// stat-callout → circle
// ---------------------------------------------------------------------------

describe('enrichScenesWithAnnotations — stat-callout', () => {
  it('adds a circle annotation to stat-callout scenes', () => {
    const scenes = [
      makeScene({
        type: 'stat-callout',
        content: 'Revenue reached 2 billion dollars.',
        visualData: { number: '2', label: 'billion in revenue', suffix: 'B' },
      }),
    ];

    enrichScenesWithAnnotations(scenes);

    expect(scenes[0].annotations).toBeDefined();
    expect(scenes[0].annotations!.length).toBe(1);

    const circle = scenes[0].annotations![0];
    expect(circle.type).toBe('circle');
    expect(circle.delayFrames).toBe(25);
    if (circle.type === 'circle') {
      expect(circle.cx).toBe(960);
      expect(circle.cy).toBe(420);
      expect(circle.rx).toBe(200);
      expect(circle.ry).toBe(80);
    }
  });
});

// ---------------------------------------------------------------------------
// comparison → arrow + x-mark
// ---------------------------------------------------------------------------

describe('enrichScenesWithAnnotations — comparison', () => {
  it('adds an arrow annotation to comparison scenes', () => {
    const scenes = [
      makeScene({
        type: 'comparison',
        content: 'Old approach vs new approach.',
        visualData: {
          left: { title: 'Legacy', items: ['Slow'] },
          right: { title: 'Modern', items: ['Fast'] },
        },
      }),
    ];

    enrichScenesWithAnnotations(scenes);

    expect(scenes[0].annotations).toBeDefined();
    const arrow = scenes[0].annotations!.find((a) => a.type === 'arrow');
    expect(arrow).toBeDefined();
    expect(arrow!.color).toBe(ANNOTATION_COLORS.brand);
  });

  it('adds arrow + x-mark when "replaced" is in the text', () => {
    const scenes = [
      makeScene({
        type: 'comparison',
        content: 'The old system was replaced by the new one.',
        visualData: {
          left: { title: 'Old System', items: ['Replaced'] },
          right: { title: 'New System', items: ['Current'] },
        },
      }),
    ];

    enrichScenesWithAnnotations(scenes);

    expect(scenes[0].annotations).toBeDefined();
    expect(scenes[0].annotations!.length).toBe(2);

    const arrow = scenes[0].annotations!.find((a) => a.type === 'arrow');
    const xMark = scenes[0].annotations!.find((a) => a.type === 'x-mark');
    expect(arrow).toBeDefined();
    expect(xMark).toBeDefined();
    expect(xMark!.color).toBe(ANNOTATION_COLORS.warning);
  });
});

// ---------------------------------------------------------------------------
// text-emphasis → underline
// ---------------------------------------------------------------------------

describe('enrichScenesWithAnnotations — text-emphasis', () => {
  it('adds an underline annotation to text-emphasis scenes', () => {
    const scenes = [
      makeScene({
        type: 'text-emphasis',
        content: 'This changes everything.',
        visualData: { phrase: 'This changes everything.', style: 'fade' },
      }),
    ];

    enrichScenesWithAnnotations(scenes);

    expect(scenes[0].annotations).toBeDefined();
    const underline = scenes[0].annotations![0];
    expect(underline.type).toBe('underline');
    expect(underline.delayFrames).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Excluded types
// ---------------------------------------------------------------------------

describe('enrichScenesWithAnnotations — exclusions', () => {
  it('does NOT annotate intro scenes', () => {
    const scenes = [
      makeScene({
        type: 'intro',
        content: 'Welcome to the show.',
        visualData: {},
      }),
    ];

    enrichScenesWithAnnotations(scenes);
    expect(scenes[0].annotations).toBeUndefined();
  });

  it('does NOT annotate scenes with 3+ overlays (too busy)', () => {
    const scenes = [
      makeScene({
        type: 'stat-callout',
        content: 'Revenue grew 500%.',
        visualData: { number: '500', label: 'growth', suffix: '%' },
        overlays: [
          { type: 'corner-logo', position: 'top-right', companyName: 'X', brandColor: '#fff' },
          { type: 'source-citation', position: 'bottom-left', source: 'Industry data' },
          { type: 'info-badge', position: 'top-left', label: 'Hot' },
        ],
      }),
    ];

    enrichScenesWithAnnotations(scenes);
    expect(scenes[0].annotations).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

describe('enrichScenesWithAnnotations — limits', () => {
  it('enforces max 2 annotations per scene', () => {
    const scenes = [
      makeScene({
        type: 'comparison',
        content: 'The obsolete system was replaced by something new and eliminated problems.',
        visualData: {
          left: { title: 'Old', items: [] },
          right: { title: 'New', items: [] },
        },
      }),
    ];

    enrichScenesWithAnnotations(scenes);
    expect(scenes[0].annotations!.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Sentiment-based colors
// ---------------------------------------------------------------------------

describe('enrichScenesWithAnnotations — color sentiment', () => {
  it('uses green for positive stat content', () => {
    const scenes = [
      makeScene({
        type: 'stat-callout',
        content: 'Revenue growth surged by 200%.',
        visualData: { number: '200', label: 'revenue growth', suffix: '%' },
      }),
    ];

    enrichScenesWithAnnotations(scenes);

    const circle = scenes[0].annotations![0];
    expect(circle.color).toBe(ANNOTATION_COLORS.success);
  });

  it('uses amber for negative content', () => {
    const scenes = [
      makeScene({
        type: 'stat-callout',
        content: 'The stock dropped by 40% after the loss.',
        visualData: { number: '40', label: 'stock decline', suffix: '%' },
      }),
    ];

    enrichScenesWithAnnotations(scenes);

    const circle = scenes[0].annotations![0];
    expect(circle.color).toBe(ANNOTATION_COLORS.warning);
  });

  it('uses red for dramatic text-emphasis', () => {
    const scenes = [
      makeScene({
        type: 'text-emphasis',
        content: 'This is the biggest revolution in computing history.',
        visualData: { phrase: 'The biggest revolution in computing history', style: 'slam' },
      }),
    ];

    enrichScenesWithAnnotations(scenes);

    const underline = scenes[0].annotations![0];
    expect(underline.color).toBe(ANNOTATION_COLORS.emphasis);
    if (underline.type === 'underline') {
      expect(underline.style).toBe('squiggly');
    }
  });
});
