import { describe, expect, it } from 'vitest';
import type { Scene } from '@nexus-ai/director-agent';
import { scoreVisualQuality } from '../visual-quality-scorer.js';

function scene(partial: Partial<Scene>): Scene {
  return {
    id: partial.id ?? 's',
    type: partial.type ?? 'narration-default',
    content: partial.content ?? 'sample',
    startFrame: partial.startFrame ?? 0,
    endFrame: partial.endFrame ?? 60,
    visualData: partial.visualData ?? {},
    transition: partial.transition ?? 'cut',
    visualSource: partial.visualSource,
    sourceUrl: partial.sourceUrl,
    screenshotDisplayMode: partial.screenshotDisplayMode,
  } as Scene;
}

describe('scoreVisualQuality', () => {
  it('scores high when evidence coverage, cadence, and transition dynamics are strong', () => {
    const scenes = [
      scene({ id: 's1', type: 'stat-callout', startFrame: 0, endFrame: 60, content: 'AI adoption jumped 240% in 3 months.', transition: 'slam', visualSource: 'source-screenshot', sourceUrl: 'https://github.com/vercel/next.js', screenshotDisplayMode: 'foreground' }),
      scene({ id: 's2', type: 'comparison', startFrame: 60, endFrame: 120, content: 'But reliability dropped after rushed launches.', transition: 'split', visualSource: 'content-screenshot', sourceUrl: 'https://techcrunch.com/x', screenshotDisplayMode: 'foreground' }),
      scene({ id: 's3', type: 'code-block', startFrame: 120, endFrame: 180, content: 'Teams fixed this because they improved observability.', transition: 'zoom-in', visualSource: 'source-screenshot', sourceUrl: 'https://x.com/u/status/1', screenshotDisplayMode: 'foreground' }),
      scene({ id: 's4', type: 'timeline', startFrame: 180, endFrame: 240, content: 'Now the market is shifting again.', transition: 'wipe-down', visualSource: 'content-screenshot', sourceUrl: 'https://github.com/nodejs/node', screenshotDisplayMode: 'foreground' }),
      scene({ id: 's5', type: 'list-reveal', startFrame: 240, endFrame: 300, content: 'Therefore execution speed is the new moat.', transition: 'pop-in', visualSource: 'ai-generated' }),
    ];

    const result = scoreVisualQuality(scenes, 15);
    expect(result.qualityStatus).toBe('PASS');
    expect(result.qualityScore).toBeGreaterThanOrEqual(70);
    expect(result.sourceEvidenceCoverage).toBeGreaterThanOrEqual(0.6);
    expect(result.transitionDiversity).toBeGreaterThan(0.6);
    expect(result.patternBreakRatio).toBeGreaterThan(0.6);
    expect(result.maxConsecutiveSceneTypeRun).toBe(1);
  });

  it('degrades when visuals are repetitive, static, and low evidence', () => {
    const scenes = [
      scene({ id: 'r1', type: 'narration-default', startFrame: 0, endFrame: 180, content: 'A recap sentence.' }),
      scene({ id: 'r2', type: 'narration-default', startFrame: 180, endFrame: 360, content: 'Another recap sentence.' }),
      scene({ id: 'r3', type: 'narration-default', startFrame: 360, endFrame: 540, content: 'More recap sentence.' }),
      scene({ id: 'r4', type: 'narration-default', startFrame: 540, endFrame: 720, content: 'Still recap sentence.', visualSource: 'ai-generated' }),
      scene({ id: 'r5', type: 'narration-default', startFrame: 720, endFrame: 900, content: 'No narrative turn here.' }),
    ];

    const result = scoreVisualQuality(scenes, 120);
    expect(result.qualityStatus).toBe('DEGRADED');
    expect(result.qualityScore).toBeLessThan(70);
    expect(result.maxConsecutiveSceneTypeRun).toBeGreaterThanOrEqual(4);
    expect(result.qualityWarnings).toContain('Repetitive scene composition detected');
    expect(result.qualityWarnings.length).toBeGreaterThan(0);
  });
});
