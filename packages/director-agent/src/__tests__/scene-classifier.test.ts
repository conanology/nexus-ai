import { describe, it, expect } from 'vitest';
import { assignVisualLayers } from '../scene-classifier.js';
import type { ClassifiedSegment, SceneType, ScenePacing, VisualLayer } from '../types.js';

// =============================================================================
// Helpers
// =============================================================================

function makeSegment(overrides: Partial<ClassifiedSegment> = {}): ClassifiedSegment {
  return {
    index: 0,
    text: 'Test segment text',
    startFrame: 0,
    endFrame: 90,
    sentenceCount: 1,
    sceneType: 'narration-default',
    visualData: { backgroundVariant: 'gradient' },
    pacing: 'normal',
    ...overrides,
  };
}

/**
 * Creates N segments with the given scene types.
 * Uses generic text that does NOT contain company names or URLs
 * to avoid triggering content-aware overrides.
 */
function makeGenericSegments(
  count: number,
  sceneType: SceneType = 'narration-default',
  pacing: ScenePacing = 'normal',
): ClassifiedSegment[] {
  return Array.from({ length: count }, (_, i) =>
    makeSegment({
      index: i,
      text: `This is a generic segment about some topic number ${i}`,
      startFrame: i * 90,
      endFrame: (i + 1) * 90,
      sceneType,
      pacing,
    }),
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('assignVisualLayers', () => {
  // ---------------------------------------------------------------------------
  // Edge case: empty input
  // ---------------------------------------------------------------------------
  it('returns empty array for empty input', () => {
    const result = assignVisualLayers([]);
    expect(result).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Round-robin distribution
  // ---------------------------------------------------------------------------
  describe('round-robin distribution', () => {
    it('cycles through abstract-concept, evidence-screenshot, showcase-scroll for generic segments', () => {
      const segments = makeGenericSegments(6);
      const result = assignVisualLayers(segments);

      // narration-default has no LAYER_HINTS entry, and the generic text has
      // no company names or URLs, so it should use round-robin
      expect(result[0].visualLayer).toBe('abstract-concept');
      expect(result[1].visualLayer).toBe('evidence-screenshot');
      expect(result[2].visualLayer).toBe('showcase-scroll');
      // Second cycle
      expect(result[3].visualLayer).toBe('abstract-concept');
      expect(result[4].visualLayer).toBe('evidence-screenshot');
      expect(result[5].visualLayer).toBe('showcase-scroll');
    });

    it('assigns a visualLayer to every segment (for non-intro/outro types)', () => {
      const segments = makeGenericSegments(9);
      const result = assignVisualLayers(segments);

      for (const seg of result) {
        expect(seg.visualLayer).toBeDefined();
        expect(['abstract-concept', 'evidence-screenshot', 'showcase-scroll']).toContain(
          seg.visualLayer,
        );
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Max consecutive constraint (forced rotation when consecutiveCount >= 3)
  // ---------------------------------------------------------------------------
  describe('max consecutive constraint', () => {
    it('forces rotation when consecutiveCount reaches 3 (on the 3rd same-layer segment)', () => {
      // All stat-callout → LAYER_HINTS maps to 'abstract-concept'
      // consecutiveCount flow: seg0=1, seg1=2, seg2=3 → forced rotation
      const segments = Array.from({ length: 5 }, (_, i) =>
        makeSegment({
          index: i,
          text: `Some abstract concept about technology number ${i}`,
          startFrame: i * 90,
          endFrame: (i + 1) * 90,
          sceneType: 'stat-callout',
          visualData: { number: '42', label: 'test', countUp: true },
          pacing: 'punch',
        }),
      );

      const result = assignVisualLayers(segments);

      // First 2 should be abstract-concept (from LAYER_HINTS for stat-callout)
      expect(result[0].visualLayer).toBe('abstract-concept');
      expect(result[1].visualLayer).toBe('abstract-concept');

      // 3rd triggers rotation (consecutiveCount hits 3) — forced to evidence-screenshot
      expect(result[2].visualLayer).not.toBe('abstract-concept');
      expect(result[2].visualLayer).toBe('evidence-screenshot');

      // 4th: stat-callout hint says abstract-concept, which differs from evidence-screenshot → allowed
      expect(result[3].visualLayer).toBe('abstract-concept');

      // 5th: same as lastLayer (abstract-concept), consecutiveCount=2, still allowed
      expect(result[4].visualLayer).toBe('abstract-concept');
    });

    it('enforces the constraint for showcase-scroll (code-block scenes)', () => {
      // code-block → LAYER_HINTS → 'showcase-scroll'
      // consecutiveCount flow: seg0=1, seg1=2, seg2=3 → forced rotation
      const segments = Array.from({ length: 4 }, (_, i) =>
        makeSegment({
          index: i,
          text: `Code example for feature ${i}`,
          startFrame: i * 90,
          endFrame: (i + 1) * 90,
          sceneType: 'code-block',
          visualData: { code: 'const x = 1;', language: 'javascript' },
          pacing: 'normal',
        }),
      );

      const result = assignVisualLayers(segments);

      // First 2 should be showcase-scroll
      expect(result[0].visualLayer).toBe('showcase-scroll');
      expect(result[1].visualLayer).toBe('showcase-scroll');

      // 3rd triggers rotation (consecutiveCount hits 3)
      // showcase-scroll is index 2 in VISUAL_LAYERS, so (2+1)%3 = 0 = abstract-concept
      expect(result[2].visualLayer).not.toBe('showcase-scroll');
      expect(result[2].visualLayer).toBe('abstract-concept');

      // 4th: code-block hint says showcase-scroll, differs from abstract-concept → allowed
      expect(result[3].visualLayer).toBe('showcase-scroll');
    });
  });

  // ---------------------------------------------------------------------------
  // Content-aware overrides
  // ---------------------------------------------------------------------------
  describe('content-aware overrides', () => {
    it('assigns showcase-scroll for code-block scenes', () => {
      const segment = makeSegment({
        sceneType: 'code-block',
        text: 'Here is some code logic for the feature',
        visualData: { code: 'console.log("hi")', language: 'javascript' },
      });

      const result = assignVisualLayers([segment]);
      expect(result[0].visualLayer).toBe('showcase-scroll');
    });

    it('assigns abstract-concept for stat-callout scenes', () => {
      const segment = makeSegment({
        sceneType: 'stat-callout',
        text: 'Some interesting statistic about growth',
        visualData: { number: '100', label: 'users', countUp: true },
        pacing: 'punch',
      });

      const result = assignVisualLayers([segment]);
      expect(result[0].visualLayer).toBe('abstract-concept');
    });

    it('assigns evidence-screenshot for logo-showcase scenes', () => {
      const segment = makeSegment({
        sceneType: 'logo-showcase',
        text: 'Several companies are involved',
        visualData: { logos: [{ name: 'Brand' }], layout: 'sequential' },
        pacing: 'punch',
      });

      const result = assignVisualLayers([segment]);
      expect(result[0].visualLayer).toBe('evidence-screenshot');
    });

    it('assigns evidence-screenshot for text containing a company URL', () => {
      const segment = makeSegment({
        sceneType: 'narration-default',
        text: 'Check out the docs at https://openai.com/blog for more details',
      });

      const result = assignVisualLayers([segment]);
      expect(result[0].visualLayer).toBe('evidence-screenshot');
    });

    it('assigns evidence-screenshot for text mentioning a known company name', () => {
      const segment = makeSegment({
        sceneType: 'narration-default',
        text: 'Microsoft recently announced a new partnership with Anthropic',
      });

      const result = assignVisualLayers([segment]);
      expect(result[0].visualLayer).toBe('evidence-screenshot');
    });

    it('assigns abstract-concept for full-screen-text scenes', () => {
      const segment = makeSegment({
        sceneType: 'full-screen-text',
        text: 'What does this mean for the future',
        visualData: { text: 'What does this mean?', alignment: 'center' },
        pacing: 'breathe',
      });

      const result = assignVisualLayers([segment]);
      expect(result[0].visualLayer).toBe('abstract-concept');
    });

    it('assigns abstract-concept for text-emphasis scenes', () => {
      const segment = makeSegment({
        sceneType: 'text-emphasis',
        text: 'The key takeaway here is important',
        visualData: { phrase: 'key takeaway', style: 'fade' },
        pacing: 'punch',
      });

      const result = assignVisualLayers([segment]);
      expect(result[0].visualLayer).toBe('abstract-concept');
    });

    it('assigns abstract-concept for quote scenes', () => {
      const segment = makeSegment({
        sceneType: 'quote',
        text: 'As someone once remarked about technology',
        visualData: { text: 'Something profound', attribution: 'Expert' },
        pacing: 'breathe',
      });

      const result = assignVisualLayers([segment]);
      expect(result[0].visualLayer).toBe('abstract-concept');
    });

    it('assigns showcase-scroll for diagram scenes', () => {
      const segment = makeSegment({
        sceneType: 'diagram',
        text: 'The architecture flows through several nodes',
        visualData: {
          nodes: [{ id: 'a', label: 'Start' }],
          edges: [],
          layout: 'horizontal',
        },
        pacing: 'normal',
      });

      const result = assignVisualLayers([segment]);
      expect(result[0].visualLayer).toBe('showcase-scroll');
    });

    it('assigns abstract-concept for meme-reaction scenes', () => {
      const segment = makeSegment({
        sceneType: 'meme-reaction',
        text: 'This is really surprising',
        visualData: { gifSrc: '', reactionType: 'shocked', description: 'Reaction' },
        pacing: 'punch',
      });

      const result = assignVisualLayers([segment]);
      expect(result[0].visualLayer).toBe('abstract-concept');
    });

    it('assigns abstract-concept for map-animation scenes', () => {
      const segment = makeSegment({
        sceneType: 'map-animation',
        text: 'Adoption is spreading across countries',
        visualData: {
          mapType: 'world',
          highlightedCountries: ['US', 'GB'],
          animationStyle: 'simultaneous',
        },
        pacing: 'normal',
      });

      const result = assignVisualLayers([segment]);
      expect(result[0].visualLayer).toBe('abstract-concept');
    });

    it('assigns showcase-scroll for dynamic-chart scenes', () => {
      const segment = makeSegment({
        sceneType: 'dynamic-chart',
        text: 'Benchmark results show significant performance differences',
        visualData: {
          chartType: 'bar',
          title: 'Framework Benchmarks',
          data: [{ label: 'React', value: 120 }, { label: 'Svelte', value: 45 }],
          animationStyle: 'sequential',
        },
        pacing: 'dense',
      });

      const result = assignVisualLayers([segment]);
      expect(result[0].visualLayer).toBe('showcase-scroll');
    });
  });

  // ---------------------------------------------------------------------------
  // Intro/outro excluded
  // ---------------------------------------------------------------------------
  describe('intro/outro exclusion', () => {
    it('does not assign visualLayer to intro segments', () => {
      const segments = [
        makeSegment({ index: 0, sceneType: 'intro', text: 'Welcome to the show' }),
        makeSegment({
          index: 1,
          sceneType: 'narration-default',
          text: 'Something generic about a topic here',
          startFrame: 90,
          endFrame: 180,
        }),
      ];

      const result = assignVisualLayers(segments);

      expect(result[0].visualLayer).toBeUndefined();
      expect(result[1].visualLayer).toBeDefined();
    });

    it('does not assign visualLayer to outro segments', () => {
      const segments = [
        makeSegment({
          index: 0,
          sceneType: 'narration-default',
          text: 'Something generic about a topic here',
        }),
        makeSegment({
          index: 1,
          sceneType: 'outro',
          text: 'Thanks for watching',
          startFrame: 90,
          endFrame: 180,
        }),
      ];

      const result = assignVisualLayers(segments);

      expect(result[0].visualLayer).toBeDefined();
      expect(result[1].visualLayer).toBeUndefined();
    });

    it('skips intro and outro but assigns layers to all middle segments', () => {
      const segments = [
        makeSegment({ index: 0, sceneType: 'intro', text: 'Welcome' }),
        makeSegment({
          index: 1,
          sceneType: 'narration-default',
          text: 'First generic topic segment here',
          startFrame: 90,
          endFrame: 180,
        }),
        makeSegment({
          index: 2,
          sceneType: 'narration-default',
          text: 'Second generic topic segment here',
          startFrame: 180,
          endFrame: 270,
        }),
        makeSegment({
          index: 3,
          sceneType: 'narration-default',
          text: 'Third generic topic segment here',
          startFrame: 270,
          endFrame: 360,
        }),
        makeSegment({
          index: 4,
          sceneType: 'outro',
          text: 'Goodbye',
          startFrame: 360,
          endFrame: 450,
        }),
      ];

      const result = assignVisualLayers(segments);

      expect(result[0].visualLayer).toBeUndefined(); // intro
      expect(result[1].visualLayer).toBeDefined();
      expect(result[2].visualLayer).toBeDefined();
      expect(result[3].visualLayer).toBeDefined();
      expect(result[4].visualLayer).toBeUndefined(); // outro
    });

    it('intro/outro do not affect the round-robin counter', () => {
      // Intro should be skipped, so segment at index 1 should get the first
      // round-robin value, not the second
      const segments = [
        makeSegment({ index: 0, sceneType: 'intro', text: 'Welcome' }),
        makeSegment({
          index: 1,
          sceneType: 'narration-default',
          text: 'First generic topic content here',
          startFrame: 90,
          endFrame: 180,
        }),
        makeSegment({
          index: 2,
          sceneType: 'narration-default',
          text: 'Second generic topic content here',
          startFrame: 180,
          endFrame: 270,
        }),
        makeSegment({
          index: 3,
          sceneType: 'narration-default',
          text: 'Third generic topic content here',
          startFrame: 270,
          endFrame: 360,
        }),
      ];

      const result = assignVisualLayers(segments);

      // Intro skipped, round-robin starts at 0 for index 1
      expect(result[0].visualLayer).toBeUndefined();
      expect(result[1].visualLayer).toBe('abstract-concept');
      expect(result[2].visualLayer).toBe('evidence-screenshot');
      expect(result[3].visualLayer).toBe('showcase-scroll');
    });
  });

  // ---------------------------------------------------------------------------
  // Mixed scenarios
  // ---------------------------------------------------------------------------
  describe('mixed scenarios', () => {
    it('returns the same array reference (mutates in place)', () => {
      const segments = makeGenericSegments(3);
      const result = assignVisualLayers(segments);
      expect(result).toBe(segments);
    });

    it('handles a realistic video with mixed scene types', () => {
      const segments: ClassifiedSegment[] = [
        makeSegment({ index: 0, sceneType: 'intro', text: 'Welcome' }),
        makeSegment({
          index: 1,
          sceneType: 'stat-callout',
          text: 'Some big number here',
          visualData: { number: '500', label: 'users', countUp: true },
          pacing: 'punch',
          startFrame: 90,
          endFrame: 180,
        }),
        makeSegment({
          index: 2,
          sceneType: 'code-block',
          text: 'Here is the implementation',
          visualData: { code: 'const x = 1;', language: 'typescript' },
          startFrame: 180,
          endFrame: 270,
        }),
        makeSegment({
          index: 3,
          sceneType: 'logo-showcase',
          text: 'Companies involved in this space',
          visualData: { logos: [{ name: 'Acme' }], layout: 'sequential' },
          pacing: 'punch',
          startFrame: 270,
          endFrame: 360,
        }),
        makeSegment({
          index: 4,
          sceneType: 'narration-default',
          text: 'Some generic commentary on the broader topic landscape',
          startFrame: 360,
          endFrame: 450,
        }),
        makeSegment({
          index: 5,
          sceneType: 'outro',
          text: 'Thanks for watching',
          startFrame: 450,
          endFrame: 540,
        }),
      ];

      const result = assignVisualLayers(segments);

      expect(result[0].visualLayer).toBeUndefined(); // intro
      expect(result[1].visualLayer).toBe('abstract-concept'); // stat-callout hint
      expect(result[2].visualLayer).toBe('showcase-scroll'); // code-block hint
      expect(result[3].visualLayer).toBe('evidence-screenshot'); // logo-showcase hint
      // narration-default with no company/URL → round-robin
      expect(result[4].visualLayer).toBeDefined();
      expect(result[5].visualLayer).toBeUndefined(); // outro
    });

    it('handles a single non-intro/outro segment', () => {
      const segment = makeSegment({
        sceneType: 'narration-default',
        text: 'Just a single segment about something generic here',
      });

      const result = assignVisualLayers([segment]);
      expect(result).toHaveLength(1);
      expect(result[0].visualLayer).toBe('abstract-concept'); // first in round-robin
    });

    it('content-aware hint takes priority over round-robin', () => {
      // Even though round-robin would give 'abstract-concept' first,
      // a code-block should still get 'showcase-scroll'
      const segments = [
        makeSegment({
          index: 0,
          sceneType: 'code-block',
          text: 'Some code example for the feature',
          visualData: { code: 'x = 1', language: 'python' },
        }),
        makeSegment({
          index: 1,
          sceneType: 'narration-default',
          text: 'Just a segment about some general topic here',
          startFrame: 90,
          endFrame: 180,
        }),
      ];

      const result = assignVisualLayers(segments);

      // code-block gets hint override, not round-robin
      expect(result[0].visualLayer).toBe('showcase-scroll');
      // narration-default falls through to round-robin (starts at index 0)
      expect(result[1].visualLayer).toBe('abstract-concept');
    });
  });
});
