/**
 * Types for the News Sourcing package
 */

export interface NewsItem {
  /** Title of the news article */
  title: string;
  /** URL to the article */
  url: string;
  /** Name of the news source */
  source: string;
  /** ISO 8601 UTC timestamp of publication */
  publishedAt: string;
  /** Score representing the virality/popularity of the item */
  viralityScore: number;
  /** Additional source-specific metadata */
  metadata?: Record<string, unknown>;
}

export interface NewsSource {
  /** Unique name of the source */
  name: string;
  /** Initial authority weight for scoring (0-1) */
  authorityWeight: number;
  /** Fetch items from this source */
  fetch(pipelineId: string): Promise<NewsItem[]>;
}

export interface NewsSourcingConfig {
  /** List of source names to enable */
  enabledSources: string[];
  /** Minimum virality score to include an item */
  minViralityScore?: number;
  /** Max age of items in hours */
  maxAgeHours?: number;
}

/**
 * Data structure for News Sourcing output
 */
export interface NewsSourcingData {
  /** All fetched and scored news items */
  items: NewsItem[];
  /** Count of items fetched per source */
  sourceCounts: Record<string, number>;
}
