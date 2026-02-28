import { describe, expect, it } from 'vitest';
import type { Scene } from '@nexus-ai/director-agent';
import { applyPacingEnvelope } from '../pacing-director.js';

function makeScene(id: string, startFrame: number, endFrame: number, sourceUrl?: string): Scene {
  return {
    id,
    type: 'narration-default',
    startFrame,
    endFrame,
    content: 'scene',
    visualData: {},
    transition: 'cut',
    ...(sourceUrl ? { sourceUrl, visualSource: 'source-screenshot' } : {}),
  } as Scene;
}

describe('applyPacingEnvelope', () => {
  it('assigns punch pacing in hook and breathe pacing in conclusion', () => {
    const scenes = [
      makeScene('s1', 0, 90),
      makeScene('s2', 90, 180, 'https://github.com/vercel/next.js'),
      makeScene('s3', 180, 270),
      makeScene('s4', 270, 360),
      makeScene('s5', 360, 450),
      makeScene('s6', 450, 540),
    ];

    const metrics = applyPacingEnvelope(scenes, 18);

    expect(metrics.hookSceneCount).toBeGreaterThan(0);
    expect(metrics.conclusionSceneCount).toBeGreaterThan(0);
    expect(scenes[0].pacing).toBe('punch');
    expect(scenes[scenes.length - 1].pacing).toBe('breathe');
    expect(scenes[1].pacing).toBe('dense');
  });
});
