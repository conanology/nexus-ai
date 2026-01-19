/**
 * Integration tests for Twitter package
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeTwitter, postTweet } from '../twitter.js';
import { createTwitterClient } from '../client.js';
import type { TwitterStageInput } from '../types.js';

// Mock modules
vi.mock('../client.js', () => ({
  createTwitterClient: vi.fn(),
}));

vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual('@nexus-ai/core');
  return {
    ...actual,
    withRetry: vi.fn(async (fn) => {
      const result = await fn();
      return { result, attempts: 1, totalDelayMs: 0 };
    }),
    logger: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    FirestoreClient: vi.fn(() => ({
      updateDocument: vi.fn().mockResolvedValue(undefined),
    })),
    NexusError: {
      retryable: vi.fn((code, message, stage) => new Error(message)),
      critical: vi.fn((code, message, stage) => new Error(message)),
    },
  };
});

describe('postTweet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should post tweet and return tweet URL', async () => {
    // Mock Twitter API client
    const mockTweet = vi.fn().mockResolvedValue({
      data: { id: '1234567890' },
    });

    const mockClient = {
      v2: { tweet: mockTweet },
    };

    vi.mocked(createTwitterClient).mockResolvedValue(mockClient as any);

    // Execute
    const result = await postTweet(
      'https://youtube.com/watch?v=abc',
      'Test Video'
    );

    // Verify
    expect(result).toEqual({
      tweetId: '1234567890',
      tweetUrl: 'https://twitter.com/i/web/status/1234567890',
    });

    expect(mockTweet).toHaveBeenCalledWith(
      expect.stringContaining('Test Video')
    );
    expect(mockTweet).toHaveBeenCalledWith(
      expect.stringContaining('https://youtube.com/watch?v=abc')
    );
  });

  it('should use formatted tweet text', async () => {
    const mockTweet = vi.fn().mockResolvedValue({
      data: { id: 'test123' },
    });

    const mockClient = {
      v2: { tweet: mockTweet },
    };

    vi.mocked(createTwitterClient).mockResolvedValue(mockClient as any);

    await postTweet('https://youtube.com/watch?v=test', 'AI News');

    const expectedText = 'AI News 🎬\n\nWatch now: https://youtube.com/watch?v=test\n\n#AI #MachineLearning';
    expect(mockTweet).toHaveBeenCalledWith(expectedText);
  });

  it('should handle long titles by truncating', async () => {
    const mockTweet = vi.fn().mockResolvedValue({
      data: { id: 'test456' },
    });

    const mockClient = {
      v2: { tweet: mockTweet },
    };

    vi.mocked(createTwitterClient).mockResolvedValue(mockClient as any);

    const longTitle = 'A'.repeat(300);
    await postTweet('https://youtube.com/watch?v=test', longTitle);

    const [calledWith] = mockTweet.mock.calls[0];
    expect(calledWith.length).toBeLessThanOrEqual(280);
    expect(calledWith).toContain('...');
  });

  it('should throw error if Twitter API returns invalid response', async () => {
    const mockTweet = vi.fn().mockResolvedValue({
      data: null, // Invalid response
    });

    const mockClient = {
      v2: { tweet: mockTweet },
    };

    vi.mocked(createTwitterClient).mockResolvedValue(mockClient as any);

    await expect(
      postTweet('https://youtube.com/watch?v=test', 'Test')
    ).rejects.toThrow();
  });

  it('should handle rate limit errors with proper error code', async () => {
    const rateLimitError = Object.assign(new Error('Rate limit exceeded'), {
      code: 429,
      rateLimit: {
        reset: Math.floor(Date.now() / 1000) + 900, // 15 min from now
      },
    });

    const mockTweet = vi.fn().mockRejectedValue(rateLimitError);

    const mockClient = {
      v2: { tweet: mockTweet },
    };

    vi.mocked(createTwitterClient).mockResolvedValue(mockClient as any);

    await expect(
      postTweet('https://youtube.com/watch?v=test', 'Test')
    ).rejects.toThrow();
  });

  it('should use correct tweet URL format', async () => {
    const mockTweet = vi.fn().mockResolvedValue({
      data: { id: 'abc123xyz' },
    });

    const mockClient = {
      v2: { tweet: mockTweet },
    };

    vi.mocked(createTwitterClient).mockResolvedValue(mockClient as any);

    const result = await postTweet('https://youtube.com/watch?v=test', 'Test');

    // Should use /i/web/status/ format, not /user/status/
    expect(result.tweetUrl).toBe('https://twitter.com/i/web/status/abc123xyz');
    expect(result.tweetUrl).not.toContain('/user/status/');
  });
});

describe('executeTwitter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute Twitter stage successfully', async () => {
    // Mock Twitter API client
    const mockTweet = vi.fn().mockResolvedValue({
      data: { id: 'tweet123' },
    });

    const mockClient = {
      v2: { tweet: mockTweet },
    };

    vi.mocked(createTwitterClient).mockResolvedValue(mockClient as any);

    // Create input
    const input: TwitterStageInput = {
      pipelineId: '2026-01-19',
      previousStage: 'youtube',
      data: {
        videoUrl: 'https://youtube.com/watch?v=abc123',
        title: 'Amazing AI Breakthrough',
      },
      config: {},
    };

    // Execute
    const result = await executeTwitter(input);

    // Verify
    expect(result.success).toBe(true);
    expect(result.data.posted).toBe(true);
    expect(result.data.tweetUrl).toBe('https://twitter.com/i/web/status/tweet123');
    expect(result.quality.measurements.twitterPosted).toBe(true);
  });

  it('should handle Twitter failures gracefully (RECOVERABLE)', async () => {
    // Mock Twitter API failure
    vi.mocked(createTwitterClient).mockRejectedValue(
      new Error('Twitter API unavailable')
    );

    const input: TwitterStageInput = {
      pipelineId: '2026-01-19',
      previousStage: 'youtube',
      data: {
        videoUrl: 'https://youtube.com/watch?v=abc123',
        title: 'Test Video',
      },
      config: {},
    };

    // Execute - should NOT throw
    const result = await executeTwitter(input);

    // Verify failure is handled gracefully
    expect(result.success).toBe(false);
    expect(result.data.posted).toBe(false);
    expect(result.quality.measurements.twitterPosted).toBe(false);
    expect(result.warnings).toBeDefined();
    expect(result.warnings?.length).toBeGreaterThan(0);
  });

  it('should store tweet data to Firestore on success', async () => {
    const mockUpdateDocument = vi.fn().mockResolvedValue(undefined);
    const MockFirestore = vi.fn(() => ({
      updateDocument: mockUpdateDocument,
    }));

    // Override Firestore mock for this test
    const { FirestoreClient } = await import('@nexus-ai/core');
    vi.mocked(FirestoreClient).mockImplementation(MockFirestore as any);

    const mockTweet = vi.fn().mockResolvedValue({
      data: { id: 'stored123' },
    });

    const mockClient = {
      v2: { tweet: mockTweet },
    };

    vi.mocked(createTwitterClient).mockResolvedValue(mockClient as any);

    const input: TwitterStageInput = {
      pipelineId: '2026-01-19',
      previousStage: 'youtube',
      data: {
        videoUrl: 'https://youtube.com/watch?v=test',
        title: 'Test',
      },
      config: {},
    };

    await executeTwitter(input);

    // Verify Firestore update was called
    expect(mockUpdateDocument).toHaveBeenCalledWith(
      'pipelines/2026-01-19',
      'twitter',
      expect.objectContaining({
        tweetUrl: 'https://twitter.com/i/web/status/stored123',
        videoUrl: 'https://youtube.com/watch?v=test',
        postedAt: expect.any(String),
      })
    );
  });

  it('should include cost tracking (free within rate limits)', async () => {
    const mockTweet = vi.fn().mockResolvedValue({
      data: { id: 'cost123' },
    });

    const mockClient = {
      v2: { tweet: mockTweet },
    };

    vi.mocked(createTwitterClient).mockResolvedValue(mockClient as any);

    const input: TwitterStageInput = {
      pipelineId: '2026-01-19',
      previousStage: 'youtube',
      data: {
        videoUrl: 'https://youtube.com/watch?v=test',
        title: 'Test',
      },
      config: {},
    };

    const result = await executeTwitter(input);

    expect(result.cost.totalCost).toBe(0);
    expect(result.provider.name).toBe('twitter-api-v2');
    expect(result.provider.tier).toBe('primary');
  });

  it('should validate pipelineId format (YYYY-MM-DD)', async () => {
    const mockTweet = vi.fn().mockResolvedValue({
      data: { id: 'test123' },
    });

    const mockClient = {
      v2: { tweet: mockTweet },
    };

    vi.mocked(createTwitterClient).mockResolvedValue(mockClient as any);

    const invalidInput: TwitterStageInput = {
      pipelineId: 'invalid-id',
      previousStage: 'youtube',
      data: {
        videoUrl: 'https://youtube.com/watch?v=test',
        title: 'Test',
      },
      config: {},
    };

    await expect(executeTwitter(invalidInput)).rejects.toThrow('Invalid pipelineId format');
  });

  it('should handle Firestore errors gracefully without failing stage', async () => {
    const mockTweet = vi.fn().mockResolvedValue({
      data: { id: 'firestore123' },
    });

    const mockClient = {
      v2: { tweet: mockTweet },
    };

    vi.mocked(createTwitterClient).mockResolvedValue(mockClient as any);

    // Mock Firestore to throw error
    const mockUpdateDocument = vi.fn().mockRejectedValue(new Error('Firestore unavailable'));
    const MockFirestore = vi.fn(() => ({
      updateDocument: mockUpdateDocument,
    }));

    const { FirestoreClient } = await import('@nexus-ai/core');
    vi.mocked(FirestoreClient).mockImplementation(MockFirestore as any);

    const input: TwitterStageInput = {
      pipelineId: '2026-01-19',
      previousStage: 'youtube',
      data: {
        videoUrl: 'https://youtube.com/watch?v=test',
        title: 'Test',
      },
      config: {},
    };

    // Should still succeed even if Firestore fails
    const result = await executeTwitter(input);

    expect(result.success).toBe(true);
    expect(result.data.posted).toBe(true);
    expect(mockTweet).toHaveBeenCalled();
  });
});
