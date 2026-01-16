import { describe, it, expect } from 'vitest';
import {
  calculateFreshnessScore,
  sortNewsItems,
  MIN_HOURS,
  PENALTY_24H,
  PENALTY_48H,
  FALLBACK_AGE_HOURS,
} from './scoring.js';
import type { NewsItem } from './types.js';

describe('calculateFreshnessScore', () => {
  const baseItem: NewsItem = {
    title: 'Test Article',
    url: 'https://example.com/article',
    source: 'test-source',
    publishedAt: new Date('2026-01-16T10:00:00Z').toISOString(),
    viralityScore: 100,
  };

  const authorityWeight = 0.8;

  describe('Basic calculation', () => {
    it('should calculate score using formula (viralityScore * authorityWeight) / hoursSincePublish', () => {
      // Published 2 hours ago
      const executionTime = new Date('2026-01-16T12:00:00Z').getTime();
      const score = calculateFreshnessScore(baseItem, authorityWeight, executionTime);

      // Expected: (100 * 0.8) / 2 = 40
      expect(score).toBe(40);
    });

    it('should round score to 2 decimal places', () => {
      // Published 3 hours ago
      const executionTime = new Date('2026-01-16T13:00:00Z').getTime();
      const score = calculateFreshnessScore(baseItem, authorityWeight, executionTime);

      // Expected: (100 * 0.8) / 3 = 26.666... → 26.67
      expect(score).toBe(26.67);
    });
  });

  describe('Time clamping', () => {
    it('should clamp hoursSincePublish to minimum 1 hour', () => {
      // Published 0.5 hours ago (30 minutes)
      const executionTime = new Date('2026-01-16T10:30:00Z').getTime();
      const score = calculateFreshnessScore(baseItem, authorityWeight, executionTime);

      // Should use MIN_HOURS (1) instead of 0.5
      // Expected: (100 * 0.8) / 1 = 80
      expect(score).toBe(80);
    });

    it('should treat immediate (0 hours) as 1 hour minimum', () => {
      // Published at exact execution time
      const executionTime = new Date('2026-01-16T10:00:00Z').getTime();
      const score = calculateFreshnessScore(baseItem, authorityWeight, executionTime);

      // Expected: (100 * 0.8) / 1 = 80
      expect(score).toBe(80);
    });
  });

  describe('Age penalties', () => {
    it('should apply 0.5x penalty for items > 24 hours old', () => {
      // Published 25 hours ago
      const executionTime = new Date('2026-01-17T11:00:00Z').getTime();
      const score = calculateFreshnessScore(baseItem, authorityWeight, executionTime);

      // Expected: ((100 * 0.8) / 25) * 0.5 = 1.6
      expect(score).toBe(1.6);
    });

    it('should apply 0.1x penalty for items > 48 hours old', () => {
      // Published 50 hours ago
      const executionTime = new Date('2026-01-18T12:00:00Z').getTime();
      const score = calculateFreshnessScore(baseItem, authorityWeight, executionTime);

      // Expected: ((100 * 0.8) / 50) * 0.1 = 0.16
      expect(score).toBe(0.16);
    });

    it('should not apply penalty for items exactly 24 hours old', () => {
      // Published exactly 24 hours ago
      const executionTime = new Date('2026-01-17T10:00:00Z').getTime();
      const score = calculateFreshnessScore(baseItem, authorityWeight, executionTime);

      // Expected: (100 * 0.8) / 24 = 3.33 (no penalty since not > 24)
      expect(score).toBe(3.33);
    });

    it('should not apply 48h penalty for items exactly 48 hours old', () => {
      // Published exactly 48 hours ago
      const executionTime = new Date('2026-01-18T10:00:00Z').getTime();
      const score = calculateFreshnessScore(baseItem, authorityWeight, executionTime);

      // Expected: ((100 * 0.8) / 48) * 0.5 = 0.83 (only 24h penalty)
      expect(score).toBe(0.83);
    });
  });

  describe('Edge cases - Future dates', () => {
    it('should treat items with future publishedAt as immediate (0 hours)', () => {
      const futureItem: NewsItem = {
        ...baseItem,
        publishedAt: new Date('2026-01-16T14:00:00Z').toISOString(),
      };

      // Execution time is before published time
      const executionTime = new Date('2026-01-16T12:00:00Z').getTime();
      const score = calculateFreshnessScore(futureItem, authorityWeight, executionTime);

      // Future dates treated as 0 hours, clamped to MIN_HOURS (1)
      // Expected: (100 * 0.8) / 1 = 80
      expect(score).toBe(80);
    });
  });

  describe('Edge cases - Missing publishedAt', () => {
    it('should handle missing publishedAt as 25h old with penalty', () => {
      const itemWithoutDate: NewsItem = {
        ...baseItem,
        publishedAt: '', // Missing/empty
      };

      const score = calculateFreshnessScore(itemWithoutDate, authorityWeight);

      // Expected: ((100 * 0.8) / 25) * 0.5 = 1.6
      expect(score).toBe(1.6);
    });

    it('should handle undefined publishedAt as 25h old', () => {
      const itemWithoutDate: NewsItem = {
        ...baseItem,
        publishedAt: undefined as any,
      };

      const score = calculateFreshnessScore(itemWithoutDate, authorityWeight);

      // Expected: ((100 * 0.8) / 25) * 0.5 = 1.6
      expect(score).toBe(1.6);
    });
  });

  describe('Edge cases - Zero values', () => {
    it('should return 0 for zero viralityScore', () => {
      const zeroViralityItem: NewsItem = {
        ...baseItem,
        viralityScore: 0,
      };

      const executionTime = new Date('2026-01-16T12:00:00Z').getTime();
      const score = calculateFreshnessScore(zeroViralityItem, authorityWeight, executionTime);

      expect(score).toBe(0);
    });

    it('should return 0 for zero authorityWeight', () => {
      const executionTime = new Date('2026-01-16T12:00:00Z').getTime();
      const score = calculateFreshnessScore(baseItem, 0, executionTime);

      expect(score).toBe(0);
    });

    it('should return 0 for both zero viralityScore and authorityWeight', () => {
      const zeroViralityItem: NewsItem = {
        ...baseItem,
        viralityScore: 0,
      };

      const executionTime = new Date('2026-01-16T12:00:00Z').getTime();
      const score = calculateFreshnessScore(zeroViralityItem, 0, executionTime);

      expect(score).toBe(0);
    });
  });

  describe('Real-world scenarios', () => {
    it('should score fresh high-value item highly', () => {
      const freshViralItem: NewsItem = {
        title: 'Breaking AI News',
        url: 'https://example.com/breaking',
        source: 'high-authority',
        publishedAt: new Date('2026-01-16T11:00:00Z').toISOString(),
        viralityScore: 500,
      };

      // Published 1 hour ago
      const executionTime = new Date('2026-01-16T12:00:00Z').getTime();
      const score = calculateFreshnessScore(freshViralItem, 0.9, executionTime);

      // Expected: (500 * 0.9) / 1 = 450
      expect(score).toBe(450);
    });

    it('should score old viral item lower due to age penalty', () => {
      const oldViralItem: NewsItem = {
        title: 'Old Viral News',
        url: 'https://example.com/old',
        source: 'high-authority',
        publishedAt: new Date('2026-01-14T12:00:00Z').toISOString(),
        viralityScore: 500,
      };

      // Published 48.5 hours ago
      const executionTime = new Date('2026-01-16T12:30:00Z').getTime();
      const score = calculateFreshnessScore(oldViralItem, 0.9, executionTime);

      // Expected: ((500 * 0.9) / 48.5) * 0.1 = 0.93
      expect(score).toBe(0.93);
    });

    it('should score fresh obscure item moderately', () => {
      const freshObscureItem: NewsItem = {
        title: 'Niche Topic',
        url: 'https://example.com/niche',
        source: 'low-authority',
        publishedAt: new Date('2026-01-16T11:30:00Z').toISOString(),
        viralityScore: 10,
      };

      // Published 0.5 hours ago (clamped to 1)
      const executionTime = new Date('2026-01-16T12:00:00Z').getTime();
      const score = calculateFreshnessScore(freshObscureItem, 0.3, executionTime);

      // Expected: (10 * 0.3) / 1 = 3
      expect(score).toBe(3);
    });
  });
});

