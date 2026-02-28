import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scene } from '@nexus-ai/director-agent';
import { enrichScenesWithSourceMetadata } from '../source-metadata-enricher.js';

function makeScene(sourceUrl: string): Scene {
  return {
    id: 's1',
    type: 'narration-default',
    content: 'According to source',
    startFrame: 0,
    endFrame: 120,
    visualData: {},
    transition: 'fade',
    sourceUrl,
    visualSource: 'source-screenshot',
  } as Scene;
}

describe('enrichScenesWithSourceMetadata', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('api.github.com/repos/vercel/next.js')) {
        return {
          ok: true,
          json: async () => ({
            full_name: 'vercel/next.js',
            stargazers_count: 131000,
            forks_count: 28000,
            language: 'TypeScript',
          }),
        } as Response;
      }
      return { ok: false } as Response;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches github repository metadata to scenes', async () => {
    const scenes = [makeScene('https://github.com/vercel/next.js')];
    await enrichScenesWithSourceMetadata(scenes);

    expect(scenes[0].sourceMetadata).toBeDefined();
    expect(scenes[0].sourceMetadata?.sourceKind).toBe('repository');
    expect(scenes[0].sourceMetadata?.sourceName).toBe('vercel/next.js');
    expect(scenes[0].sourceMetadata?.detail).toContain('⭐');
  });

  it('attaches tweet metadata without API requirements', async () => {
    const scenes = [makeScene('https://x.com/rauchg/status/12345')];
    await enrichScenesWithSourceMetadata(scenes);

    expect(scenes[0].sourceMetadata).toBeDefined();
    expect(scenes[0].sourceMetadata?.sourceKind).toBe('tweet');
    expect(scenes[0].sourceMetadata?.sourceName).toBe('@rauchg');
  });
});
