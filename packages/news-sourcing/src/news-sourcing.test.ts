import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { executeNewsSourcing, selectTopic } from './news-sourcing.js';
import { StageInput, FirestoreClient } from '@nexus-ai/core';
import { NewsSourcingConfig, NewsItem } from './types.js';

// Mock FirestoreClient
vi.mock('@nexus-ai/core', async () => {
  const actual = await vi.importActual('@nexus-ai/core') as any;
  return {
    ...actual,
    FirestoreClient: vi.fn().mockImplementation(() => ({
      setDocument: vi.fn().mockResolvedValue(undefined),
      getDocument: vi.fn().mockResolvedValue(undefined),
      updateDocument: vi.fn().mockResolvedValue(undefined),
      queryDocuments: vi.fn().mockResolvedValue([]),
    })),
  };
});

beforeAll(() => {
  process.env.NEXUS_PROJECT_ID = 'test-project';
  process.env.NEXUS_REDDIT_CLIENT_ID = 'mock-client-id';
  process.env.NEXUS_REDDIT_CLIENT_SECRET = 'mock-client-secret';
});

describe('executeNewsSourcing', () => {
  const mockInput: StageInput<NewsSourcingConfig> = {
    pipelineId: '2026-01-16',
    previousStage: null,
    data: {
      enabledSources: ['hacker-news', 'reddit'],
      minViralityScore: 0,
    },
    config: {
      timeout: 30000,
      retries: 3,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch news, select topic, and persist to Firestore', async () => {
    // Mock global fetch for HN and Reddit
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      
      // HN top stories
      if (urlStr.includes('topstories.json')) {
        return {
          ok: true,
          json: async () => [1, 2, 3, 4, 5],
        } as Response;
      }
      
      // HN item details
      if (urlStr.includes('v0/item/')) {
        const id = urlStr.match(/v0\/item\/(\d+)\.json/)?.[1];
        return {
          ok: true,
          json: async () => ({
            id: Number(id),
            title: `AI Story ${id} (gpt)`,
            type: 'story',
            by: `author-${id}`,
            time: Math.floor(Date.now() / 1000) - 3600,
            score: 100 + Number(id),
            url: `https://example.com/ai-${id}`,
          }),
        } as Response;
      }

      // Reddit token
      if (urlStr.includes('api/v1/access_token')) {
        return {
          ok: true,
          json: async () => ({
            access_token: 'mock-token',
            expires_in: 3600,
            token_type: 'bearer',
          }),
        } as Response;
      }

      // Reddit hot posts
      if (urlStr.includes('reddit.com')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              children: [
                {
                  data: {
                    title: 'Reddit AI Paper 1 [Research]',
                    url: 'https://reddit.com/r/ml/1',
                    created_utc: Math.floor(Date.now() / 1000) - 7200,
                    score: 500,
                    num_comments: 50,
                    link_flair_text: 'Research',
                  }
                },
                {
                  data: {
                    title: 'Reddit AI Project 2 [Project]',
                    url: 'https://reddit.com/r/ml/2',
                    created_utc: Math.floor(Date.now() / 1000) - 14400,
                    score: 300,
                    num_comments: 30,
                    link_flair_text: 'Project',
                  }
                }
              ]
            }
          }),
        } as Response;
      }

      return { ok: false, status: 404 } as Response;
    });

    const result = await executeNewsSourcing(mockInput);

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalled();

    // Verify topic selection result structure
    expect(result.data.selectionTime).toBeDefined();
    expect(result.data.candidates).toBeDefined();
    expect(Array.isArray(result.data.candidates)).toBe(true);

    // Verify fallback field exists
    expect(typeof result.data.fallback).toBe('boolean');

    // If not fallback, should have selected topic
    if (!result.data.fallback) {
      expect(result.data.selected).toBeDefined();
      expect(result.data.selected?.title).toBeDefined();
      expect(result.data.selected?.url).toBeDefined();
      expect(result.data.candidates.length).toBeGreaterThanOrEqual(3);
    } else {
      // Fallback case
      expect(result.data.selected).toBeNull();
      expect(result.data.deepDiveCandidates).toBeDefined();
    }

    // Verify StageOutput structure (AC7)
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.cost).toBeDefined();
    expect(result.quality).toBeDefined();
    expect(result.provider).toBeDefined();
  }, 60000); // 60s timeout for integration test
});

