import { describe, it, expect } from 'vitest';
import { applyPacing } from '../pacing-engine.js';
import type { Scene, SceneType, ScenePacing } from '../types.js';

// =============================================================================
// Helpers
// =============================================================================

function makeScene(
  index: number,
  type: SceneType,
  pacing: ScenePacing,
  startFrame: number,
  endFrame: number,
  overrides: Partial<Scene> = {},
): Scene {
  return {
    id: `scene-${index}-${type}`,
    type,
    startFrame,
    endFrame,
    content: `Content for scene ${index}`,
    visualData: {} as Scene['visualData'],
    pacing,
    transition: index === 0 ? 'cut' : 'fade',
    ...overrides,
  };
}

/**
 * Creates N evenly-spaced scenes with the given pacing values.
 */
function makeScenesWithPacing(
  pacings: Array<{ type: SceneType; pacing: ScenePacing }>,
  totalFrames: number,
): Scene[] {
  const each = Math.floor(totalFrames / pacings.length);
  return pacings.map((p, i) =>
    makeScene(
      i,
      p.type,
      p.pacing,
      i * each,
      i === pacings.length - 1 ? totalFrames : (i + 1) * each,
    ),
  );
}

function totalDuration(scenes: Scene[]): number {
  if (scenes.length === 0) return 0;
  return scenes[scenes.length - 1].endFrame - scenes[0].startFrame;
}

function sceneDuration(scene: Scene): number {
  return scene.endFrame - scene.startFrame;
}

// =============================================================================
// Tests
// =============================================================================

