import { NewsSource, NewsItem } from '../types.js';
import { withRetry, logger, CostTracker, NexusError } from '@nexus-ai/core';

interface RedditPost {
  title: string;
  url: string;
  permalink: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  num_crossposts: number;
  created_utc: number;
  link_flair_text: string | null;
  stickied: boolean;
  is_self: boolean;
}

interface RedditApiResponse {
  data: {
    children: Array<{
      data: RedditPost;
    }>;
  };
}

interface RedditTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class RedditSource implements NewsSource {
  name = 'reddit';
  authorityWeight = 0.6;

  private token: string | null = null;
  private tokenExpiry: number = 0;

  private readonly tokenEndpoint = 'https://www.reddit.com/api/v1/access_token';
  private readonly hotPostsEndpoint = 'https://oauth.reddit.com/r/MachineLearning/hot';
  private readonly userAgent = 'nexus-ai/1.0';

  private readonly allowedFlairs = ['research', 'project', 'news'];

  async fetch(pipelineId: string): Promise<NewsItem[]> {
    const tracker = new CostTracker(pipelineId, 'news-sourcing');

    logger.info({ source: this.name }, 'Fetching from Reddit r/MachineLearning');

    try {
      // Fetch hot posts (handles token acquisition internally)
      const posts = await this.fetchHotPosts(tracker);

      // Filter and map posts
      const relevantItems: NewsItem[] = [];

      for (const post of posts) {
        if (this.isRelevant(post) && this.isFresh(post) && relevantItems.length < 10) {
          const newsItem = this.mapToNewsItem(post);
          relevantItems.push(newsItem);
        }
      }

      logger.info({
        count: relevantItems.length,
        source: this.name
      }, 'Fetched Reddit posts');

      return relevantItems;

    } catch (error) {
      logger.error({ error }, 'Failed to fetch from Reddit');
      throw error;
    }
  }

