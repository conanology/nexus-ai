/**
 * Meme Enricher Tests
 *
 * Validates that enrichScenesWithMemes correctly inserts meme-reaction scenes,
 * adjusts timing, and respects limits. Uses mocked Tenor API responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Scene } from '@nexus-ai/director-agent';

// ---------------------------------------------------------------------------
// Mock the asset-library meme functions
// ---------------------------------------------------------------------------

vi.mock('@nexus-ai/asset-library', () => ({
  selectMemeReaction: vi.fn(),
  searchMeme: vi.fn(),
  fetchMemeGifBuffer: vi.fn(),
  memeToDataUri: vi.fn(),
  getReactionQuery: vi.fn(),
}));

import {
  selectMemeReaction,
  searchMeme,
  fetchMemeGifBuffer,
  memeToDataUri,
  getReactionQuery,
} from '@nexus-ai/asset-library';
import { enrichScenesWithMemes } from '../meme-enricher.js';

const mockSelectMemeReaction = vi.mocked(selectMemeReaction);
const mockSearchMeme = vi.mocked(searchMeme);
const mockFetchMemeGifBuffer = vi.mocked(fetchMemeGifBuffer);
const mockMemeToDataUri = vi.mocked(memeToDataUri);
const mockGetReactionQuery = vi.mocked(getReactionQuery);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScene(
  overrides: Partial<Scene> & { type: Scene['type']; content: string },
): Scene {
  return {
    id: `scene-${Math.random().toString(36).slice(2, 8)}`,
    startFrame: 0,
    endFrame: 200,
    visualData: {},
    transition: 'cut',
    ...overrides,
  };
}

function setupMockMemeSuccess(reactionType = 'shocked') {
  mockSelectMemeReaction.mockReturnValue({
    reactionType,
    searchQuery: 'shocked face reaction',
  });
  mockSearchMeme.mockResolvedValue({
    id: 'tenor-123',
    gifUrl: 'https://tenor.com/test.gif',
    description: 'Shocked face',
    previewUrl: 'https://tenor.com/test-preview.gif',
  });
  mockFetchMemeGifBuffer.mockResolvedValue(Buffer.from('fake-gif-data'));
  mockMemeToDataUri.mockReturnValue('data:image/gif;base64,ZmFrZS1naWYtZGF0YQ==');
  mockGetReactionQuery.mockReturnValue('shocked face reaction');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('enrichScenesWithMemes', () => {
  it('skips when no API key', async () => {
    const scenes = [
      makeScene({ type: 'intro', content: 'Hello', startFrame: 0, endFrame: 200 }),
      makeScene({ type: 'stat-callout', content: 'Big stat', startFrame: 200, endFrame: 400 }),
      makeScene({ type: 'outro', content: 'Bye', startFrame: 400, endFrame: 600 }),
    ];

    const result = await enrichScenesWithMemes(scenes, undefined);
    expect(result).toBe(scenes);
    expect(result.length).toBe(3);
  });

  it('skips when fewer than 3 scenes', async () => {
    const scenes = [
      makeScene({ type: 'intro', content: 'Hello', startFrame: 0, endFrame: 200 }),
      makeScene({ type: 'outro', content: 'Bye', startFrame: 200, endFrame: 400 }),
    ];

    const result = await enrichScenesWithMemes(scenes, 'test-key');
    expect(result.length).toBe(2);
  });

  it('inserts a meme scene at the correct position', async () => {
    setupMockMemeSuccess();

    const scenes = [
      makeScene({ type: 'intro', content: 'Hello', startFrame: 0, endFrame: 200 }),
      makeScene({
        type: 'stat-callout',
        content: 'The AI replaced 700 agents.',
        startFrame: 200,
        endFrame: 500,
      }),
      makeScene({ type: 'narration-default', content: 'Next scene.', startFrame: 500, endFrame: 800 }),
      makeScene({ type: 'outro', content: 'Bye', startFrame: 800, endFrame: 1000 }),
    ];

    // Only trigger meme after the stat-callout (index 1)
    mockSelectMemeReaction
      .mockReturnValueOnce(null) // intro — excluded by selector
      .mockReturnValueOnce({ reactionType: 'shocked', searchQuery: 'shocked face reaction' }) // stat-callout
      .mockReturnValueOnce(null); // narration

    const result = await enrichScenesWithMemes(scenes, 'test-key');

    // Should be 5 scenes now: intro, stat, meme, narration, outro
    expect(result.length).toBe(5);
    expect(result[0].type).toBe('intro');
    expect(result[1].type).toBe('stat-callout');
    expect(result[2].type).toBe('meme-reaction');
    expect(result[3].type).toBe('narration-default');
    expect(result[4].type).toBe('outro');
  });

  it('meme scene has correct visualData structure', async () => {
    setupMockMemeSuccess('mind_blown');

    const scenes = [
      makeScene({ type: 'intro', content: 'Hello', startFrame: 0, endFrame: 200 }),
      makeScene({
        type: 'stat-callout',
        content: 'Mind blown stat.',
        startFrame: 200,
        endFrame: 500,
      }),
      makeScene({ type: 'narration-default', content: 'Next.', startFrame: 500, endFrame: 800 }),
      makeScene({ type: 'outro', content: 'Bye', startFrame: 800, endFrame: 1000 }),
    ];

    mockSelectMemeReaction
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ reactionType: 'mind_blown', searchQuery: 'mind blown' })
      .mockReturnValueOnce(null);

    const result = await enrichScenesWithMemes(scenes, 'test-key');
    const meme = result.find((s) => s.type === 'meme-reaction');

    expect(meme).toBeDefined();
    const vd = meme!.visualData as Record<string, unknown>;
    expect(vd.gifSrc).toBe('data:image/gif;base64,ZmFrZS1naWYtZGF0YQ==');
    expect(vd.reactionType).toBe('mind_blown');
    expect(vd.description).toBe('Shocked face');
    expect(meme!.sfx).toEqual(['whoosh-in']);
  });

  it('shifts next scene startFrame by 36 frames', async () => {
    setupMockMemeSuccess();

    const scenes = [
      makeScene({ type: 'intro', content: 'Hello', startFrame: 0, endFrame: 200 }),
      makeScene({
        type: 'stat-callout',
        content: 'Shocking stat.',
        startFrame: 200,
        endFrame: 500,
      }),
      makeScene({ type: 'narration-default', content: 'Next.', startFrame: 500, endFrame: 800 }),
      makeScene({ type: 'outro', content: 'Bye', startFrame: 800, endFrame: 1000 }),
    ];

    mockSelectMemeReaction
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ reactionType: 'shocked', searchQuery: 'shocked face' })
      .mockReturnValueOnce(null);

    await enrichScenesWithMemes(scenes, 'test-key');

    // The narration scene should have been shifted forward by 36 frames
    const narration = scenes.find((s) => s.type === 'narration-default');
    expect(narration!.startFrame).toBe(536); // 500 + 36
  });

  it('enforces max 5 memes per video', async () => {
    setupMockMemeSuccess();

    // Create 12 scenes, all should trigger memes
    const scenes: Scene[] = [
      makeScene({ type: 'intro', content: 'Hello', startFrame: 0, endFrame: 200 }),
    ];

    for (let i = 1; i <= 10; i++) {
      scenes.push(
        makeScene({
          type: 'stat-callout',
          content: `Stat ${i}: staggering numbers.`,
          startFrame: i * 300,
          endFrame: (i + 1) * 300,
        }),
      );
    }
    scenes.push(
      makeScene({ type: 'outro', content: 'Bye', startFrame: 3300, endFrame: 3500 }),
    );

    // selectMemeReaction returns a selection for every non-intro scene
    mockSelectMemeReaction.mockImplementation((_text, type) => {
      if (type === 'intro' || type === 'outro') return null;
      return { reactionType: 'shocked', searchQuery: 'shocked face' };
    });

    const result = await enrichScenesWithMemes(scenes, 'test-key');

    const memeScenes = result.filter((s) => s.type === 'meme-reaction');
    expect(memeScenes.length).toBeLessThanOrEqual(5);
  });

  it('does not insert meme when GIF fetch fails', async () => {
    mockSelectMemeReaction.mockReturnValue({
      reactionType: 'shocked',
      searchQuery: 'shocked face',
    });
    mockSearchMeme.mockResolvedValue(null);
    mockGetReactionQuery.mockReturnValue('shocked face');

    const scenes = [
      makeScene({ type: 'intro', content: 'Hello', startFrame: 0, endFrame: 200 }),
      makeScene({ type: 'stat-callout', content: 'Big stat.', startFrame: 200, endFrame: 500 }),
      makeScene({ type: 'narration-default', content: 'Next.', startFrame: 500, endFrame: 800 }),
      makeScene({ type: 'outro', content: 'Bye', startFrame: 800, endFrame: 1000 }),
    ];

    const result = await enrichScenesWithMemes(scenes, 'test-key');

    // No memes should be inserted since all fetches failed
    const memes = result.filter((s) => s.type === 'meme-reaction');
    expect(memes.length).toBe(0);
  });

  it('does not insert meme when next scene is too short', async () => {
    // selectMemeReaction is only called when next-scene duration check passes.
    // Scene layout: intro(200f) → stat(300f) → short(100f) → outro(200f)
    // The stat's next scene (short, 100f) fails the duration check (< 156),
    // so selectMemeReaction is never called for stat. It IS called for intro
    // (next is stat, 300f > 156) and for short (next is outro, 200f > 156).
    mockSelectMemeReaction.mockReturnValue(null);

    const scenes = [
      makeScene({ type: 'intro', content: 'Hello', startFrame: 0, endFrame: 200 }),
      makeScene({
        type: 'stat-callout',
        content: 'Staggering stat.',
        startFrame: 200,
        endFrame: 500,
      }),
      // Next scene is only 100 frames — too short to borrow from
      makeScene({ type: 'narration-default', content: 'Short.', startFrame: 500, endFrame: 600 }),
      makeScene({ type: 'outro', content: 'Bye', startFrame: 600, endFrame: 800 }),
    ];

    const result = await enrichScenesWithMemes(scenes, 'test-key');
    const memes = result.filter((s) => s.type === 'meme-reaction');
    expect(memes.length).toBe(0);
    // Verify selectMemeReaction was NOT called for the stat scene (index 1)
    // It was called for intro (i=0) and narration (i=2), but not stat (i=1)
    expect(mockSelectMemeReaction).toHaveBeenCalledTimes(2);
  });
});