describe('sortNewsItems', () => {
  const executionTime = new Date('2026-01-16T12:00:00Z').getTime();

  const items: NewsItem[] = [
    {
      title: 'Old Viral',
      url: 'https://example.com/1',
      source: 'source-a',
      publishedAt: new Date('2026-01-15T12:00:00Z').toISOString(), // 24h ago
      viralityScore: 200,
    },
    {
      title: 'Fresh Viral',
      url: 'https://example.com/2',
      source: 'source-a',
      publishedAt: new Date('2026-01-16T11:00:00Z').toISOString(), // 1h ago
      viralityScore: 150,
    },
    {
      title: 'Very Old',
      url: 'https://example.com/3',
      source: 'source-b',
      publishedAt: new Date('2026-01-14T12:00:00Z').toISOString(), // 48h ago
      viralityScore: 300,
    },
    {
      title: 'Fresh Low Viral',
      url: 'https://example.com/4',
      source: 'source-c',
      publishedAt: new Date('2026-01-16T11:30:00Z').toISOString(), // 0.5h ago
      viralityScore: 50,
    },
  ];

  const getAuthorityWeight = (item: NewsItem): number => {
    // Mock authority weights by source
    const weights: Record<string, number> = {
      'source-a': 0.8,
      'source-b': 0.7,
      'source-c': 0.6,
    };
    return weights[item.source] || 0.5;
  };

  it('should sort items by freshness score descending', () => {
    const sorted = sortNewsItems(items, getAuthorityWeight, executionTime);

    // Verify order by checking titles
    expect(sorted[0].title).toBe('Fresh Viral'); // Highest score
    expect(sorted[sorted.length - 1].title).toBe('Very Old'); // Lowest score due to 48h penalty
  });

  it('should return a new array without modifying original', () => {
    const originalOrder = items.map((i) => i.title);
    const sorted = sortNewsItems(items, getAuthorityWeight, executionTime);

    // Original should be unchanged
    expect(items.map((i) => i.title)).toEqual(originalOrder);

    // Sorted should be different
    expect(sorted.map((i) => i.title)).not.toEqual(originalOrder);
  });

  it('should handle empty array', () => {
    const sorted = sortNewsItems([], getAuthorityWeight, executionTime);
    expect(sorted).toEqual([]);
  });

  it('should handle single item', () => {
    const singleItem = [items[0]];
    const sorted = sortNewsItems(singleItem, getAuthorityWeight, executionTime);

    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toEqual(items[0]);
  });

  it('should sort items with same score consistently', () => {
    const duplicates: NewsItem[] = [
      {
        title: 'Item A',
        url: 'https://example.com/a',
        source: 'source-a',
        publishedAt: new Date('2026-01-16T11:00:00Z').toISOString(),
        viralityScore: 100,
      },
      {
        title: 'Item B',
        url: 'https://example.com/b',
        source: 'source-a',
        publishedAt: new Date('2026-01-16T11:00:00Z').toISOString(),
        viralityScore: 100,
      },
    ];

    const sorted = sortNewsItems(duplicates, getAuthorityWeight, executionTime);

    // Both should have same score
    const scoreA = calculateFreshnessScore(sorted[0], getAuthorityWeight(sorted[0]), executionTime);
    const scoreB = calculateFreshnessScore(sorted[1], getAuthorityWeight(sorted[1]), executionTime);
    expect(scoreA).toBe(scoreB);
  });

  it('should calculate scores correctly for verification', () => {
    const sorted = sortNewsItems(items, getAuthorityWeight, executionTime);

    // Verify first item has highest score
    const scores = sorted.map((item) =>
      calculateFreshnessScore(item, getAuthorityWeight(item), executionTime)
    );

    // Each score should be >= the next
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  });
});

describe('Constants', () => {
  it('should export correct constant values', () => {
    expect(MIN_HOURS).toBe(1.0);
    expect(PENALTY_24H).toBe(0.5);
    expect(PENALTY_48H).toBe(0.1);
    expect(FALLBACK_AGE_HOURS).toBe(25);
  });
});
