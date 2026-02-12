/**
 * Screenshot Enricher Tests
 *
 * Tests scene enrichment with mocked screenshot service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the asset-library screenshot functions
vi.mock('@nexus-ai/asset-library', () => ({
  resolveScreenshotUrl: vi.fn((name: string) => {
    const map: Record<string, { url: string }> = {
      klarna: { url: 'https://www.klarna.com' },
      openai: { url: 'https://openai.com' },
      salesforce: { url: 'https://www.salesforce.com' },
      stripe: { url: 'https://stripe.com' },
      nvidia: { url: 'https://www.nvidia.com' },
      github: { url: 'https://github.com' },
      shopify: { url: 'https://www.shopify.com' },
    };
    const key = name.toLowerCase();
    return map[key] ?? null;
  }),
  captureWebsiteScreenshot: vi.fn(async () => {
    // Return a fake PNG buffer
    return Buffer.from('fake-screenshot-png-data');
  }),
  closeBrowser: vi.fn(async () => {}),
  screenshotToDataUri: vi.fn((buffer: Buffer) => {
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }),
}));

import { enrichScenesWithScreenshots } from '../screenshot-enricher.js';
import type { Scene } from '@nexus-ai/director-agent';
import {
  captureWebsiteScreenshot,
  closeBrowser,
} from '@nexus-ai/asset-library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScene(overrides: Partial<Scene> & Pick<Scene, 'id' | 'type' | 'content'>): Scene {
  return {
    startFrame: 0,
    endFrame: 150,
    visualData: {},
    transition: 'fade',
    ...overrides,
  } as Scene;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('enrichScenesWithScreenshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds screenshotImage to a stat-callout scene mentioning Klarna', async () => {
    const scenes = [
      makeScene({
        id: 'scene-1',
        type: 'stat-callout',
        content: 'Klarna replaced 700 agents with AI',
        visualData: { number: '700', label: 'agents replaced', countUp: true },
      }),
    ];

    await enrichScenesWithScreenshots(scenes);

    expect(scenes[0].screenshotImage).toBeDefined();
    expect(scenes[0].screenshotImage).toMatch(/^data:image\/png;base64,/);
    expect(captureWebsiteScreenshot).toHaveBeenCalledWith(
      'https://www.klarna.com',
      expect.objectContaining({ darkMode: true }),
    );
  });

  it('adds screenshotImage to a logo-showcase scene mentioning OpenAI', async () => {
    const scenes = [
      makeScene({
        id: 'scene-2',
        type: 'logo-showcase',
        content: 'Giants like OpenAI are leading the charge',
        visualData: { logos: [{ name: 'OpenAI' }], layout: 'sequential' },
      }),
    ];

    await enrichScenesWithScreenshots(scenes);

    expect(scenes[0].screenshotImage).toBeDefined();
    expect(captureWebsiteScreenshot).toHaveBeenCalled();
  });

  it('adds screenshotImage to narration-default with company mention', async () => {
    const scenes = [
      makeScene({
        id: 'scene-3',
        type: 'narration-default',
        content: 'Salesforce has been investing heavily in AI capabilities',
        visualData: { backgroundVariant: 'gradient' },
      }),
    ];

    await enrichScenesWithScreenshots(scenes);

    expect(scenes[0].screenshotImage).toBeDefined();
  });

  it('does NOT add screenshots to excluded scene types (intro, outro, code-block, meme-reaction, map-animation)', async () => {
    const scenes = [
      makeScene({
        id: 'scene-4',
        type: 'intro',
        content: 'Welcome to the show about Klarna',
        visualData: {},
      }),
      makeScene({
        id: 'scene-5',
        type: 'outro',
        content: 'Thanks for watching about Salesforce',
        visualData: {},
      }),
      makeScene({
        id: 'scene-6',
        type: 'code-block',
        content: 'OpenAI API example code',
        visualData: { code: 'const ai = new OpenAI();', language: 'javascript' },
      }),
    ];

    await enrichScenesWithScreenshots(scenes);

    expect(scenes[0].screenshotImage).toBeUndefined();
    expect(scenes[1].screenshotImage).toBeUndefined();
    expect(scenes[2].screenshotImage).toBeUndefined();
    expect(captureWebsiteScreenshot).not.toHaveBeenCalled();
  });

  it('limits to MAX 10 screenshots per video', async () => {
    const companies = ['Klarna', 'Salesforce', 'Stripe', 'NVIDIA', 'OpenAI', 'GitHub', 'Shopify'];
    const scenes = companies.map((name, i) =>
      makeScene({
        id: `scene-${i}`,
        type: 'stat-callout',
        content: `${name} saw massive growth this quarter`,
        visualData: { number: '100', label: `${name} growth`, countUp: true },
      }),
    );

    await enrichScenesWithScreenshots(scenes);

    const screenshotCount = scenes.filter((s) => s.screenshotImage).length;
    expect(screenshotCount).toBeLessThanOrEqual(10);
    // All 7 companies should get screenshots (under the new limit of 10)
    expect(captureWebsiteScreenshot).toHaveBeenCalledTimes(7);
  });

  it('preserves existing backgroundImage when screenshot fails', async () => {
    // Make capture return null for this test
    vi.mocked(captureWebsiteScreenshot).mockResolvedValueOnce(null);

    const scenes = [
      makeScene({
        id: 'scene-10',
        type: 'stat-callout',
        content: 'Klarna stats are impressive',
        visualData: { number: '700', label: 'agents', countUp: true },
        backgroundImage: 'data:image/png;base64,existing-ai-image',
      }),
    ];

    await enrichScenesWithScreenshots(scenes);

    // screenshotImage should NOT be set (capture failed)
    expect(scenes[0].screenshotImage).toBeUndefined();
    // Original backgroundImage should be preserved
    expect(scenes[0].backgroundImage).toBe('data:image/png;base64,existing-ai-image');
  });

  it('only captures once per company (no duplicates)', async () => {
    const scenes = [
      makeScene({
        id: 'scene-a',
        type: 'stat-callout',
        content: 'Klarna replaced 700 agents',
        visualData: { number: '700', label: 'agents', countUp: true },
      }),
      makeScene({
        id: 'scene-b',
        type: 'narration-default',
        content: 'Klarna continued to innovate',
        visualData: { backgroundVariant: 'gradient' },
      }),
    ];

    await enrichScenesWithScreenshots(scenes);

    // Only one screenshot for Klarna, not two
    const callCount = vi.mocked(captureWebsiteScreenshot).mock.calls.length;
    expect(callCount).toBe(1);
    expect(scenes[0].screenshotImage).toBeDefined();
    expect(scenes[1].screenshotImage).toBeUndefined();
  });

  it('does nothing when no company mentions found', async () => {
    const scenes = [
      makeScene({
        id: 'scene-x',
        type: 'narration-default',
        content: 'The future of artificial intelligence is bright',
        visualData: { backgroundVariant: 'gradient' },
      }),
    ];

    await enrichScenesWithScreenshots(scenes);

    expect(captureWebsiteScreenshot).not.toHaveBeenCalled();
    expect(scenes[0].screenshotImage).toBeUndefined();
  });

  it('always calls closeBrowser after processing', async () => {
    const scenes = [
      makeScene({
        id: 'scene-cleanup',
        type: 'stat-callout',
        content: 'Stripe processes billions in payments',
        visualData: { number: '1B', label: 'payments', suffix: '+' },
      }),
    ];

    await enrichScenesWithScreenshots(scenes);

    expect(closeBrowser).toHaveBeenCalled();
  });
});
