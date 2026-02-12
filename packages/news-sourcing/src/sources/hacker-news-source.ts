import { NewsSource, NewsItem } from '../types.js';
import { withRetry, logger, CostTracker, NexusError } from '@nexus-ai/core';

interface HNStory {
  id: number;
  title: string;
  url?: string;
  by: string;
  score?: number;
  descendants?: number;
  time: number;
  type: string;
}

export class HackerNewsSource implements NewsSource {
  name = 'hacker-news';
  authorityWeight = 0.7;
  private readonly topStoriesEndpoint = 'https://hacker-news.firebaseio.com/v0/topstories.json';
  private readonly itemEndpoint = 'https://hacker-news.firebaseio.com/v0/item';

  // AI/ML keyword filters
  private readonly titleKeywords = [
    'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'agi',
    'gpt', 'llm', 'language model', 'transformer', 'neural network', 'diffusion',
    'reinforcement learning', 'rlhf', 'fine-tuning', 'prompt engineering',
    'computer vision', 'nlp', 'natural language', 'speech recognition', 'tts',
    'openai', 'anthropic', 'claude', 'chatgpt', 'gemini', 'llama', 'mistral'
  ];

  private readonly domainKeywords = [
    'openai.com', 'anthropic.com', 'huggingface.co', 'arxiv.org',
    'ai.meta.com', 'deepmind.com', 'google.com/ai',
    'research.google', 'ai.facebook.com'
  ];

