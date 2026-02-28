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
    transition: partial.transition ?? 'fade',
    visualSource: partial.visualSource,
    sourceUrl: partial.sourceUrl,
    screenshotDisplayMode: partial.screenshotDisplayMode,
  } as Scene;
}

describe('scoreVisualQuality', () => {
  it('scores high when evidence coverage and cadence are strong', () => {
    const scenes = [
      scene({ type: 'narration-default', visualSource: 'source-screenshot', sourceUrl: 'https://github.com/vercel/next.js', screenshotDisplayMode: 'foreground' }),
      scene({ type: 'highlight', visualSource: 'content-screenshot', sourceUrl: 'https://techcrunch.com/x', screenshotDisplayMode: 'foreground' }),
      scene({ type: 'comparison-split', visualSource: 'ai-generated' }),
      scene({ type: 'code-block', visualSource: 'source-screenshot', sourceUrl: 'https://x.com/u/status/1', screenshotDisplayMode: 'foreground' }),
      scene({ type: 'listicle', visualSource: 'content-screenshot', sourceUrl: 'https://github.com/nodejs/node', screenshotDisplayMode: 'foreground' }),
    ];

    const result = scoreVisualQuality(scenes, 15); // 5 scenes in 15s = 20/min cadence
    expect(result.qualityStatus).toBe('PASS');
    expect(result.qualityScore).toBeGreaterThanOrEqual(70);
    expect(result.sourceEvidenceCoverage).toBeGreaterThanOrEqual(0.6);
  });

  it('degrades when visuals are mostly gradients and low cadence', () => {
    const scenes = [
      scene({ type: 'narration-default' }),
      scene({ type: 'narration-default' }),
      scene({ type: 'narration-default' }),
      scene({ type: 'narration-default', visualSource: 'ai-generated' }),
    ];

    const result = scoreVisualQuality(scenes, 90); // ~2.7/min
    expect(result.qualityStatus).toBe('DEGRADED');
    expect(result.qualityScore).toBeLessThan(70);
    expect(result.qualityWarnings.length).toBeGreaterThan(0);
  });
});
