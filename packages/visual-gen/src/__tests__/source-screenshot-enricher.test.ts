import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nexus-ai/asset-library', () => ({
  captureWebsiteScreenshot: vi.fn(async () => Buffer.from('png')),
  closeBrowser: vi.fn(async () => {}),
  screenshotToDataUri: vi.fn((buffer: Buffer) => `data:image/png;base64,${buffer.toString('base64')}`),
}));

vi.mock('../agentic-browser.js', () => ({
  captureWithAgenticBrowser: vi.fn(async () => null),
}));

import { captureWebsiteScreenshot } from '@nexus-ai/asset-library';
import { enrichScenesWithSourceScreenshots } from '../source-screenshot-enricher.js';
import type { Scene } from '@nexus-ai/director-agent';

function makeScene(content: string): Scene {
  return {
    id: 's1',
    type: 'narration-default',
    content,
    startFrame: 0,
    endFrame: 120,
    visualData: {},
    transition: 'fade',
  } as Scene;
}

describe('enrichScenesWithSourceScreenshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes tweet URLs to vxtwitter capture target', async () => {
    const scenes = [makeScene('According to this tweet, the launch failed.')];
    const sourceUrls = [
      {
        url: 'https://x.com/example/status/123456789',
        title: 'Example post about the launch',
      },
    ];

    await enrichScenesWithSourceScreenshots(scenes, sourceUrls);

    expect(captureWebsiteScreenshot).toHaveBeenCalled();
    const firstCall = vi.mocked(captureWebsiteScreenshot).mock.calls[0];
    expect(firstCall[0]).toContain('vxtwitter.com/example/status/123456789');
    expect(scenes[0].visualSource).toBe('source-screenshot');
  });
});