  async fetch(pipelineId: string): Promise<NewsItem[]> {
    const tracker = new CostTracker(pipelineId, 'news-sourcing');

    logger.info({ source: this.name }, 'Fetching from Hacker News');

    try {
      // Fetch top story IDs
      const { result: storyIds } = await withRetry(
        async () => {
          try {
            const res = await fetch(this.topStoriesEndpoint, {
              signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
              if (res.status === 429 || res.status >= 500) {
                throw NexusError.retryable(
                  'NEXUS_NEWS_SOURCE_FAILED',
                  `Hacker News API error: ${res.status} ${res.statusText}`,
                  'news-sourcing',
                  { source: 'hacker-news' }
                );
              }

              if (res.status === 404) {
                logger.warn({ status: 404 }, 'Hacker News top stories endpoint not found');
                return [];
              }

              throw NexusError.retryable(
                'NEXUS_NEWS_SOURCE_FAILED',
                `Hacker News API returned ${res.status}`,
                'news-sourcing',
                { source: 'hacker-news' }
              );
            }

            tracker.recordApiCall('hacker-news-api', {}, 0);

            const data = await res.json().catch(err => {
              throw NexusError.critical(
                'NEXUS_NEWS_SOURCE_FAILED',
                `Failed to parse Hacker News response: ${err.message}`,
                'news-sourcing',
                { source: 'hacker-news' }
              );
            });

            if (!Array.isArray(data)) {
              throw NexusError.critical(
                'NEXUS_NEWS_SOURCE_FAILED',
                'Hacker News response is not an array',
                'news-sourcing',
                { source: 'hacker-news' }
              );
            }

            return data as number[];

          } catch (error) {
            if (error instanceof NexusError) throw error;
            throw NexusError.retryable(
              'NEXUS_NEWS_SOURCE_FAILED',
              `Network error fetching Hacker News: ${(error as Error).message}`,
              'news-sourcing',
              { source: 'hacker-news' }
            );
          }
        },
        { maxRetries: 3, stage: 'news-sourcing' }
      );

      // Handle 404 case where we returned empty array
      if (Array.isArray(storyIds) && storyIds.length === 0) return [];

      // Fetch story details until we have 10 relevant items
      const relevantItems: NewsItem[] = [];
      const maxToCheck = Math.min(30, (storyIds as number[]).length); // Check top 30 stories (need only 10)

      for (let i = 0; i < maxToCheck && relevantItems.length < 10; i++) {
        const storyId = (storyIds as number[])[i];
        const story = await this.fetchStoryDetails(storyId, tracker);

        if (story && this.isRelevant(story) && this.isFresh(story.time)) {
          const newsItem = this.mapToNewsItem(story);
          relevantItems.push(newsItem);
        }
      }

      logger.info({
        count: relevantItems.length,
        source: this.name
      }, 'Fetched Hacker News stories');

      return relevantItems;

    } catch (error) {
      logger.error({ error }, 'Failed to fetch from Hacker News');
      throw error;
    }
  }

  private async fetchStoryDetails(storyId: number, tracker: CostTracker): Promise<HNStory | null> {
    try {
      const { result: story } = await withRetry(
        async () => {
          try {
            const res = await fetch(`${this.itemEndpoint}/${storyId}.json`, {
              signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) {
              if (res.status === 429 || res.status >= 500) {
                throw NexusError.retryable(
                  'NEXUS_NEWS_SOURCE_FAILED',
                  `Hacker News item API error: ${res.status}`,
                  'news-sourcing',
                  { source: 'hacker-news', storyId }
                );
              }

              // Skip this story if not found
              if (res.status === 404) {
                logger.warn({ storyId }, 'Story not found');
                return null;
              }

              throw NexusError.retryable(
                'NEXUS_NEWS_SOURCE_FAILED',
                `Hacker News item API returned ${res.status}`,
                'news-sourcing',
                { source: 'hacker-news', storyId }
              );
            }

            tracker.recordApiCall('hacker-news-api', {}, 0);

            const data = await res.json().catch(err => {
              logger.warn({ storyId, error: err.message }, 'Failed to parse story JSON');
              return null;
            });

            return data as HNStory;

          } catch (error) {
            if (error instanceof NexusError) throw error;
            // Network errors - retry
            throw NexusError.retryable(
              'NEXUS_NEWS_SOURCE_FAILED',
              `Network error fetching story: ${(error as Error).message}`,
              'news-sourcing',
              { source: 'hacker-news', storyId }
            );
          }
        },
        { maxRetries: 3, stage: 'news-sourcing' }
      );

      return story;

    } catch (error) {
      // Log and skip this story
      logger.warn({ storyId, error }, 'Failed to fetch story details');
      return null;
    }
  }

  private isRelevant(story: HNStory): boolean {
    // Only accept story type
    if (story.type !== 'story') return false;

    // Check title keywords (case-insensitive)
    const lowerTitle = story.title.toLowerCase();
    const hasTitleKeyword = this.titleKeywords.some(keyword =>
      lowerTitle.includes(keyword.toLowerCase())
    );

    if (hasTitleKeyword) return true;

    // Check domain keywords
    if (story.url) {
      const lowerUrl = story.url.toLowerCase();
      const hasDomainKeyword = this.domainKeywords.some(domain =>
        lowerUrl.includes(domain.toLowerCase())
      );

      if (hasDomainKeyword) return true;
    }

    return false;
  }

  private isFresh(time: number): boolean {
    const storyDate = new Date(time * 1000);
    const now = new Date();

    // Validate date
    if (isNaN(storyDate.getTime())) {
      logger.warn({ time }, 'Invalid story time');
      return false;
    }

    const hoursSince = (now.getTime() - storyDate.getTime()) / (1000 * 60 * 60);
    return hoursSince <= 48 && hoursSince >= 0;
  }

  private mapToNewsItem(story: HNStory): NewsItem {
    // Calculate virality score with null safety
    const score = story.score || 0;
    const descendants = story.descendants || 0;
    const viralityScore = Math.max(0, score + (descendants * 0.5));

    // Construct HN discussion URL
    const hnUrl = `https://news.ycombinator.com/item?id=${story.id}`;

    // Convert Unix timestamp to ISO string
    const publishedAt = new Date(story.time * 1000).toISOString();

    return {
      title: story.title,
      url: story.url || hnUrl, // Use HN URL if no external URL
      source: this.name,
      publishedAt,
      viralityScore,
      metadata: {
        author: story.by,
        commentCount: descendants,
        hnUrl
      }
    };
  }
}