  private async getAccessToken(tracker: CostTracker): Promise<string> {
    // Check if we have a valid cached token
    const now = Date.now();
    if (this.token && this.tokenExpiry > now) {
      logger.debug({ expiresIn: this.tokenExpiry - now }, 'Using cached Reddit token');
      return this.token;
    }

    logger.info({}, 'Fetching new Reddit access token');

    const { result: tokenData } = await withRetry(
      async () => {
        try {
          const clientId = process.env.NEXUS_REDDIT_CLIENT_ID;
          const clientSecret = process.env.NEXUS_REDDIT_CLIENT_SECRET;

          if (!clientId || !clientSecret) {
            throw NexusError.critical(
              'NEXUS_REDDIT_API_ERROR',
              'Reddit credentials not configured (NEXUS_REDDIT_CLIENT_ID, NEXUS_REDDIT_CLIENT_SECRET)',
              'news-sourcing',
              { source: 'reddit' }
            );
          }

          // Create Basic Auth credentials
          const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

          const res = await fetch(this.tokenEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': this.userAgent
            },
            body: 'grant_type=client_credentials'
          });

          if (!res.ok) {
            if (res.status === 429 || res.status >= 500) {
              throw NexusError.retryable(
                'NEXUS_REDDIT_API_ERROR',
                `Reddit token API error: ${res.status} ${res.statusText}`,
                'news-sourcing',
                { source: 'reddit', endpoint: 'token' }
              );
            }

            // 401 likely means bad credentials
            if (res.status === 401) {
              throw NexusError.critical(
                'NEXUS_REDDIT_API_ERROR',
                'Reddit authentication failed - check credentials',
                'news-sourcing',
                { source: 'reddit', status: 401 }
              );
            }

            throw NexusError.retryable(
              'NEXUS_REDDIT_API_ERROR',
              `Reddit token API returned ${res.status}`,
              'news-sourcing',
              { source: 'reddit', endpoint: 'token' }
            );
          }

          tracker.recordApiCall('reddit-api', {}, 0);

          const data = await res.json().catch(err => {
            throw NexusError.critical(
              'NEXUS_REDDIT_API_ERROR',
              `Failed to parse Reddit token response: ${err.message}`,
              'news-sourcing',
              { source: 'reddit' }
            );
          }) as RedditTokenResponse;

          if (!data.access_token) {
            throw NexusError.critical(
              'NEXUS_REDDIT_API_ERROR',
              'Reddit token response missing access_token',
              'news-sourcing',
              { source: 'reddit' }
            );
          }

          return data;

        } catch (error) {
          if (error instanceof NexusError) throw error;
          throw NexusError.retryable(
            'NEXUS_REDDIT_API_ERROR',
            `Network error fetching Reddit token: ${(error as Error).message}`,
            'news-sourcing',
            { source: 'reddit' }
          );
        }
      },
      { maxRetries: 3, stage: 'news-sourcing' }
    );

    // Cache token
    this.token = tokenData.access_token;
    // Set expiry to 5 minutes before actual expiry to be safe
    this.tokenExpiry = Date.now() + ((tokenData.expires_in - 300) * 1000);

    logger.info({ expiresIn: tokenData.expires_in }, 'Reddit token acquired');

    return this.token;
  }

  private async fetchHotPosts(tracker: CostTracker): Promise<RedditPost[]> {
    const { result: posts } = await withRetry(
      async () => {
        try {
          const accessToken = await this.getAccessToken(tracker);

          const res = await fetch(`${this.hotPostsEndpoint}?limit=50`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'User-Agent': this.userAgent
            }
          });

          if (!res.ok) {
            // 401 might mean token expired - clear cache and throw retryable error
            if (res.status === 401) {
              logger.warn({}, 'Reddit token expired, clearing cache');
              this.token = null;
              this.tokenExpiry = 0;

              throw NexusError.retryable(
                'NEXUS_REDDIT_API_ERROR',
                'Reddit token expired or invalid',
                'news-sourcing',
                { source: 'reddit', status: 401 }
              );
            }

            if (res.status === 429 || res.status >= 500) {
              throw NexusError.retryable(
                'NEXUS_REDDIT_API_ERROR',
                `Reddit API error: ${res.status} ${res.statusText}`,
                'news-sourcing',
                { source: 'reddit', endpoint: 'hot' }
              );
            }

            throw NexusError.retryable(
              'NEXUS_REDDIT_API_ERROR',
              `Reddit API returned ${res.status}`,
              'news-sourcing',
              { source: 'reddit', endpoint: 'hot' }
            );
          }

          tracker.recordApiCall('reddit-api', {}, 0);

          const data = await res.json().catch(err => {
            throw NexusError.critical(
              'NEXUS_REDDIT_API_ERROR',
              `Failed to parse Reddit posts response: ${err.message}`,
              'news-sourcing',
              { source: 'reddit' }
            );
          }) as RedditApiResponse;

          if (!data?.data?.children || !Array.isArray(data.data.children)) {
            throw NexusError.critical(
              'NEXUS_REDDIT_API_ERROR',
              'Reddit response has unexpected structure',
              'news-sourcing',
              { source: 'reddit' }
            );
          }

          return data.data.children.map(child => child.data);

        } catch (error) {
          if (error instanceof NexusError) throw error;
          throw NexusError.retryable(
            'NEXUS_REDDIT_API_ERROR',
            `Network error fetching Reddit posts: ${(error as Error).message}`,
            'news-sourcing',
            { source: 'reddit' }
          );
        }
      },
      { maxRetries: 3, stage: 'news-sourcing' }
    );

    return posts;
  }

  private isRelevant(post: RedditPost): boolean {
    // Filter out stickied posts (rules, megathreads)
    if (post.stickied) {
      return false;
    }

    // Check flair (case-insensitive partial match)
    const flair = post.link_flair_text?.toLowerCase() || '';
    if (!flair) {
      return false; // Require flair
    }

    const hasAllowedFlair = this.allowedFlairs.some(allowedFlair =>
      flair.includes(allowedFlair)
    );

    return hasAllowedFlair;
  }

  private isFresh(post: RedditPost): boolean {
    const postDate = new Date(post.created_utc * 1000);
    const now = new Date();

    // Validate date
    if (isNaN(postDate.getTime())) {
      logger.warn({ time: post.created_utc }, 'Invalid post time');
      return false;
    }

    const hoursSince = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);

    // Filter posts older than 48 hours
    return hoursSince <= 48 && hoursSince >= 0;
  }

  private mapToNewsItem(post: RedditPost): NewsItem {
    // Calculate virality score with null safety
    const score = post.score || 0;
    const ratio = post.upvote_ratio || 0.5; // Default to 0.5 if missing
    const comments = post.num_comments || 0;

    const viralityScore = Math.max(0, (score * ratio) + (comments * 0.5));

    // Determine URL - use external link if available, otherwise Reddit discussion
    const url = post.is_self
      ? `https://www.reddit.com${post.permalink}`
      : post.url;

    // Convert Unix timestamp to ISO string
    const publishedAt = new Date(post.created_utc * 1000).toISOString();

    return {
      title: post.title,
      url,
      source: this.name,
      publishedAt,
      viralityScore,
      metadata: {
        flair: post.link_flair_text,
        commentCount: comments,
        upvoteRatio: ratio,
        crosspostCount: post.num_crossposts || 0,
        permalink: `https://www.reddit.com${post.permalink}`
      }
    };
  }
}
