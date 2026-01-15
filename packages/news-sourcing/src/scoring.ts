import { NewsItem } from './types.js';

/**
 * Calculates a final score for a news item based on freshness and virality.
 * Formula: (viralityScore * authorityWeight) / hoursSincePublish
 *
 * Penalties:
 * - > 24 hours: 0.5x multiplier
 * - > 48 hours: 0.1x multiplier
 */
export function calculateFreshnessScore(item: NewsItem, authorityWeight: number = 0.5): number {
  const publishedDate = new Date(item.publishedAt);
  const now = new Date();
  
  // Calculate hours since publish, minimum 1 hour to avoid division issues
  const hoursSincePublish = Math.max(1, (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60));
  
  let score = (item.viralityScore * authorityWeight) / hoursSincePublish;

  // Apply age penalties per PRD/Architecture requirements
  if (hoursSincePublish > 48) {
    score *= 0.1;
  } else if (hoursSincePublish > 24) {
    score *= 0.5;
  }

  return score;
}
