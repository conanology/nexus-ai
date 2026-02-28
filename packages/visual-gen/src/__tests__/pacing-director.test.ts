import { describe, expect, it } from 'vitest';
import type { Scene } from '@nexus-ai/director-agent';
import { applyPacingEnvelope } from '../pacing-director.js';

function makeScene(
  id: string,
  startFrame: number,
  endFrame: number,
  options: Partial<Scene> = {},
): Scene {
  return {
    id,
    type: options.type ?? 'narration-default',
    startFrame,
    endFrame,
    content: options.content ?? 'scene',
    visualData: {},
    transition: options.transition ?? 'cut',
    sourceUrl: options.sourceUrl,
    visualSource: options.visualSource,
  } as Scene;
}

describe('applyPacingEnvelope', () => {
  it('assigns pacing, detects hook archetype, and injects kinetic transitions', () => {
    const scenes = [
      makeScene('s1', 0, 90, { content: 'Traffic jumped 312% in 6 hours across AI coding tools.' }),
      makeScene('s2', 90, 180, { content: 'The numbers are real and the market is reacting now.' }),
      makeScene('s3', 180, 270, { content: 'GitHub repos are exploding with forks.', sourceUrl: 'https://github.com/vercel/next.js', visualSource: 'source-screenshot' }),
      makeScene('s4', 270, 360, { content: 'Teams are shipping faster but with more incidents.' }),
      makeScene('s5', 360, 450, { content: 'The next quarter will decide winners and losers.' }),
      makeScene('s6', 450, 540, { content: 'Conclusion and what to watch next.' }),
    ];

    const metrics = applyPacingEnvelope(scenes, 18);

    expect(metrics.hookSceneCount).toBeGreaterThan(0);
    expect(metrics.conclusionSceneCount).toBeGreaterThan(0);
    expect(metrics.hookArchetype).toBe('shock-stat');
    expect(metrics.patternBreakCount).toBeGreaterThan(0);
    expect(scenes[0].pacing).toBe('punch');
    expect(scenes[scenes.length - 1].pacing).toBe('breathe');
    expect(scenes[2].pacing).toBe('dense');
    expect(scenes[0].transition).not.toBe('cut');
    expect(scenes[0].sfx?.length).toBeGreaterThan(0);
  });

  it('applies novelty guardrails when scene composition repeats too much', () => {
    const scenes = [
      makeScene('n1', 0, 90, { type: 'narration-default', content: 'A' }),
      makeScene('n2', 90, 180, { type: 'narration-default', content: 'B' }),
      makeScene('n3', 180, 270, { type: 'narration-default', content: 'C' }),
      makeScene('n4', 270, 360, { type: 'narration-default', content: 'D' }),
      makeScene('n5', 360, 450, { type: 'narration-default', content: 'E' }),
    ];

    const metrics = applyPacingEnvelope(scenes, 15);

    expect(metrics.maxConsecutiveSceneTypeRun).toBeGreaterThanOrEqual(4);
    expect(metrics.noveltyInterventions).toBeGreaterThan(0);
    expect(scenes.some((scene) => scene.transition !== 'cut')).toBe(true);
  });
});