describe('selectTopic', () => {
  const now = new Date('2026-01-16T12:00:00Z').getTime();
  const getWeight = () => 0.5;

  const createNewsItem = (overrides: Partial<NewsItem> = {}): NewsItem => ({
    title: 'Test Article',
    url: 'https://example.com/test',
    source: 'test-source',
    publishedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    viralityScore: 100,
    ...overrides,
  });

  describe('AC1: Top Topic Selection', () => {
    it('should select the single highest-scored news item', () => {
      const items: NewsItem[] = [
        createNewsItem({ title: 'Low Score', viralityScore: 50 }),
        createNewsItem({ title: 'Highest Score', viralityScore: 200 }),
        createNewsItem({ title: 'Medium Score', viralityScore: 100 }),
      ];

      const result = selectTopic(items, getWeight, now);

      expect(result.selected).toBeDefined();
      expect(result.selected?.title).toBe('Highest Score');
    });

    it('should select based on calculated freshness score, not raw virality', () => {
      const items: NewsItem[] = [
        // Older item with high virality
        createNewsItem({
          title: 'Old High Virality',
          viralityScore: 500,
          publishedAt: new Date(now - 20 * 60 * 60 * 1000).toISOString(), // 20h ago
        }),
        // Recent item with lower virality (should win due to freshness)
        createNewsItem({
          title: 'Recent Medium Virality',
          viralityScore: 200,
          publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
        }),
        // Another recent item to meet minimum threshold
        createNewsItem({
          title: 'Another Recent Item',
          viralityScore: 150,
          publishedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
        }),
      ];

      const result = selectTopic(items, getWeight, now);

      expect(result.selected?.title).toBe('Recent Medium Virality');
    });
  });

  describe('AC2: Minimum Viable Topics Validation', () => {
    it('should succeed when exactly 3 viable candidates exist', () => {
      const items: NewsItem[] = [
        createNewsItem({ title: 'Item 1' }),
        createNewsItem({ title: 'Item 2' }),
        createNewsItem({ title: 'Item 3' }),
      ];

      const result = selectTopic(items, getWeight, now);

      expect(result.selected).toBeDefined();
      expect(result.candidates).toHaveLength(3);
    });

    it('should succeed when more than 3 viable candidates exist', () => {
      const items: NewsItem[] = [
        createNewsItem({ title: 'Item 1' }),
        createNewsItem({ title: 'Item 2' }),
        createNewsItem({ title: 'Item 3' }),
        createNewsItem({ title: 'Item 4' }),
        createNewsItem({ title: 'Item 5' }),
      ];

      const result = selectTopic(items, getWeight, now);

      expect(result.selected).toBeDefined();
      expect(result.candidates.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('AC3: Fallback Logic', () => {
    it('should trigger fallback when fewer than 3 viable candidates exist', () => {
      const items: NewsItem[] = [
        createNewsItem({ title: 'Item 1' }),
        createNewsItem({ title: 'Item 2' }),
      ];

      const result = selectTopic(items, getWeight, now);

      expect(result.fallback).toBe(true);
      expect(result.selected).toBeNull();
    });

    it('should trigger fallback when no candidates exist', () => {
      const items: NewsItem[] = [];

      const result = selectTopic(items, getWeight, now);

      expect(result.fallback).toBe(true);
      expect(result.selected).toBeNull();
    });

    it('should identify deep dive topics (>48 hours old) for fallback', () => {
      const items: NewsItem[] = [
        // Recent items (insufficient count)
        createNewsItem({
          title: 'Recent 1',
          publishedAt: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
        }),
        // Old items that could be deep dive candidates
        createNewsItem({
          title: 'Deep Dive Candidate 1',
          publishedAt: new Date(now - 60 * 60 * 60 * 1000).toISOString(), // 60h ago
          viralityScore: 300,
        }),
        createNewsItem({
          title: 'Deep Dive Candidate 2',
          publishedAt: new Date(now - 72 * 60 * 60 * 1000).toISOString(), // 72h ago
          viralityScore: 250,
        }),
      ];

      const result = selectTopic(items, getWeight, now);

      expect(result.fallback).toBe(true);
      expect(result.deepDiveCandidates).toBeDefined();
      expect(result.deepDiveCandidates!.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle items with missing publishedAt timestamps', () => {
      const items: NewsItem[] = [
        createNewsItem({ title: 'Valid Item 1' }),
        createNewsItem({ title: 'Missing Timestamp', publishedAt: '' }),
        createNewsItem({ title: 'Valid Item 2' }),
        createNewsItem({ title: 'Valid Item 3' }),
      ];

      const result = selectTopic(items, getWeight, now);

      // Should still select a topic if >= 3 valid items
      expect(result.selected).toBeDefined();
    });

    it('should handle zero virality scores', () => {
      const items: NewsItem[] = [
        createNewsItem({ title: 'Zero Virality', viralityScore: 0 }),
        createNewsItem({ title: 'Normal Item 1', viralityScore: 100 }),
        createNewsItem({ title: 'Normal Item 2', viralityScore: 150 }),
        createNewsItem({ title: 'Normal Item 3', viralityScore: 120 }),
      ];

      const result = selectTopic(items, getWeight, now);

      expect(result.selected).toBeDefined();
      expect(result.selected?.viralityScore).toBeGreaterThan(0);
    });
  });
});