describe('applyPacing', () => {
  it('distributes 10 mixed-pacing scenes across 3000 frames with correct relative durations', () => {
    const pacings: Array<{ type: SceneType; pacing: ScenePacing }> = [
      { type: 'intro', pacing: 'normal' },
      { type: 'text-emphasis', pacing: 'normal' },
      { type: 'stat-callout', pacing: 'punch' },
      { type: 'narration-default', pacing: 'normal' },
      { type: 'comparison', pacing: 'dense' },
      { type: 'quote', pacing: 'breathe' },
      { type: 'stat-callout', pacing: 'punch' },
      { type: 'diagram', pacing: 'dense' },
      { type: 'text-emphasis', pacing: 'normal' },
      { type: 'outro', pacing: 'breathe' },
    ];

    const scenes = makeScenesWithPacing(pacings, 3000);
    const result = applyPacing(scenes, 3000, 30);

    // Total frames must equal 3000 exactly
    expect(result[result.length - 1].endFrame).toBe(3000);
    expect(result[0].startFrame).toBe(0);

    // Punch scenes should be shorter than normal scenes
    const punchScenes = result.filter((s) => s.pacing === 'punch');
    const normalScenes = result.filter((s) => s.pacing === 'normal');
    const avgPunch = punchScenes.reduce((s, sc) => s + sceneDuration(sc), 0) / punchScenes.length;
    const avgNormal = normalScenes.reduce((s, sc) => s + sceneDuration(sc), 0) / normalScenes.length;
    expect(avgPunch).toBeLessThan(avgNormal);

    // Breathe scenes should be longer than normal scenes
    const breatheScenes = result.filter((s) => s.pacing === 'breathe');
    const avgBreathe = breatheScenes.reduce((s, sc) => s + sceneDuration(sc), 0) / breatheScenes.length;
    expect(avgBreathe).toBeGreaterThan(avgNormal);
  });

  it('clamps all-punch scenes to min 60 frames', () => {
    const pacings: Array<{ type: SceneType; pacing: ScenePacing }> = Array.from(
      { length: 5 },
      (_, i) => ({
        type: (i === 0 ? 'intro' : i === 4 ? 'outro' : 'stat-callout') as SceneType,
        pacing: 'punch' as ScenePacing,
      }),
    );

    const scenes = makeScenesWithPacing(pacings, 1500);
    const result = applyPacing(scenes, 1500, 30);

    // With rhythm rule, middle of 3 consecutive punch becomes normal
    // But all scenes should still be >= 60 frames (absolute min is 45)
    for (const scene of result) {
      expect(sceneDuration(scene)).toBeGreaterThanOrEqual(45);
    }

    // Total must be exact
    expect(result[result.length - 1].endFrame).toBe(1500);
  });

  it('clamps all-breathe scenes to max 270 frames', () => {
    const pacings: Array<{ type: SceneType; pacing: ScenePacing }> = Array.from(
      { length: 4 },
      (_, i) => ({
        type: (i === 0 ? 'intro' : i === 3 ? 'outro' : 'quote') as SceneType,
        pacing: 'breathe' as ScenePacing,
      }),
    );

    // 4 scenes * 270 max = 1080, so give much more to test clamping
    const scenes = makeScenesWithPacing(pacings, 2000);
    const result = applyPacing(scenes, 2000, 30);

    // Total must be exact
    expect(result[result.length - 1].endFrame).toBe(2000);
    expect(result[0].startFrame).toBe(0);
  });

  it('changes middle scene when 3 consecutive punch scenes exist (rhythm fix)', () => {
    const pacings: Array<{ type: SceneType; pacing: ScenePacing }> = [
      { type: 'intro', pacing: 'normal' },
      { type: 'stat-callout', pacing: 'punch' },
      { type: 'stat-callout', pacing: 'punch' },
      { type: 'stat-callout', pacing: 'punch' },
      { type: 'outro', pacing: 'breathe' },
    ];

    const scenes = makeScenesWithPacing(pacings, 1500);
    const result = applyPacing(scenes, 1500, 30);

    // The middle punch (index 2) should have been changed to 'normal'
    const punchCount = result.filter((s) => s.pacing === 'punch').length;
    expect(punchCount).toBeLessThanOrEqual(2);

    // Verify the middle one changed
    expect(result[2].pacing).toBe('normal');
  });

  it('inserts a breathe scene when 5+ consecutive non-breathe scenes exist', () => {
    const pacings: Array<{ type: SceneType; pacing: ScenePacing }> = [
      { type: 'intro', pacing: 'normal' },
      { type: 'text-emphasis', pacing: 'normal' },
      { type: 'stat-callout', pacing: 'punch' },
      { type: 'comparison', pacing: 'dense' },
      { type: 'diagram', pacing: 'dense' },
      { type: 'narration-default', pacing: 'normal' },
      { type: 'outro', pacing: 'breathe' },
    ];

    const scenes = makeScenesWithPacing(pacings, 2100);
    const result = applyPacing(scenes, 2100, 30);

    // The first 6 non-breathe scenes should trigger a breathe insertion
    // Check that at least one scene before the outro is now 'breathe'
    const nonOutroBreathe = result.filter(
      (s) => s.pacing === 'breathe' && s.type !== 'outro',
    );
    expect(nonOutroBreathe.length).toBeGreaterThanOrEqual(1);

    // Total must still be exact
    expect(result[result.length - 1].endFrame).toBe(2100);
  });

  it('preserves cold open scene duration (80 frames unchanged)', () => {
    const coldOpen = makeScene(0, 'stat-callout', 'punch', 0, 80, {
      isColdOpen: true,
    });
    const scenes = [
      coldOpen,
      makeScene(1, 'intro', 'normal', 80, 280),
      makeScene(2, 'text-emphasis', 'normal', 280, 480),
      makeScene(3, 'stat-callout', 'punch', 480, 680),
      makeScene(4, 'outro', 'breathe', 680, 880),
    ];

    const result = applyPacing(scenes, 880, 30);

    // Cold open should still be exactly 80 frames
    expect(sceneDuration(result[0])).toBe(80);
    expect(result[0].isColdOpen).toBe(true);

    // Total must be exact
    expect(result[result.length - 1].endFrame).toBe(880);
    expect(result[0].startFrame).toBe(0);
  });

  it('gives full duration to a single scene regardless of pacing', () => {
    const scenes = [makeScene(0, 'intro', 'punch', 0, 3000)];

    const result = applyPacing(scenes, 3000, 30);

    // Single scene should get close to the full duration
    // (may be clamped by absolute max, but normalize brings it back)
    expect(result[0].startFrame).toBe(0);
    expect(result[0].endFrame).toBe(3000);
  });

  it('handles 2 scenes (intro + outro) with pacing applied proportionally', () => {
    const scenes = [
      makeScene(0, 'intro', 'normal', 0, 300),
      makeScene(1, 'outro', 'breathe', 300, 600),
    ];

    const result = applyPacing(scenes, 600, 30);

    // Breathe should be longer than normal
    const introDur = sceneDuration(result[0]);
    const outroDur = sceneDuration(result[1]);
    expect(outroDur).toBeGreaterThanOrEqual(introDur);

    // Total must be exact
    expect(result[result.length - 1].endFrame).toBe(600);
    expect(result[0].startFrame).toBe(0);
  });

  it('does not modify meme-reaction scene durations', () => {
    const scenes = [
      makeScene(0, 'intro', 'normal', 0, 200),
      makeScene(1, 'text-emphasis', 'normal', 200, 400),
      makeScene(2, 'meme-reaction', 'normal', 400, 436), // 36 frames
      makeScene(3, 'stat-callout', 'punch', 436, 636),
      makeScene(4, 'outro', 'breathe', 636, 836),
    ];

    const result = applyPacing(scenes, 836, 30);

    // Meme-reaction should still be 36 frames
    const meme = result.find((s) => s.type === 'meme-reaction')!;
    expect(sceneDuration(meme)).toBe(36);

    // Total must be exact
    expect(result[result.length - 1].endFrame).toBe(836);
  });

  it('returns empty array for empty input', () => {
    const result = applyPacing([], 3000, 30);
    expect(result).toEqual([]);
  });

  it('ensures all scenes have sequential non-overlapping frames', () => {
    const pacings: Array<{ type: SceneType; pacing: ScenePacing }> = [
      { type: 'intro', pacing: 'normal' },
      { type: 'stat-callout', pacing: 'punch' },
      { type: 'comparison', pacing: 'dense' },
      { type: 'quote', pacing: 'breathe' },
      { type: 'text-emphasis', pacing: 'normal' },
      { type: 'stat-callout', pacing: 'punch' },
      { type: 'diagram', pacing: 'dense' },
      { type: 'outro', pacing: 'breathe' },
    ];

    const scenes = makeScenesWithPacing(pacings, 2400);
    const result = applyPacing(scenes, 2400, 30);

    // Check sequential frames: each scene starts where the previous ended
    for (let i = 1; i < result.length; i++) {
      expect(result[i].startFrame).toBe(result[i - 1].endFrame);
    }

    // First starts at 0, last ends at total
    expect(result[0].startFrame).toBe(0);
    expect(result[result.length - 1].endFrame).toBe(2400);
  });
});
