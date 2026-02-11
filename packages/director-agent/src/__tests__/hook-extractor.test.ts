import { describe, it, expect } from 'vitest';
import { extractColdOpenHook } from '../hook-extractor.js';
import type { Scene, SceneType, StatCalloutVisualData, TextEmphasisVisualData } from '../types.js';

// =============================================================================
// Helpers
// =============================================================================

function makeScene(
  index: number,
  type: SceneType,
  content: string,
  visualData: Record<string, unknown>,
  overrides: Partial<Scene> = {},
): Scene {
  return {
    id: `scene-${index}-${type}`,
    type,
    startFrame: index * 150,
    endFrame: (index + 1) * 150,
    content,
    visualData: visualData as Scene['visualData'],
    transition: index === 0 ? 'cut' : 'fade',
    ...overrides,
  };
}

function makeStatScene(
  index: number,
  number: string,
  label: string,
  extras: Partial<StatCalloutVisualData> = {},
): Scene {
  return makeScene(index, 'stat-callout', `${number} ${label}`, {
    number,
    label,
    countUp: true,
    ...extras,
  });
}

function makeTextScene(
  index: number,
  phrase: string,
  style: 'fade' | 'slam' | 'typewriter' = 'fade',
): Scene {
  return makeScene(index, 'text-emphasis', phrase, {
    phrase,
    style,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('extractColdOpenHook', () => {
  it('extracts a hook from a scene with "2.3 million conversations" (high score)', () => {
    const scenes = [
      makeScene(0, 'intro', 'Welcome to the show.', {}),
      makeStatScene(1, '2.3M', 'conversations handled'),
      makeScene(2, 'narration-default', 'Some narration.', { backgroundVariant: 'gradient' }),
      makeScene(3, 'outro', 'Thanks for watching.', {}),
    ];

    const hook = extractColdOpenHook('full script text', scenes);
    expect(hook).not.toBeNull();
    expect(hook!.sceneType).toBe('stat-callout');
    expect(hook!.text).toContain('2.3M');
    expect(hook!.text).toContain('conversations handled');
  });

  it('extracts a hook from "700 agents replaced" (disruption keyword bonus)', () => {
    const scenes = [
      makeScene(0, 'intro', 'Welcome.', {}),
      makeStatScene(1, '700', 'full-time agents replaced by AI'),
      makeScene(2, 'narration-default', 'More context.', { backgroundVariant: 'gradient' }),
      makeScene(3, 'outro', 'Bye.', {}),
    ];

    const hook = extractColdOpenHook('script', scenes);
    expect(hook).not.toBeNull();
    expect(hook!.sceneType).toBe('stat-callout');
    // 700 > 100 → 4 base + "replaced" → +3 = 7 >= 6 threshold
    expect(hook!.text).toContain('700');
    expect(hook!.text).toContain('replaced');
  });

  it('returns null when only small stats exist (score too low)', () => {
    const scenes = [
      makeScene(0, 'intro', 'Welcome.', {}),
      makeStatScene(1, '15', 'employees joined'),
      makeScene(2, 'narration-default', 'Content.', { backgroundVariant: 'gradient' }),
      makeScene(3, 'outro', 'Bye.', {}),
    ];

    const hook = extractColdOpenHook('script', scenes);
    // 15 < 100 → score 0, no keywords → total 0, below threshold 6
    expect(hook).toBeNull();
  });

  it('extracts a hook from dramatic text "The end of SaaS as we know it"', () => {
    const scenes = [
      makeScene(0, 'intro', 'Welcome.', {}),
      makeScene(1, 'narration-default', 'Some context.', { backgroundVariant: 'gradient' }),
      makeTextScene(2, 'The end of SaaS as we know it'),
      makeScene(3, 'outro', 'Bye.', {}),
    ];

    const hook = extractColdOpenHook('script', scenes);
    expect(hook).not.toBeNull();
    expect(hook!.sceneType).toBe('text-emphasis');
    expect(hook!.text).toContain('end of');
    // Cold open always uses slam style
    const vd = hook!.visualData as TextEmphasisVisualData;
    expect(vd.style).toBe('slam');
  });

  it('returns null when there are no stats and no dramatic text', () => {
    const scenes = [
      makeScene(0, 'intro', 'Welcome to our channel.', {}),
      makeScene(1, 'narration-default', 'Today we discuss cloud computing.', { backgroundVariant: 'gradient' }),
      makeTextScene(2, 'Cloud computing is widely used in enterprise'),
      makeScene(3, 'outro', 'Thanks for watching.', {}),
    ];

    const hook = extractColdOpenHook('script', scenes);
    expect(hook).toBeNull();
  });

  it('trims hook text to max 15 words', () => {
    const longPhrase = 'The unprecedented collapse of the entire SaaS industry has fundamentally changed how we build and deploy software forever';
    const scenes = [
      makeScene(0, 'intro', 'Welcome.', {}),
      makeTextScene(1, longPhrase),
      makeScene(2, 'outro', 'Bye.', {}),
    ];

    const hook = extractColdOpenHook('script', scenes);
    expect(hook).not.toBeNull();
    const words = hook!.text.split(/\s+/);
    expect(words.length).toBeLessThanOrEqual(15);
  });

  it('returns visualData matching the stat-callout type', () => {
    const scenes = [
      makeScene(0, 'intro', 'Welcome.', {}),
      makeStatScene(1, '5000000', 'users worldwide', { prefix: '$', suffix: '+' }),
      makeScene(2, 'outro', 'Bye.', {}),
    ];

    const hook = extractColdOpenHook('script', scenes);
    expect(hook).not.toBeNull();
    expect(hook!.sceneType).toBe('stat-callout');

    const vd = hook!.visualData as StatCalloutVisualData;
    expect(vd.number).toBe('5000000');
    expect(vd.label).toBe('users worldwide');
    expect(vd.prefix).toBe('$');
    expect(vd.suffix).toBe('+');
    expect(vd.countUp).toBe(false); // Cold open = no count-up
  });

  it('sourceSceneIndex points to the correct scene', () => {
    const scenes = [
      makeScene(0, 'intro', 'Welcome.', {}),
      makeScene(1, 'narration-default', 'Some context.', { backgroundVariant: 'gradient' }),
      makeStatScene(2, '1500000', 'data points processed'),
      makeScene(3, 'narration-default', 'More text.', { backgroundVariant: 'gradient' }),
      makeScene(4, 'outro', 'Bye.', {}),
    ];

    const hook = extractColdOpenHook('script', scenes);
    expect(hook).not.toBeNull();
    expect(hook!.sourceSceneIndex).toBe(2);
  });

  it('prefers the highest scoring stat when multiple exist', () => {
    const scenes = [
      makeScene(0, 'intro', 'Welcome.', {}),
      makeStatScene(1, '500', 'items sold'),          // score: 4 (> 100)
      makeStatScene(2, '2000000', 'users disrupted'),  // score: 10 + 3 = 13
      makeStatScene(3, '5000', 'employees'),            // score: 4 (> 1000 = 6)
      makeScene(4, 'outro', 'Bye.', {}),
    ];

    const hook = extractColdOpenHook('script', scenes);
    expect(hook).not.toBeNull();
    expect(hook!.sourceSceneIndex).toBe(2);
    expect(hook!.text).toContain('2000000');
  });

  it('falls back to dramatic text when stats score below threshold', () => {
    const scenes = [
      makeScene(0, 'intro', 'Welcome.', {}),
      makeStatScene(1, '50', 'small number'),
      makeTextScene(2, 'The biggest transformation in tech history'),
      makeScene(3, 'outro', 'Bye.', {}),
    ];

    const hook = extractColdOpenHook('script', scenes);
    expect(hook).not.toBeNull();
    expect(hook!.sceneType).toBe('text-emphasis');
    expect(hook!.text).toContain('biggest');
  });

  it('returns visualData matching text-emphasis type with slam style', () => {
    const scenes = [
      makeScene(0, 'intro', 'Welcome.', {}),
      makeTextScene(1, 'An unprecedented revolution in computing'),
      makeScene(2, 'outro', 'Bye.', {}),
    ];

    const hook = extractColdOpenHook('script', scenes);
    expect(hook).not.toBeNull();
    expect(hook!.sceneType).toBe('text-emphasis');

    const vd = hook!.visualData as TextEmphasisVisualData;
    expect(vd.phrase).toBeDefined();
    expect(vd.style).toBe('slam');
  });
});
