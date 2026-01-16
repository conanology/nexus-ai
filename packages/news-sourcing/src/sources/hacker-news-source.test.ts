import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HackerNewsSource } from './hacker-news-source.js';
import { logger, NexusError, CostTracker } from '@nexus-ai/core';

// Mock dependencies
vi.mock('@nexus-ai/core', () => {
  class MockNexusError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NexusError';
    }
    static retryable = vi.fn((code, msg) => new Error(`RETRYABLE: ${code} - ${msg}`));
    static critical = vi.fn((code, msg) => new Error(`CRITICAL: ${code} - ${msg}`));
  }

  return {
    withRetry: vi.fn(async (fn) => ({ result: await fn() })),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    CostTracker: vi.fn(() => ({
      recordApiCall: vi.fn(),
    })),
    NexusError: MockNexusError
  };
});

describe('HackerNewsSource', () => {
  let source: HackerNewsSource;

  beforeEach(() => {
    source = new HackerNewsSource();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-16T12:00:00Z')); // Set current time for freshness tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should implement NewsSource interface with correct properties', () => {
    expect(source.name).toBe('hacker-news');
    expect(source.authorityWeight).toBe(0.7);
    expect(typeof source.fetch).toBe('function');
  });

  it('should fetch and filter AI/ML stories from HN API', async () => {
    const now = Math.floor(Date.now() / 1000);

    // Mock top stories endpoint and individual stories
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [100, 101, 102]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 100,
          title: 'New GPT-4 breakthrough in AI',
          url: 'https://example.com/gpt4',
          by: 'user1',
          score: 150,
          descendants: 42,
          time: now - 3600,
          type: 'story'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 101,
          title: 'Cooking tips for beginners',
          url: 'https://example.com/cooking',
          by: 'user2',
          score: 80,
          descendants: 10,
          time: now - 7200,
          type: 'story'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 102,
          title: 'Machine Learning advances in healthcare',
          url: 'https://example.com/ml-health',
          by: 'user3',
          score: 200,
          descendants: 55,
          time: now - 10800,
          type: 'story'
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(10);

    // All items should be AI/ML related
    items.forEach(item => {
      const lowerTitle = item.title.toLowerCase();
      const hasAIKeyword = lowerTitle.includes('gpt') ||
                          lowerTitle.includes('ai') ||
                          lowerTitle.includes('machine learning') ||
                          lowerTitle.includes('ml');
      expect(hasAIKeyword).toBe(true);
    });
  });

  it('should calculate virality score correctly', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [100]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 100,
          title: 'AI breakthrough',
          url: 'https://example.com/ai',
          by: 'user1',
          score: 100,
          descendants: 50,
          time: now - 3600,
          type: 'story'
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(1);
    // viralityScore = score + (descendants * 0.5) = 100 + (50 * 0.5) = 125
    expect(items[0].viralityScore).toBe(125);
  });

  it('should handle missing score and descendants fields', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [100]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 100,
          title: 'AI news',
          url: 'https://example.com/ai',
          by: 'user1',
          time: now - 3600,
          type: 'story'
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(1);
    expect(items[0].viralityScore).toBe(0);
  });

  it('should filter stories older than 48 hours', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [100, 101]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 100,
          title: 'New AI model',
          url: 'https://example.com/ai',
          by: 'user1',
          score: 100,
          descendants: 20,
          time: now - 3600,
          type: 'story'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 101,
          title: 'Old GPT news',
          url: 'https://example.com/old',
          by: 'user2',
          score: 150,
          descendants: 30,
          time: now - (50 * 3600),
          type: 'story'
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('New AI model');
  });

  it('should include HN discussion URL in metadata', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [100]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 100,
          title: 'AI breakthrough',
          url: 'https://example.com/ai',
          by: 'testuser',
          score: 100,
          descendants: 25,
          time: now - 3600,
          type: 'story'
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items[0].metadata?.hnUrl).toBe('https://news.ycombinator.com/item?id=100');
    expect(items[0].metadata?.author).toBe('testuser');
    expect(items[0].metadata?.commentCount).toBe(25);
  });

  it('should handle 404 error gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith({ status: 404 }, 'Hacker News top stories endpoint not found');
  });

  it('should retry on 500 error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response);

    await expect(source.fetch('test-pipeline-id')).rejects.toThrow('RETRYABLE');
  });

  it('should handle rate limiting as retryable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests'
    } as Response);

    await expect(source.fetch('test-pipeline-id')).rejects.toThrow('RETRYABLE');
  });

  it('should limit results to 10 items maximum', async () => {
    const now = Math.floor(Date.now() / 1000);
    const storyIds = Array.from({ length: 15 }, (_, i) => i + 100);

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => storyIds
      } as Response);

    // Mock all 15 stories as AI-related
    storyIds.forEach((id, index) => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id,
          title: `AI story ${index + 1}`,
          url: `https://example.com/ai${index}`,
          by: 'user',
          score: 100 + index,
          descendants: 20,
          time: now - 3600,
          type: 'story'
        })
      } as Response);
    });

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(10);
  });

  it('should filter by AI/ML domain keywords', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [100, 101]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 100,
          title: 'Interesting article',
          url: 'https://openai.com/research/article',
          by: 'user1',
          score: 100,
          descendants: 20,
          time: now - 3600,
          type: 'story'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 101,
          title: 'Cooking recipes',
          url: 'https://example.com/cooking',
          by: 'user2',
          score: 150,
          descendants: 30,
          time: now - 3600,
          type: 'story'
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(1);
    expect(items[0].url).toContain('openai.com');
  });

  it('should handle stories without URL by using HN URL as fallback', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [100]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 100,
          title: 'Ask HN: What AI tools are you using?',
          // No URL field - Ask HN posts don't have external URLs
          by: 'user1',
          score: 100,
          descendants: 50,
          time: now - 3600,
          type: 'story'
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(1);
    expect(items[0].url).toBe('https://news.ycombinator.com/item?id=100');
    expect(items[0].title).toBe('Ask HN: What AI tools are you using?');
  });

  it('should handle malformed JSON in story details gracefully', async () => {
    const now = Math.floor(Date.now() / 1000);

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [100, 101]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Unexpected token in JSON');
        }
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 101,
          title: 'Valid AI story',
          url: 'https://example.com/ai',
          by: 'user2',
          score: 100,
          descendants: 20,
          time: now - 3600,
          type: 'story'
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    // Should skip the malformed story and continue with valid one
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Valid AI story');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ storyId: 100 }),
      'Failed to parse story JSON'
    );
  });
});
