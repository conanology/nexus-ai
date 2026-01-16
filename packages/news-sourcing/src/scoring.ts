import { NewsItem } from './types.js';

/**
 * Constants for scoring algorithm
 */
export const MIN_HOURS = 1.0;
export const PENALTY_24H = 0.5;
export const PENALTY_48H = 0.1;
export const FALLBACK_AGE_HOURS = 25; // For items with missing publishedAt to ensure >24h penalty

/**
 * Calculates a final score for a news item based on freshness and virality.
 * Formula: (viralityScore * authorityWeight) / hoursSincePublish
 *
 * Penalties:
 * - > 24 hours: 0.5x multiplier
 * - > 48 hours: 0.1x multiplier
 *
 * Edge cases:
 * - Future dates: treated as 0 hours (immediate)
 * - Missing publishedAt: treated as 25h old (triggers 0.5x penalty)
 * - Zero virality or authority: returns 0
 *
 * @param item - The news item to score
 * @param authorityWeight - The authority weight of the source (0-1)
 * @param executionTime - Optional execution time (defaults to Date.now())
 * @returns Freshness score rounded to 2 decimal places
 */
export function calculateFreshnessScore(
  item: NewsItem,
  authorityWeight: number,
  executionTime?: number
): number {
  // Handle zero virality or authority edge case
  if (item.viralityScore === 0 || authorityWeight === 0) {
    return 0;
  }

  const now = executionTime !== undefined ? executionTime : Date.now();

  // Handle missing publishedAt - treat as 25h old
  if (!item.publishedAt) {
    const ageInHours = FALLBACK_AGE_HOURS;
    let score = (item.viralityScore * authorityWeight) / ageInHours;

    // Apply penalty for being > 24h
    score *= PENALTY_24H;

    return Math.round(score * 100) / 100;
  }

  const publishedDate = new Date(item.publishedAt);

  // Calculate hours since publish
  let hoursSincePublish = (now - publishedDate.getTime()) / (1000 * 60 * 60);

  // Handle future dates - treat as immediate (0 hours)
  if (hoursSincePublish < 0) {
    hoursSincePublish = 0;
  }

  // Clamp to minimum 1 hour to avoid division by zero or inflated scores
  const clampedHours = Math.max(MIN_HOURS, hoursSincePublish);

  // Calculate base score
  let score = (item.viralityScore * authorityWeight) / clampedHours;

  // Apply age penalties per PRD/Architecture requirements
  if (clampedHours > 48) {
    score *= PENALTY_48H;
  } else if (clampedHours > 24) {
    score *= PENALTY_24H;
  }

  // Round to 2 decimal places for reasonable precision
  return Math.round(score * 100) / 100;
}

/**
 * Sorts an array of NewsItem objects by freshness score in descending order.
 * Returns a new array without modifying the original.
 *
 * Note: This function requires authorityWeight for each item. In practice, use
 * this with a map of source names to authority weights, or extend NewsItem
 * to include the weight.
 *
 * @param items - Array of news items to sort
 * @param getAuthorityWeight - Function to get authority weight for an item
 * @param executionTime - Optional execution time (defaults to Date.now())
 * @returns New array sorted by freshness score descending
 */
export function sortNewsItems(
  items: NewsItem[],
  getAuthorityWeight: (item: NewsItem) => number,
  executionTime?: number
): NewsItem[] {
  return [...items].sort((a, b) => {
    const scoreA = calculateFreshnessScore(a, getAuthorityWeight(a), executionTime);
    const scoreB = calculateFreshnessScore(b, getAuthorityWeight(b), executionTime);
    return scoreB - scoreA; // Descending order
  });
}
