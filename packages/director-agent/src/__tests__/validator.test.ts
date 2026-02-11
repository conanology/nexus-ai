import { describe, it, expect } from 'vitest';
import { validateScenes } from '../validator.js';
import { DEFAULT_SCENE_PACING } from '../types.js';
import type { ClassifiedSegment, SceneType } from '../types.js';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Creates a minimal ClassifiedSegment for testing.
 */
function makeSegment(
  index: number,
  sceneType: SceneType,
  text: string = `Segment ${index} text content.`,
  overrides: Partial<ClassifiedSegment> = {},
): ClassifiedSegment {
  return {
    index,
    text,
    startFrame: index * 150,
    endFrame: (index + 1) * 150,
    sentenceCount: 1,
    sceneType,
    visualData: getMinimalVisualData(sceneType, text),
    pacing: DEFAULT_SCENE_PACING[sceneType],
    ...overrides,
  };
}

/**
 * Returns minimal valid visualData for a scene type.
 */
function getMinimalVisualData(
  sceneType: SceneType,
  text: string,
): Record<string, unknown> {
  switch (sceneType) {
    case 'intro':
      return {};
    case 'outro':
      return {};
    case 'narration-default':
      return { backgroundVariant: 'gradient' };
    case 'text-emphasis':
      return { phrase: text.slice(0, 40), style: 'fade' };
    case 'full-screen-text':
      return { text: text.slice(0, 60), alignment: 'center' };
    case 'stat-callout':
      return { number: '100', label: 'things', countUp: true };
    case 'comparison':
      return {
        left: { title: 'A', items: ['Item 1'] },
        right: { title: 'B', items: ['Item 1'] },
      };
    case 'diagram':
      return {
        nodes: [{ id: 'a', label: 'Start' }, { id: 'b', label: 'End' }],
        edges: [{ from: 'a', to: 'b' }],
        layout: 'horizontal',
      };
    case 'logo-showcase':
      return { logos: [{ name: 'Acme' }], layout: 'sequential' };
    case 'timeline':
      return { events: [{ year: '2024', label: 'Event' }] };
    case 'quote':
      return { text: 'A quote', attribution: 'Someone' };
    case 'list-reveal':
      return { items: ['Item 1', 'Item 2'], style: 'bullet' };
    case 'code-block':
      return { code: 'console.log("hi")', language: 'javascript' };
    case 'chapter-break':
      return { title: 'Chapter' };
    default:
      return {};
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('validateScenes', () => {
  it('returns no warnings for a valid scene array', () => {
    const scenes: ClassifiedSegment[] = [
      makeSegment(0, 'intro'),
      makeSegment(1, 'text-emphasis'),
      makeSegment(2, 'list-reveal'),
      makeSegment(3, 'stat-callout'),
      makeSegment(4, 'comparison'),
      makeSegment(5, 'outro'),
    ];

    const result = validateScenes(scenes);

    expect(result.warnings).toHaveLength(0);
    expect(result.scenes).toHaveLength(6);
  });

  it('returns empty result for empty input', () => {
    const result = validateScenes([]);
    expect(result.scenes).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Triple Repetition
  // ---------------------------------------------------------------------------

  describe('triple repetition rule', () => {
    it('changes middle scene when 3 consecutive scenes have the same type', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        makeSegment(1, 'text-emphasis'),
        makeSegment(2, 'text-emphasis'),
        makeSegment(3, 'text-emphasis'),
        makeSegment(4, 'outro'),
      ];

      const result = validateScenes(scenes);

      // The middle scene (index 2) should have been changed
      expect(result.scenes[2].sceneType).not.toBe('text-emphasis');
      expect(result.scenes[2].sceneType).toBe('narration-default');

      // Should have a warning about the change
      expect(result.warnings.some((w) => w.includes('Scene 2'))).toBe(true);
      expect(
        result.warnings.some((w) => w.includes('consecutive')),
      ).toBe(true);
    });

    it('does not change when only 2 consecutive same-type scenes', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        makeSegment(1, 'text-emphasis'),
        makeSegment(2, 'text-emphasis'),
        makeSegment(3, 'list-reveal'),
        makeSegment(4, 'outro'),
      ];

      const result = validateScenes(scenes);

      expect(result.scenes[1].sceneType).toBe('text-emphasis');
      expect(result.scenes[2].sceneType).toBe('text-emphasis');
      expect(
        result.warnings.some((w) => w.includes('consecutive')),
      ).toBe(false);
    });

    it('uses text-emphasis as replacement when triple narration-default', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        makeSegment(1, 'narration-default'),
        makeSegment(2, 'narration-default'),
        makeSegment(3, 'narration-default'),
        makeSegment(4, 'outro'),
      ];

      const result = validateScenes(scenes);

      // Middle should become text-emphasis (not narration-default again)
      expect(result.scenes[2].sceneType).toBe('text-emphasis');
    });
  });

  // ---------------------------------------------------------------------------
  // Bookend Enforcement
  // ---------------------------------------------------------------------------

  describe('bookend enforcement', () => {
    it('forces first scene to intro when missing', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'text-emphasis'),
        makeSegment(1, 'list-reveal'),
        makeSegment(2, 'outro'),
      ];

      const result = validateScenes(scenes);

      expect(result.scenes[0].sceneType).toBe('intro');
      expect(
        result.warnings.some((w) => w.includes('Forced to "intro"')),
      ).toBe(true);
    });

    it('forces last scene to outro when missing', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        makeSegment(1, 'list-reveal'),
        makeSegment(2, 'text-emphasis'),
      ];

      const result = validateScenes(scenes);

      expect(result.scenes[2].sceneType).toBe('outro');
      expect(
        result.warnings.some((w) => w.includes('Forced to "outro"')),
      ).toBe(true);
    });

    it('does not warn when bookends are already correct', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        makeSegment(1, 'text-emphasis'),
        makeSegment(2, 'outro'),
      ];

      const result = validateScenes(scenes);

      expect(
        result.warnings.some((w) => w.includes('Forced to')),
      ).toBe(false);
    });

    it('handles single scene — forces to intro', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'text-emphasis'),
      ];

      const result = validateScenes(scenes);

      expect(result.scenes[0].sceneType).toBe('intro');
    });
  });

  // ---------------------------------------------------------------------------
  // Stat Usage Warning
  // ---------------------------------------------------------------------------

  describe('stat usage warning', () => {
    it('warns when segment has large numbers but does not use stat-callout', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        makeSegment(
          1,
          'text-emphasis',
          'The company processed 2500 transactions per second.',
        ),
        makeSegment(2, 'outro'),
      ];

      const result = validateScenes(scenes);

      expect(
        result.warnings.some(
          (w) => w.includes('Scene 1') && w.includes('stat-callout'),
        ),
      ).toBe(true);
    });

    it('warns when segment has percentage but does not use stat-callout', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        makeSegment(
          1,
          'narration-default',
          'Accuracy improved to 95% over the baseline.',
        ),
        makeSegment(2, 'outro'),
      ];

      const result = validateScenes(scenes);

      expect(
        result.warnings.some((w) => w.includes('stat-callout')),
      ).toBe(true);
    });

    it('warns when segment has monetary values but does not use stat-callout', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        makeSegment(
          1,
          'text-emphasis',
          'Revenue reached $500 million this quarter.',
        ),
        makeSegment(2, 'outro'),
      ];

      const result = validateScenes(scenes);

      expect(
        result.warnings.some((w) => w.includes('stat-callout')),
      ).toBe(true);
    });

    it('does not warn when stat-callout is already used', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        makeSegment(
          1,
          'stat-callout',
          'The AI processed 2500 queries.',
        ),
        makeSegment(2, 'outro'),
      ];

      const result = validateScenes(scenes);

      expect(
        result.warnings.some(
          (w) => w.includes('Scene 1') && w.includes('stat-callout'),
        ),
      ).toBe(false);
    });

    it('does not warn when text has no significant numbers', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        makeSegment(
          1,
          'text-emphasis',
          'The formula was incredibly consistent over the years.',
        ),
        makeSegment(2, 'outro'),
      ];

      const result = validateScenes(scenes);

      expect(
        result.warnings.some((w) => w.includes('stat-callout')),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Duration Warning
  // ---------------------------------------------------------------------------

  describe('minimum duration warning', () => {
    it('warns when a scene is shorter than 90 frames', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro', 'Intro text.', {
          startFrame: 0,
          endFrame: 150,
        }),
        makeSegment(1, 'text-emphasis', 'Short scene.', {
          startFrame: 150,
          endFrame: 200, // Only 50 frames
        }),
        makeSegment(2, 'outro', 'Outro text.', {
          startFrame: 200,
          endFrame: 350,
        }),
      ];

      const result = validateScenes(scenes);

      expect(
        result.warnings.some(
          (w) => w.includes('Scene 1') && w.includes('below minimum'),
        ),
      ).toBe(true);
    });

    it('does not warn when all scenes meet minimum duration', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro', 'Intro.', {
          startFrame: 0,
          endFrame: 150,
        }),
        makeSegment(1, 'text-emphasis', 'Content.', {
          startFrame: 150,
          endFrame: 300,
        }),
        makeSegment(2, 'outro', 'Outro.', {
          startFrame: 300,
          endFrame: 450,
        }),
      ];

      const result = validateScenes(scenes);

      expect(
        result.warnings.some((w) => w.includes('below minimum')),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Variety Warning
  // ---------------------------------------------------------------------------

  describe('variety warning', () => {
    it('warns when more than 50% of scenes use the same type', () => {
      // Space out narration-default to avoid triple-repetition repair interference.
      // 6 out of 10 = 60% narration-default, with text-emphasis breaks to prevent triples.
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        makeSegment(1, 'narration-default'),
        makeSegment(2, 'narration-default'),
        makeSegment(3, 'text-emphasis'), // break the triple
        makeSegment(4, 'narration-default'),
        makeSegment(5, 'narration-default'),
        makeSegment(6, 'text-emphasis'), // break the triple
        makeSegment(7, 'narration-default'),
        makeSegment(8, 'narration-default'),
        makeSegment(9, 'outro'),
      ];

      const result = validateScenes(scenes);

      expect(
        result.warnings.some((w) => w.includes('Visual monotony')),
      ).toBe(true);
    });

    it('does not warn when scene types are well-distributed', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        makeSegment(1, 'text-emphasis'),
        makeSegment(2, 'list-reveal'),
        makeSegment(3, 'stat-callout'),
        makeSegment(4, 'comparison'),
        makeSegment(5, 'logo-showcase'),
        makeSegment(6, 'diagram'),
        makeSegment(7, 'outro'),
      ];

      const result = validateScenes(scenes);

      expect(
        result.warnings.some((w) => w.includes('Visual monotony')),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // VisualData Validation
  // ---------------------------------------------------------------------------

  describe('visualData validation', () => {
    it('repairs invalid visualData with defaults', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'intro'),
        {
          index: 1,
          text: 'Some content here.',
          startFrame: 150,
          endFrame: 300,
          sentenceCount: 1,
          sceneType: 'text-emphasis',
          visualData: { invalid: 'data' }, // Missing required 'phrase' and 'style'
          pacing: 'normal',
        },
        makeSegment(2, 'outro'),
      ];

      const result = validateScenes(scenes);

      // Should have been repaired
      expect(result.scenes[1].visualData).toHaveProperty('phrase');
      expect(result.scenes[1].visualData).toHaveProperty('style');
      expect(
        result.warnings.some(
          (w) => w.includes('Scene 1') && w.includes('failed validation'),
        ),
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: Multiple Rules
  // ---------------------------------------------------------------------------

  describe('integration', () => {
    it('applies multiple rules and accumulates all warnings', () => {
      const scenes: ClassifiedSegment[] = [
        makeSegment(0, 'text-emphasis'), // Wrong — should be intro
        makeSegment(1, 'narration-default'),
        makeSegment(2, 'narration-default'),
        makeSegment(3, 'narration-default'), // Triple repetition
        makeSegment(
          4,
          'text-emphasis',
          'Revenue hit $1000 million.', // Has stats but not stat-callout
        ),
        makeSegment(5, 'text-emphasis', 'Closing.', {
          startFrame: 750,
          endFrame: 780, // Only 30 frames — too short
        }),
        // Missing outro
      ];

      const result = validateScenes(scenes);

      // Should have multiple warnings
      expect(result.warnings.length).toBeGreaterThanOrEqual(3);

      // Bookend: first scene forced to intro
      expect(result.scenes[0].sceneType).toBe('intro');

      // Bookend: last scene forced to outro
      expect(result.scenes[result.scenes.length - 1].sceneType).toBe('outro');

      // Triple repetition: middle narration-default changed
      const narrationCount = result.scenes.filter(
        (s) => s.sceneType === 'narration-default',
      ).length;
      // At least one should have been changed
      expect(narrationCount).toBeLessThan(3);
    });
  });
});
