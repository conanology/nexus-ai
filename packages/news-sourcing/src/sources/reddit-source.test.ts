import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedditSource } from './reddit-source.js';
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
      debug: vi.fn(),
    },
    CostTracker: vi.fn(() => ({
      recordApiCall: vi.fn(),
    })),
    NexusError: MockNexusError
  };
});

describe('RedditSource', () => {
  let source: RedditSource;
  const originalEnv = process.env;

  beforeEach(() => {
    source = new RedditSource();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-16T12:00:00Z')); // Set current time for freshness tests

    // Mock environment variables
    process.env = {
      ...originalEnv,
      NEXUS_REDDIT_CLIENT_ID: 'test-client-id',
      NEXUS_REDDIT_CLIENT_SECRET: 'test-client-secret'
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    process.env = originalEnv;
  });

  it('should implement NewsSource interface with correct properties', () => {
    expect(source.name).toBe('reddit');
    expect(source.authorityWeight).toBe(0.6);
    expect(typeof source.fetch).toBe('function');
  });

  it('should fetch and filter posts from r/MachineLearning', async () => {
    const now = Math.floor(Date.now() / 1000);

    // Mock token endpoint
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      // Mock hot posts endpoint
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  title: 'New research on transformers',
                  url: 'https://arxiv.org/abs/12345',
                  permalink: '/r/MachineLearning/comments/abc/new_research',
                  score: 150,
                  upvote_ratio: 0.95,
                  num_comments: 42,
                  num_crossposts: 2,
                  created_utc: now - 3600,
                  link_flair_text: '[Research]',
                  stickied: false,
                  is_self: false
                }
              },
              {
                data: {
                  title: 'Off-topic post',
                  url: 'https://example.com/offtopic',
                  permalink: '/r/MachineLearning/comments/def/offtopic',
                  score: 80,
                  upvote_ratio: 0.8,
                  num_comments: 10,
                  num_crossposts: 0,
                  created_utc: now - 7200,
                  link_flair_text: '[Discussion]',
                  stickied: false,
                  is_self: false
                }
              },
              {
                data: {
                  title: 'Cool ML project',
                  url: 'https://github.com/user/ml-project',
                  permalink: '/r/MachineLearning/comments/ghi/cool_project',
                  score: 200,
                  upvote_ratio: 0.92,
                  num_comments: 55,
                  num_crossposts: 5,
                  created_utc: now - 10800,
                  link_flair_text: '[Project]',
                  stickied: false,
                  is_self: false
                }
              }
            ]
          }
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(2); // Only Research and Project flairs
    expect(items[0].title).toBe('New research on transformers');
    expect(items[1].title).toBe('Cool ML project');
  });

  it('should calculate virality score correctly', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  title: 'Test post',
                  url: 'https://example.com/test',
                  permalink: '/r/MachineLearning/comments/test',
                  score: 100,
                  upvote_ratio: 0.9,
                  num_comments: 50,
                  created_utc: now - 3600,
                  link_flair_text: '[Research]',
                  stickied: false,
                  is_self: false
                }
              }
            ]
          }
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(1);
    // viralityScore = (score * ratio) + (comments * 0.5) = (100 * 0.9) + (50 * 0.5) = 90 + 25 = 115
    expect(items[0].viralityScore).toBe(115);
  });

  it('should handle missing score, upvote_ratio, and num_comments fields', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  title: 'Test post',
                  url: 'https://example.com/test',
                  permalink: '/r/MachineLearning/comments/test',
                  created_utc: now - 3600,
                  link_flair_text: '[News]',
                  stickied: false,
                  is_self: false
                }
              }
            ]
          }
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(1);
    // viralityScore = (0 * 0.5) + (0 * 0.5) = 0
    expect(items[0].viralityScore).toBe(0);
  });

  it('should filter posts older than 48 hours', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  title: 'Fresh post',
                  url: 'https://example.com/fresh',
                  permalink: '/r/MachineLearning/comments/fresh',
                  score: 100,
                  upvote_ratio: 0.9,
                  num_comments: 20,
                  created_utc: now - 3600,
                  link_flair_text: '[Research]',
                  stickied: false,
                  is_self: false
                }
              },
              {
                data: {
                  title: 'Old post',
                  url: 'https://example.com/old',
                  permalink: '/r/MachineLearning/comments/old',
                  score: 150,
                  upvote_ratio: 0.95,
                  num_comments: 30,
                  created_utc: now - (50 * 3600), // 50 hours old
                  link_flair_text: '[Research]',
                  stickied: false,
                  is_self: false
                }
              }
            ]
          }
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Fresh post');
  });

  it('should filter out stickied posts', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  title: 'Normal post',
                  url: 'https://example.com/normal',
                  permalink: '/r/MachineLearning/comments/normal',
                  score: 100,
                  upvote_ratio: 0.9,
                  num_comments: 20,
                  created_utc: now - 3600,
                  link_flair_text: '[Research]',
                  stickied: false,
                  is_self: false
                }
              },
              {
                data: {
                  title: 'Stickied announcement',
                  url: 'https://example.com/sticky',
                  permalink: '/r/MachineLearning/comments/sticky',
                  score: 150,
                  upvote_ratio: 0.95,
                  num_comments: 30,
                  created_utc: now - 7200,
                  link_flair_text: '[Research]',
                  stickied: true, // Stickied - should be filtered out
                  is_self: false
                }
              }
            ]
          }
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Normal post');
  });

  it('should filter by allowed flairs (Research, Project, News)', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  title: 'Research post',
                  url: 'https://example.com/research',
                  permalink: '/r/MachineLearning/comments/research',
                  score: 100,
                  upvote_ratio: 0.9,
                  num_comments: 20,
                  created_utc: now - 3600,
                  link_flair_text: '[Research]',
                  stickied: false,
                  is_self: false
                }
              },
              {
                data: {
                  title: 'Discussion post',
                  url: 'https://example.com/discussion',
                  permalink: '/r/MachineLearning/comments/discussion',
                  score: 150,
                  upvote_ratio: 0.95,
                  num_comments: 30,
                  created_utc: now - 7200,
                  link_flair_text: '[Discussion]',
                  stickied: false,
                  is_self: false
                }
              },
              {
                data: {
                  title: 'Project post',
                  url: 'https://example.com/project',
                  permalink: '/r/MachineLearning/comments/project',
                  score: 120,
                  upvote_ratio: 0.88,
                  num_comments: 25,
                  created_utc: now - 10800,
                  link_flair_text: '[Project]',
                  stickied: false,
                  is_self: false
                }
              }
            ]
          }
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(2);
    expect(items[0].title).toBe('Research post');
    expect(items[1].title).toBe('Project post');
  });

  it('should perform case-insensitive flair matching', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  title: 'Post with lowercase flair',
                  url: 'https://example.com/lowercase',
                  permalink: '/r/MachineLearning/comments/lowercase',
                  score: 100,
                  upvote_ratio: 0.9,
                  num_comments: 20,
                  created_utc: now - 3600,
                  link_flair_text: 'research', // Lowercase
                  stickied: false,
                  is_self: false
                }
              },
              {
                data: {
                  title: 'Post with mixed case flair',
                  url: 'https://example.com/mixed',
                  permalink: '/r/MachineLearning/comments/mixed',
                  score: 120,
                  upvote_ratio: 0.92,
                  num_comments: 25,
                  created_utc: now - 7200,
                  link_flair_text: 'PrOjEcT', // Mixed case
                  stickied: false,
                  is_self: false
                }
              }
            ]
          }
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(2);
    expect(items[0].title).toBe('Post with lowercase flair');
    expect(items[1].title).toBe('Post with mixed case flair');
  });

  it('should include metadata fields', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  title: 'Test post',
                  url: 'https://example.com/test',
                  permalink: '/r/MachineLearning/comments/abc/test_post',
                  score: 100,
                  upvote_ratio: 0.9,
                  num_comments: 42,
                  num_crossposts: 12,
                  created_utc: now - 3600,
                  link_flair_text: '[Research]',
                  stickied: false,
                  is_self: false
                }
              }
            ]
          }
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items[0].metadata?.flair).toBe('[Research]');
    expect(items[0].metadata?.commentCount).toBe(42);
    expect(items[0].metadata?.upvoteRatio).toBe(0.9);
    expect(items[0].metadata?.crosspostCount).toBe(12); // Added crosspostCount
    expect(items[0].metadata?.permalink).toBe('https://www.reddit.com/r/MachineLearning/comments/abc/test_post');
  });

  it('should use Reddit discussion URL for self posts', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  title: 'Self post discussion',
                  url: 'https://www.reddit.com/r/MachineLearning/comments/abc/self_post',
                  permalink: '/r/MachineLearning/comments/abc/self_post',
                  score: 100,
                  upvote_ratio: 0.9,
                  num_comments: 50,
                  created_utc: now - 3600,
                  link_flair_text: '[Research]',
                  stickied: false,
                  is_self: true // Self post
                }
              }
            ]
          }
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(1);
    expect(items[0].url).toBe('https://www.reddit.com/r/MachineLearning/comments/abc/self_post');
  });

  it('should cache access token', async () => {
    const now = Math.floor(Date.now() / 1000);

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { children: [] }
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { children: [] }
        })
      } as Response);

    // First fetch - should get token
    await source.fetch('test-pipeline-id-1');

    // Second fetch - should reuse cached token
    await source.fetch('test-pipeline-id-2');

    // Token endpoint should only be called once
    expect(fetchSpy).toHaveBeenCalledTimes(3); // 1 token + 2 hot posts
  });

  it('should handle 401 error by clearing token cache', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response);

    await expect(source.fetch('test-pipeline-id')).rejects.toThrow('RETRYABLE');
    expect(logger.warn).toHaveBeenCalledWith({}, 'Reddit token expired, clearing cache');
  });

  it('should handle 429 rate limiting as retryable', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as Response);

    await expect(source.fetch('test-pipeline-id')).rejects.toThrow('RETRYABLE');
  });

  it('should handle 500 error as retryable', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

    await expect(source.fetch('test-pipeline-id')).rejects.toThrow('RETRYABLE');
  });

  it('should limit results to 10 items maximum', async () => {
    const now = Math.floor(Date.now() / 1000);

    const children = Array.from({ length: 15 }, (_, i) => ({
      data: {
        title: `Research post ${i + 1}`,
        url: `https://example.com/post${i}`,
        permalink: `/r/MachineLearning/comments/post${i}`,
        score: 100 + i,
        upvote_ratio: 0.9,
        num_comments: 20,
        created_utc: now - 3600,
        link_flair_text: '[Research]',
        stickied: false,
        is_self: false
      }
    }));

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { children }
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(10);
  });

  it('should throw critical error when credentials are missing', async () => {
    delete process.env.NEXUS_REDDIT_CLIENT_ID;
    delete process.env.NEXUS_REDDIT_CLIENT_SECRET;

    await expect(source.fetch('test-pipeline-id')).rejects.toThrow('CRITICAL');
    expect(NexusError.critical).toHaveBeenCalledWith(
      'NEXUS_REDDIT_API_ERROR',
      expect.stringContaining('Reddit credentials not configured'),
      'news-sourcing',
      expect.objectContaining({ source: 'reddit' })
    );
  });

  it('should filter posts without flair', async () => {
    const now = Math.floor(Date.now() / 1000);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  title: 'Post with flair',
                  url: 'https://example.com/withflair',
                  permalink: '/r/MachineLearning/comments/withflair',
                  score: 100,
                  upvote_ratio: 0.9,
                  num_comments: 20,
                  created_utc: now - 3600,
                  link_flair_text: '[Research]',
                  stickied: false,
                  is_self: false
                }
              },
              {
                data: {
                  title: 'Post without flair',
                  url: 'https://example.com/noflair',
                  permalink: '/r/MachineLearning/comments/noflair',
                  score: 150,
                  upvote_ratio: 0.95,
                  num_comments: 30,
                  created_utc: now - 7200,
                  link_flair_text: null, // No flair
                  stickied: false,
                  is_self: false
                }
              }
            ]
          }
        })
      } as Response);

    const items = await source.fetch('test-pipeline-id');

    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Post with flair');
  });
});
