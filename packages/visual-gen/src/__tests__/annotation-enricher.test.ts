/**
 * Annotation Enricher Tests
 *
 * Validates that enrichScenesWithAnnotations correctly adds hand-drawn annotations:
 * - Circles on stat-callout scenes (dynamic size based on digit count)
 * - Arrows + x-marks on comparison scenes (positioned to match panel layout)
 * - Underlines on text-emphasis scenes (dynamic width based on phrase length)
 * - Underlines on full-screen-text scenes
 * - Arrows on list-reveal scenes
 * - narration-default only annotated with foreground screenshots
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
    expect(circle.delayFrames).toBe(8);
    if (circle.type === 'circle') {
      // Centered at 960, number baseline around 480
      expect(circle.cx).toBe(960);
      expect(circle.cy).toBe(480);
      // rx is dynamic: max(140, 1 * 60 + 40) = 140
      expect(circle.rx).toBe(140);
      expect(circle.ry).toBe(90);
    }
  });

  it('widens circle for longer numbers', () => {
    const scenes = [
      makeScene({
        type: 'stat-callout',
        content: 'Processing 500000 requests.',
        visualData: { number: '500000', label: 'requests', suffix: '' },
      }),
    ];

    enrichScenesWithAnnotations(scenes);
    const circle = scenes[0].annotations![0];
    if (circle.type === 'circle') {
      // rx = max(140, 6 * 60 + 40) = 400
      expect(circle.rx).toBe(400);
    }
  });

  it('shifts circle right for comparison mode', () => {
    const scenes = [
      makeScene({
        type: 'stat-callout',
        content: 'From 10 to 100.',
        visualData: { number: '100', label: 'new', comparison: { number: '10', label: 'old' } },
      }),
    ];

    enrichScenesWithAnnotations(scenes);
    const circle = scenes[0].annotations![0];
    if (circle.type === 'circle') {
      expect(circle.cx).toBe(1200); // right stat position
    }
  });
});

// ---------------------------------------------------------------------------
// comparison → arrow + x-mark
// ---------------------------------------------------------------------------

describe('enrichScenesWithAnnotations — comparison', () => {
  it('adds an arrow annotation between panel centers', () => {
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
    if (arrow!.type === 'arrow') {
      // Arrow from left panel center to right panel center
      expect(arrow!.fromX).toBe(480);
      expect(arrow!.toX).toBe(1440);
    }
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
    if (xMark!.type === 'x-mark') {
      // X-mark over left panel title
      expect(xMark!.cx).toBe(480);
      expect(xMark!.cy).toBe(160);
    }
  });
});

// ---------------------------------------------------------------------------
// text-emphasis → underline
// ---------------------------------------------------------------------------

describe('enrichScenesWithAnnotations — text-emphasis', () => {
  it('adds an underline annotation with dynamic width', () => {
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
    expect(underline.delayFrames).toBe(6);
    if (underline.type === 'underline') {
      // phrase 24 chars, fontSize 128, charWidth 64, width = 24*64 = 1536 → clamped to 1344
      expect(underline.width).toBeLessThanOrEqual(1344);
      expect(underline.width).toBeGreaterThan(0);
      // y = 540 + 128 * 0.35 = 584.8
      expect(underline.y).toBeCloseTo(540 + 128 * 0.35, 0);
    }
  });

  it('uses smaller font size for long phrases', () => {
    const longPhrase = 'A'.repeat(70); // > 60 chars → fontSize 96
    const scenes = [
      makeScene({
        type: 'text-emphasis',
        content: longPhrase,
        visualData: { phrase: longPhrase, style: 'fade' },
      }),
    ];

    enrichScenesWithAnnotations(scenes);

    const underline = scenes[0].annotations![0];
    if (underline.type === 'underline') {
      // fontSize 96, y = 540 + 96*0.35 = 573.6
      expect(underline.y).toBeCloseTo(540 + 96 * 0.35, 0);
    }
  });
});

// ---------------------------------------------------------------------------
// full-screen-text → underline
// ---------------------------------------------------------------------------

describe('enrichScenesWithAnnotations — full-screen-text', () => {
  it('adds an underline annotation', () => {
    const scenes = [
      makeScene({
        type: 'full-screen-text',
        content: 'The future is now.',
        visualData: { text: 'The future is now.' },
      }),
    ];

    enrichScenesWithAnnotations(scenes);

    expect(scenes[0].annotations).toBeDefined();
    const underline = scenes[0].annotations![0];
    expect(underline.type).toBe('underline');
    if (underline.type === 'underline') {
      // text 18 chars, fontSize 84, charWidth 42, width = 756
      expect(underline.width).toBe(756);
      expect(underline.y).toBeCloseTo(540 + 84 * 0.35, 0);
    }
  });
});

// ---------------------------------------------------------------------------
// list-reveal → arrow
// ---------------------------------------------------------------------------

describe('enrichScenesWithAnnotations — list-reveal', () => {
  it('adds an arrow pointing into content area', () => {
    const scenes = [
      makeScene({
        type: 'list-reveal',
        content: 'Key points',
        visualData: { title: 'Key Points', items: ['First', 'Second'], style: 'bullet' },
      }),
    ];

    enrichScenesWithAnnotations(scenes);

    expect(scenes[0].annotations).toBeDefined();
    const arrow = scenes[0].annotations![0];
    expect(arrow.type).toBe('arrow');
    if (arrow.type === 'arrow') {
      expect(arrow.fromX).toBe(280);
      expect(arrow.toX).toBe(384); // paddingLeft 20% of 1920
    }
  });
});

// ---------------------------------------------------------------------------
// narration-default → conditional underline
// ---------------------------------------------------------------------------

describe('enrichScenesWithAnnotations — narration-default', () => {
  it('does NOT annotate narration-default without foreground screenshot', () => {
    const scenes = [
      makeScene({
        type: 'narration-default',
        content: 'Revenue is at a critical 500 million.',
        visualData: {},
      }),
    ];

    enrichScenesWithAnnotations(scenes);
    expect(scenes[0].annotations).toBeUndefined();
  });

  it('annotates narration-default with foreground screenshot and emphasis words', () => {
    const scenes = [
      makeScene({
        type: 'narration-default',
        content: 'This is a critical development worth 500 million.',
        visualData: {},
        screenshotDisplayMode: 'foreground',
      } as any),
    ];

    enrichScenesWithAnnotations(scenes);
    expect(scenes[0].annotations).toBeDefined();
    expect(scenes[0].annotations![0].type).toBe('underline');
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
